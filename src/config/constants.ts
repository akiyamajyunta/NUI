import type { FusionParams } from '@/types';

export const ANDROID_PACKAGE = 'com.example.stuffedcam';

/** 長辺の最大テクスチャ想定（px） */
export const MAX_TEXTURE_LONG_SIDE = 4096;

/** JPEG 保存品質（0〜100） */
export const JPEG_QUALITY = 92;

export const FOCUS_TIMEOUT_MS = 3000;

/** focusTo 完了後の待ち（ms）の選択肢。各フォーカス後に適用 */
export type FocusSettleMs = 0 | 100 | 200 | 300;

/** ピント検証：領域の鮮鋭度比がこれを超えれば OK とみなす */
export const FOCUS_VERIFY_K = 1.15;

/** 閉ループ撮影：点周辺の鮮鋭度が相手画像のこの倍率以上でなければ1回再撮 */
export const CLOSED_LOOP_CAPTURE_K = 1.3;

/** ピント検証・診断の画質比較で共通する分析用長辺（mode/08 と同一） */
export const FOCUS_VERIFY_LONG_SIDE = 512;

export const BENCHMARK_RUNS_DEFAULT = 10;
export const BENCHMARK_INTERVAL_MS = 1500;

export const ALIGN_LONG_SIDE = 256;

/** 信頼度がこの値未満なら位置合わせ offset を適用しない（0〜1） */
export const ALIGN_MIN_CONFIDENCE = 0.3;

/** 撮影1前フォーカスの fresh 判定許容時間（ms）の選択肢 */
export type FocusFreshMaxMs = 2000 | 4000 | 8000;

/** ピント維持: 背景点への focus 再指定間隔（ms） */
export const HOLD_BACKGROUND_FOCUS_INTERVAL_MS = 1500;

/** タップ直後この時間はピント維持を止める（ms） */
export const HOLD_FOCUS_PAUSE_AFTER_TAP_MS = 3000;
/** プレビュータップ後、シャッターを有効にするまでの待ち */
export const SHUTTER_FOCUS_SETTLE_MS = 1000;

/**
 * 鮮鋭度マップ（8bit）の符号化。ラプラシアン絶対値 lap を sqrt(lap / SHARPNESS_LAP_MAX) で格納し、
 * 小さい値の階調を確保する。復号は enc^2 * SHARPNESS_LAP_MAX。
 */
export const SHARPNESS_LAP_MAX = 1;

/** 正規化差 d = (sN - sF) / (sN + sF + eps) の eps（ラプラシアン絶対値の単位） */
export const MASK_EPS = 0.004;

/**
 * sN + sF がこの値以下なら低テクスチャ（自前の判定を使わない）。
 * 実機未計測の見積もり値。診断レポートの S 値域を見て調整する。
 */
export const MASK_LOW_TEXTURE_LO = 0.015;
/** sN + sF がこの値以上なら十分なテクスチャ（自前の判定をそのまま使う）。同上、見積もり値 */
export const MASK_LOW_TEXTURE_HI = 0.05;

/** 低テクスチャ領域を補うための広いぼかし半径（作業解像度での px） */
export const MASK_FILL_BLUR_RADIUS = 32;
/** 周囲にもテクスチャが無いときに寄せる値の重み（小さいほど周囲の値を優先） */
export const MASK_FILL_PRIOR = 0.02;
/** 周囲にもテクスチャが無い領域の既定値（0 = FAR、1 = NEAR） */
export const MASK_FILL_FALLBACK = 0;

/** threshold の下限（smoothstep の幅が 0 にならないようにする） */
export const MASK_MIN_THRESHOLD = 0.005;

export const MEDIA_ALBUM_NAME = 'ぬいぐるみ合成';

export const DEFAULT_FUSION_PARAMS: FusionParams = {
  workLongSide: 1024,
  // 作業解像度での px
  sharpWindowRadius: 6,
  maskBlurRadius: 3,
  // threshold / nearBias / haloShrink は正規化差 d（-1〜1）の単位
  threshold: 0.15,
  nearBias: 0.02,
  haloShrink: 0,
  colorMatch: true,
  align: false,
  scaleMode: 'estimate',
  scaleFixed: 1.02,
  scaleMinGain: 0.001,
  scaleAdoptMin: 1.0,
  scaleAdoptMax: 1.08,
};

/** 設定の拡大率固定値の許容範囲 */
export const SCALE_FIXED_MIN = 0.98;
export const SCALE_FIXED_MAX = 1.06;

export const PREVIEW_FUSION_LONG_SIDE = 1024;

export type CaptureStrategyId = 'S1' | 'S2' | 'S3';

export type PhotoResolutionPreset = 'HD_4_3' | 'FHD_4_3' | 'UHD_4_3';

export type CaptureOrder = 'far_then_near' | 'near_then_far';

export type CaptureSettings = {
  strategyId: CaptureStrategyId;
  s3ExtraDelayMs: 0 | 50 | 100 | 200;
  shutterSound: boolean;
  refocusBeforeFirst: boolean;
  autoFuseAfterCapture: boolean;
  saveOriginals: boolean;
  focusTimeoutMs: number;
  photoResolution: PhotoResolutionPreset;
  /** 合成完了後に診断レポートをクリップボードへ自動コピー */
  autoCopyDiagnosticsAfterFusion: boolean;
  /** 各 focusTo 完了後の待ち（ms） */
  focusSettleMs: FocusSettleMs;
  /** 撮影後の鮮鋭度で1回まで再撮（試作） */
  closedLoopCapture: boolean;
  /** プレビュー中、背景点へ定期的に focus 再指定（実験） */
  holdBackgroundFocus: boolean;
  /** 診断の scale×平行移動同時探索（重い）。既定オフ */
  scaleJointSearch: boolean;
  /** 2枚の撮影順（NEAR/FAR の意味は不変） */
  captureOrder: CaptureOrder;
  /** 直近フォーカスからこの時間未満なら撮影1前フォーカスをスキップ（fresh） */
  focusFreshMaxMs: FocusFreshMaxMs;
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
  autoCopyDiagnosticsAfterFusion: false,
  focusSettleMs: 0,
  closedLoopCapture: false,
  holdBackgroundFocus: false,
  scaleJointSearch: false,
  captureOrder: 'far_then_near',
  focusFreshMaxMs: 4000,
};