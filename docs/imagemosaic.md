# GeoServer ImageMosaic

## 概要・用語解説

**ImageMosaic** は GeoServer の機能の一つで、複数のラスタ画像（TIF）を1つのレイヤーとして束ねて配信する仕組みです。時刻（TIME）や標高（ELEVATION）などの次元に対応しており、日付パラメータで画像を切り替えることができます。

| 用語 | 説明 |
|-----|------|
| **ワークスペース（workspace）** | GeoServer の名前空間。撮影エリアに対応（例: `site-a`） |
| **ストア（store）** | データソースの定義。本システムでは `ortho-{workspace}` という名前の CoverageStore |
| **レイヤー** | WMS/WFS で公開されるデータ。ストアと1対1で対応 |
| **granule（グラニュール）** | ImageMosaic を構成する個別の TIF ファイル1枚。日付と空間範囲を持つ |
| **シェープファイルインデックス** | granule の空間範囲・日付等を記録した `.shp/.dbf/.shx`。GeoServer が自動生成・管理 |
| **TIME 次元** | WMS リクエストの `TIME=YYYY-MM-DDThh:mm:ssZ` で日付別の granule を選択する機能 |

## ファイル構成

```
./data/ortho/{workspace}/
├── ortho_20260101.tif           # granule（TIF 実データ）
├── ortho_20260201.tif
├── ortho_20260301.tif
│
├── ortho-{workspace}.shp        # GeoServer が管理するインデックス（空間範囲・日付）
├── ortho-{workspace}.dbf        # インデックスの属性テーブル
├── ortho-{workspace}.shx        # インデックスのシェープインデックス
├── ortho-{workspace}.properties # ストア設定（GeoServer が生成）
│
├── timeregex.properties         # ファイル名から日付抽出ルール
└── indexer.properties           # インデックス設定（TIME 次元・絶対パス等）
```

### timeregex.properties

```properties
regex=[0-9]{8}
format=yyyyMMdd
```

`ortho_20260101.tif` というファイル名から 8桁の数字（20260101）を抽出し、`yyyyMMdd` フォーマットで日付として解釈します。

### indexer.properties

```properties
TimeAttribute=ingestion
Schema=*the_geom:Polygon,location:String,ingestion:java.util.Date
PropertyCollectors=TimestampFileNameExtractorSPI[timeregex](ingestion)
AbsolutePath=true
```

- `TimeAttribute=ingestion` — TIME 次元に使用するフィールド名
- `AbsolutePath=true` — ファイルパスを絶対パスで記録（シンリンク経由のアクセスに対応）

> **仕様との差異について**  
> 設計仕様書（§4.3）では可搬性を高めるため `AbsolutePath=false`（相対パス）を推奨しています。  
> 本実装で `true`（絶対パス）を採用しているのは、**シンリンク方式に起因する技術的要件**があるためです。
>
> `external.imagemosaic POST` は「シェープファイルインデックスと TIF ファイルが同じディレクトリに存在すること」を前提にします。  
> 本システムでは以下のシンリンク構成を使用しています：
> ```
> /opt/geoserver/data_dir/data/{ws}/ortho-{ws}/  →  /data/ortho/{ws}/
> ```
> `AbsolutePath=false` の場合、GeoServer はシンリンクを解決せずに相対パスを生成するため、  
> インデックスから見た相対パスと TIF の実際のパスが不一致になり `external.imagemosaic` が失敗します。  
> `AbsolutePath=true` にすることで、インデックスに `/data/ortho/{ws}/ortho_YYYYMMDD.tif` という絶対パスが記録され、  
> GeoServer コンテナ内でのファイル参照が確実に成功します。  
>
> シンリンク方式を廃止して TIF と設定ファイルを同一ディレクトリに配置する構成に変更すれば `AbsolutePath=false` に戻せます。

## アップロードフロー

### 初回アップロード（ストア未存在の場合）

```
1. ワークスペース存在確認・作成
       │
       ▼
2. シンリンク作成
   data_dir/data/{ws}/ortho-{ws}/  →  /data/ortho/{ws}/
       │
       ▼
3. properties のみの ZIP を file.imagemosaic PUT
   PUT /rest/workspaces/{ws}/coveragestores/{store}/file.imagemosaic
   Content-Type: application/zip
   ※ TIF を含まない小さな ZIP（timeregex.properties + indexer.properties のみ）
   → GeoServer がストア・シェープファイルインデックスのスキーマを作成
       │
       ▼
4. TIME 次元を有効化
   PUT /rest/workspaces/{ws}/coveragestores/{store}/coverages/{layer}
   Body: {"coverage": {"dimensions": {"coverageDimension": [...], "customDimension": [...]}}}
       │
       ▼
5. InputTransparentColor=#000000 設定（黒 nodata を透過）
       │
       ▼
6. 最初の granule を追加
   POST /rest/workspaces/{ws}/coveragestores/{store}/external.imagemosaic
   Body: /data/ortho/{ws}/ortho_{YYYYMMDD}.tif
   ※ file:// プレフィクスなし、絶対パスで指定
```

### 2回目以降のアップロード（ストア既存の場合）

```
1. ストア存在確認 → OK
2. インデックス（.shp）存在確認
   存在しない場合: ストア自動削除 → 初回フローへ（自動リカバリ）
3. external.imagemosaic POST で granule 追加
   POST /rest/workspaces/{ws}/coveragestores/{store}/external.imagemosaic
   Body: /data/ortho/{ws}/ortho_{YYYYMMDD}.tif
```

## シンリンク方式の説明

GeoServer は ImageMosaic ストアを初期化する際、以下の場所にインデックスファイルを作成しようとします。

```
/opt/geoserver/data_dir/data/{workspace}/{store_name}/
```

本システムではこのディレクトリをシンリンクとして `/data/ortho/{workspace}/` を指すように設定します。

```
/opt/geoserver/data_dir/data/{ws}/ortho-{ws}/  ─シンリンク─▶  /data/ortho/{ws}/
```

この構成により：
- インデックス（.shp/.dbf/.shx）と TIF ファイルが同じディレクトリに存在する
- `external.imagemosaic` POST が「インデックスと同じ場所に TIF がある」という前提を満たす
- bind mount によりホスト側の `./data/ortho/{ws}/` に全データが集約され、バックアップが容易

シンリンク作成は register-service が担い、GeoServer コンテナ起動後・ストア初期化前に実行されます。GeoServer と register-service は `./data/geoserver_data` を共有マウントしているため、register-service 側からシンリンク操作が可能です。

## 自動リカバリ

ストアの定義（GeoServer 側）は存在するが、インデックス（.shp）が存在しない不整合状態に対してリカバリを行います。

**発生ケース**:
- `./data/ortho/{workspace}/` を手動削除した後、コンテナを再起動した
- インデックスファイルが破損・消失した

**リカバリフロー**:
```
1. add_granule() 呼び出し
       │
       ▼
2. ストア存在確認 → 存在する
       │
       ▼
3. インデックス（.shp）存在確認 → 存在しない
       │
       ▼
4. ストアを自動削除（DELETE /coveragestores/{store}?recurse=true）
       │
       ▼
5. 初回フローで再初期化
```

## ファイル命名規則

TIF ファイルは以下の形式で命名されます。

```
ortho_{YYYYMMDD}.tif
```

例: `ortho_20260101.tif`（2026年1月1日の撮影データ）

同じ日付のファイルを再アップロードすると既存の granule は上書きされます（同一ファイルパスへの書き込みのため）。

## WMS リクエスト例

```
GET /geoserver/{workspace}/wms
  ?SERVICE=WMS
  &REQUEST=GetMap
  &LAYERS={workspace}:ortho-{workspace}
  &TIME=2026-01-01T00:00:00.000Z
  &TRANSPARENT=true
  &FORMAT=image/png
  &WIDTH=512&HEIGHT=512
  &CRS=EPSG:3857
  &BBOX=...
```

`TIME` パラメータで日付を指定すると、GeoServer が対応する granule を選択してラスタを返します。
