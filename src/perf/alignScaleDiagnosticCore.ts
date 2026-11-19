import { DISPLAY_BUFFER, displayNormalizedToBufferNormalized } from '@/imaging/displayPoint';
import type { NormalizedPoint, ScaleEstimateSource, ScaleNccSample } from '@/types';
import {
  medianRecentTrustworthyScales,
  pushTrustworthyScale,
} from '@/perf/scaleEstimateHistory';

/** 同時探索など診断専用の縮小長辺 */
export const SCALE_DIAG_LONG_SIDE = 80;
/** 粗探索の長辺 */
export const SCALE_COARSE_LONG_SIDE = 80;
/** 精密探索の長辺（上限 160px） */
export const SCALE_ESTIMATE_LONG_SIDE = 160;
export const SCALE_FINE_STEP = 0.002;
/** 精密探索の半幅 */
export const SCALE_FINE_RADIUS = 0.01;
/** 精密最良が粗最良よりこの分以上 NCC が高いときだけ精密値を採用 */
export const SCALE_FINE_ADOPT_MIN_NCC = 0.001;
export const SCALE_ADOPT_MIN_DEFAULT = 1.0;
export const SCALE_ADOPT_MAX_DEFAULT = 1.08;
/** 粗探索ピーク鋭さの評価半幅 */
export const SCALE_COARSE_PEAK_RADIUS = 0.01;
/** これ未満ならピークが平坦とみなし推定を信頼しない。既定 0.005 */
export const SCALE_PEAK_SHARPNESS_MIN = 0.005;
/** 履歴が無いときの固定倍率既定 */
export const SCALE_FIXED_DEFAULT = 1.02;
/** 両画像に同じ半径のボックスぼかし（分析px） */
export const SCALE_DIAG_BLUR_RADIUS_PX = 2;

export const SCALE_MIN = 0.95;
export const SCALE_MAX = 1.1;
export const SCALE_STEP = 0.005;
/** これ未満の NCC 改善では scale=1 に戻す。既定 0.001 */
export const SCALE_MIN_GAIN = 0.001;
export const TRANS_RANGE_PX = 3;
export const SUBJECT_EXCLUDE_RADIUS_FRAC = 0.25;

function sampleBilinear(src: Float32Array, w: number, h: number, x: number, y: number): number {
  if (x < 0 || y < 0 || x > w - 1 || y > h - 1) return NaN;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(x0 + 1, w - 1);
  const y1 = Math.min(y0 + 1, h - 1);
  const tx = x - x0;
  const ty = y - y0;
  const v00 = src[y0 * w + x0];
  const v10 = src[y0 * w + x1];
  const v01 = src[y1 * w + x0];
  const v11 = src[y1 * w + x1];
  const top = v00 * (1 - tx) + v10 * tx;
  const bot = v01 * (1 - tx) + v11 * tx;
  return top * (1 - ty) + bot * ty;
}

export function boxBlurGray(gray: Float32Array, w: number, h: number, radius: number): Float32Array {
  if (radius <= 0) return gray.slice();
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  const diam = radius * 2 + 1;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      let sum = 0;
      for (let k = -radius; k <= radius; k += 1) {
        const sx = Math.min(w - 1, Math.max(0, x + k));
        sum += gray[y * w + sx];
      }
      tmp[y * w + x] = sum / diam;
    }
  }
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      let sum = 0;
      for (let k = -radius; k <= radius; k += 1) {
        const sy = Math.min(h - 1, Math.max(0, y + k));
        sum += tmp[sy * w + x];
      }
      out[y * w + x] = sum / diam;
    }
  }
  return out;
}

function farSampleAt(
  grayFar: Float32Array,
  w: number,
  h: number,
  nearX: number,
  nearY: number,
  scale: number,
  dx: number,
  dy: number,
): number {
  const px = nearX - dx;
  const py = nearY - dy;
  const cx = w * 0.5;
  const cy = h * 0.5;
  const sx = (px - cx) / scale + cx;
  const sy = (py - cy) / scale + cy;
  return sampleBilinear(grayFar, w, h, sx, sy);
}

export function maskedNccGray(
  grayNear: Float32Array,
  grayFar: Float32Array,
  w: number,
  h: number,
  scale: number,
  dx: number,
  dy: number,
  subject: NormalizedPoint,
): number {
  const cx = subject.x * w;
  const cy = subject.y * h;
  const r = SUBJECT_EXCLUDE_RADIUS_FRAC * w;
  const r2 = r * r;

  let sumA = 0;
  let sumB = 0;
  let count = 0;
  for (let y = 1; y < h - 1; y += 1) {
    for (let x = 1; x < w - 1; x += 1) {
      const ddx = x - cx;
      const ddy = y - cy;
      if (ddx * ddx + ddy * ddy <= r2) continue;
      const b = farSampleAt(grayFar, w, h, x, y, scale, dx, dy);
      if (Number.isNaN(b)) continue;
      sumA += grayNear[y * w + x];
      sumB += b;
      count += 1;
    }
  }
  if (count < 8) return -1;

  const meanA = sumA / count;
  const meanB = sumB / count;
  let num = 0;
  let denA = 0;
  let denB = 0;
  for (let y = 1; y < h - 1; y += 1) {
    for (let x = 1; x < w - 1; x += 1) {
      const ddx = x - cx;
      const ddy = y - cy;
      if (ddx * ddx + ddy * ddy <= r2) continue;
      const b = farSampleAt(grayFar, w, h, x, y, scale, dx, dy);
      if (Number.isNaN(b)) continue;
      const a = grayNear[y * w + x];
      const da = a - meanA;
      const db = b - meanB;
      num += da * db;
      denA += da * da;
      denB += db * db;
    }
  }
  const denom = Math.sqrt(denA * denB);
  if (denom < 1e-10) return -1;
  return num / denom;
}

export type AlignScaleSearchResult = {
  mode: 'scaleOnly' | 'scaleAndTranslation';
  bestScale: number;
  bestDx: number;
  bestDy: number;
  bestNcc: number;
  unityNcc: number;
  /** bestNcc − unityNcc（scale=1, dx=dy=0） */
  nccGainVsUnity: number;
  ms: number;
};

export type AlignScaleDiagnostic = {
  analysisLongSide: number;
  blurRadiusPx: number;
  excludeSubjectRadiusFrac: number;
  searchMin: number;
  searchMax: number;
  scaleStep: number;
  translationRangePx: number;
  scaleOnly: AlignScaleSearchResult;
  joint: AlignScaleSearchResult | null;
  ms: number;
};

/** 粗探索の最良点と両隣から頂点を 0.001 刻みで返す。山でなければ粗探索値 */
export function refineScaleByParabola(
  samples: readonly { scale: number; ncc: number }[],
  bestIndex: number,
): number {
  const prev = samples[bestIndex - 1];
  const best = samples[bestIndex];
  const next = samples[bestIndex + 1];
  if (!prev || !best || !next) return best?.scale ?? 1;
  const step = best.scale - prev.scale;
  if (Math.abs(step) < 1e-9) return best.scale;
  const y0 = prev.ncc;
  const y1 = best.ncc;
  const y2 = next.ncc;
  const a = (y0 + y2) / 2 - y1;
  if (a >= -1e-12) return best.scale;
  const b = (y2 - y0) / 2;
  const refined = best.scale + (-b / (2 * a)) * step;
  const clamped = Math.min(SCALE_MAX, Math.max(SCALE_MIN, refined));
  return Math.round(clamped * 1000) / 1000;
}

function searchScaleOnly(
  grayNear: Float32Array,
  grayFar: Float32Array,
  w: number,
  h: number,
  subject: NormalizedPoint,
  unityNcc: number,
): AlignScaleSearchResult {
  const t0 = performance.now();
  const samples: { scale: number; ncc: number }[] = [];
  let bestIndex = 0;
  const nSteps = Math.round((SCALE_MAX - SCALE_MIN) / SCALE_STEP) + 1;
  for (let i = 0; i < nSteps; i += 1) {
    const scale = SCALE_MIN + i * SCALE_STEP;
    const ncc = maskedNccGray(grayNear, grayFar, w, h, scale, 0, 0, subject);
    samples.push({ scale, ncc });
    if (ncc > samples[bestIndex].ncc) bestIndex = i;
  }
  let bestScale = samples[bestIndex].scale;
  let bestNcc = samples[bestIndex].ncc;
  const refined = refineScaleByParabola(samples, bestIndex);
  if (Math.abs(refined - bestScale) > 5e-4) {
    const ncc = maskedNccGray(grayNear, grayFar, w, h, refined, 0, 0, subject);
    if (ncc >= bestNcc) {
      bestNcc = ncc;
      bestScale = refined;
    }
  }
  return {
    mode: 'scaleOnly',
    bestScale,
    bestDx: 0,
    bestDy: 0,
    bestNcc,
    unityNcc,
    nccGainVsUnity: bestNcc - unityNcc,
    ms: performance.now() - t0,
  };
}

function searchScaleAndTranslation(
  grayNear: Float32Array,
  grayFar: Float32Array,
  w: number,
  h: number,
  subject: NormalizedPoint,
  unityNcc: number,
): AlignScaleSearchResult {
  const t0 = performance.now();
  let bestScale = 1;
  let bestDx = 0;
  let bestDy = 0;
  let bestNcc = -2;
  const nSteps = Math.round((SCALE_MAX - SCALE_MIN) / SCALE_STEP) + 1;
  for (let i = 0; i < nSteps; i += 1) {
    const scale = SCALE_MIN + i * SCALE_STEP;
    for (let dy = -TRANS_RANGE_PX; dy <= TRANS_RANGE_PX; dy += 1) {
      for (let dx = -TRANS_RANGE_PX; dx <= TRANS_RANGE_PX; dx += 1) {
        const ncc = maskedNccGray(grayNear, grayFar, w, h, scale, dx, dy, subject);
        if (ncc > bestNcc) {
          bestNcc = ncc;
          bestScale = scale;
          bestDx = dx;
          bestDy = dy;
        }
      }
    }
  }
  return {
    mode: 'scaleAndTranslation',
    bestScale,
    bestDx,
    bestDy,
    bestNcc,
    unityNcc,
    nccGainVsUnity: bestNcc - unityNcc,
    ms: performance.now() - t0,
  };
}

export type GrayScalePair = {
  grayNear: Float32Array;
  grayFar: Float32Array;
  w: number;
  h: number;
};

export type AppliedScaleEstimate = {
  estimatedScale: number;
  appliedScale: number;
  nccBefore: number;
  /** 推定 scale での NCC。フォールバックしても残す */
  nccAtEstimate: number;
  nccAfter: number;
  fellBack: boolean;
  minGain: number;
  analysisLongSide: number;
  coarseLongSide: number;
  ms: number;
  coarseMs: number;
  fineMs: number;
  coarseTopNcc: ScaleNccSample[];
  peakSharpness: number;
  peakSharpnessMin: number;
  scaleSource: ScaleEstimateSource;
  fineSkipped: boolean;
  coarseBestScale: number;
  coarseBestNcc: number;
  fineBestScale: number | null;
  fineBestNcc: number | null;
  adoptMin: number;
  adoptMax: number;
  fineAdoptMinNcc: number;
};

/** 精密探索で試す scale 一覧（粗最良の ±SCALE_FINE_RADIUS、SCALE_FINE_STEP 刻み） */
export function fineSearchScalesAround(coarseBestScale: number): number[] {
  const fineMin = Math.max(
    SCALE_MIN,
    Math.round((coarseBestScale - SCALE_FINE_RADIUS) * 1000) / 1000,
  );
  const fineMax = Math.min(
    SCALE_MAX,
    Math.round((coarseBestScale + SCALE_FINE_RADIUS) * 1000) / 1000,
  );
  return scalesInRange(fineMin, fineMax, SCALE_FINE_STEP);
}

function scalesInRange(min: number, max: number, step: number): number[] {
  const n = Math.round((max - min) / step) + 1;
  const out: number[] = [];
  for (let i = 0; i < n; i += 1) {
    const s = Math.round((min + i * step) * 1000) / 1000;
    out.push(Math.min(max, Math.max(min, s)));
  }
  return out;
}

function searchScaleSamples(
  grayNear: Float32Array,
  grayFar: Float32Array,
  w: number,
  h: number,
  subject: NormalizedPoint,
  scales: readonly number[],
): { samples: ScaleNccSample[]; bestIndex: number; ms: number } {
  const t0 = performance.now();
  const samples: ScaleNccSample[] = [];
  let bestIndex = 0;
  for (let i = 0; i < scales.length; i += 1) {
    const scale = scales[i];
    const ncc = maskedNccGray(grayNear, grayFar, w, h, scale, 0, 0, subject);
    samples.push({ scale, ncc });
    if (ncc > samples[bestIndex].ncc) bestIndex = i;
  }
  return { samples, bestIndex, ms: performance.now() - t0 };
}

function topNccSamples(samples: readonly ScaleNccSample[], n: number): ScaleNccSample[] {
  return [...samples].sort((a, b) => b.ncc - a.ncc).slice(0, n);
}

function peakSharpnessAt(
  grayNear: Float32Array,
  grayFar: Float32Array,
  w: number,
  h: number,
  subject: NormalizedPoint,
  bestScale: number,
  bestNcc: number,
  radius: number,
): number {
  const lo = maskedNccGray(grayNear, grayFar, w, h, bestScale - radius, 0, 0, subject);
  const hi = maskedNccGray(grayNear, grayFar, w, h, bestScale + radius, 0, 0, subject);
  return bestNcc - Math.max(lo, hi);
}

function clampScale(scale: number): number {
  return Math.min(SCALE_MAX, Math.max(SCALE_MIN, scale));
}

function emptyScaleEstimate(
  minGain: number,
  coarse: GrayScalePair,
  fine: GrayScalePair,
  ms: number,
): AppliedScaleEstimate {
  return {
    estimatedScale: 1,
    appliedScale: 1,
    nccBefore: 0,
    nccAtEstimate: 0,
    nccAfter: 0,
    fellBack: false,
    minGain,
    analysisLongSide: Math.max(fine.w, fine.h),
    coarseLongSide: Math.max(coarse.w, coarse.h),
    ms,
    coarseMs: 0,
    fineMs: 0,
    coarseTopNcc: [],
    peakSharpness: 0,
    peakSharpnessMin: SCALE_PEAK_SHARPNESS_MIN,
    scaleSource: 'fixed',
    fineSkipped: false,
    coarseBestScale: 1,
    coarseBestNcc: 0,
    fineBestScale: null,
    fineBestNcc: null,
    adoptMin: SCALE_ADOPT_MIN_DEFAULT,
    adoptMax: SCALE_ADOPT_MAX_DEFAULT,
    fineAdoptMinNcc: SCALE_FINE_ADOPT_MIN_NCC,
  };
}

function subjectAt(
  subjectDisplay: NormalizedPoint,
  w: number,
  h: number,
): NormalizedPoint {
  return displayNormalizedToBufferNormalized(subjectDisplay, w, h, DISPLAY_BUFFER);
}

function pickFallbackScale(fixedApplied: number) {
  const median = medianRecentTrustworthyScales();
  if (median != null) {
    return { scale: clampScale(median), source: 'recent' as const };
  }
  return { scale: fixedApplied, source: 'fixed' as const };
}

function isInAdoptRange(scale: number, adoptMin: number, adoptMax: number): boolean {
  return scale >= adoptMin && scale <= adoptMax;
}

export type CoarseSearchResult = {
  coarseBest: ScaleNccSample;
  coarseTopNcc: ScaleNccSample[];
  peakSharpness: number;
  coarseMs: number;
  coarseLongSide: number;
};

/** @deprecated finalizeScaleEstimate 用の別名 */
export type SharpCoarsePeakContext = CoarseSearchResult;

export function runCoarseScaleSearch(
  coarse: GrayScalePair,
  subjectDisplay: NormalizedPoint,
): CoarseSearchResult {
  const {
    grayNear: cNear,
    grayFar: cFar,
    w: cw,
    h: ch,
  } = coarse;
  const subjectC = subjectAt(subjectDisplay, cw, ch);
  const coarseLongSide = Math.max(cw, ch);
  const coarseScales = scalesInRange(SCALE_MIN, SCALE_MAX, SCALE_STEP);
  const coarseFound = searchScaleSamples(cNear, cFar, cw, ch, subjectC, coarseScales);
  const coarseTopNcc = topNccSamples(coarseFound.samples, 5);
  const coarseBest = coarseFound.samples[coarseFound.bestIndex];
  const peakSharpness = peakSharpnessAt(
    cNear,
    cFar,
    cw,
    ch,
    subjectC,
    coarseBest.scale,
    coarseBest.ncc,
    SCALE_COARSE_PEAK_RADIUS,
  );
  return {
    coarseBest,
    coarseTopNcc,
    peakSharpness,
    coarseMs: coarseFound.ms,
    coarseLongSide,
  };
}

export type FinalizeScaleOptions = {
  adoptMin: number;
  adoptMax: number;
  fixedScale: number;
  fineAdoptMinNcc: number;
  minGain: number;
};

function buildScaleEstimateBase(
  coarseResult: CoarseSearchResult,
  opts: FinalizeScaleOptions,
  partial: Partial<AppliedScaleEstimate>,
): AppliedScaleEstimate {
  return {
    estimatedScale: coarseResult.coarseBest.scale,
    appliedScale: coarseResult.coarseBest.scale,
    nccBefore: 0,
    nccAtEstimate: coarseResult.coarseBest.ncc,
    nccAfter: 0,
    fellBack: false,
    minGain: opts.minGain,
    analysisLongSide: coarseResult.coarseLongSide,
    coarseLongSide: coarseResult.coarseLongSide,
    ms: 0,
    coarseMs: coarseResult.coarseMs,
    fineMs: 0,
    coarseTopNcc: coarseResult.coarseTopNcc,
    peakSharpness: coarseResult.peakSharpness,
    peakSharpnessMin: SCALE_PEAK_SHARPNESS_MIN,
    scaleSource: 'coarse',
    fineSkipped: true,
    coarseBestScale: coarseResult.coarseBest.scale,
    coarseBestNcc: coarseResult.coarseBest.ncc,
    fineBestScale: null,
    fineBestNcc: null,
    adoptMin: opts.adoptMin,
    adoptMax: opts.adoptMax,
    fineAdoptMinNcc: opts.fineAdoptMinNcc,
    ...partial,
  };
}

export function finalizeScaleEstimate(
  coarseResult: CoarseSearchResult,
  coarse: GrayScalePair,
  fine: GrayScalePair | null,
  subjectDisplay: NormalizedPoint,
  opts: FinalizeScaleOptions,
  t0: number,
): AppliedScaleEstimate {
  const fixedApplied = clampScale(opts.fixedScale);
  const {
    grayNear: cNear,
    grayFar: cFar,
    w: cw,
    h: ch,
  } = coarse;
  const subjectC = subjectAt(subjectDisplay, cw, ch);

  if (!isInAdoptRange(coarseResult.coarseBest.scale, opts.adoptMin, opts.adoptMax)) {
    const fb = pickFallbackScale(fixedApplied);
    const nccBefore = maskedNccGray(cNear, cFar, cw, ch, 1, 0, 0, subjectC);
    const nccAfter = maskedNccGray(cNear, cFar, cw, ch, fb.scale, 0, 0, subjectC);
    return buildScaleEstimateBase(coarseResult, opts, {
      appliedScale: fb.scale,
      nccBefore,
      nccAfter,
      fellBack: true,
      scaleSource: fb.source,
      fineSkipped: true,
      ms: performance.now() - t0,
    });
  }

  if (!fine) {
    throw new Error('fine gray required when coarse best is in adopt range');
  }

  const {
    grayNear: fNear,
    grayFar: fFar,
    w: fw,
    h: fh,
  } = fine;
  const subjectF = subjectAt(subjectDisplay, fw, fh);
  const nccBefore = maskedNccGray(fNear, fFar, fw, fh, 1, 0, 0, subjectF);
  const coarseNccOnFine = maskedNccGray(
    fNear,
    fFar,
    fw,
    fh,
    coarseResult.coarseBest.scale,
    0,
    0,
    subjectF,
  );
  const fineScales = fineSearchScalesAround(coarseResult.coarseBest.scale);
  const fineFound = searchScaleSamples(fNear, fFar, fw, fh, subjectF, fineScales);
  const fineBest = fineFound.samples[fineFound.bestIndex];

  let appliedScale = coarseResult.coarseBest.scale;
  let scaleSource: ScaleEstimateSource = 'coarse';
  let nccAtEstimate = coarseNccOnFine;
  if (fineBest.ncc >= coarseNccOnFine + opts.fineAdoptMinNcc) {
    appliedScale = fineBest.scale;
    scaleSource = 'fine';
    nccAtEstimate = fineBest.ncc;
    pushTrustworthyScale(fineBest.scale);
  } else {
    pushTrustworthyScale(coarseResult.coarseBest.scale);
  }

  const nccAfter = maskedNccGray(fNear, fFar, fw, fh, appliedScale, 0, 0, subjectF);

  return buildScaleEstimateBase(coarseResult, opts, {
    estimatedScale: appliedScale,
    appliedScale,
    nccBefore,
    nccAtEstimate,
    nccAfter,
    analysisLongSide: Math.max(fw, fh),
    ms: performance.now() - t0,
    fineMs: fineFound.ms,
    scaleSource,
    fineSkipped: false,
    fineBestScale: fineBest.scale,
    fineBestNcc: fineBest.ncc,
  });
}

export function estimateAppliedScale(
  coarse: GrayScalePair,
  fine: GrayScalePair | null,
  subjectDisplay: NormalizedPoint,
  mode: 'off' | 'estimate' | 'fixed',
  fixedScale = SCALE_FIXED_DEFAULT,
  minGain = SCALE_MIN_GAIN,
  adoptMin = SCALE_ADOPT_MIN_DEFAULT,
  adoptMax = SCALE_ADOPT_MAX_DEFAULT,
): AppliedScaleEstimate {
  const t0 = performance.now();
  const coarseLongSide = Math.max(coarse.w, coarse.h);
  const finePlaceholder: GrayScalePair = fine ?? coarse;
  if (mode === 'off') {
    return emptyScaleEstimate(minGain, coarse, finePlaceholder, performance.now() - t0);
  }

  const {
    grayNear: cNear,
    grayFar: cFar,
    w: cw,
    h: ch,
  } = coarse;
  const subjectC = subjectAt(subjectDisplay, cw, ch);
  const fixedApplied = clampScale(fixedScale);

  if (mode === 'fixed') {
    const nccBefore = maskedNccGray(cNear, cFar, cw, ch, 1, 0, 0, subjectC);
    const nccAfter = maskedNccGray(cNear, cFar, cw, ch, fixedApplied, 0, 0, subjectC);
    return {
      estimatedScale: fixedApplied,
      appliedScale: fixedApplied,
      nccBefore,
      nccAtEstimate: nccAfter,
      nccAfter,
      fellBack: false,
      minGain,
      analysisLongSide: fine ? Math.max(fine.w, fine.h) : coarseLongSide,
      coarseLongSide,
      ms: performance.now() - t0,
      coarseMs: 0,
      fineMs: 0,
      coarseTopNcc: [],
      peakSharpness: 0,
      peakSharpnessMin: SCALE_PEAK_SHARPNESS_MIN,
      scaleSource: 'fixed',
      fineSkipped: true,
      coarseBestScale: fixedApplied,
      coarseBestNcc: nccAfter,
      fineBestScale: null,
      fineBestNcc: null,
      adoptMin: SCALE_ADOPT_MIN_DEFAULT,
      adoptMax: SCALE_ADOPT_MAX_DEFAULT,
      fineAdoptMinNcc: SCALE_FINE_ADOPT_MIN_NCC,
    };
  }

  const coarseResult = runCoarseScaleSearch(
    { grayNear: cNear, grayFar: cFar, w: cw, h: ch },
    subjectDisplay,
  );
  return finalizeScaleEstimate(
    coarseResult,
    { grayNear: cNear, grayFar: cFar, w: cw, h: ch },
    fine,
    subjectDisplay,
    {
      adoptMin,
      adoptMax,
      fixedScale,
      fineAdoptMinNcc: SCALE_FINE_ADOPT_MIN_NCC,
      minGain,
    },
    t0,
  );
}

export function runAlignScaleDiagnostic(
  grayNear: Float32Array,
  grayFar: Float32Array,
  w: number,
  h: number,
  subject: NormalizedPoint,
  analysisLongSide: number,
  jointSearch = false,
): AlignScaleDiagnostic {
  const t0 = performance.now();
  const unityNcc = maskedNccGray(grayNear, grayFar, w, h, 1, 0, 0, subject);
  const scaleOnly = searchScaleOnly(grayNear, grayFar, w, h, subject, unityNcc);
  const joint = jointSearch
    ? searchScaleAndTranslation(grayNear, grayFar, w, h, subject, unityNcc)
    : null;
  return {
    analysisLongSide,
    blurRadiusPx: SCALE_DIAG_BLUR_RADIUS_PX,
    excludeSubjectRadiusFrac: SUBJECT_EXCLUDE_RADIUS_FRAC,
    searchMin: SCALE_MIN,
    searchMax: SCALE_MAX,
    scaleStep: SCALE_STEP,
    translationRangePx: TRANS_RANGE_PX,
    scaleOnly,
    joint,
    ms: performance.now() - t0,
  };
}