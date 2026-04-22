// types.ts
export interface ClimateData {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    id: string;
    geometry: {
      type: 'Point';
      coordinates: [number, number];
    };
    geometry_name: string;
    properties: {
      id: number;
      point_name: string;
      longitude: number;
      latitude: number;
      datetime: string;
      temp: number;
      humid: number;
      pressure: number;
      // 補正後の値
      adjusted_temp?: number;
      adjusted_humid?: number;
    };
    bbox: [number, number, number, number];
  }>;
}

export interface Baseline {
  temperature: number;
  humidity: number;
}