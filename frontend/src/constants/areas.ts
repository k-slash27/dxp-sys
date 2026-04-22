export const AVAILABLE_AREAS = ['minobu', 'minami_alpus', 'kofu', 'demo'] as const;

export type AreaType = typeof AVAILABLE_AREAS[number];