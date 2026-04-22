import React, { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { calculateDewPoint, saturationVaporDensity } from '@/utils/_data-processor';
import { formatTime } from '@/utils/_adjust-sensor';

dayjs.extend(utc);
dayjs.extend(timezone);

dayjs.tz.setDefault('Asia/Tokyo');


const HistoryGraph = ({ sensorData }) => {

    const [selectedPoint, setSelectedPoint] = useState(null);
    const [selectedDataPoint, setSelectedDataPoint] = useState(null);

    // カラーパレット (deck.gl風)
    const colors = {
        temp: '#FDB631',      // 温度 - 暖色系のオレンジ
        humid: '#00B5DC',     // 湿度 - 水色
        pressure: '#60E188',  // 気圧 - 緑
        vaporDensity: '#FF6F61', // 飽和水蒸気量 - 赤
        dewPoint: '#b0a1ff', // 露点温度 - ピンク
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

    // ポイント選択ハンドラー
    //   const handlePointSelect = (point) => {
    //     setSelectedPoint(point);
    //     setSelectedDataPoint(null);
    //   };

    // グラフポイントクリックハンドラー
    const handleDataPointClick = (data) => {
        if (!data || !data.activePayload) return;

        const clickedData = data.activePayload[0].payload;
        // クリックされたデータに一致する履歴アイテムを検索
        const historyItem = ((selectedPoint as any).histories || []).find(
            h => h.properties.datetime === clickedData.datetime
        );

        if (historyItem) {
            const vaporDensity = saturationVaporDensity(historyItem.properties.temp).toFixed(2)
            const dewPoint = calculateDewPoint(historyItem.properties.temp, historyItem.properties.humid).toFixed(2);
            setSelectedDataPoint({...historyItem, properties: { ...historyItem.properties, vaporDensity, dewPoint }});
        }
    };

    // グラフ用データの準備（昇順に並び替え）
    const prepareChartData = (point) => {
        if (!point || !point.histories) return [];

        // 日時を昇順（古い順）にソート
        const sortedHistories = [...point.histories].sort(
            (a, b) => (dayjs(a.properties.datetime) as any) - (dayjs(b.properties.datetime) as any)
        );

        return sortedHistories.map(history => {
            const { datetime, temp, humid, pressure } = history.properties;
            // 表示用に日時をフォーマット
            // const time = dayjs(datetime).format('HH:mm');
            const time = formatTime(datetime);
            const vaporDensity = saturationVaporDensity(temp).toFixed(2)
            const dewPoint = calculateDewPoint(temp, humid).toFixed(2);
            return {
                datetime,
                time,
                temp,
                humid,
                pressure,
                vaporDensity,
                dewPoint
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
                    <p style={{ color: colors.temp, margin: '4px 0' }}>
                        {`温度: ${payload[0].value} °C`}
                    </p>
                    <p style={{ color: colors.humid, margin: '4px 0' }}>
                        {`湿度: ${payload[1].value} %`}
                    </p>
                    <p style={{ color: colors.pressure, margin: '4px 0' }}>
                        {`気圧: ${payload[2].value} hPa`}
                    </p>
                    <p style={{ color: colors.vaporDensity, margin: '4px 0' }}>
                        {`飽和水蒸気量: ${payload[3].value} g/m³`}
                    </p>
                    <p style={{ color: colors.dewPoint, margin: '4px 0' }}>
                        {`露点温度: ${payload[4].value} °C`}
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
                                    yAxisId="temp"
                                    domain={['dataMin - 0.5', 'dataMax + 0.5']}
                                    orientation="left"
                                    tick={{ fill: colors.text }}
                                    axisLine={{ stroke: colors.border }}
                                    tickLine={{ stroke: colors.border }}
                                />

                                {/* 湿度のY軸 (右) */}
                                <YAxis
                                    yAxisId="humid"
                                    domain={[40, 55]}
                                    orientation="right"
                                    tick={{ fill: colors.text }}
                                    axisLine={{ stroke: colors.border }}
                                    tickLine={{ stroke: colors.border }}
                                />

                                {/* 気圧の参照用の追加Y軸は表示しない */}
                                <YAxis
                                    yAxisId="pressure"
                                    domain={[994, 996]}
                                    hide
                                />

                                {/* 飽和水蒸気量のY軸 (右) */}                    
                                <YAxis
                                    yAxisId="vaporDensity"
                                    domain={['dataMin - 0.1', 'dataMax + 0.1']}
                                    hide
                                />

                                {/* 露点温度のY軸 (右) */}                    
                                <YAxis
                                    yAxisId="dewPoint"
                                    domain={['dataMin - 0.5', 'dataMax + 0.5']}
                                    hide
                                />

                                <Tooltip content={<CustomTooltip active={undefined} payload={undefined} label={undefined} />} />
                                <Legend
                                    wrapperStyle={{ color: colors.text }}
                                    formatter={(value) => <span style={{ color: colors.text }}>{value}</span>}
                                />

                                {/* 気温・露点温度は棒グラフで表示 */}
                                <Bar
                                    yAxisId="temp"
                                    dataKey="temp"
                                    fill={colors.temp}
                                    fillOpacity={0.8}
                                    name="温度 (°C)"
                                    barSize={15}
                                    radius={[2, 2, 0, 0]} // 角を少し丸くする
                                />
                                <Bar
                                    yAxisId="dewPoint"
                                    dataKey="dewPoint"
                                    fill={colors.dewPoint}
                                    fillOpacity={0.8}
                                    name="露点温度 (°C)"
                                    barSize={15}
                                    radius={[2, 2, 0, 0]} // 角を少し丸くする
                                />


                                {/* 湿度・気圧・飽和水蒸気量は線グラフで表示 */}
                                <Line
                                    yAxisId="humid"
                                    type="monotone"
                                    dataKey="humid"
                                    stroke={colors.humid}
                                    strokeWidth={2}
                                    dot={{ fill: colors.humid, r: 4 }}
                                    activeDot={{ fill: colors.humid, r: 6, strokeWidth: 0 }}
                                    name="湿度 (%)"
                                />
                                <Line
                                    yAxisId="pressure"
                                    type="monotone"
                                    dataKey="pressure"
                                    stroke={colors.pressure}
                                    strokeWidth={2}
                                    dot={{ fill: colors.pressure, r: 4 }}
                                    activeDot={{ fill: colors.pressure, r: 6, strokeWidth: 0 }}
                                    name="気圧 (hPa)"
                                />
                                <Line
                                    yAxisId="vaporDensity"
                                    type="monotone"
                                    dataKey="vaporDensity"
                                    stroke={colors.vaporDensity}
                                    strokeWidth={2}
                                    dot={{ fill: colors.vaporDensity, r: 4 }}
                                    activeDot={{ fill: colors.vaporDensity, r: 6, strokeWidth: 0 }}
                                    name="飽和水蒸気量 (g/m³)"
                                />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>

                </div>
            )}

            {/* 選択されたデータポイントの詳細 */}
            <div className="p-4 border-t" style={{
                borderColor: colors.border,
                //   backgroundColor: 'rgba(26, 35, 50, 0.9)',
                //   backdropFilter: 'blur(10px)',
                padding: '30px 10px',
            }}>
                {selectedDataPoint ? (
                    <div className="p-4 rounded" style={{
                        backgroundColor: 'rgba(195, 186, 186, 0.3)',
                        // border: `1px solid ${colors.border}`
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
                                <div>{dayjs((selectedDataPoint as any).properties.datetime).format('YYYY/M/D HH:mm:ss')}</div>
                            </div>
                            <div>
                                <div className="text-xs opacity-70"><b>温度：</b></div>
                                <div style={{ backgroundColor: colors.temp, width: `${(selectedDataPoint as any).properties.temp}%`, padding: '2px 4px' }}>
                                    {(selectedDataPoint as any).properties.temp} °C
                                </div>
                            </div>
                            <div>
                                <div className="text-xs opacity-70"><b>湿度：</b></div>
                                <div style={{ backgroundColor: colors.humid, width: `${(selectedDataPoint as any).properties.humid}%`, padding: '2px 4px' }}>
                                    {(selectedDataPoint as any).properties.humid} %
                                </div>
                            </div>
                            <div>
                                <div className="text-xs opacity-70"><b>気圧：</b></div>
                                <div style={{ backgroundColor: colors.pressure, width: `${(selectedDataPoint as any).properties.pressure / 1100 * 100}%`, padding: '2px 4px' }}>
                                    {(selectedDataPoint as any).properties.pressure} hPa
                                </div>
                            </div>
                            <div>
                                <div className="text-xs opacity-70"><b>飽和水蒸気量：</b></div>
                                <div style={{ backgroundColor: colors.vaporDensity, width: `${(selectedDataPoint as any).properties.vaporDensity}%`, padding: '2px 4px' }}>
                                    {(selectedDataPoint as any).properties.vaporDensity} g/m³
                                </div>
                            </div>
                            <div>
                                <div className="text-xs opacity-70"><b>露点温度：</b></div>
                                <div style={{ backgroundColor: colors.dewPoint, width: `${(selectedDataPoint as any).properties.dewPoint}%`, padding: '2px 4px' }}>
                                    {(selectedDataPoint as any).properties.dewPoint} °C
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

export default HistoryGraph;