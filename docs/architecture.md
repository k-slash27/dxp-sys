# システムアーキテクチャ

## サービス全体構成

```
[ブラウザ]
    │
    ├─────────────────────────────────────────────────────────┐
    ▼                                                         ▼
[nginx :80]  ←── リバースプロキシ（client_max_body_size 5000m）  [operator:3001]  ←── アップロード管理 UI（nginx 経由なし）
    ├── /              → frontend:3000      (Next.js 地図閲覧 UI)         │
    ├── /geoserver/    → geoserver:8080     (GeoServer WMS/WFS/REST)   　│
    └── /api/register/ → api:8000 (FastAPI)               　│
                                    ▲                                  　│
                                    └────────────────────────────────────┘
                                                                (内部通信 → api:8000)

[api:8000]
    └── → geoserver:8080  (内部通信: GeoServer REST API)

[geoserver:8080]
    ├── ./data/geoserver_data  (設定ファイル)
    └── ./data/ortho           (TIF ファイル読み取り)

[postgis:5432]  ←── 空間データベース（PostGIS）
```

## サービス間通信フロー

### 地図閲覧（frontend → GeoServer）

```
ブラウザ
  → GET /geoserver/ws/wms?SERVICE=WMS&TIME=2026-01-01
  → nginx (/geoserver/ → geoserver:8080)
  → GeoServer: ImageMosaic から該当日付の TIF を読み取りタイル生成
  → WMS タイル画像を返却
```

### オルソ画像アップロード（operator → api → GeoServer）

```
ブラウザ（operator）
  → POST /api/upload  (multipart, TIF ファイル + workspace + date)
  → operator Next.js API Route (/api/upload/route.ts)
    bodyParser 無効・ストリーム転送（大容量対応）
  → POST /webhook/upload-file
  → api: TIF を /data/ortho/{workspace}/ に保存
  → api: GeoServer REST API で ImageMosaic に granule 登録
  → GeoServer: インデックス（.shp）更新
  → 完了レスポンス（task_id 付き）
```

### アップロード進捗確認（SSE）

```
ブラウザ（operator）
  → GET /api/progress/{taskId}
  → operator Next.js API Route (/api/progress/[taskId])
  → GET /webhook/progress/{taskId}  (SSE プロキシ)
  → api: Server-Sent Events で進捗を逐次配信
```

## データフロー（アップロード〜地図表示まで）

```
1. ユーザーが operator で TIF ファイルを選択・日付指定してアップロード
       │
       ▼
2. operator → api に multipart POST（ストリーム転送）
       │
       ▼
3. api が /data/ortho/{workspace}/ortho_{YYYYMMDD}.tif として保存
       │
       ▼
4. api が GeoServer REST API を呼び出し
       │   ├── ストア未存在: シンリンク作成 → ZIP PUT → TIME 次元有効化 → external.imagemosaic POST
       │   └── ストア既存:  external.imagemosaic POST のみ
       │
       ▼
5. GeoServer が ImageMosaic インデックス（.shp/.dbf/.shx）を更新
       │
       ▼
6. frontend で WMS TIME パラメータを指定してリクエスト
       │
       ▼
7. GeoServer が該当日付の TIF を読み取り WMS タイルとして配信
       │
       ▼
8. ブラウザに地図タイルが表示される
```

## データ永続化の構成

```
./data/
├── geoserver_data/          # GeoServer 設定（named volume → bind mount）
│   ├── workspaces/          # ワークスペース・ストア・レイヤー定義
│   ├── gwc/                 # タイルキャッシュ
│   └── data/
│       └── {workspace}/
│           └── ortho-{workspace}/  ─── シンリンク → /data/ortho/{workspace}/
└── ortho/                   # TIF + ImageMosaic インデックス（named volume → bind mount）
    └── {workspace}/
        ├── ortho_20260101.tif
        ├── ortho_20260201.tif
        ├── ortho-{workspace}.shp   # 空間インデックス（GeoServer が生成）
        ├── ortho-{workspace}.dbf
        ├── ortho-{workspace}.shx
        ├── ortho-{workspace}.properties
        ├── timeregex.properties
        └── indexer.properties

postgres_data  (named volume)
└── PostgreSQL データ（PostGIS）
```

### Volume 構成の設計方針

`docker-compose.yml` では `geoserver_data` / `ortho_data` / `postgres_data` を named volume として宣言します。  
`docker-compose.override.yml` で named volume に `driver_opts` を付与し、実際の保存先をホストの `./data/` にマップします。

```
docker-compose.yml         named volume 宣言（driver 指定なし）
docker-compose.override.yml  ↳ driver: local / driver_opts: type: none, o: bind, device: ./data/...
```

この構成により：

- **環境別の切り替えが容易**: 本番では `override.prod.yml` で NFS や SAN を指定するだけ
- **データ安全性**: `docker compose down -v` を実行しても `./data/` の実ファイルは消えない  
  （`postgres_data` のみ named volume のため `-v` で消える点に注意）
- **コンテナ再作成後もデータが保持**: bind mount 先の `./data/` はホスト上に残り続ける

#### NFS 環境への切り替え例（本番用 override.prod.yml）

```yaml
volumes:
  geoserver_data:
    driver: local
    driver_opts:
      type: nfs
      o: addr=192.168.1.100,rw
      device: ":/exports/geoserver_data"
  ortho_data:
    driver: local
    driver_opts:
      type: nfs
      o: addr=192.168.1.100,rw
      device: ":/exports/ortho"
```

### シンリンクによるディレクトリ共有の仕組み

GeoServer は ImageMosaic ストアを初期化する際、`data_dir/data/{workspace}/{store_name}/` にインデックスを作成しようとします。  
journal がここにシンリンクを張ることで、インデックスが `/data/ortho/{workspace}/` に書き込まれ、TIF ファイルと同じディレクトリに揃います。

```
GeoServer コンテナ側:
  /opt/geoserver/data_dir/data/{ws}/ortho-{ws}/  →  /data/ortho/{ws}/

ホスト側（bind mount で同一実体）:
  ./data/geoserver_data/data/{ws}/ortho-{ws}/    →  ./data/ortho/{ws}/
```

## nginx ルーティング詳細

nginx は frontend・operator・GeoServer・api の4系統をプロキシします。  
operator は `/operator` パスで nginx を経由してアクセスします（Next.js の `basePath=/operator` と対応）。

| パス | プロキシ先 | 備考 |
|-----|----------|------|
| `/geoserver/` | `geoserver:8080/geoserver/` | proxy_read_timeout 300s |
| `/api/register/` | `api:8000/` | proxy_buffering off（SSE 対応） |
| `/operator` | `operator:3000/` | Next.js basePath=/operator |
| `/` | `frontend:3000/` | WebSocket Upgrade 対応 |

```nginx
client_max_body_size 5000m;  # 2.5GB 超の TIF に対応
```

SSE（Server-Sent Events）配信のため `/api/register/` では `proxy_buffering off` と `proxy_cache off` を設定し、進捗データをリアルタイムにクライアントへ届けます。
