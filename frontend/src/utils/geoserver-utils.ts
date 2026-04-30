const GEOSERVER_HOST = process.env.NEXT_PUBLIC_GEOSERVER_HOST || 'http://localhost:8080/geoserver';

export const fetchWorkspaceLayers = async (workspace: string): Promise<string[]> => {
    const res = await fetch(`/api/geoserver/layers?workspace=${encodeURIComponent(workspace)}`);
    if (!res.ok) throw new Error(`GeoServer layers API error: ${res.status}`);
    const data = await res.json();
    return data.layers ?? [];
};

export interface OrthoHistoryDate {
    date: string;      // YYYY-MM-DD
    layerName: string; // ImageMosaic 用: TIME値 (ISO8601)
    displayName: string;
}

/**
 * ImageMosaic の granule 一覧から時系列エントリを取得する。
 * api の /webhook/granules/{workspace} をプロキシする API 経由で取得。
 */
export const fetchOrthoGranules = async (workspace: string): Promise<OrthoHistoryDate[]> => {
    const res = await fetch(`/api/geoserver/granules?workspace=${encodeURIComponent(workspace)}`);
    if (!res.ok) throw new Error(`granules API error: ${res.status}`);
    const data = await res.json();

    return (data.granules ?? [])
        .map((g: any) => {
            // ingestion: "2009-10-01T00:00:00.000Z" または "2009-10-01T00:00:00"
            const iso = g.ingestion as string;
            const datePart = iso.slice(0, 10); // YYYY-MM-DD
            const [year, month, day] = datePart.split('-');
            // ISO8601 形式に正規化（TIME パラメータに使用）
            const isoTime = iso.includes('Z') ? iso : `${iso}Z`;
            return {
                date: datePart,
                layerName: isoTime,   // WMS TIME パラメータとして使用
                displayName: `${year}年${month}月${day}日`,
            };
        })
        .sort((a: OrthoHistoryDate, b: OrthoHistoryDate) => b.date.localeCompare(a.date));
};

/**
 * 後方互換: vtol-ortho-layer-YYYYMMDD 形式のレイヤー名リストを返す。
 * ImageMosaic に移行済みの場合は fetchOrthoGranules を使うこと。
 */
export const fetchOrthoLayers = async (workspace: string): Promise<OrthoHistoryDate[]> => {
    const layers = await fetchWorkspaceLayers(workspace);
    return layers
        .filter(name => /^vtol-ortho-layer-\d{8}$/.test(name))
        .sort()
        .reverse()
        .map(name => {
            const match = name.match(/(\d{4})(\d{2})(\d{2})$/);
            return {
                date: match ? `${match[1]}-${match[2]}-${match[3]}` : '2025-01-01',
                layerName: name,
                displayName: match ? `${match[1]}年${match[2]}月${match[3]}日` : name,
            };
        });
};

/**
 * ImageMosaic 用 WMS GetMap タイル URL を生成する。
 * Deck.gl TileLayer の getTileData コールバック内で tile.bbox を渡して使用する。
 * tile.bbox は WGS84 度数 (EPSG:4326) で提供されるため SRS=EPSG:4326 を使う。
 *
 * @param workspace GeoServer ワークスペース名
 * @param storeName カバレッジストア名 (例: "ortho-demo")
 * @param timeISO  TIME パラメータ (ISO8601, 例: "2009-10-01T00:00:00.000Z")
 * @param bbox     タイルの BBOX { west, south, east, north } (WGS84 度数)
 */
export const getOrthoWMSTileUrl = (
    workspace: string,
    storeName: string,
    timeISO: string,
    bbox: { west: number; south: number; east: number; north: number }
): string => {
    const { west, south, east, north } = bbox;
    const params = new URLSearchParams({
        SERVICE: 'WMS',
        VERSION: '1.1.1',
        REQUEST: 'GetMap',
        LAYERS: `${workspace}:${storeName}`,
        TIME: timeISO,
        BBOX: `${west},${south},${east},${north}`,
        WIDTH: '512',
        HEIGHT: '512',
        SRS: 'EPSG:4326',
        FORMAT: 'image/png',
        TRANSPARENT: 'TRUE',
    });
    return `${GEOSERVER_HOST}/${workspace}/wms?${params.toString()}`;
};

export interface CoverageBBox {
    minx: number;
    maxx: number;
    miny: number;
    maxy: number;
}

/**
 * GeoServer カバレッジの latLonBoundingBox（WGS84）を取得する。
 * フロントエンドから GeoServer REST API に直接アクセスせず、Next.js プロキシ経由で取得する。
 */
export const fetchCoverageBBox = async (
    workspace: string,
    store: string
): Promise<CoverageBBox | null> => {
    try {
        const res = await fetch(
            `/api/geoserver/coverage-bbox?workspace=${encodeURIComponent(workspace)}&store=${encodeURIComponent(store)}`
        );
        if (!res.ok) return null;
        return await res.json() as CoverageBBox;
    } catch {
        return null;
    }
};

export const getWorkspaceUrl = (service: string, layer?: string, workspace?: string) => {
    const currentWorkspace = workspace || 'rtos';

    const baseWmtsUrl = `${GEOSERVER_HOST}/${currentWorkspace}/gwc/service/wmts?REQUEST=GetTile&SERVICE=WMTS&VERSION=1.0.0&LAYER=${currentWorkspace}:${layer}&STYLE=&TILEMATRIX=EPSG:900913:{z}&TILEMATRIXSET=EPSG:900913&FORMAT=image/png&TILECOL={x}&TILEROW={y}`;
    const baseWfsUrl = `${GEOSERVER_HOST}/${currentWorkspace}/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=${currentWorkspace}:${layer}&outputFormat=application/json`;
    const baseMvtUrl = `${GEOSERVER_HOST}/${currentWorkspace}/gwc/service/wmts?REQUEST=GetTile&SERVICE=WMTS&VERSION=1.0.0&LAYER=${currentWorkspace}:${layer}&STYLE=&TRANSPARENT=true&TILEMATRIX=EPSG:900913:{z}&TILEMATRIXSET=EPSG:900913&FORMAT=application/vnd.mapbox-vector-tile&TILECOL={x}&TILEROW={y}`;

    switch (service) {
        case 'wmts': return baseWmtsUrl;
        case 'wfs': return baseWfsUrl;
        case 'mvt': return baseMvtUrl;
        default: return baseWfsUrl;
    }
};
