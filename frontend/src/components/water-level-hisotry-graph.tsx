import React, { useState, useEffect, useMemo } from 'react';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

dayjs.extend(utc);
dayjs.extend(timezone);

dayjs.tz.setDefault('Asia/Tokyo');


const WaterLevelHistoryGraph = ({ sensorData }) => {

    const [selectedPoint, setSelectedPoint] = useState(null);
    const [selectedDataPoint, setSelectedDataPoint] = useState(null);

    // カラーパレット (deck.gl風)
    const colors = {
        water_level: '#00B5DC',      // 温度 - 暖色系のオレンジ
        // humid: '#00B5DC',     // 湿度 - 水色
        // pressure: '#60E188',  // 気圧 - 緑
        // background: '#0D1929', // ダークブルーの背景
        background: '#fff',
        // panelBg: '#1A2332',    // パネル背景
        panelBg: '#fff2',
        // text: '#F8F9FA',      // 明るいテキスト
        text: '#0D1929',
        border: '#2A3442',    // ボーダー
        // buttonBg: '#30445F',  // ボタン背景
        buttonBg: '#fff',
        // buttonActive: '#0069D0', // アクティブボタン
        buttonActive: '#bbb',
        chartGrid: '#2A3442'  // グラフのグリッド線
    };

    // 初期読み込み時の選択ポイント設定
    useEffect(() => {
        setSelectedPoint(sensorData);
    }, [sensorData, selectedPoint]);

    // グラフポイントクリックハンドラー
    const handleDataPointClick = (data) => {
        if (!data || !data.activePayload) return;

        const clickedData = data.activePayload[0].payload;
        // クリックされたデータに一致する履歴アイテムを検索
        const historyItem = ((selectedPoint as any).histories || []).find(
            h => h.properties.date_time === clickedData.date_time
        );

        if (historyItem) {
            setSelectedDataPoint(historyItem);
        }
    };

    // グラフ用データの準備（昇順に並び替え）
    const prepareChartData = (point) => {
        if (!point || !point.histories) return [];

        // 日時を昇順（古い順）にソート
        const sortedHistories = [...point.histories].sort(
            (a, b) => (dayjs(a.properties.date_time) as any) - (dayjs(b.properties.date_time) as any)
        );

        return sortedHistories.map(history => {
            const { date_time, water_level } = history.properties;
            // 表示用に日時をフォーマット
            const time = dayjs(date_time).format('HH:mm');
            return {
                time,
                date_time,
                water_level,
            };
        });
    };

    // カスタムツールチップ
    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            return (
                <div style={{
                    backgroundColor: 'rgba(26, 35, 50, 0.9)',
                    border: `1px solid ${colors.border}`,
                    padding: '6px 12px 12px 12px',
                    borderRadius: '4px',
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
                }}>
                    <p style={{ color: '#fff', fontWeight: 600, marginBottom: '8px' }}>{`${label}`}</p>
                    <p style={{ color: colors.water_level, margin: '4px 0' }}>
                        {`水位: ${payload[0].value} m`}
                    </p>
                </div>
            );
        }
        return null;
    };

    if (!sensorData || sensorData.length === 0) {
        return <div className="p-4" style={{ color: colors.text }}>センサーデータがありません</div>;
    }

    const chartData = selectedPoint ? prepareChartData(selectedPoint) : [];

    return (
        <div className="flex flex-col h-full overflow-hidden rounded-lg" style={{ backgroundColor: colors.background, color: colors.text }}>

            {/* 統合グラフ */}
            {selectedPoint && (
                <div className="p-4 flex-grow overflow-y-auto" style={{ backgroundColor: colors.panelBg }}>
                    <div className="h-64 bg-opacity-20 p-2 rounded" style={{ backgroundColor: colors.background, height: '270px', fontSize: '14px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart
                                data={chartData}
                                margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
                                onClick={handleDataPointClick}
                            >
                                <CartesianGrid strokeDasharray="3 3" stroke={colors.chartGrid} />
                                <XAxis
                                    dataKey="time"
                                    tick={{ fill: colors.text }}
                                    axisLine={{ stroke: colors.border }}
                                />

                                {/* 温度のY軸 (左) */}
                                <YAxis
                                    yAxisId="water_level"
                                    domain={['dataMin - 0.5', 'dataMax + 0.5']}
                                    orientation="left"
                                    tick={{ fill: colors.text }}
                                    axisLine={{ stroke: colors.border }}
                                    tickLine={{ stroke: colors.border }}
                                />


                                <Tooltip content={<CustomTooltip active={undefined} payload={undefined} label={undefined} />} />
                                <Legend
                                    wrapperStyle={{ color: colors.text }}
                                    formatter={(value) => <span style={{ color: colors.text }}>{value}</span>}
                                />

                                {/* 気温は棒グラフで表示 */}
                                <Bar
                                    yAxisId="water_level"
                                    dataKey="water_level"
                                    fill={colors.water_level}
                                    fillOpacity={0.8}
                                    name="水位 (m)"
                                    barSize={15}
                                    radius={[2, 2, 0, 0]} // 角を少し丸くする
                                />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>

                </div>
            )}

            {/* 選択されたデータポイントの詳細 */}
            <div className="p-4 border-t" style={{
                borderColor: colors.border,
                padding: '30px 10px',
            }}>
                {selectedDataPoint ? (
                    <div className="p-4 rounded" style={{
                        backgroundColor: 'rgba(195, 186, 186, 0.3)',
                        borderRadius: '8px',
                        padding: '15px',
                        fontSize: '14px',
                    }}>
                        <div className="grid grid-cols-2 gap-3" style={{
                            display: 'grid',
                            gap: '8px'
                        }}>
                            <div>
                                <div className="text-xs opacity-70"><b>観測時刻：</b></div>
                                <div>{dayjs((selectedDataPoint as any).properties.date_time).format('YYYY/M/D HH:mm:ss')}</div>
                            </div>
                            <div>
                                <div className="text-xs opacity-70"><b>水位：</b></div>
                                <div style={{ backgroundColor: colors.water_level, width: `${(selectedDataPoint as any).properties.water_level / 8 * 100}%`, padding: '2px 4px' }}>
                                    {(selectedDataPoint as any).properties.water_level} m
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex justify-between text-xs opacity-70 mt-2" style={{ color: '#888', fontSize: '13px' }}>
                        <div>閲覧したい日時の棒グラフをクリックしてください</div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default WaterLevelHistoryGraph;