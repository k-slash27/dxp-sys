# DXP オンプレミス版

ドローン空撮オルソ画像を時系列で管理・配信するシステム。  
元々 AWS（S3 + Lambda + DataSync + GeoServer）で構成されていたものを、Docker Compose ベースのオンプレミス環境へ移行したシステムです。

## サービス一覧

| サービス | 技術 | 役割 |
|---------|------|------|
| nginx | nginx:1.27-alpine | リバースプロキシ（ポート 80） |
| frontend | Next.js + deck.gl + MapLibre GL | 地図閲覧 UI |
| operator | Next.js 16（App Router） | アップロード管理 UI |
| api | FastAPI（Python） | ファイル受付・GeoServer 登録 API |
| geoserver | kartoza/geoserver:2.28.2 | WMS/WFS タイル配信・ImageMosaic 管理 |
| postgis | PostGIS 15-3.4 | 空間データベース |

## URL

| URL | 用途 |
|-----|------|
| `http://localhost/` | 地図閲覧 UI（Auth0 認証） |
| `http://localhost/operator` | operator 管理 UI（Auth0 認証） |
| `http://localhost/geoserver/` | GeoServer 管理画面・WMS/WFS |
| `http://localhost/api/register/` | api API（nginx 経由） |
| `http://localhost:8000/docs` | api Swagger UI（開発時） |

## クイックスタート

```bash
# 1. 環境変数ファイルを準備（必要に応じてパスワードを変更）
cp .env.example .env

# 2. bind mount 先ディレクトリを作成（初回のみ）
mkdir -p data/geoserver_data data/ortho

# 3. 起動
docker compose up -d

# 4. 状態確認
docker compose ps
```

> `docker-compose.override.yml` が自動適用され、named volume を `./data/` 以下にマップします。  
> 開発時は各サービスのポートも個別に公開されます。

## ディレクトリ構成

```
dxp-sys/
├── docker-compose.yml             # 全環境共通（サービス定義・named volume 宣言）
├── docker-compose.override.yml    # 環境別設定（bind mount マップ・ポート公開・ホットリロード）
├── .env.example                   # 環境変数テンプレート
├── nginx/
│   └── nginx.conf                 # リバースプロキシ設定
├── geoserver/                     # GeoServer 関連設定
├── api/              # FastAPI サービス
├── operator/                      # Next.js アップロード管理 UI
├── frontend/                      # Next.js 地図閲覧 UI
├── scripts/                       # 運用スクリプト
├── data/                          # 永続化データ（初回 mkdir -p が必要）
│   ├── geoserver_data/            # GeoServer 設定（named volume → bind mount）
│   └── ortho/                     # TIF ファイル + ImageMosaic インデックス（named volume → bind mount）
└── docs/                          # 詳細ドキュメント
    ├── architecture.md            # システムアーキテクチャ
    ├── imagemosaic.md             # GeoServer ImageMosaic の仕組み
    ├── api.md                     # API エンドポイント仕様
    └── operations.md              # 運用手順
```

## 詳細ドキュメント

- [アーキテクチャ](docs/architecture.md) — サービス間通信・データフロー・nginx ルーティング
- [Auth0 セットアップ](docs/auth0-setup.md) — 認証基盤の設定手順・ロール・パーミッション設計
- [ImageMosaic](docs/imagemosaic.md) — GeoServer ImageMosaic の仕組みとファイル構成
- [API 仕様](docs/api.md) — api 全エンドポイントの詳細
- [運用手順](docs/operations.md) — 起動・停止・バックアップ・トラブルシューティング
