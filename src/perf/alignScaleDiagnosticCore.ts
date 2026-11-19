import type { NormalizedPoint } from '@/types';

/** 同時探索など診断専用の縮小長辺 */
export const SCALE_DIAG_LONG_SIDE = 80;
/** 拡大率推定の比較画像。長辺 192〜256px */
export const SCALE_ESTIMATE_LONG_SIDE = 256;
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
  ms: number;
};

export function estimateAppliedScale(
  grayNear: Float32Array,
  grayFar: Float32Array,
  w: number,
  h: number,
  subject: NormalizedPoint,
  mode: 'off' | 'estimate' | 'fixed',
  fixedScale = 1,
  minGain = SCALE_MIN_GAIN,
): AppliedScaleEstimate {
  const t0 = performance.now();
  const longSide = Math.max(w, h);
  if (mode === 'off') {
    return {
      estimatedScale: 1,
      appliedScale: 1,
      nccBefore: 0,
      nccAtEstimate: 0,
      nccAfter: 0,
      fellBack: false,
      minGain,
      analysisLongSide: longSide,
      ms: performance.now() - t0,
    };
  }
  const nccBefore = maskedNccGray(grayNear, grayFar, w, h, 1, 0, 0, subject);
  if (mode === 'fixed') {
    const applied = Math.min(SCALE_MAX, Math.max(SCALE_MIN, fixedScale));
    const nccAfter = maskedNccGray(grayNear, grayFar, w, h, applied, 0, 0, subject);
    return {
      estimatedScale: applied,
      appliedScale: applied,
      nccBefore,
      nccAtEstimate: nccAfter,
      nccAfter,
      fellBack: false,
      minGain,
      analysisLongSide: longSide,
      ms: performance.now() - t0,
    };
  }
  const found = searchScaleOnly(grayNear, grayFar, w, h, subject, nccBefore);
  const gain = found.bestNcc - nccBefore;
  const fellBack = gain < minGain;
  return {
    estimatedScale: found.bestScale,
    appliedScale: fellBack ? 1 : found.bestScale,
    nccBefore,
    nccAtEstimate: found.bestNcc,
    nccAfter: fellBack ? nccBefore : found.bestNcc,
    fellBack,
    minGain,
    analysisLongSide: longSide,
    ms: performance.now() - t0,
  };
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