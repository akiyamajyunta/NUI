export type NormalizedPoint = { x: number; y: number };

export type CapturedPhoto = {
  uri: string;
  width: number;
  height: number;
  orientation: string;
  focusPoint: NormalizedPoint;
  role: 'NEAR' | 'FAR';
};

export type TimelineMark = { label: string; t: number };

export type ClosedLoopRetryReport = {
  enabled: boolean;
  farRetried: boolean;
  nearRetried: boolean;
  retryTotalMs?: number;
};

export type FocusABeforeShotReport = {
  executed: boolean;
  reason: 'forced' | 'not_background' | 'stale' | 'fresh';
  lastFocusTarget: 'subject' | 'background' | 'none';
  elapsedSinceFocusMs: number;
};

export type HoldBackgroundFocusSessionStats = {
  enabled: boolean;
  capturesWhileEnabled: number;
  focusASkippedCount: number;
};

export type CaptureResult = {
  near: CapturedPhoto;
  far: CapturedPhoto;
  timeline: TimelineMark[];
  totalMs: number;
  strategyId: string;
  closedLoop?: ClosedLoopRetryReport;
  focusABeforeShot?: FocusABeforeShotReport;
  holdBackgroundFocus?: HoldBackgroundFocusSessionStats;
};

export type FusionParams = {
  workLongSide: number;
  sharpWindowRadius: number;
  maskBlurRadius: number;
  threshold: number;
  nearBias: number;
  haloShrink: number;
  colorMatch: boolean;
  align: boolean;
};

export type FusionTimings = {
  loadMs: number;
  alignMs: number;
  sharpnessMs: number;
  blendMs: number;
  encodeMs: number;
  totalMs: number;
};

export type FusionDebugUris = {
  nearUri?: string;
  farUri?: string;
  maskUri?: string;
  sharpNearUri?: string | undefined;
  sharpFarUri?: string | undefined;
};

export type RangeStats = { min: number; median: number; max: number };

/** 鮮鋭度マップ S_near・S_far（ラプラシアン絶対値の単位）と正規化差 d の値域 */
export type MaskDiagnostics = {
  sNear: RangeStats;
  sFar: RangeStats;
  d: RangeStats;
  /** sN + sF が低テクスチャのしきい値未満だった画素の割合（0〜1） */
  lowTextureRatio: number;
  sampleCount: number;
  /** S_near/S_far の min・median 一致など 8bit 量子化の調査（修正なし） */
  quantizationAnalysis?: string;
};

export type FusionResult = {
  imageUri: string;
  width: number;
  height: number;
  timings: FusionTimings;
  /** ブレンドに実際に適用した offset */
  alignOffset: { dx: number; dy: number };
  /** 探索で得た offset（信頼度不足時も保持） */
  alignEstimatedOffset: { dx: number; dy: number };
  alignOffsetApplied: boolean;
  alignConfidence: number;
  alignWarning: boolean;
  debug?: FusionDebugUris;
  maskDiagnostics?: MaskDiagnostics;
  psnrDb?: number;
};

export type SyntheticSession = {
  referenceUri: string;
};

export type ResultViewMode =
  | 'result'
  | 'near'
  | 'far'
  | 'mask'
  | 'sharpNear'
  | 'sharpFar'
  | 'blink'
  | 'edgeOverlay';

export type FusionPreviewImages = {
  nearUri?: string;
  farUri?: string;
  maskPreviewUri?: string;
};

export type FusionInput = {
  nearUri: string;
  farUri: string;
  params: FusionParams;
  outputLongSide?: number;
};

export type LoadedImageInfo = {
  image: import('@shopify/react-native-skia').SkImage;
  width: number;
  height: number;
  uri: string;
  orientation: string;
};