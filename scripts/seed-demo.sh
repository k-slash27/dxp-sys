#!/usr/bin/env bash
# デモ用 ImageMosaic 時系列データを demo ワークスペースに投入するスクリプト
# Usage: ./scripts/seed-demo.sh
# 前提: docker compose up -d でコンテナが起動済みであること
set -euo pipefail

GEOSERVER_URL="${GEOSERVER_URL:-http://localhost:8080/geoserver}"
GEOSERVER_USER="${GEOSERVER_USER:-admin}"
GEOSERVER_PASSWORD="${GEOSERVER_PASSWORD:-geoserver}"
WORKSPACE="demo"
STORE="ortho-demo"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEMO_DATA_DIR="${SCRIPT_DIR}/demo-data"

log() { echo "[$(date +%H:%M:%S)] $*"; }

# GeoServer の起動待ち
log "GeoServer の起動を待機中..."
for i in $(seq 1 30); do
  if curl -sf "${GEOSERVER_URL}/web/" -o /dev/null 2>/dev/null; then
    log "GeoServer: OK"
    break
  fi
  [ $i -eq 30 ] && { echo "ERROR: GeoServer が起動しませんでした"; exit 1; }
  sleep 5
done

# ワークスペース作成（既存はスキップ）
log "ワークスペース '${WORKSPACE}' を作成中..."
curl -sf -X POST "${GEOSERVER_URL}/rest/workspaces" \
  -u "${GEOSERVER_USER}:${GEOSERVER_PASSWORD}" \
  -H "Content-Type: application/json" \
  -d "{\"workspace\":{\"name\":\"${WORKSPACE}\"}}" -o /dev/null || true

# 既存ストアを削除（冪等にするため）
log "既存ストアをクリーンアップ..."
curl -sf -X DELETE \
  "${GEOSERVER_URL}/rest/workspaces/${WORKSPACE}/coveragestores/${STORE}?recurse=true" \
  -u "${GEOSERVER_USER}:${GEOSERVER_PASSWORD}" -o /dev/null || true

# 共有ボリューム上のインデックスファイルをクリア（TIF は残す）
log "インデックスファイルをクリア中..."
docker compose exec -T api sh -c "
  cd /data/ortho/${WORKSPACE} 2>/dev/null || exit 0
  rm -f *.shp *.dbf *.shx *.prj *.fix *.qix *.imagemosaic *.dat *.properties
" || true

# デモデータを共有ボリュームにコピー
log "デモデータを共有ボリュームにコピー中..."
docker compose exec -T api mkdir -p /data/ortho/${WORKSPACE}

# テンプレートをコピー
docker compose cp "${SCRIPT_DIR}/../geoserver/templates/indexer.properties" \
  "api:/data/ortho/${WORKSPACE}/indexer.properties"
docker compose cp "${SCRIPT_DIR}/../geoserver/templates/timeregex.properties" \
  "api:/data/ortho/${WORKSPACE}/timeregex.properties"

# TIF ファイルをコピー
for f in "${DEMO_DATA_DIR}"/ortho_*.tif; do
  fname=$(basename "$f")
  docker compose cp "$f" "api:/data/ortho/${WORKSPACE}/${fname}"
done

# ストアを JSON で作成（url に絶対パスを指定）
log "ImageMosaic ストアを作成中..."
HTTP_STATUS=$(curl -s -o /tmp/seed_resp.txt -w "%{http_code}" \
  -X POST "${GEOSERVER_URL}/rest/workspaces/${WORKSPACE}/coveragestores" \
  -u "${GEOSERVER_USER}:${GEOSERVER_PASSWORD}" \
  -H "Content-Type: application/json" \
  -d "{
    \"coverageStore\": {
      \"name\": \"${STORE}\",
      \"type\": \"ImageMosaic\",
      \"enabled\": true,
      \"workspace\": {\"name\": \"${WORKSPACE}\"},
      \"url\": \"file:///data/ortho/${WORKSPACE}/\"
    }
  }")
[ "$HTTP_STATUS" = "201" ] && log "ストア作成: OK" || { echo "ERROR: ストア作成失敗 (HTTP ${HTTP_STATUS})"; cat /tmp/seed_resp.txt; exit 1; }

# 全 TIF を external.imagemosaic POST で harvest
log "granule を harvest 中..."
for f in "${DEMO_DATA_DIR}"/ortho_*.tif; do
  fname=$(basename "$f")
  HTTP=$(curl -s -o /tmp/seed_resp.txt -w "%{http_code}" \
    -X POST "${GEOSERVER_URL}/rest/workspaces/${WORKSPACE}/coveragestores/${STORE}/external.imagemosaic" \
    -u "${GEOSERVER_USER}:${GEOSERVER_PASSWORD}" \
    -H "Content-Type: text/plain" \
    -d "/data/ortho/${WORKSPACE}/${fname}")
  log "  harvest ${fname}: HTTP ${HTTP}"
done

# カバレッジのネイティブ名を取得してパブリッシュ
log "カバレッジをパブリッシュ中..."
sleep 2
NATIVE_NAME=$(curl -s \
  "${GEOSERVER_URL}/rest/workspaces/${WORKSPACE}/coveragestores/${STORE}/coverages.json?list=all" \
  -u "${GEOSERVER_USER}:${GEOSERVER_PASSWORD}" | \
  python3 -c "import json,sys; print(json.load(sys.stdin)['list']['string'][0])")
log "  nativeName: ${NATIVE_NAME}"

HTTP_STATUS=$(curl -s -o /tmp/seed_resp.txt -w "%{http_code}" \
  -X POST "${GEOSERVER_URL}/rest/workspaces/${WORKSPACE}/coveragestores/${STORE}/coverages" \
  -u "${GEOSERVER_USER}:${GEOSERVER_PASSWORD}" \
  -H "Content-Type: application/json" \
  -d "{\"coverage\": {\"name\": \"${STORE}\", \"nativeName\": \"${NATIVE_NAME}\"}}")
[ "$HTTP_STATUS" = "201" ] && log "カバレッジ公開: OK" || { echo "ERROR: カバレッジ公開失敗 (HTTP ${HTTP_STATUS})"; cat /tmp/seed_resp.txt; exit 1; }

# TIME次元を有効化
log "TIME次元を有効化中..."
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -X PUT "${GEOSERVER_URL}/rest/workspaces/${WORKSPACE}/coveragestores/${STORE}/coverages/${STORE}.json" \
  -u "${GEOSERVER_USER}:${GEOSERVER_PASSWORD}" \
  -H "Content-Type: application/json" \
  -d '{
    "coverage": {
      "metadata": {
        "entry": [
          {"@key": "dirName", "$": "'"${STORE}"'_null"},
          {
            "@key": "time",
            "dimensionInfo": {
              "enabled": true,
              "presentation": "LIST",
              "units": "ISO8601",
              "defaultValue": {"strategy": "MAXIMUM"}
            }
          }
        ]
      }
    }
  }')
[ "$HTTP_STATUS" = "200" ] && log "TIME次元: OK" || echo "WARNING: TIME次元設定失敗 (HTTP ${HTTP_STATUS})"

# SLD スタイルのアップロード（任意）
SLD_FILE="${DEMO_DATA_DIR}/snow_style.sld"
if [ -f "${SLD_FILE}" ]; then
  log "SLD スタイル 'snow_style' をアップロード中..."
  HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "${GEOSERVER_URL}/rest/styles" \
    -u "${GEOSERVER_USER}:${GEOSERVER_PASSWORD}" \
    -H "Content-Type: application/vnd.ogc.sld+xml" \
    -d @"${SLD_FILE}")
  [ "$HTTP_STATUS" = "201" ] || [ "$HTTP_STATUS" = "409" ] && \
    log "SLD スタイル: OK" || log "SLD スキップ (HTTP ${HTTP_STATUS})"
fi

# 登録確認
log "登録 granule を確認中..."
curl -s "${GEOSERVER_URL}/rest/workspaces/${WORKSPACE}/coveragestores/${STORE}/coverages/${STORE}/index/granules.json" \
  -u "${GEOSERVER_USER}:${GEOSERVER_PASSWORD}" | \
  python3 -c "
import json,sys
d=json.load(sys.stdin)
feats=d.get('features',[])
print(f'  登録 granule: {len(feats)} 件')
for f in feats:
    p=f.get('properties',{})
    print(f'  - {p.get(\"ingestion\",\"\")[:10]} | {p.get(\"location\",\"\")}')
" 2>/dev/null || true

log ""
log "=== デモセットアップ完了 ==="
log "ワークスペース : ${WORKSPACE}"
log "ストア         : ${STORE}"
log "GeoServer 管理画面 : ${GEOSERVER_URL}/web/"
log ""
log "WMS 動作確認 (TIME パラメータ付き):"
log "  # データ範囲: EPSG:32632, UL(624800,5184500) → LR(632600,5171500)"
log "  # WGS84 中心: 10.685°E, 46.743°N (イタリア北部 トレンティーノ州)"
log "  curl '${GEOSERVER_URL}/${WORKSPACE}/wms?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap"
log "  &LAYERS=${WORKSPACE}:${STORE}&TIME=2009-10-01T00:00:00.000Z"
log "  &BBOX=624800,5171500,632600,5184500&WIDTH=256&HEIGHT=256&SRS=EPSG:32632&FORMAT=image/png'"
