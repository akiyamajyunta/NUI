import type { FusionParams } from '@/types';

export const ANDROID_PACKAGE = 'com.example.stuffedcam';

/** 長辺の最大テクスチャ想定（px） */
export const MAX_TEXTURE_LONG_SIDE = 4096;

/** JPEG 保存品質（0〜100） */
export const JPEG_QUALITY = 92;

export const FOCUS_TIMEOUT_MS = 3000;

/** focusTo 完了後、撮影までの待ち（ms） */
export const FOCUS_SETTLE_MS = 150;

/** ピント検証：領域の鮮鋭度比がこれを超えれば OK とみなす */
export const FOCUS_VERIFY_K = 1.15;

export const BENCHMARK_RUNS_DEFAULT = 10;
export const BENCHMARK_INTERVAL_MS = 1500;

export const ALIGN_LONG_SIDE = 256;

export const MEDIA_ALBUM_NAME = 'ぬいぐるみ合成';

export const DEFAULT_FUSION_PARAMS: FusionParams = {
  workLongSide: 1024,
  sharpWindowRadius: 1,
  maskBlurRadius: 3,
  threshold: 0.08,
  nearBias: 0.02,
  haloShrink: 0,
  colorMatch: true,
  align: true,
};

export const PREVIEW_FUSION_LONG_SIDE = 1024;

export type CaptureStrategyId = 'S1' | 'S2' | 'S3';

export type PhotoResolutionPreset = 'HD_4_3' | 'FHD_4_3' | 'UHD_4_3';

export type CaptureSettings = {
  strategyId: CaptureStrategyId;
  s3ExtraDelayMs: 0 | 50 | 100 | 200;
  shutterSound: boolean;
  refocusBeforeFirst: boolean;
  autoFuseAfterCapture: boolean;
  saveOriginals: boolean;
  focusTimeoutMs: number;
  photoResolution: PhotoResolutionPreset;
};

export const DEFAULT_CAPTURE_SETTINGS: CaptureSettings = {
  strategyId: 'S1',
  s3ExtraDelayMs: 0,
  shutterSound: false,
  refocusBeforeFirst: false,
  autoFuseAfterCapture: true,
  saveOriginals: false,
  focusTimeoutMs: FOCUS_TIMEOUT_MS,
  photoResolution: 'FHD_4_3',
};