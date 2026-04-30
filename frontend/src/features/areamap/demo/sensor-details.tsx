import HistoryGraph from "@/components/hisotry-graph";
import styles from "@/features/areamap/_shared-styles";
import { useState } from "react";
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { calculateDewPoint, calculateWBGT, saturationVaporDensity } from "@/utils/_data-processor";
import { formatDateTime } from "@/utils/_adjust-sensor";
import { useResizable } from '@/hooks/use-resizable';

dayjs.extend(utc);
dayjs.extend(timezone);

dayjs.tz.setDefault('Asia/Tokyo');


// センサー詳細情報コンポーネント
const SensorDetails = ({ selected, onClose }) => {
    const [displayMode, setDisplayMode] = useState<string>('graph');
    const { width, resizeHandle } = useResizable(370, 240, 800);

    const wbgtValue = calculateWBGT(selected.properties.temp, selected.properties.humid);

    return (
        <div style={{ position: 'absolute', top: '110px', right: '10px', width, height: 'calc(100vh - 210px)', borderRadius: '8px', zIndex: 999, backgroundColor: 'white', boxShadow: '4px 0 8px rgba(0, 0, 0, 0.15)' }}>
            {resizeHandle}
            <div style={{ height: '100%', overflowY: 'auto', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <h3 style={{...styles.sectionTitle, fontSize: '17px'}}>環境センサーポイント情報</h3>
                <button
                    onClick={onClose}
                    style={styles.closeButton}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>

            <div style={styles.detailsContent}>
                <div style={styles.detailsHeader}>
                    <h3 style={styles.detailsTitle}>{selected.properties.point_name}</h3>
                </div>

                <div style={styles.infoCard}>
                    <div style={styles.infoGrid}>
                        <div style={styles.infoLabel}>温度</div>
                        <div style={styles.infoValue}>{selected.properties.temp} °C</div>

                        <div style={styles.infoLabel}>湿度</div>
                        <div style={styles.infoValue}>{selected.properties.humid} %</div>

                        <div style={styles.infoLabel}>気圧</div>
                        <div style={styles.infoValue}>{selected.properties.pressure} hPa</div>

                        <div style={styles.infoLabel}>飽和水蒸気量</div>
                        <div style={styles.infoValue}>{saturationVaporDensity(selected.properties.temp).toFixed(2)} g/m³</div>

                        <div style={styles.infoLabel}>露点温度</div>
                        <div style={styles.infoValue}>{calculateDewPoint(selected.properties.temp, selected.properties.humid).toFixed(2)} °C</div>

                        <div style={styles.infoLabel}>WBGT（暑さ指数）</div>
                        <div style={{...styles.infoValue, ...wbgtValue.style}}>{wbgtValue.status}（{wbgtValue.wbgt.toFixed(2)}°C）</div>

                        <div style={styles.infoLabel}>位置</div>
                        <div style={{ ...styles.infoValue, ...styles.smallText }}>{selected.properties.latitude}, {selected.properties.longitude}</div>

                        <div style={styles.infoLabel}>観測時刻</div>
                        <div style={{ ...styles.infoValue, ...styles.smallText }}>{formatDateTime(selected.properties.datetime)}</div>
                    </div>
                </div>

                <h4 style={styles.historyTitle}>履歴データ</h4>

                <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', zIndex: 1 }}>
                    <button style={{...styles.button, ...(displayMode === 'graph' ? styles.buttonSelected : {})}} onClick={() => setDisplayMode('graph')}>グラフ表示</button>
                    <button style={{...styles.button, ...(displayMode === 'list' ? styles.buttonSelected : {})}} onClick={() => setDisplayMode('list')}>一覧表示</button>
                </div>

                { displayMode === 'graph' ?
                    <HistoryGraph sensorData={selected} />
                    :
                    <div style={styles.historyList}>
                        {selected.histories.map((history, index) => (
                            <div
                                key={history.properties.id}
                                style={{
                                    ...styles.historyItem,
                                    ...(index === 0 ? styles.currentHistoryItem : {})
                                }}
                            >
                                <div style={styles.infoGrid}>
                                    <div style={styles.infoLabel}>温度</div>
                                    <div style={styles.infoValue}>{history.properties.temp} °C</div>

                                    <div style={styles.infoLabel}>湿度</div>
                                    <div style={styles.infoValue}>{history.properties.humid} %</div>

                                    <div style={styles.infoLabel}>気圧</div>
                                    <div style={styles.infoValue}>{history.properties.pressure} hPa</div>

                                    <div style={styles.infoLabel}>飽和水蒸気量</div>
                                    <div style={styles.infoValue}>{saturationVaporDensity(history.properties.temp).toFixed(2)} g/m³</div>

                                    <div style={styles.infoLabel}>露点温度</div>
                                    <div style={styles.infoValue}>{calculateDewPoint(history.properties.temp, history.properties.humid).toFixed(2)} °C</div>

                                    <div style={{ ...styles.smallText, color: '#718096', gridColumn: 'span 2', marginTop: '4px' }}>
                                        {history.properties.datetime}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                }
            </div>
            </div>
        </div>
    );
};

export default SensorDetails;