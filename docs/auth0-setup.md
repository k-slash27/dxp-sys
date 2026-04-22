# Auth0 セットアップ手順

## 概要

DXP システムは Auth0 SaaS を認証基盤として使用します。
frontend（地図閲覧）と operator（ファイル管理）は別々の Auth0 Application として登録します。

アクセス制御は **Permission ベース** で行います。ロール名ではなく「何ができるか」をトークンに付与することで、ロール追加時もコード変更なしに対応できます。

## ロール・パーミッション設計

### Permission 定義

| Permission | 意味 |
|---|---|
| `frontend:access` | frontend にログインできる |
| `frontend:manage_area` | 担当エリア管理・ユーザー管理・登録ができる |
| `frontend:admin` | 全エリア管理・admin ユーザー作成ができる |
| `operator:access` | operator にログインできる |

### ロールへの付与

| Auth0 ロール | Permissions |
|---|---|
| `ADMIN` | `frontend:access` + `frontend:manage_area` + `frontend:admin` + `operator:access` |
| `USER_manager` | `frontend:access` + `frontend:manage_area` |
| `USER_staff` | `frontend:access` |
| `USER` | `frontend:access` |
| `PARTNER` | `operator:access` |

### UI 表示名マッピング

| Auth0 ロール | UI 表示名 |
|---|---|
| `ADMIN` | admin |
| `USER_manager` | editor |
| `USER_staff` | viewer |
| `USER` | viewer |

### app_metadata スキーマ

```json
{
  "role": "ADMIN | USER_manager | USER_staff | USER | PARTNER",
  "workspaces": "* | kofu,demo | kofu",
  "primary_area": "kofu"
}
```

---

## 手順

### 1. Auth0 テナント作成

1. [Auth0 Dashboard](https://auth0.com/) にサインアップ / ログイン
2. テナントを作成（例: `dxp-yourorg`）

---

### 2. Resource Server（API）作成

アクセス制御に使う Permission を定義するための Resource Server を作成します。

1. `Applications` → `APIs` → `Create API`
2. 設定:
   - **Name**: `DXP API`
   - **Identifier**: `https://api.dxp/`
   - **Signing Algorithm**: `RS256`
3. `Permissions` タブで以下を追加:

| Permission | Description |
|---|---|
| `frontend:access` | frontend へのログイン |
| `frontend:manage_area` | エリア・ユーザー管理 |
| `frontend:admin` | 全エリア管理・admin 作成 |
| `operator:access` | operator へのログイン |

4. `Settings` タブ → **RBAC Settings** で以下を両方 ON にする:
   - **Enable RBAC**
   - **Add Permissions in the Access Token**

---

### 3. ロール作成と Permission 付与

1. `User Management` → `Roles` → `Create Role`
2. 以下のロールを作成し、それぞれに Permission を付与:

**ADMIN:**
- Permissions: `frontend:access`, `frontend:manage_area`, `frontend:admin`, `operator:access`

**USER_manager:**
- Permissions: `frontend:access`, `frontend:manage_area`

**USER_staff:**
- Permissions: `frontend:access`

**USER:**
- Permissions: `frontend:access`

**PARTNER:**
- Permissions: `operator:access`

---

### 4. frontend 用 Application 作成

1. `Applications` → `Create Application`
2. 名前: `DXP Frontend`、タイプ: `Regular Web Applications`
3. `設定` タブ:
   - **Allowed Callback URLs**: `http://localhost/api/auth/callback`
   - **Allowed Logout URLs**: `http://localhost`
   - **Allowed Web Origins**: `http://localhost`
4. `Client ID` と `Client Secret` をメモ → `.env` の `FRONTEND_AUTH0_CLIENT_ID` / `FRONTEND_AUTH0_CLIENT_SECRET` に設定
5. **`API` タブ** → `DXP API` の **ユーザーアクセス** を「認可済み」に変更

---

### 5. operator 用 Application 作成

1. `Applications` → `Create Application`
2. 名前: `DXP Operator`、タイプ: `Regular Web Applications`
3. `設定` タブ:
   - **Allowed Callback URLs**: `http://localhost/operator/api/auth/callback`
   - **Allowed Logout URLs**: `http://localhost/operator`
   - **Allowed Web Origins**: `http://localhost`
4. `Client ID` と `Client Secret` をメモ → `.env` の `OPERATOR_AUTH0_CLIENT_ID` / `OPERATOR_AUTH0_CLIENT_SECRET` に設定
5. **`API` タブ** → `DXP API` の **ユーザーアクセス** を「認可済み」に変更

> **重要**: この手順 5 を省略すると `Client is not authorized to access resource server` エラーでログインできません。

---

### 6. Management API 用 M2M Application 作成（ユーザー管理機能用）

1. `Applications` → `Create Application`
2. 名前: `DXP Management`、タイプ: `Machine to Machine`
3. Auth0 Management API を選択し、以下のスコープを付与:
   - `read:users`
   - `create:users`
   - `update:users`
   - `read:roles`
   - `create:role_members`
   - `delete:role_members`
4. `Client ID` と `Client Secret` をメモ → `.env` の `AUTH0_MANAGEMENT_CLIENT_ID` / `AUTH0_MANAGEMENT_CLIENT_SECRET` に設定

---

### 7. Post-Login Action 作成（カスタムクレーム付与）

Post-Login Action は **app_metadata の内容（role / workspaces / primary_area）を ID トークンに付与する**だけです。
権限（permissions）は Auth0 RBAC が Access Token に自動で付与するため、Action での処理は不要です。

1. `Actions` → `Library` → `Create Action`
2. 名前: `Add Custom Claims`、トリガー: `Login / Post Login`
3. 以下のコードを貼り付け:

```javascript
exports.onExecutePostLogin = async (event, api) => {
  const namespace = 'https://dxp/';
  const meta = event.user.app_metadata || {};

  // app_metadata の情報を ID トークンに付与（表示・ワークスペース制御用）
  api.idToken.setCustomClaim(namespace + 'role', meta.role || '');
  api.idToken.setCustomClaim(namespace + 'workspaces', meta.workspaces || '');
  api.idToken.setCustomClaim(namespace + 'primary_area', meta.primary_area || '');

  // permissions は Auth0 RBAC が Access Token に自動付与するため記述不要
};
```

4. `Deploy` して `Login` フローに追加（`Actions` → `Flows` → `Login` → Action をドラッグ）

---

### 8. テストユーザー作成

1. `User Management` → `Users` → `Create User`
2. ユーザーを作成後、`Roles` タブでロールを付与
3. `app_metadata` に以下を設定（JSON 編集）:

**frontend 閲覧ユーザー（USER ロール付与）:**
```json
{
  "role": "USER",
  "workspaces": "demo",
  "primary_area": "demo"
}
```

**frontend 管理ユーザー（USER_manager ロール付与）:**
```json
{
  "role": "USER_manager",
  "workspaces": "kofu,demo",
  "primary_area": "kofu"
}
```

**operator ユーザー（PARTNER ロール付与）:**
```json
{
  "role": "PARTNER",
  "workspaces": "*",
  "primary_area": ""
}
```

**管理者（ADMIN ロール付与）:**
```json
{
  "role": "ADMIN",
  "workspaces": "*",
  "primary_area": "national"
}
```

---

### 9. .env 設定

`.env.example` をコピーして `.env` を作成し、各値を設定:

```bash
cp .env.example .env
```

必須の Auth0 関連環境変数:

```bash
AUTH0_ISSUER_BASE_URL=https://YOUR_DOMAIN.auth0.com
AUTH0_AUDIENCE=https://api.dxp/

FRONTEND_AUTH0_CLIENT_ID=...
FRONTEND_AUTH0_CLIENT_SECRET=...
FRONTEND_AUTH0_SECRET=   # openssl rand -hex 32

OPERATOR_AUTH0_CLIENT_ID=...
OPERATOR_AUTH0_CLIENT_SECRET=...
OPERATOR_AUTH0_SECRET=   # openssl rand -hex 32

AUTH0_MANAGEMENT_CLIENT_ID=...
AUTH0_MANAGEMENT_CLIENT_SECRET=...
```

> `AUTH0_AUDIENCE` は手順 2 で設定した API Identifier（`https://api.dxp/`）と完全一致する必要があります。

---

### 10. 動作確認

```bash
docker compose build frontend operator
docker compose up -d
```

1. `http://localhost/` → ログイン画面が表示されること
2. USER ロールでログイン → 地図閲覧 OK、設定メニューにパスワード変更のみ表示
3. USER_manager ロールでログイン → ユーザー管理・新規登録メニューが表示されること
4. `http://localhost/operator` → ログイン画面が表示されること
5. PARTNER ロールでログイン → ファイル管理 OK
6. PARTNER ロールで frontend にアクセス → 403 で拒否されること
7. USER ロールで operator にアクセス → 403 で拒否されること

---

## 認証フロー概要

```
ブラウザ → POST /api/auth/login（username + password）
              ↓
         Auth0 Resource Owner Password Grant
         + audience=https://api.dxp/
              ↓
         Auth0 が返す:
           id_token  → role / workspaces / primary_area（Action が付与）
           access_token → permissions（RBAC が自動付与）
              ↓
         サーバーサイドで両 Token をデコード
         access_token.permissions に frontend:access が含まれるか確認
              ↓
         OK → セッション確立・ユーザー情報を localStorage に保存
```

---

## 本番環境での注意

- Callback URL / Logout URL に本番ドメインを追加
- `AUTH0_SECRET` は必ず 32 文字以上のランダム文字列を使用
- `AUTH0_CLIENT_SECRET` / `AUTH0_MANAGEMENT_CLIENT_SECRET` は Git に含めない（`.gitignore` で `.env` を除外済みであること確認）
