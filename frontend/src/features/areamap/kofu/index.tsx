import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Map, NavigationControl } from 'react-map-gl/maplibre';
import { BitmapLayer, GeoJsonLayer, IconLayer, TextLayer } from '@deck.gl/layers';
import { ContourLayer, HeatmapLayer } from '@deck.gl/aggregation-layers';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MVTLayer, TileLayer } from '@deck.gl/geo-layers';
import DeckOverlay from '@/components/deck-overlay';
import styles from '@/features/areamap/_shared-styles';
import Sidebar from '@/features/areamap/kofu/sidebar';
import BasemapSwitcher from '@/components/sidebar-basemap-switcher';
import { groupedDataProcessor } from '@/utils/_data-processor';
import { debounce } from 'lodash';
import HistoryGraph from '@/components/hisotry-graph';
import SensorDetails from './sensor-details';
import WaterLevelDetails from './water-level-details';
import { adjustClimateData } from '@/utils/_adjust-sensor';
import { cacheManager, useCacheCleanup } from '@/utils/_cache-manager';
import { getWorkspaceUrl, fetchOrthoLayers } from '@/utils/geoserver-utils';
import OrthoHistorySwitcher from '@/components/ortho-history-switcher';


interface KofuAreaMapProps { userInfo?: any; pickingLocation?: boolean; onLocationPick?: (lat: number, lng: number) => void; }
export default function KofuAreaMap({ userInfo, pickingLocation, onLocationPick }: KofuAreaMapProps) {
    // キャッシュ管理フックの初期化
    const { clearExpiredCache, clearAllCache, getCacheStats } = useCacheCleanup(true);
    
    // 甲府市固定のワークスペース
    const currentWorkspace = 'kofu';

    // ベースマップのスタイル
    const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';
    const DARK_MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
    const TILE_SOURCES = {
        baseOrtho: 'https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg',
        baseGsi: 'https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png'
    };

    const getSuiroNoudouTile = () => getWorkspaceUrl('wmts', 'suiro-noudou', currentWorkspace);
    const getNouchiOrthoTile = (layerName = 'vtol-ortho-layer') => {
        const originalUrl = getWorkspaceUrl('wmts', layerName, currentWorkspace);
        // キャッシュバスティング適用チェック
        const finalUrl = cacheManager.getBustingUrl(originalUrl);
        
        // オルソレイヤーアクセスを記録
        cacheManager.recordCacheEntry(originalUrl, 'ortho', currentWorkspace);
        
        return finalUrl;
    };
    const getNouchiVariTile = () => getWorkspaceUrl('wmts', 'nouchi-vari-layer', currentWorkspace);

    // センターデータ（動的にワークスペースに基づいて生成）
    const getSensorsUrl = () => getWorkspaceUrl('wfs', 'sensor_data', currentWorkspace);
    const getWaterLevelSensorsUrl = () => getWorkspaceUrl('wfs', 'river_water_level', currentWorkspace);

    // 区画線データ（動的にワークスペースに基づいて生成）
    const getGridsUrl = () => getWorkspaceUrl('mvt', 'nouchi-grid-layer', currentWorkspace);

    // MAP初期表示時設定
    const INITIAL_VIEW_STATE = {
        latitude: 35.48405075073242,
        longitude: 138.44937133789062,
        zoom: 15,
        bearing: 0,
        pitch: 0
    };

    const mapRef = useRef<any>(null);
    const [selected, setSelected] = useState(null);
    const [selectedWaterLevel, setSelectedWaterLevel] = useState(null);
    const [contourData, setContourData] = useState(null);
    const [sensorData, setSensorData] = useState(null);
    const [waterLevelData, setWaterLevelData] = useState(null);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [mapModeDark, setMapModeDark] = useState(false);
    const [gridInfo, setGridInfo] = useState(null);
    const [colorDomain, setColorDomain] = useState([14, 38]);
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

    // レイヤーの描画順序を管理する状態
    const [layerRenderOrder, setLayerRenderOrder] = useState([
        'grids', 'contour', 'sensors', 'waterLevel', 'nouchiOrtho', 'nouchiVari'
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
        nouchiVari: false,
        grids: true,
        contour: false,
        sensors: false,
        waterLevel: false,
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

    // ズームレベルに基づいて半径を計算する関数
    const calculateRadius = useCallback((zoom) => {
        return Math.max(100, 280 * (zoom - 15 + 1));
    }, []);

    // 温度に基づく色のスケール
    const getColorScale = useCallback((data) => {
        if (!data || data.length === 0) return;

        const tempValues = data.map(d => d.properties.temp);
        const therehold = Number(process.env.NEXT_PUBLIC_ADJUSTMENT_TEMP_COLOR_RANGE);
        const minTemp = Math.min(...tempValues) - therehold;
        const maxTemp = Math.max(...tempValues) + therehold;

        setColorDomain([minTemp, maxTemp]);
    }, []);

    // 農地オルソレイヤー
    const nouchiOrthoLayer = useMemo(() => {
        return new TileLayer({
            id: `nouchi-ortho-layer-${currentOrthoLayer}`,
            data: getNouchiOrthoTile(currentOrthoLayer),
            minZoom: 5,
            maxZoom: 18,
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


    const VARILayer = useMemo(() => {
        return new TileLayer({
            id: 'nouchi-vari-layer',
            data: getNouchiVariTile(),
            minZoom: 5,
            maxZoom: 18,
            tileSize: 256,
            visible: layerVisibility.nouchiVari,
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
    }, [layerVisibility.nouchiVari, currentWorkspace]);

    
    // 区画線レイヤー
    const gridLayer = useMemo(() => {
        return new MVTLayer({
            id: 'mvt-layer',
            data: getGridsUrl(),
            minZoom: 5,
            maxZoom: 18,
            getFillColor: [255, 0, 0, 0],
            getLineColor: [70, 70, 70, 255],
            lineWidthMinPixels: 0.5,
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

    // センサーポイントレイヤー
    const sensorLayer = useMemo(() => {
        if (!sensorData) return null;        
        return new GeoJsonLayer({
            id: 'sensors',
            data: sensorData,
            filled: true,
            pointRadiusMinPixels: 10,
            pointRadiusScale: 10,
            // getPointRadius: f => f.properties.temp / 2,
            getFillColor: [200, 0, 80, 180],
            pickable: true,
            autoHighlight: true,
            onClick: info => {
                setSelected(info.object);
                setSidebarOpen(true);
            },
            visible: layerVisibility.sensors
        });
    }, [sensorData, layerVisibility.sensors]);

    // 気温分布ヒートマップレイヤー
    const heatmapLayer = useMemo(() => {
        if (!contourData) return null;
        
        // ズームレベルに基づいてradiusPixelsを調整
        const radiusPixels = calculateRadius(viewState.zoom);
        
        return new HeatmapLayer({
            id: 'heatmap-layer',
            data: contourData,
            aggregation: 'MEAN',
            getPosition: d => d.geometry.coordinates,
            getWeight: d => d.properties.temp - 15,
            radiusPixels,
            intensity: 2,
            threshold: 0.05,
            colorDomain: colorDomain as any,
            colorRange: [
                [0, 128, 255],
                [0, 255, 255],
                [255, 255, 0],
                [255, 128, 0],
                [255, 0, 0]
            ],    
            opacity: 0.5,
            parameters: {
                depthTest: false,
                blend: true
            },
            visible: layerVisibility.contour,
            // GPUアグリゲーションを有効化して精度を向上
            gpuAggregation: true,
            // テクスチャのサイズを増やして精度向上
            // weightsTextureSize: 4096,
            updateTriggers: {
                getPosition: contourData,
                getWeight: contourData,
                radiusPixels: viewState.zoom
            }
        });
    }, [contourData, viewState.zoom, colorDomain, layerVisibility.contour, calculateRadius]);


    const waterLevelLayer = useMemo(() => {
        if (!waterLevelData) return null;        
        return new IconLayer({
            id: 'water_levels',
            data: waterLevelData,
            pickable: true,
            iconAtlas: '/ico-water-level.png',
            iconMapping: {
                marker: {x: 0, y: 0, width: 485, height: 588, mask: true}
            },
            getIcon: d => 'marker',
            sizeScale: 8,
            getPosition: d => d.geometry.coordinates,
            getSize: d => {
                // 水位に応じてサイズを変更（最小サイズ + 水位による追加サイズ）
                const minSize = 3;
                const waterLevelFactor = 3;
                return minSize + (d.properties.water_level * waterLevelFactor);
            },
            getColor: d => {
                // 水位ステータスに応じて色を変更
                // if (d.properties.water_level >= d.properties.danger_level) return [241, 0, 0]; // 危険
                // if (d.properties.water_level >= d.properties.evac_level) return [237, 107, 0]; // 避難
                // if (d.properties.water_level >= d.properties.caution_level) return [205, 172, 10]; // 注意
                // if (d.properties.water_level >= d.properties.standby_level) return [3, 149, 93]; // 待機
                return [37, 74, 128]; // 平常
            },
            onClick: info => {
                setSelectedWaterLevel(info.object);
                setSidebarOpen(true);
            },
            visible: layerVisibility.waterLevel
        });

    }, [waterLevelData, layerVisibility.waterLevel])

    const waterLevelTextLayer = useMemo(() => {
        if (!waterLevelData) return null;
        
        return new TextLayer({
            id: 'water-level-labels',
            data: waterLevelData,
            pickable: true,
            getPosition: d => d.geometry.coordinates,
            getText: d => `${(Math.floor(d.properties.water_level * 10) / 10).toString()}m`, // 水位の整数部分を表示
            getSize: d => {
                // 水位に応じてサイズを変更（最小サイズ + 水位による追加サイズ）
                const minSize = 13;
                const waterLevelFactor = 6;
                return minSize + (d.properties.water_level * waterLevelFactor);
            },
            getAngle: 0,
            getTextAnchor: 'middle',
            getAlignmentBaseline: 'center',
            getPixelOffset: [0, -5], // アイコンの上にテキストを表示するためのオフセット
            getColor: [255, 255, 255],
            fontFamily: 'Inter, Helvetica', // フォントファミリーを指定
            fontWeight: 900,
            onClick: info => {
                setSelectedWaterLevel(info.object);
                setSidebarOpen(true);
            },
            visible: layerVisibility.waterLevel
        })
    }, [waterLevelData, layerVisibility.waterLevel])

    // レイヤー設定の更新
    const toggleLayer = useCallback((layerName, visible = null) => {
        setLayerVisibility(prev => {
            const newVisibility = {
                ...prev,
                [layerName]: visible===null ? !prev[layerName] : visible,
            };
            
            // nouchiOrtho レイヤーがトグルされた時にオルソ履歴の表示を制御
            if (layerName === 'nouchiOrtho') {
                setShowOrthoHistory(newVisibility.nouchiOrtho);
            }
            
            return newVisibility;
        });
    }, [contourData, viewState.zoom, colorDomain, layerVisibility.contour]);

    // オルソ画像の日付変更ハンドラー
    const handleOrthoDateChange = useCallback((layerName: string) => {
        setCurrentOrthoLayer(layerName);
    }, []);

    // オルソ画像ローディング状態変更ハンドラー
    const handleOrthoLoadingChange = useCallback((loading: boolean) => {
        setOrthoLoading(loading);
    }, []);

    const toggleBaseMap = useCallback((baseMapName: string, visible: boolean | null) => {
        setBaseMapVisibility(prev => ({
            ...prev,
            [baseMapName]: visible===null ? !prev[baseMapName] : visible,
        }));
    }, [contourData, viewState.zoom]);


    // すべてのレイヤーを1つの配列にまとめる
    const layers = useMemo(() => {
        const activeLayers: any[] = [];
        
        // ベースマップレイヤー（常に最下層）
        if (gsiMapLayer) activeLayers.push(gsiMapLayer);
        if (gsiBaseMapLayer) activeLayers.push(gsiBaseMapLayer);
        if (waterLevelOrthoLayer) activeLayers.push(waterLevelOrthoLayer);
        
        // レイヤーIDとレイヤーオブジェクトのマッピング
        const layerMap = {
            'grids': [gridLayer].filter(Boolean),
            'contour': [], // contourLayerがコメントアウトされているため空配列
            'sensors': [sensorLayer].filter(Boolean),
            'waterLevel': [waterLevelLayer, waterLevelTextLayer].filter(Boolean),
            'nouchiOrtho': [nouchiOrthoLayer].filter(Boolean),
            'nouchiVari': [VARILayer].filter(Boolean)
        };
        
        // サイドバーで設定された順序でレイヤーを追加（上にあるレイヤーが前面に来るよう逆順で処理）
        [...layerRenderOrder].reverse().forEach(layerKey => {
            const layers = layerMap[layerKey];
            if (layers && layers.length > 0) {
                activeLayers.push(...layers);
            }
        });
        
        // ヒートマップは常に上層に配置
        if (heatmapLayer) activeLayers.push(heatmapLayer);
        
        return activeLayers;
    }, [
        layerRenderOrder,
        nouchiOrthoLayer, 
        gridLayer, 
        heatmapLayer, 
        sensorLayer, 
        waterLevelLayer, 
        waterLevelTextLayer, 
        gsiMapLayer, 
        gsiBaseMapLayer, 
        waterLevelOrthoLayer, 
        VARILayer
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

        // センサーデータ取得
        fetch(getSensorsUrl())
        .then(res => {
            if (!res.ok) {
                throw new Error(`センサーデータの取得に失敗: ${res.status}`);
            }
            return res.json();
        })
        .then(data => {
            const adjustedData = adjustClimateData(data);
            return adjustedData;
        })
        .then(data => {
            const grouped = groupedDataProcessor(data.features, 'properties.point_name', 'properties.datetime', 'desc');

            const preparedData: any = Object.entries(grouped).map(([, records]: any) => {
                return {
                    ...records[0],
                    histories: records.sort((a: any, b: any) => new Date(b.properties.datetime).getTime() - new Date(a.properties.datetime).getTime())
                };
            });
            
            setContourData(preparedData);
            setSensorData(preparedData);
            getColorScale(preparedData);
        })
        .catch(error => {
            console.error('センサーデータ取得エラー:', error);
            setContourData(null);
            setSensorData(null);
        })
        .finally(() => setIsLoading(false));

        // 水位センサーデータ取得
        fetch(getWaterLevelSensorsUrl())
        .then(res => {
            if (!res.ok) {
                throw new Error(`水位データの取得に失敗: ${res.status}`);
            }
            return res.json();
        })
        .then(data => {
            const grouped = groupedDataProcessor(data.features, 'properties.station_name', 'properties.date_time', 'desc');

            const preparedData: any = Object.entries(grouped).map(([, records]: any) => {
                return {
                    ...records[0],
                    histories: records
                };
            });
            setWaterLevelData(preparedData);
        })
        .catch(error => {
            console.error('水位データ取得エラー:', error);
            setWaterLevelData(null);
        });

    }, [currentWorkspace, getColorScale]);

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
                    <>
                        <Map
                            initialViewState={INITIAL_VIEW_STATE}
                            mapStyle={!mapModeDark ? MAP_STYLE : DARK_MAP_STYLE}
                            style={styles.map}
                            onMove={onViewStateChange}
                            onDrag={onViewStateChange}
                            onZoom={onViewStateChange}
                            onRotate={onViewStateChange}
                            ref={mapRef}
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
                        {/* 場所選択モード: DeckOverlay のクリック横取りを回避する透明オーバーレイ */}
                        {pickingLocation && (
                            <div
                                style={{
                                    position: 'absolute', inset: 0, zIndex: 500,
                                    cursor: 'crosshair',
                                    background: 'rgba(59,130,246,0.08)',
                                }}
                                onClick={(e) => {
                                    if (!mapRef.current || !onLocationPick) return;
                                    const map = mapRef.current.getMap();
                                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                    const x = e.clientX - rect.left;
                                    const y = e.clientY - rect.top;
                                    const lngLat = map.unproject([x, y]);
                                    onLocationPick(lngLat.lat, lngLat.lng);
                                }}
                            />
                        )}
                    </>
                }
            </div>

            {/* 選択したセンサーの詳細情報 */}
            {(layerVisibility.sensors && selected) &&
                <SensorDetails
                    selected={selected}
                    onClose={() => setSelected(null)}
                />
            }
            {(layerVisibility.waterLevel && selectedWaterLevel) &&
                <WaterLevelDetails
                    selected={selectedWaterLevel}
                    onClose={() => setSelectedWaterLevel(null)}
                />
            }

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