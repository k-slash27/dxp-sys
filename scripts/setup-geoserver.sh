#!/usr/bin/env bash
# GeoServer初期セットアップスクリプト
# Usage: ./scripts/setup-geoserver.sh [workspace_name]
# Example: ./scripts/setup-geoserver.sh kofu
set -euo pipefail

GEOSERVER_URL="${GEOSERVER_URL:-http://localhost:8080/geoserver}"
GEOSERVER_USER="${GEOSERVER_USER:-admin}"
GEOSERVER_PASSWORD="${GEOSERVER_PASSWORD:-geoserver}"
WORKSPACE="${1:-demo}"
STORE_NAME="ortho-${WORKSPACE}"
DATA_DIR="/data/ortho/${WORKSPACE}"

AUTH="-u ${GEOSERVER_USER}:${GEOSERVER_PASSWORD}"
HEADERS='-H "Content-Type: application/json" -H "Accept: application/json"'

log() { echo "[$(date +%H:%M:%S)] $*"; }
die() { echo "ERROR: $*" >&2; exit 1; }

# GeoServer起動待ち
log "GeoServer起動を待機中..."
for i in $(seq 1 30); do
  if curl -sf "${GEOSERVER_URL}/web/" -o /dev/null; then
    log "GeoServer起動確認"
    break
  fi
  [ $i -eq 30 ] && die "GeoServerが起動しませんでした"
  sleep 5
done

# ワークスペース作成（既存の場合はスキップ）
log "ワークスペース '${WORKSPACE}' を作成中..."
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "${GEOSERVER_URL}/rest/workspaces" \
  ${AUTH} \
  -H "Content-Type: application/json" \
  -d "{\"workspace\":{\"name\":\"${WORKSPACE}\"}}")

if [ "$HTTP_STATUS" = "201" ]; then
  log "ワークスペース作成完了"
elif [ "$HTTP_STATUS" = "409" ]; then
  log "ワークスペース既存: スキップ"
else
  die "ワークスペース作成失敗 (HTTP ${HTTP_STATUS})"
fi

# ImageMosaicストア用ディレクトリをdata volume内に準備
# （実際のGeoTiffはoperatorがアップロード後にこのパスに保存される）
log "ImageMosaicストア '${STORE_NAME}' を作成中..."
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "${GEOSERVER_URL}/rest/workspaces/${WORKSPACE}/coveragestores" \
  ${AUTH} \
  -H "Content-Type: application/json" \
  -d "{
    \"coverageStore\": {
      \"name\": \"${STORE_NAME}\",
      \"type\": \"ImageMosaic\",
      \"enabled\": true,
      \"workspace\": {\"name\": \"${WORKSPACE}\"},
      \"url\": \"file://${DATA_DIR}\"
    }
  }")

if [ "$HTTP_STATUS" = "201" ]; then
  log "ストア作成完了"
elif [ "$HTTP_STATUS" = "409" ]; then
  log "ストア既存: スキップ"
else
  die "ストア作成失敗 (HTTP ${HTTP_STATUS})"
fi

# レイヤー公開
log "レイヤー '${STORE_NAME}' を公開中..."
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "${GEOSERVER_URL}/rest/workspaces/${WORKSPACE}/coveragestores/${STORE_NAME}/coverages" \
  ${AUTH} \
  -H "Content-Type: application/json" \
  -d "{
    \"coverage\": {
      \"name\": \"${STORE_NAME}\",
      \"title\": \"${WORKSPACE} 空撮オルソ画像\",
      \"nativeCRS\": \"EPSG:4326\",
      \"srs\": \"EPSG:4326\",
      \"enabled\": true
    }
  }")

if [ "$HTTP_STATUS" = "201" ]; then
  log "レイヤー公開完了"
elif [ "$HTTP_STATUS" = "409" ]; then
  log "レイヤー既存: スキップ"
else
  log "レイヤー公開: HTTP ${HTTP_STATUS}（GeoTiffが未登録の場合は正常）"
fi

# GetCapabilities確認
log "WMS GetCapabilities 確認中..."
curl -sf "${GEOSERVER_URL}/wms?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetCapabilities" \
  -o /dev/null && log "WMS: OK" || log "WMS: 確認できませんでした"

log "セットアップ完了: workspace=${WORKSPACE}, store=${STORE_NAME}"
log "GeoServer管理画面: ${GEOSERVER_URL}/web/"
