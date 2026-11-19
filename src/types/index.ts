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
  reason: 'forced' | 'not_shot1_target' | 'not_background' | 'stale' | 'fresh';
  lastFocusTarget: 'subject' | 'background' | 'none';
  elapsedSinceFocusMs: number;
  /** 撮影1のフォーカス対象 */
  shot1Target?: 'subject' | 'background';
  /** fresh 判定の許容時間（ms） */
  focusFreshMaxMs?: number;
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

export type ScaleCorrectionMode = 'off' | 'estimate' | 'fixed';

export type ScaleNccSample = { scale: number; ncc: number };

export type ScaleEstimateSource = 'coarse' | 'fine' | 'recent' | 'fixed';

export type ScaleCorrectionReport = {
  mode: ScaleCorrectionMode;
  estimatedScale: number;
  appliedScale: number;
  nccBefore: number;
  /** 推定 scale の NCC。fallback しても消さない */
  nccAtEstimate: number;
  nccAfter: number;
  fellBack: boolean;
  minGain: number;
  /** 精密探索の長辺 */
  analysisLongSide: number;
  coarseLongSide: number;
  ms: number;
  coarseMs: number;
  fineMs: number;
  /** 粗探索 NCC 上位（最大5点） */
  coarseTopNcc: ScaleNccSample[];
  peakSharpness: number;
  peakSharpnessMin: number;
  scaleSource: ScaleEstimateSource;
  /** 範囲外等で精密探索しなかった */
  fineSkipped: boolean;
  coarseBestScale: number;
  coarseBestNcc: number;
  fineBestScale: number | null;
  fineBestNcc: number | null;
  adoptMin: number;
  adoptMax: number;
  fineAdoptMinNcc: number;
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
  /** 拡大率補正。既定は毎回推定 */
  scaleMode: ScaleCorrectionMode;
  /** scaleMode が fixed のとき FAR に掛ける倍率 */
  scaleFixed: number;
  /** 推定 NCC の改善がこれ未満なら scale=1。既定 0.001 */
  scaleMinGain: number;
  /** 粗最良 scale の採用下限（これ未満ならフォールバック）。既定 1.0 */
  scaleAdoptMin: number;
  /** 粗最良 scale の採用上限（これ超ならフォールバック）。既定 1.08 */
  scaleAdoptMax: number;
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
  scaleCorrection?: ScaleCorrectionReport;
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