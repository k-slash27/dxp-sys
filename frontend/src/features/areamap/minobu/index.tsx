import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Map, NavigationControl } from 'react-map-gl/maplibre';
import { BitmapLayer } from '@deck.gl/layers';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MVTLayer, TileLayer } from '@deck.gl/geo-layers';
import DeckOverlay from '@/components/deck-overlay';
import styles from '@/features/areamap/_shared-styles';
import Sidebar from '@/features/areamap/minobu/sidebar';
import BasemapSwitcher from '@/components/sidebar-basemap-switcher';
import { debounce } from 'lodash';
import { cacheManager, useCacheCleanup } from '@/utils/_cache-manager';
import { getWorkspaceUrl, fetchOrthoLayers } from '@/utils/geoserver-utils';
import OrthoHistorySwitcher from '@/components/ortho-history-switcher';


export default function MinobuAreaMap({ userInfo }: { userInfo?: any }) {
    // キャッシュ管理フックの初期化
    const { clearExpiredCache, clearAllCache, getCacheStats } = useCacheCleanup(true);
    
    // 身延町固定のワークスペース（minobuワークスペースを使用）
    const currentWorkspace = 'minobu';

    // ベースマップのスタイル
    const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';
    const TILE_SOURCES = {
        baseOrtho: 'https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg',
        baseGsi: 'https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png'
    };

    const getSuiroNoudouTile = () => getWorkspaceUrl('wmts', 'suiro-noudou', currentWorkspace);
    const getNouchiOrthoTile = (layerName: string = 'vtol-ortho-layer') => {
        const originalUrl = getWorkspaceUrl('wmts', layerName, currentWorkspace);
        // キャッシュバスティング適用チェック
        const finalUrl = cacheManager.getBustingUrl(originalUrl);
        
        // オルソレイヤーアクセスを記録
        cacheManager.recordCacheEntry(originalUrl, 'ortho', currentWorkspace);
        
        return finalUrl;
    };

    // 区画線データ（動的にワークスペースに基づいて生成）
    const getGridsUrl = () => getWorkspaceUrl('wmts', 'nouchi-grid-layer', currentWorkspace);
    const getGridsMvtUrl = () => getWorkspaceUrl('mvt', 'nouchi-grid-layer', currentWorkspace);

    // MAP初期表示時設定
    const INITIAL_VIEW_STATE = {
        latitude: 35.48405075073242,
        longitude: 138.44937133789062,
        zoom: 15,
        bearing: 0,
        pitch: 0
    };

    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [gridInfo, setGridInfo] = useState(null);
    const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);
    const [isLoading, setIsLoading] = useState(true);
    const [currentOrthoLayer, setCurrentOrthoLayer] = useState('vtol-ortho-layer');
    const [orthoLayers, setOrthoLayers] = useState<{ date: string; layerName: string; displayName: string }[]>([]);
    const [showOrthoHistory, setShowOrthoHistory] = useState(false);
    const [orthoLoading, setOrthoLoading] = useState(false);

    // ベースマップ表示状態
    const [baseMapVisibility, setBaseMapVisibility] = useState({
        standard: true,
        baseOrtho: false,
        baseGsi: false,
        baseWaterLevel: false,
    });

    // レイヤーの描画順序を管理する状態（身延町は2つのレイヤーのみ）
    const [layerRenderOrder, setLayerRenderOrder] = useState([
        'grids', 'nouchiOrtho'
    ]);

    // サイドバーからのレイヤー順序変更を受け取る
    const handleLayerOrderChange = (newOrder) => {
        const orderKeys = newOrder.map(layer => layer.key);
        setLayerRenderOrder(orderKeys);
    };

    // 航空写真レイヤー
    const gsiMapLayer = useMemo(() => {
        return new TileLayer({
            id: 'gsi-ortho-layer',
            data: TILE_SOURCES['baseOrtho'],
            minZoom: 5,
            maxZoom: 18,
            tileSize: 256,
            renderSubLayers: (props: any) => {
                const {
                    bbox: { west, south, east, north }
                } = props.tile;

                return new BitmapLayer(props, {
                    data: null,
                    image: props.data,
                    bounds: [west, south, east, north]
                } as any);
            },
            visible: baseMapVisibility.baseOrtho,
        });
    }, [baseMapVisibility.baseOrtho]);

    // 地理院地図レイヤー
    const gsiBaseMapLayer = useMemo(() => {
        return new TileLayer({
            id: 'gsi-base-layer',
            data: TILE_SOURCES['baseGsi'],
            minZoom: 5,
            maxZoom: 18,
            tileSize: 256,
            visible: baseMapVisibility.baseGsi,
            renderSubLayers: (props: any) => {
                const {
                    bbox: { west, south, east, north }
                } = props.tile;

                return new BitmapLayer(props, {
                    data: null,
                    image: props.data,
                    bounds: [west, south, east, north]
                } as any);
            },
        });
    }, [baseMapVisibility.baseGsi]);
    
    // 水路マップ
    const waterLevelOrthoLayer = useMemo(() => {
        return new TileLayer({
            id: 'water-level-ortho-layer',
            data: getSuiroNoudouTile(),
            minZoom: 5,
            maxZoom: 18,
            tileSize: 256,
            visible: baseMapVisibility.baseWaterLevel,
            renderSubLayers: (props: any) => {
                const {
                    bbox: { west, south, east, north }
                } = props.tile;

                return new BitmapLayer(props, {
                    data: null,
                    image: props.data,
                    bounds: [west, south, east, north]
                } as any);
            },
        });
    }, [baseMapVisibility.baseWaterLevel, currentWorkspace]);
    

    // レイヤー表示状態
    const [layerVisibility, setLayerVisibility] = useState({
        nouchiOrtho: false,
        // nouchiVari: false,
        grids: true,
        // contour: false,
        // sensors: false,
        // waterLevel: false,
    });

    // ビューステート変更のハンドラー
    const onViewStateChange = useCallback(
        debounce(
            ({viewState}) => {
                setViewState(viewState);
            },
        300, { maxWait: 500 }),
        []
    );

    // 農地オルソレイヤー
    const nouchiOrthoLayer = useMemo(() => {
        return new TileLayer({
            id: `nouchi-ortho-layer-${currentOrthoLayer}`,
            data: getNouchiOrthoTile(currentOrthoLayer),
            minZoom: 5,
            // maxZoom: 18,
            tileSize: 256,
            visible: layerVisibility.nouchiOrtho && !orthoLoading,
            onTileLoad: (tile: any) => {
                // タイルロード時にキャッシュエントリを記録
                if (tile.url && tile.url.includes('ortho')) {
                    cacheManager.recordCacheEntry(tile.url, 'ortho', currentWorkspace);
                }
            },
            renderSubLayers: (props: any) => {
                const {
                    bbox: { west, south, east, north }
                } = props.tile;

                return new BitmapLayer(props, {
                    data: null,
                    image: props.data,
                    bounds: [west, south, east, north]
                } as any);
            },
        });
    }, [layerVisibility.nouchiOrtho, currentWorkspace, currentOrthoLayer, orthoLoading]);
    
    // 区画線表示レイヤー（TileLayer）
    const gridTileLayer = useMemo(() => {
        return new TileLayer({
            id: 'grid-tile-layer',
            data: getGridsUrl(),
            minZoom: 5,
            tileSize: 256,
            opacity: 0.6,
            visible: layerVisibility.grids,
            renderSubLayers: (props: any) => {
                const {
                    bbox: { west, south, east, north }
                } = props.tile;

                return new BitmapLayer(props, {
                    data: null,
                    image: props.data,
                    bounds: [west, south, east, north],
                    tintColor: [255, 255, 255], // 茶色系でmultiply効果
                    blendMode: 'multiply'  // より簡単な指定方法
                } as any);
            },
        });
    }, [layerVisibility.grids, currentWorkspace]);

    // 区画線クリック検出レイヤー（透明なMVTLayer）
    const gridClickLayer = useMemo(() => {
        return new MVTLayer({
            id: 'grid-click-layer',
            data: getGridsMvtUrl(),
            minZoom: 5,
            maxZoom: 18,
            getFillColor: [0, 0, 0, 0], // 完全に透明
            getLineColor: [0, 0, 0, 0], // 完全に透明
            lineWidthMinPixels: 0,
            visible: layerVisibility.grids,
            pickable: true,
            onClick: info => {
                if (info.object) {
                    setGridInfo({
                        object: info?.object,
                        x: info.x,
                        y: info.y
                    } as any);
                } else {
                    setGridInfo(null);
                }
            },
            onBlur: () => setGridInfo(null)
        });
    }, [layerVisibility.grids, currentWorkspace]);

    // レイヤー設定の更新
    const toggleLayer = useCallback((layerName, visible = null) => {
        setLayerVisibility(prev => ({
            ...prev,
            [layerName]: visible===null ? !prev[layerName] : visible,
        }));
        
        if (layerName === 'nouchiOrtho' && (visible === true || (visible === null && !layerVisibility.nouchiOrtho))) {
            setShowOrthoHistory(true);
        } else if (layerName === 'nouchiOrtho' && (visible === false || (visible === null && layerVisibility.nouchiOrtho))) {
            setShowOrthoHistory(false);
        }
    }, [viewState.zoom, layerVisibility.nouchiOrtho]);

    const toggleBaseMap = useCallback((baseMapName: string, visible: boolean | null) => {
        setBaseMapVisibility(prev => ({
            ...prev,
            [baseMapName]: visible===null ? !prev[baseMapName] : visible,
        }));
    }, [viewState.zoom]);


    // すべてのレイヤーを1つの配列にまとめる
    const layers = useMemo(() => {
        const activeLayers: any[] = [];
        
        // ベースマップレイヤー（常に最下層）
        if (gsiMapLayer) activeLayers.push(gsiMapLayer);
        if (gsiBaseMapLayer) activeLayers.push(gsiBaseMapLayer);
        if (waterLevelOrthoLayer) activeLayers.push(waterLevelOrthoLayer);
        
        // レイヤーIDとレイヤーオブジェクトのマッピング
        const layerMap = {
            'grids': [gridTileLayer, gridClickLayer].filter(Boolean),
            'nouchiOrtho': [nouchiOrthoLayer].filter(Boolean)
        };
        
        // サイドバーで設定された順序でレイヤーを追加（上にあるレイヤーが前面に来るよう逆順で処理）
        [...layerRenderOrder].reverse().forEach(layerKey => {
            const layers = layerMap[layerKey];
            if (layers && layers.length > 0) {
                activeLayers.push(...layers);
            }
        });
        
        return activeLayers;
    }, [
        layerRenderOrder,
        nouchiOrthoLayer, 
        gridTileLayer, 
        gridClickLayer, 
        gsiMapLayer, 
        gsiBaseMapLayer, 
        waterLevelOrthoLayer
    ]);

    // GeoPackageの属性データを表示
    const renderTooltip = () => {
        if (!gridInfo) return null;
        const { object, x, y }: any = gridInfo;
        const properties = object.properties;
        return (
            <div style={{ ...styles.tooltip, left: x, top: y }}>
                <div style={styles.tooltipClose} onClick={() => setGridInfo(null)}>
                    ×
                </div>
                {Object.keys(properties).map(key => (
                    <div key={key}>
                        <strong>{key}:</strong> {properties[key]}
                    </div>
                ))}
            </div>
        );
    };

    // データの読み込み（ワークスペース変更時に再実行）
    useEffect(() => {
        if (!currentWorkspace) return;

        setIsLoading(true);

        // オルソレイヤー名取得
        fetchOrthoLayers(currentWorkspace)
        .then(dates => {
            if (dates.length > 0) {
                setCurrentOrthoLayer(dates[0].layerName);
                setOrthoLayers(dates);
            }
        })
        .catch(error => {
            console.error('オルソレイヤーの取得に失敗:', error);
        });

        setTimeout(() => {
            setIsLoading(false);
        }, 1000);
    }, [currentWorkspace]);

    const handleOrthoDateChange = useCallback((layerName: string) => {
        setCurrentOrthoLayer(layerName);
    }, []);

    // オルソ画像ローディング状態変更ハンドラー
    const handleOrthoLoadingChange = useCallback((loading: boolean) => {
        setOrthoLoading(loading);
    }, []);

    return (
        <div style={styles.container}>
            {/* サイドバー */}
            <Sidebar
                sidebarOpen={sidebarOpen}
                setSidebarOpen={setSidebarOpen}
                layerVisibility={layerVisibility}
                toggleLayer={toggleLayer}
                setShowOrthoHistory={setShowOrthoHistory}
                onLayerOrderChange={handleLayerOrderChange}
            />

            {/* マップコンテナ */}
            <div style={styles.mapContainer}>
                {isLoading ? 
                    <div style={styles.loading}>Loading...</div>
                    :
                    <Map
                        initialViewState={INITIAL_VIEW_STATE}
                        mapStyle={MAP_STYLE}
                        style={styles.map}
                        onMove={onViewStateChange}
                        onDrag={onViewStateChange}
                        onZoom={onViewStateChange}
                        onRotate={onViewStateChange}
                        reuseMaps
                    >
                        {!isLoading && 
                            <DeckOverlay
                                layers={layers}
                                onViewStateChange={onViewStateChange}
                                controller={true}
                            />
                        }
                        <NavigationControl position="top-right" />
                        {renderTooltip()}

                        {/* Basemap Switcher - positioned absolutely in bottom-right */}
                        <BasemapSwitcher toggleBaseMap={toggleBaseMap} />
                    </Map>
                } 

                {/* 身延町エリアの場合はみのワンを表示 */}
                <img width={80} height={'auto'} src={'/mino-wan.svg'} style={{ position: 'absolute', bottom: '40px', right: '10px', zIndex: 999}} />
            </div>

            {/* ドローン空撮画像履歴 - 画面下中央に配置 */}
            {layerVisibility.nouchiOrtho && (
                <div style={{
                    position: 'absolute',
                    bottom: '20px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '450px',
                    maxWidth: 'calc(100vw - 400px)',
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    borderRadius: '12px',
                    padding: '5px 15px',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                    zIndex: 100,
                    backdropFilter: 'blur(8px)'
                }}>
                    <OrthoHistorySwitcher
                        onDateChange={handleOrthoDateChange}
                        availableDates={orthoLayers}
                        currentWorkspace={currentWorkspace}
                    />
                </div>
            )}
        </div>
    );
}