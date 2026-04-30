# 運用手順

## 起動・停止

### 初回起動

```bash
# 1. リポジトリのルートに移動
cd /path/to/dxp-sys

# 2. 環境変数ファイルを準備
cp .env.example .env
# .env を編集してパスワードを変更（本番環境では必須）

# 3. bind mount 先ディレクトリを作成（初回のみ・docker-compose.override.yml が参照する）
mkdir -p data/geoserver_data data/ortho

# 4. 起動
docker compose up -d

# 5. 起動確認
docker compose ps
```

> **volume の仕組み**: `docker-compose.override.yml` が named volume (`geoserver_data`, `ortho_data`) を  
> ホストの `./data/geoserver_data`, `./data/ortho` に bind mount としてマップします。  
> そのため手順 3 のディレクトリ作成が必要です（Docker が先に volume を作ろうとして失敗するのを防ぐ）。

全サービスが `healthy` または `running` になるまで 1〜2 分かかります。GeoServer のヘルスチェックは `start_period: 90s` のため、起動後しばらく待機が必要です。

### 通常起動・停止

```bash
# 起動
docker compose up -d

# 停止（データは保持）
docker compose down

# 停止（volume オブジェクトも削除）
# ※ postgres_data は named volume のためデータが消える
# ※ geoserver_data / ortho_data はホストの ./data/ に保持されるため消えない
docker compose down -v

# 再起動
docker compose restart

# 特定サービスのみ再起動
docker compose restart api
```

### ログ確認

```bash
# 全サービスのログ
docker compose logs -f

# 特定サービスのログ
docker compose logs -f api
docker compose logs -f geoserver

# 直近 100 行
docker compose logs --tail=100 geoserver
```

### 開発環境での起動

開発時は `docker-compose.override.yml` が自動適用され、各サービスのポートがホストに公開されます。

```bash
docker compose up -d

# 開発時にアクセス可能な URL
# http://localhost/           - frontend（Auth0 認証）
# http://localhost/operator   - operator（Auth0 認証）
# http://localhost:3000/      - frontend（直接）
# http://localhost:3001/      - operator（直接）
# http://localhost:8000/docs  - api Swagger UI
# http://localhost:8080/geoserver/ - GeoServer 管理画面
# http://localhost:5432/      - PostgreSQL
```

---

## ワークスペース（エリア）の追加

新しい撮影エリアを追加する場合、GeoServer のワークスペースを作成します。  
journal は初回アップロード時にワークスペースを自動作成するため、**通常は手動作成不要**です。

### 自動作成（推奨）

operator 画面で新しいワークスペース名を指定してオルソ画像をアップロードするだけです。  
journal が以下を自動実行します。

1. ワークスペース作成（GeoServer REST API）
2. `/data/ortho/{workspace}/` ディレクトリ作成
3. ImageMosaic ストア初期化
4. TIME 次元有効化

### 手動作成（GeoServer 管理画面）

```
1. http://localhost:8080/geoserver/web/ にアクセス
2. 左メニュー「ワークスペース」→「新規ワークスペース」
3. 名前と名前空間 URI を設定して保存
```

---

## オルソ画像のアップロード

### operator 画面からのアップロード

```
1. http://localhost/operator にアクセス（Auth0 認証: PARTNER または ADMIN ロール）
2. エリアを選択
3. 撮影日を入力（YYYY-MM-DD）
4. TIF ファイルを選択
5. 「アップロード」ボタンをクリック
6. 進捗バーでアップロード状況を確認
```

### API からのアップロード（curl）

```bash
# journal に直接アップロード（開発時）
curl -X POST http://localhost:8000/webhook/upload-file \
  -F "file=@/path/to/ortho_20260101.tif" \
  -F "workspace=site-a" \
  -F "date=2026-01-01"

# nginx 経由（本番）
curl -X POST http://localhost/api/register/webhook/upload-file \
  -F "file=@/path/to/ortho_20260101.tif" \
  -F "workspace=site-a" \
  -F "date=2026-01-01"
```

### ファイルが既に配置済みの場合

TIF ファイルをすでに `/data/ortho/{workspace}/ortho_{YYYYMMDD}.tif` に配置している場合：

```bash
curl -X POST http://localhost:8000/webhook/upload \
  -H "Content-Type: application/json" \
  -d '{
    "workspace": "site-a",
    "filename": "ortho_20260101.tif",
    "date": "2026-01-01"
  }'
```

---

## granule の削除

```bash
# 1. granule 一覧を取得して ID を確認
curl http://localhost:8000/webhook/granules/site-a

# 2. granule を削除（ファイルも同時に削除される）
curl -X DELETE http://localhost:8000/webhook/granule \
  -H "Content-Type: application/json" \
  -d '{
    "workspace": "site-a",
    "granule_id": "ortho_20260101"
  }'
```

> operator 画面からも削除できます（granule 一覧の削除ボタン）。

---

## 日付変更

誤った日付で登録した場合、granule の日付を変更できます。

```bash
# granule の日付を 2026-01-01 から 2026-01-15 に変更
curl -X PATCH http://localhost:8000/webhook/granule \
  -H "Content-Type: application/json" \
  -d '{
    "workspace": "site-a",
    "granule_id": "ortho_20260101",
    "new_filename": "ortho_20260115.tif"
  }'
```

内部処理: `ortho_20260101.tif` → `ortho_20260115.tif` にリネーム → GeoServer 上で削除 → 再登録。

---

## データバックアップ・リストア

### バックアップ対象

| データ | パス | 内容 |
|-------|------|------|
| TIF + インデックス | `./data/ortho/` | オルソ画像本体と ImageMosaic インデックス |
| GeoServer 設定 | `./data/geoserver_data/` | ワークスペース・ストア・レイヤー定義 |
| PostgreSQL | named volume `postgres_data` | 空間データ |

### バックアップ手順

```bash
# TIF + GeoServer 設定のバックアップ（コンテナ停止不要）
tar -czf backup_$(date +%Y%m%d).tar.gz ./data/ortho/ ./data/geoserver_data/

# PostgreSQL バックアップ（コンテナが起動中であること）
docker compose exec postgis pg_dump -U ${POSTGRES_USER:-dxp} ${POSTGRES_DB:-dxp} \
  > postgres_backup_$(date +%Y%m%d).sql
```

### リストア手順

```bash
# 1. サービスを停止
docker compose down

# 2. TIF + GeoServer 設定をリストア
tar -xzf backup_20260101.tar.gz

# 3. PostgreSQL をリストア
docker compose up -d postgis
sleep 10
docker compose exec -T postgis psql -U ${POSTGRES_USER:-dxp} ${POSTGRES_DB:-dxp} \
  < postgres_backup_20260101.sql

# 4. 全サービスを起動
docker compose up -d
```

> **注意**: `./data/geoserver_data/data/{ws}/{store}/` はシンリンクのため、`tar` でバックアップする場合は `--dereference` オプションを使うか、シンリンク先（`./data/ortho/`）を対象に含めてください。

### TIF ファイルのみ復元（GeoServer 設定は残す場合）

TIF を追加・削除した後にインデックスと不整合が生じた場合、api の自動リカバリを活用できます。

```bash
# 1. TIF を /data/ortho/{workspace}/ に配置
cp ortho_20260101.tif ./data/ortho/site-a/

# 2. アップロード API を呼び出してインデックスを再構築
curl -X POST http://localhost:8000/webhook/upload \
  -H "Content-Type: application/json" \
  -d '{"workspace": "site-a", "filename": "ortho_20260101.tif", "date": "2026-01-01"}'
```

---

## トラブルシューティング

### GeoServer が起動しない

**症状**: `docker compose ps` で geoserver が `unhealthy` または起動ループ

```bash
# ログを確認
docker compose logs geoserver

# データディレクトリの権限を確認
ls -la ./data/geoserver_data/

# GeoServer コンテナに入って確認
docker compose exec geoserver bash
```

**よくある原因**:
- `./data/geoserver_data/` の権限が不足している → `chmod -R 777 ./data/geoserver_data/`
- メモリ不足（INITIAL_MEMORY/MAXIMUM_MEMORY 設定を確認）

---

### アップロードが失敗する

**症状**: operator でアップロードがエラーになる

```bash
# journal のログを確認
docker compose logs api

# GeoServer への接続を確認
docker compose exec api curl -s http://geoserver:8080/geoserver/web/
```

**よくある原因**:
- GeoServer がまだ起動中（ヘルスチェック前）→ しばらく待って再試行
- TIF ファイルが壊れている → 別のファイルで試す
- GeoServer の認証情報が違う → `.env` の `GEOSERVER_USER/GEOSERVER_PASSWORD` を確認

---

### 地図に画像が表示されない

**症状**: frontend で日付を選択しても地図にオルソ画像が表示されない

```bash
# GeoServer の WMS リクエストを直接確認
curl "http://localhost:8080/geoserver/{workspace}/wms?SERVICE=WMS&REQUEST=GetCapabilities"

# granule が登録されているか確認
curl http://localhost:8000/webhook/granules/{workspace}
```

**よくある原因**:
- TIME パラメータの日付形式が間違っている（`YYYY-MM-DDT00:00:00.000Z` 形式が必要）
- granule が GeoServer に登録されていない → アップロードを再試行
- InputTransparentColor が設定されていない → GeoServer レイヤー設定を確認

---

### シンリンクエラー

**症状**: アップロード時に `Permission denied` や `File exists` エラー

```bash
# シンリンクの状態を確認
ls -la ./data/geoserver_data/data/{workspace}/

# シンリンクを手動修正
rm -rf ./data/geoserver_data/data/{workspace}/ortho-{workspace}
ln -s $(pwd)/data/ortho/{workspace} ./data/geoserver_data/data/{workspace}/ortho-{workspace}
```

---

### インデックスと TIF の不整合

**症状**: granule 一覧に表示されるが WMS で取得できない、または登録数が実際の TIF 数と異なる

インデックスファイル（.shp）を削除して再構築します。

```bash
# 1. GeoServer のストアを削除（管理画面または API）
curl -u admin:geoserver -X DELETE \
  "http://localhost:8080/geoserver/rest/workspaces/{workspace}/coveragestores/ortho-{workspace}?recurse=true"

# 2. インデックスファイルを削除
rm ./data/ortho/{workspace}/ortho-{workspace}.shp
rm ./data/ortho/{workspace}/ortho-{workspace}.dbf
rm ./data/ortho/{workspace}/ortho-{workspace}.shx
rm ./data/ortho/{workspace}/ortho-{workspace}.properties

# 3. 最初の TIF で再初期化（自動リカバリが動作）
curl -X POST http://localhost:8000/webhook/upload \
  -H "Content-Type: application/json" \
  -d '{"workspace": "{workspace}", "filename": "ortho_{YYYYMMDD}.tif", "date": "YYYY-MM-DD"}'

# 4. 残りの TIF を順次登録
for tif in ./data/ortho/{workspace}/ortho_*.tif; do
  filename=$(basename "$tif")
  date=$(echo "$filename" | grep -o '[0-9]\{8\}')
  formatted_date="${date:0:4}-${date:4:2}-${date:6:2}"
  curl -X POST http://localhost:8000/webhook/upload \
    -H "Content-Type: application/json" \
    -d "{\"workspace\": \"{workspace}\", \"filename\": \"$filename\", \"date\": \"$formatted_date\"}"
  sleep 1
done
```

---

### PostgreSQL に接続できない

```bash
# 接続確認
docker compose exec postgis psql -U ${POSTGRES_USER:-dxp} -c '\l'

# ログ確認
docker compose logs postgis
```

`postgres_data` は Docker 管理の named volume のため、`docker compose down -v` を実行するとデータが消えます。  
通常の `docker compose down`（`-v` なし）では保持されます。  
`geoserver_data` と `ortho_data` はホストの `./data/` に bind mount されているため、`-v` を付けても実ファイルは消えません。
