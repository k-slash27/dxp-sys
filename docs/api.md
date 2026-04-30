# API 仕様

## api

**ベース URL**: `http://localhost:8000`（開発時）/ `http://localhost/api/register`（nginx 経由）  
**Swagger UI**: `http://localhost:8000/docs`（開発時のみ）  
**ルータープレフィクス**: `/webhook`

---

### POST /webhook/upload-file

マルチパートでファイルを受け取り、ディスクに保存してから GeoServer に登録します。  
operator の `/api/upload` から呼ばれます。大容量 TIF（2.5GB 超）に対応するためストリーミング書き込みを使用します。

**Content-Type**: `multipart/form-data`

**フォームフィールド**:

| フィールド | 型 | 必須 | 説明 |
|-----------|---|------|------|
| `file` | File | ○ | GeoTiff ファイル（`.tif` / `.tiff`） |
| `workspace` | string | ○ | GeoServer ワークスペース名（撮影エリア） |
| `date` | string | ○ | 撮影日（`YYYY-MM-DD` 形式） |

**レスポンス（200）**:

```json
{
  "task_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "completed",
  "filename": "ortho_20260101.tif",
  "result": {
    "workspace": "site-a",
    "store": "ortho-site-a",
    "granule": "ortho_20260101.tif"
  }
}
```

**エラーレスポンス**:

```json
// 400: GeoTiff 以外のファイル
{ "detail": "GeoTiff (.tif, .tiff) のみ対応" }

// 500: GeoServer 登録失敗
{ "detail": "GeoServer への登録に失敗しました: ..." }
```

---

### POST /webhook/upload

ファイルがすでに `/data/ortho/{workspace}/{filename}` に存在する場合の GeoServer 登録のみを行います。

**Content-Type**: `application/json`

**リクエストボディ**:

```json
{
  "workspace": "site-a",
  "filename": "ortho_20260101.tif",
  "date": "2026-01-01"
}
```

**レスポンス（200）**:

```json
{
  "task_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "completed",
  "result": {
    "workspace": "site-a",
    "store": "ortho-site-a"
  }
}
```

**エラーレスポンス**:

```json
// 404: ファイルが存在しない
{ "detail": "ファイルが見つかりません: /data/ortho/site-a/ortho_20260101.tif" }
```

---

### DELETE /webhook/granule

指定した granule を GeoServer から削除し、対応する TIF ファイルも削除します。

**Content-Type**: `application/json`

**リクエストボディ**:

```json
{
  "workspace": "site-a",
  "granule_id": "ortho_20260101"
}
```

**レスポンス（200）**:

```json
{
  "status": "deleted",
  "granule_id": "ortho_20260101"
}
```

> `granule_id` は `GET /webhook/granules/{workspace}` で取得できます。

---

### PATCH /webhook/granule

granule の日付を変更します。内部処理: 旧ファイルのリネーム → GeoServer 上で削除 → 新ファイルで再登録。

**Content-Type**: `application/json`

**リクエストボディ**:

```json
{
  "workspace": "site-a",
  "granule_id": "ortho_20260101",
  "new_filename": "ortho_20260115.tif"
}
```

**レスポンス（200）**:

```json
{
  "status": "updated",
  "result": {
    "workspace": "site-a",
    "granule_id": "ortho_20260115"
  }
}
```

**エラーレスポンス**:

```json
// 404: granule が見つからない
{ "detail": "granule が見つかりません: ortho_20260101" }

// 404: ファイルが存在しない
{ "detail": "元ファイルが見つかりません: /data/ortho/site-a/ortho_20260101.tif" }
```

---

### GET /webhook/granules/{workspace}

指定ワークスペースに登録されている granule の一覧を返します。

**パスパラメータ**:

| パラメータ | 説明 |
|-----------|------|
| `workspace` | GeoServer ワークスペース名 |

**レスポンス（200）**:

```json
{
  "workspace": "site-a",
  "granules": [
    {
      "id": "ortho_20260101",
      "location": "file:///data/ortho/site-a/ortho_20260101.tif",
      "ingestion": "2026-01-01T00:00:00.000+0000"
    },
    {
      "id": "ortho_20260201",
      "location": "file:///data/ortho/site-a/ortho_20260201.tif",
      "ingestion": "2026-02-01T00:00:00.000+0000"
    }
  ]
}
```

---

### GET /webhook/areas

GeoServer のワークスペース一覧を撮影エリアとして返します。

**レスポンス（200）**:

```json
[
  {
    "id": "site-a",
    "label": "site-a",
    "workspace": "site-a",
    "storagePath": "/data/ortho/site-a",
    "contact": {
      "contactOrganization": null
    }
  },
  {
    "id": "site-b",
    "label": "site-b",
    "workspace": "site-b",
    "storagePath": "/data/ortho/site-b",
    "contact": {
      "contactOrganization": null
    }
  }
]
```

---

### GET /webhook/progress/{task_id}

Server-Sent Events（SSE）でアップロードタスクの進捗を配信します。  
最大 60 秒間、1秒ごとにステータスを送信します。

**パスパラメータ**:

| パラメータ | 説明 |
|-----------|------|
| `task_id` | `/upload-file` または `/upload` のレスポンスで返される UUID |

**レスポンス（200）**:  
`Content-Type: text/event-stream`

```
data: {"task_id": "550e8400-...", "status": "uploading", "message": "ファイル保存中..."}

data: {"task_id": "550e8400-...", "status": "processing", "message": "GeoServer に登録中..."}

data: {"task_id": "550e8400-...", "status": "completed", "message": "登録完了", "result": {...}}
```

**ステータス一覧**:

| ステータス | 説明 |
|----------|------|
| `pending` | タスクがまだ開始されていない |
| `uploading` | ファイルをディスクに保存中 |
| `processing` | GeoServer に登録中 |
| `completed` | 登録完了 |
| `failed` | エラー発生（`message` にエラー内容） |

---

### GET /health

サービスの死活確認用エンドポイント。

**レスポンス（200）**:

```json
{ "status": "ok" }
```

---

## operator API プロキシルート

operator（Next.js）は api への直接アクセスをプロキシします。

### POST /api/upload

api の `POST /webhook/upload-file` へのストリームプロキシ。  
`bodyParser` を無効化し、リクエストボディをそのまま転送することで大容量ファイルに対応しています。

**動作**: `multipart/form-data` リクエストをそのまま journal に転送

**フォームフィールド**: journal と同一（`file`, `workspace`, `date`）

**内部転送先**: `http://api:8000/webhook/upload-file`

---

### GET /api/progress/[taskId]

api の `GET /webhook/progress/{task_id}` への SSE プロキシ。

**内部転送先**: `http://api:8000/webhook/progress/{taskId}`

---

### GET /api/areas

api の `GET /webhook/areas` へのプロキシ。

**内部転送先**: `http://api:8000/webhook/areas`
