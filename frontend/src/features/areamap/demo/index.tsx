import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Map, NavigationControl } from 'react-map-gl/maplibre';
import { BitmapLayer, GeoJsonLayer, IconLayer, PathLayer, PolygonLayer, ScatterplotLayer, TextLayer } from '@deck.gl/layers';
import { ContourLayer, HeatmapLayer } from '@deck.gl/aggregation-layers';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MVTLayer, TileLayer } from '@deck.gl/geo-layers';
import DeckOverlay from '@/components/deck-overlay';
import styles from '@/features/areamap/_shared-styles';
import Sidebar from '@/features/areamap/demo/sidebar';
import BasemapSwitcher from '@/components/sidebar-basemap-switcher';
import { groupedDataProcessor } from '@/utils/_data-processor';
import { debounce } from 'lodash';
import HistoryGraph from '@/components/hisotry-graph';
import SensorDetails from './sensor-details';
import WaterLevelDetails from './water-level-details';
import { adjustClimateData } from '@/utils/_adjust-sensor';
import { cacheManager, useCacheCleanup } from '@/utils/_cache-manager';
import { getWorkspaceUrl, fetchOrthoGranules, getOrthoWMSTileUrl, fetchCoverageBBox, CoverageBBox } from '@/utils/geoserver-utils';
import OrthoHistorySwitcher from '@/components/ortho-history-switcher';
import { Container } from 'lucide-react';


interface DemoAreaMapProps { userInfo?: any; pickingLocation?: boolean; onLocationPick?: (lat: number, lng: number) => void; journalEntries?: { id: string; record_date: string; text_content: string | null; location: { lat: number; lng: number } | null }[]; onJournalMarkerClick?: (entryId: string) => void; }
export default function DemoAreaMap({ userInfo, pickingLocation, onLocationPick, journalEntries = [], onJournalMarkerClick }: DemoAreaMapProps) {
    // キャッシュ管理フックの初期化
    const { clearExpiredCache, clearAllCache, getCacheStats } = useCacheCleanup(true);
    
    // デモエリア固定のワークスペース（demoワークスペースを使用）
    const currentWorkspace = 'demo';
    // api の命名規則 ortho-{workspace} に合わせる
    const STORE_NAME = `ortho-${currentWorkspace}`;

    // ベースマップのスタイル
    const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';
    const DARK_MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
    const TILE_SOURCES = {
        baseOrtho: 'https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg',
        baseGsi: 'https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png'
    };

    const getSuiroNoudouTile = () => getWorkspaceUrl('wmts', 'suiro-noudou', currentWorkspace);
    const getNouchiVariTile = () => getWorkspaceUrl('wmts', 'nouchi-vari-layer', currentWorkspace);

    // センターデータ（動的にワークスペースに基づいて生成）
    const getSensorsUrl = () => getWorkspaceUrl('wfs', 'sensor_data', currentWorkspace);
    const getWaterLevelSensorsUrl = () => getWorkspaceUrl('wfs', 'river_water_level', currentWorkspace);

    // 区画線データ（動的にワークスペースに基づいて生成）
    const getGridsUrl = () => getWorkspaceUrl('wmts', 'nouchi-grid-layer', currentWorkspace);
    const getGridsMvtUrl = () => getWorkspaceUrl('mvt', 'nouchi-grid-layer', currentWorkspace);

    // MAP初期表示時設定（GeoServerから自動取得、取得失敗時は日本中心のフォールバック）
    const DEFAULT_VIEW_STATE = {
        latitude: 35.681,
        longitude: 139.767,
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
    const [mapInitCenter, setMapInitCenter] = useState(DEFAULT_VIEW_STATE);
    const [viewState, setViewState] = useState(DEFAULT_VIEW_STATE);
    const [orthoExtent, setOrthoExtent] = useState<[number, number, number, number] | undefined>(undefined);
    const [isLoading, setIsLoading] = useState(true);
    const [currentOrthoLayer, setCurrentOrthoLayer] = useState('');
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
            // maxZoom: 18,
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

    // 農地オルソレイヤー（ImageMosaic WMS TIME パラメータ使用）
    // getTileData コールバックで tile.bbox (WGS84度数) を受け取り WMS URL を構築する。
    // data プロパティの URL テンプレートは {x},{y},{z} しか置換されないため使用しない。
    const nouchiOrthoLayer = useMemo(() => {
        return new TileLayer({
            id: `nouchi-ortho-layer-${currentOrthoLayer || 'none'}`,
            getTileData: async (tile: any) => {
                if (!currentOrthoLayer) return null;
                const url = getOrthoWMSTileUrl(currentWorkspace, STORE_NAME, currentOrthoLayer, tile.bbox);
                const res = await fetch(url);
                if (!res.ok) return null;
                const blob = await res.blob();
                return createImageBitmap(blob);
            },
            minZoom: 5,
            tileSize: 512,
            ...(orthoExtent ? { extent: orthoExtent } : {}),
            visible: layerVisibility.nouchiOrtho && !orthoLoading && !!currentOrthoLayer,
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
    }, [layerVisibility.nouchiOrtho, currentWorkspace, currentOrthoLayer, orthoLoading, orthoExtent]);


    const VARILayer = useMemo(() => {
        return new TileLayer({
            id: 'nouchi-vari-layer',
            data: getNouchiVariTile(),
            minZoom: 5,
            // maxZoom: 18,
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

    
    // 区画線表示レイヤー（TileLayer）
    const gridTileLayer = useMemo(() => {
        return new TileLayer({
            id: 'grid-tile-layer',
            data: getGridsUrl(),
            minZoom: 5,
            tileSize: 256,

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
        setLayerVisibility(prev => ({
            ...prev,
            [layerName]: visible===null ? !prev[layerName] : visible,
        }));
        
        // オルソ画像レイヤーが有効になった時にヒストリーコントロールを表示
        if (layerName === 'nouchiOrtho' && (visible === true || (visible === null && !layerVisibility.nouchiOrtho))) {
            setShowOrthoHistory(true);
        } else if (layerName === 'nouchiOrtho' && (visible === false || (visible === null && layerVisibility.nouchiOrtho))) {
            setShowOrthoHistory(false);
        }
    }, [contourData, viewState.zoom, colorDomain, layerVisibility.contour, layerVisibility.nouchiOrtho]);

    const toggleBaseMap = useCallback((baseMapName: string, visible: boolean | null) => {
        setBaseMapVisibility(prev => ({
            ...prev,
            [baseMapName]: visible===null ? !prev[baseMapName] : visible,
        }));
    }, [contourData, viewState.zoom]);


    // 生産者日誌マーカーレイヤー
    const journalMarkerLayer = useMemo(() => {
        const entries = (journalEntries as any[]).filter((e: any) => e.location !== null);
        if (entries.length === 0) return null;
        return new ScatterplotLayer({
            id: 'journal-markers',
            data: entries,
            getPosition: (d: any) => [d.location.lng, d.location.lat],
            getRadius: 8,
            radiusMinPixels: 8,
            radiusMaxPixels: 20,
            getFillColor: [74, 222, 128, 220],
            getLineColor: [255, 255, 255],
            lineWidthMinPixels: 2,
            stroked: true,
            pickable: true,
            onClick: (info: any) => {
                onJournalMarkerClick?.(info.object.id);
            },
            updateTriggers: { getPosition: journalEntries },
        });
    }, [journalEntries]);

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

        // 生産者日誌マーカーは最上層
        if (journalMarkerLayer) activeLayers.push(journalMarkerLayer);

        return activeLayers;
    }, [
        layerRenderOrder,
        nouchiOrthoLayer,
        gridTileLayer,
        gridClickLayer,
        heatmapLayer,
        sensorLayer,
        waterLevelLayer,
        waterLevelTextLayer,
        gsiMapLayer,
        gsiBaseMapLayer,
        waterLevelOrthoLayer,
        VARILayer,
        journalMarkerLayer
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

    // granule 一覧を取得して state を更新する（レイヤー ON 時にも呼ばれる）
    const refreshOrthoGranules = useCallback(async (workspace: string) => {
        try {
            const dates = await fetchOrthoGranules(workspace);
            if (dates.length === 0) return;
            setOrthoLayers(dates);
            // 現在選択中の日付が新しいリストに存在しない場合は最新日付に切り替える
            setCurrentOrthoLayer(prev => {
                const still = dates.some(d => d.layerName === prev);
                return still ? prev : dates[0].layerName;
            });
        } catch (error) {
            console.error('オルソ granule 一覧の取得に失敗:', error);
        }
    }, []);

    // データの読み込み（ワークスペース変更時に再実行）
    useEffect(() => {
        if (!currentWorkspace) return;

        setIsLoading(true);

        // --- granule 一覧 + BBox 取得 ---
        const granulesAndBBox = refreshOrthoGranules(currentWorkspace)
            .then(async () => {
                // BBox を取得してマップ初期位置・extent を更新
                const bbox = await fetchCoverageBBox(currentWorkspace, STORE_NAME);
                if (bbox) {
                    const centerLng = (bbox.minx + bbox.maxx) / 2;
                    const centerLat = (bbox.miny + bbox.maxy) / 2;
                    const lngSpan = bbox.maxx - bbox.minx;
                    const zoom = Math.max(10, Math.min(15, Math.round(Math.log2(360 / lngSpan)) - 1));
                    const center = { latitude: centerLat, longitude: centerLng, zoom, bearing: 0, pitch: 0 };
                    setMapInitCenter(center);
                    setViewState(center);
                    setOrthoExtent([bbox.minx, bbox.miny, bbox.maxx, bbox.maxy]);
                }
            })
            .catch(error => {
                console.error('BBox 取得に失敗:', error);
            });

        // --- センサーデータ取得 ---
        const sensorFetch = fetch(getSensorsUrl())
            .then(res => {
                if (!res.ok) throw new Error(`センサーデータの取得に失敗: ${res.status}`);
                return res.json();
            })
            .then(data => {
                const adjustedData = adjustClimateData(data);
                const grouped = groupedDataProcessor(adjustedData.features, 'properties.point_name', 'properties.datetime', 'desc');
                const preparedData: any = Object.entries(grouped).map(([, records]: any) => ({
                    ...records[0],
                    histories: records.sort((a: any, b: any) =>
                        new Date(b.properties.datetime).getTime() - new Date(a.properties.datetime).getTime()
                    ),
                }));
                setContourData(preparedData);
                setSensorData(preparedData);
                getColorScale(preparedData);
            })
            .catch(error => {
                console.error('センサーデータ取得エラー:', error);
                setContourData(null);
                setSensorData(null);
            });

        // granule/BBox とセンサーデータが両方揃ってからマップを表示する
        // （先にどちらかが終わっても isLoading=false にしない）
        Promise.all([granulesAndBBox, sensorFetch])
            .finally(() => setIsLoading(false));

        // --- 水位センサーデータ取得（地図表示をブロックしない） ---
        fetch(getWaterLevelSensorsUrl())
            .then(res => {
                if (!res.ok) throw new Error(`水位データの取得に失敗: ${res.status}`);
                return res.json();
            })
            .then(data => {
                const grouped = groupedDataProcessor(data.features, 'properties.station_name', 'properties.date_time', 'desc');
                const preparedData: any = Object.entries(grouped).map(([, records]: any) => ({
                    ...records[0],
                    histories: records,
                }));
                setWaterLevelData(preparedData);
            })
            .catch(error => {
                console.error('水位データ取得エラー:', error);
                setWaterLevelData(null);
            });

    }, [currentWorkspace, getColorScale, refreshOrthoGranules]);

    // ドローン空撮レイヤーが ON になったとき granule を最新化
    useEffect(() => {
        if (layerVisibility.nouchiOrtho && currentWorkspace) {
            refreshOrthoGranules(currentWorkspace);
        }
    }, [layerVisibility.nouchiOrtho, currentWorkspace, refreshOrthoGranules]);

    // オルソ画像履歴の日付変更ハンドラー
    const handleOrthoDateChange = useCallback((layerName: string) => {
        setCurrentOrthoLayer(layerName);
    }, []);

    // オルソ画像ローディング状態変更ハンドラー
    const handleOrthoLoadingChange = useCallback((loading: boolean) => {
        setOrthoLoading(loading);
    }, []);

    // キャッシュクリア時のコールバック
    const handleCacheCleared = (count: number) => {
        console.log(`キャッシュクリア完了: ${count}件`);
        // オルソレイヤーの再描画をトリガー
        if (count > 0) {
            setOrthoLoading(true);
            setTimeout(() => setOrthoLoading(false), 1000);
        }
    };

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
                            initialViewState={mapInitCenter}
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