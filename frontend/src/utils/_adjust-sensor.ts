import { ClimateData, Baseline } from '@/types';

// 環境変数から設定値を取得
export const getEnvConfig = () => ({
  baseline: {
    temperature: Number(process.env.NEXT_PUBLIC_BASELINE_TEMPERATURE) || null,
    humidity: Number(process.env.NEXT_PUBLIC_BASELINE_HUMIDITY) || null
  },
  adjustmentOptions: {
    temperatureThreshold: Number(process.env.NEXT_PUBLIC_ADJUSTMENT_THRESHOLD_TEMP) || 5,
    humidityThreshold: Number(process.env.NEXT_PUBLIC_ADJUSTMENT_THRESHOLD_HUMIDITY) || 10,
    adjustmentRate: Number(process.env.NEXT_PUBLIC_ADJUSTMENT_RATE) || 0.7
  },
  adjustmentStartDatetime: process.env.NEXT_PUBLIC_ADJUSTMENT_START_DATETIME || null
});

// 日時シフト計算関数
const calculateDatetimeShift = (data: ClimateData): { shiftMs: number; originalMinDatetime: string } => {
  const config = getEnvConfig();
  
  if (!config.adjustmentStartDatetime) {
    return { shiftMs: 0, originalMinDatetime: '' };
  }
  
  // 元データの最小日時を取得
  const datetimes = data.features.map(f => new Date(f.properties.datetime).getTime());
  const minDatetimeMs = Math.min(...datetimes);
  const originalMinDatetime = new Date(minDatetimeMs).toISOString();
  
  // 環境変数の日時との差分を計算
  const targetDatetimeMs = new Date(config.adjustmentStartDatetime).getTime();
  const shiftMs = targetDatetimeMs - minDatetimeMs;

  console.log(originalMinDatetime, new Date(config.adjustmentStartDatetime), minDatetimeMs, shiftMs);
  
  return { shiftMs, originalMinDatetime };
};

// データ補正関数（実際のプロパティ名に対応）
export const adjustClimateData = (data: ClimateData, baseline?: Baseline): ClimateData => {
  const config = getEnvConfig();
  const useBaseline = baseline || config.baseline;
  const { shiftMs } = calculateDatetimeShift(data);
  
  return {
    ...data,
    features: data.features.map(feature => {
        // 元の日時にシフト時間を加算
        let adjustedDatetime = feature.properties.datetime;

        if (shiftMs !== 0) {
            const originalDateMs = new Date(feature.properties.datetime).getTime();
            adjustedDatetime = new Date(originalDateMs + shiftMs).toISOString();
        }

        return {
            ...feature,
            properties: {
                ...feature.properties,
                datetime: adjustedDatetime,
                temp: adjustValue(
                    feature.properties.temp, // temperature → temp
                    useBaseline.temperature || feature.properties.temp,
                    config.adjustmentOptions.temperatureThreshold,
                    config.adjustmentOptions.adjustmentRate
                ),
                humid: adjustValue(
                    feature.properties.humid, // humidity → humid
                    useBaseline.humidity || feature.properties.humid,
                    config.adjustmentOptions.humidityThreshold,
                    config.adjustmentOptions.adjustmentRate
                )
            }
        }
    })
  };
};

// 個別値の補正計算（環境変数対応）
const adjustValue = (
  original: number, 
  baseline: number, 
  threshold: number = 5, 
  adjustmentRate: number = 0.7
): number => {
  const diff = Math.abs(original - baseline);
  if (diff <= threshold) return original; // 閾値内なら補正なし
  const direction = original > baseline ? -1 : 1;
  return baseline + (diff * adjustmentRate * direction);
};

// 日時フォーマット用のヘルパー関数
export const formatDateTime = (dateTimeString: string): string => {
  try {
    const cleanDateString = dateTimeString.trim().replace(/^["']|["']$/g, '').replace('Z', '').replace(/\+\d{2}:\d{2}$/, '');
    const localDate = new Date(cleanDateString);

    return localDate.toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return dateTimeString;
  }
};


export const formatTime = (dateTimeString: string): string => {
  try {
    const cleanDateString = dateTimeString.trim().replace(/^["']|["']$/g, '').replace('Z', '').replace(/\+\d{2}:\d{2}$/, '');
    const localDate = new Date(cleanDateString);

    return localDate.toLocaleString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return dateTimeString;
  }
};