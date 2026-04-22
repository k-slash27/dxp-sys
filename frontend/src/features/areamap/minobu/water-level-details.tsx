import HistoryGraph from "@/components/hisotry-graph";
import styles from "@/features/areamap/_shared-styles";
import { useState } from "react";
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import WaterLevelHistoryGraph from "@/components/water-level-hisotry-graph";

dayjs.extend(utc);
dayjs.extend(timezone);

dayjs.tz.setDefault('Asia/Tokyo');


// センサー詳細情報コンポーネント
const WaterLevelDetails = ({ selected, onClose }) => {
    const [displayMode, setDisplayMode] = useState<string>('graph');

        
    return (
        <div style={{ ...styles.layerSection, ...styles.sensorDetails }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <h3 style={{...styles.sectionTitle, fontSize: '17px'}}>水位センサーポイント情報</h3>
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
                    <h3 style={styles.detailsTitle}>{selected.properties.station_code}</h3>
                </div>

                <div style={styles.infoCard}>
                    <div style={styles.infoGrid}>
                        <div style={styles.infoLabel}>水位</div>
                        <div style={styles.infoValue}>{selected.properties.water_level} m</div>

                        <div style={styles.infoLabel}>位置</div>
                        <div style={{ ...styles.infoValue, ...styles.smallText }}>{selected.properties.latitude}, {selected.properties.longitude}</div>

                        <div style={styles.infoLabel}>観測時刻</div>
                        <div style={{ ...styles.infoValue, ...styles.smallText }}>{dayjs(selected.properties.date_time).format('YYYY/M/D HH:mm:ss')}</div>
                    </div>
                </div>


                <h4 style={styles.historyTitle}>ライブカメラ</h4>

                <div>
                    <video width="100%" height="179" poster="/water-level-movie-cover.png" loop muted autoPlay playsInline>
                        <source src="/water-level-movie.webm" type="video/webm"></source>
                    </video>
                </div>

                <h4 style={styles.historyTitle}>履歴データ</h4>

                <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', zIndex: 1 }}>
                    <button style={{...styles.button, ...(displayMode === 'graph' ? styles.buttonSelected : {})}} onClick={() => setDisplayMode('graph')}>グラフ表示</button>
                    <button style={{...styles.button, ...(displayMode === 'list' ? styles.buttonSelected : {})}} onClick={() => setDisplayMode('list')}>一覧表示</button>
                </div>

                { displayMode === 'graph' ?
                    <WaterLevelHistoryGraph sensorData={selected} />
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
                                    <div style={styles.infoLabel}>水位</div>
                                    <div style={styles.infoValue}>{history.properties.water_level} m</div>

                                    <div style={{ ...styles.smallText, color: '#718096', gridColumn: 'span 2', marginTop: '4px' }}>
                                        {dayjs(history.properties.date_time).format('YYYY/M/D HH:mm:ss')}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                }
            </div>
        </div>
    );
};

export default WaterLevelDetails;