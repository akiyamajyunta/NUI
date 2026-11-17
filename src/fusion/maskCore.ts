import {
  MASK_EPS,
  MASK_FILL_FALLBACK,
  MASK_FILL_PRIOR,
  MASK_LOW_TEXTURE_HI,
  MASK_LOW_TEXTURE_LO,
  MASK_MIN_THRESHOLD,
  SHARPNESS_LAP_MAX,
} from '@/config/constants';
import type { FusionParams, MaskDiagnostics, RangeStats } from '@/types';

/**
 * マスク計算の CPU 実装（純粋関数）。shaders/mask.ts・laplacian.ts と同じ式。
 * 単体テストと診断（S・d の値域）で使う。
 */

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

/** ラプラシアン絶対値 → 8bit 格納用の値（0〜1） */
export function encodeSharpness(lap: number): number {
  return Math.sqrt(clamp01(lap / SHARPNESS_LAP_MAX));
}

/** 8bit 格納値（0〜1） → ラプラシアン絶対値 */
export function decodeSharpness(encoded: number): number {
  return encoded * encoded * SHARPNESS_LAP_MAX;
}

/** d = (sN - sF) / (sN + sF + eps)。範囲は -1〜1 */
export function normalizedDiff(sNear: number, sFar: number, eps = MASK_EPS): number {
  return (sNear - sFar) / (sNear + sFar + eps);
}

/** テクスチャの確からしさ（0 = 低テクスチャ、1 = 十分） */
export function textureConfidence(
  sum: number,
  lo = MASK_LOW_TEXTURE_LO,
  hi = MASK_LOW_TEXTURE_HI,
): number {
  return smoothstep(lo, hi, sum);
}

export type MaskDecisionParams = Pick<FusionParams, 'threshold' | 'nearBias' | 'haloShrink'>;

export function effectiveThreshold(threshold: number): number {
  return Math.max(threshold, MASK_MIN_THRESHOLD);
}

/** 正規化差による判定（1 = NEAR、0 = FAR） */
export function rawMaskValue(sNear: number, sFar: number, p: MaskDecisionParams): number {
  const t = effectiveThreshold(p.threshold);
  return smoothstep(-t, t, normalizedDiff(sNear, sFar) + p.nearBias - p.haloShrink);
}

/** 広くぼかした (m0*c, c) から、低テクスチャ領域に入れる値を求める */
export function fillMaskValue(wideMaskTimesConf: number, wideConf: number): number {
  const fill =
    (wideMaskTimesConf + MASK_FILL_PRIOR * MASK_FILL_FALLBACK) / (wideConf + MASK_FILL_PRIOR);
  return smoothstep(0.25, 0.75, fill);
}

export function finalMaskValue(m0: number, confidence: number, fill: number): number {
  return fill + (m0 - fill) * confidence;
}

const D_BINS = 400;

function medianFromHistogram(hist: Uint32Array, total: number): number {
  const half = total / 2;
  let acc = 0;
  for (let i = 0; i < hist.length; i += 1) {
    acc += hist[i];
    if (acc >= half) return i;
  }
  return hist.length - 1;
}

/**
 * 鮮鋭度マップ（符号化済み 8bit、RGBA なら stride=4）から、S_near・S_far・d の値域を求める。
 * 値はラプラシアン絶対値の単位に復号して返す。
 */
export function maskDiagnosticsFromEncoded(
  nearBytes: ArrayLike<number>,
  farBytes: ArrayLike<number>,
  pixelCount: number,
  stride = 4,
  maxSamples = 120000,
): MaskDiagnostics {
  const empty: RangeStats = { min: 0, median: 0, max: 0 };
  if (pixelCount <= 0) {
    return { sNear: empty, sFar: empty, d: empty, lowTextureRatio: 0, sampleCount: 0 };
  }
  const step = Math.max(1, Math.floor(pixelCount / maxSamples));
  const histNear = new Uint32Array(256);
  const histFar = new Uint32Array(256);
  const histD = new Uint32Array(D_BINS + 1);
  let minNear = 255;
  let maxNear = 0;
  let minFar = 255;
  let maxFar = 0;
  let minD = 1;
  let maxD = -1;
  let low = 0;
  let n = 0;
  for (let i = 0; i < pixelCount; i += step) {
    const bn = nearBytes[i * stride];
    const bf = farBytes[i * stride];
    histNear[bn] += 1;
    histFar[bf] += 1;
    if (bn < minNear) minNear = bn;
    if (bn > maxNear) maxNear = bn;
    if (bf < minFar) minFar = bf;
    if (bf > maxFar) maxFar = bf;
    const sn = decodeSharpness(bn / 255);
    const sf = decodeSharpness(bf / 255);
    if (sn + sf < MASK_LOW_TEXTURE_LO) low += 1;
    const d = normalizedDiff(sn, sf);
    if (d < minD) minD = d;
    if (d > maxD) maxD = d;
    histD[Math.round(((d + 1) / 2) * D_BINS)] += 1;
    n += 1;
  }
  const s = (b: number) => decodeSharpness(b / 255);
  const medianByteNear = medianFromHistogram(histNear, n);
  const medianByteFar = medianFromHistogram(histFar, n);
  const sNear = { min: s(minNear), median: s(medianByteNear), max: s(maxNear) };
  const sFar = { min: s(minFar), median: s(medianByteFar), max: s(maxFar) };
  return {
    sNear,
    sFar,
    d: { min: minD, median: (medianFromHistogram(histD, n) / D_BINS) * 2 - 1, max: maxD },
    lowTextureRatio: low / n,
    sampleCount: n,
    quantizationAnalysis: analyzeSharpnessQuantization(
      sNear,
      sFar,
      minNear,
      minFar,
      medianByteNear,
      medianByteFar,
      histNear,
      histFar,
      n,
    ),
  };
}

/** S_near・S_far の min/median 一致が 8bit 量子化かを説明（修正は行わない） */
export function analyzeSharpnessQuantization(
  sNear: RangeStats,
  sFar: RangeStats,
  minByteNear: number,
  minByteFar: number,
  medianByteNear: number,
  medianByteFar: number,
  histNear: Uint32Array,
  histFar: Uint32Array,
  sampleCount: number,
): string {
  const lines: string[] = [];
  const minMatch = Math.abs(sNear.min - sFar.min) < 1e-8;
  const medMatch = Math.abs(sNear.median - sFar.median) < 1e-8;
  lines.push(
    `8bit符号化: 最小バイト NEAR=${minByteNear} FAR=${minByteFar} / 中央値バイト NEAR=${medianByteNear} FAR=${medianByteFar}`,
  );
  let byteMatch = 0;
  for (let b = 0; b < 256; b += 1) {
    byteMatch += Math.min(histNear[b], histFar[b]);
  }
  const byteMatchRatio = sampleCount > 0 ? byteMatch / sampleCount : 0;
  lines.push(`符号化バイト完全一致率（近似）: ${(byteMatchRatio * 100).toFixed(1)}%`);
  if (minMatch || medMatch) {
    lines.push(
      '復号後の最小/中央値が一致: sqrt(lap/LAP_MAX) の 8bit 丸めにより、異なる lap でも同一バイトになり得る。',
    );
    if (minByteNear === minByteFar && medianByteNear === medianByteFar) {
      lines.push('原因: 中央値・最小とも符号化バイトが一致 → 8bit 量子化の影響が主因と判断。');
    } else if (minMatch || medMatch) {
      lines.push(
        '原因: バイト値は異なるが decode 後の浮動小数が一致 → LAP_MAX=1 と平方復号による離散化。',
      );
    }
  } else {
    lines.push('復号後の最小/中央値は一致していない。');
  }
  return lines.join(' ');
}
