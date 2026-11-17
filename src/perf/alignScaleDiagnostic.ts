import { ALIGN_LONG_SIDE } from '@/config/constants';
import { fitLongSide } from '@/imaging/downscale';
import { grayToGradientMag, readGrayFromSkImage } from '@/imaging/imagePixels';
import { loadImage } from '@/imaging/loadImage';
import { searchTranslation } from '@/fusion/alignCore';
import type { NormalizedPoint } from '@/types';

const SCALE_MIN = 0.95;
const SCALE_MAX = 1.05;
const SCALE_STEP = 0.005;
const SUBJECT_EXCLUDE_RADIUS_FRAC = 0.25;

function sampleBilinear(src: Float32Array, w: number, h: number, x: number, y: number): number {
  if (x < 0 || y < 0 || x > w - 1 || y > h - 1) return 0;
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

function buildScaledFarEdges(
  far: Float32Array,
  w: number,
  h: number,
  scale: number,
): Float32Array {
  const cx = w * 0.5;
  const cy = h * 0.5;
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const sx = (x - cx) / scale + cx;
      const sy = (y - cy) / scale + cy;
      out[y * w + x] = sampleBilinear(far, w, h, sx, sy);
    }
  }
  return out;
}

function maskedEdgeSad(
  ref: Float32Array,
  tgt: Float32Array,
  w: number,
  h: number,
  dx: number,
  dy: number,
  subject: NormalizedPoint,
): number {
  const cx = subject.x * w;
  const cy = subject.y * h;
  const r = SUBJECT_EXCLUDE_RADIUS_FRAC * w;
  const r2 = r * r;
  let sum = 0;
  let count = 0;
  for (let y = 1; y < h - 1; y += 1) {
    for (let x = 1; x < w - 1; x += 1) {
      const ddx = x - cx;
      const ddy = y - cy;
      if (ddx * ddx + ddy * ddy <= r2) continue;
      const tx = x + dx;
      const ty = y + dy;
      if (tx < 0 || ty < 0 || tx >= w || ty >= h) continue;
      const d = ref[y * w + x] - tgt[ty * w + tx];
      sum += d < 0 ? -d : d;
      count += 1;
    }
  }
  return count > 0 ? sum / count : Number.MAX_VALUE;
}

export type AlignScaleDiagnostic = {
  bestScale: number;
  bestMaskedSad: number;
  atUnityMaskedSad: number;
  searchMin: number;
  searchMax: number;
  step: number;
  analysisLongSide: number;
  excludeSubjectRadiusFrac: number;
  fixedTranslation: { dx: number; dy: number };
  ms: number;
};

export async function measureBackgroundEdgeScale(
  nearUri: string,
  farUri: string,
  subjectPoint: NormalizedPoint,
  analysisLongSide = ALIGN_LONG_SIDE,
): Promise<AlignScaleDiagnostic> {
  const t0 = performance.now();
  const [nearLoaded, farLoaded] = await Promise.all([loadImage(nearUri), loadImage(farUri)]);
  const nw = nearLoaded.width;
  const nh = nearLoaded.height;
  const { width: w, height: h } = fitLongSide(nw, nh, analysisLongSide);
  const grayNear = readGrayFromSkImage(nearLoaded.image, analysisLongSide);
  const grayFar = readGrayFromSkImage(farLoaded.image, analysisLongSide);
  const edgeNear = grayToGradientMag(grayNear, w, h);
  const edgeFar = grayToGradientMag(grayFar, w, h);
  const tEst = searchTranslation(edgeNear, edgeFar, w, h);
  const dx = tEst.dx;
  const dy = tEst.dy;

  let bestScale = 1;
  let bestCost = Number.MAX_VALUE;
  let atUnity = Number.MAX_VALUE;
  const nSteps = Math.round((SCALE_MAX - SCALE_MIN) / SCALE_STEP) + 1;
  for (let i = 0; i < nSteps; i += 1) {
    const scale = SCALE_MIN + i * SCALE_STEP;
    const scaledFar = buildScaledFarEdges(edgeFar, w, h, scale);
    const cost = maskedEdgeSad(edgeNear, scaledFar, w, h, dx, dy, subjectPoint);
    if (Math.abs(scale - 1) < SCALE_STEP * 0.51) atUnity = cost;
    if (cost < bestCost) {
      bestCost = cost;
      bestScale = scale;
    }
  }

  return {
    bestScale,
    bestMaskedSad: bestCost,
    atUnityMaskedSad: atUnity,
    searchMin: SCALE_MIN,
    searchMax: SCALE_MAX,
    step: SCALE_STEP,
    analysisLongSide,
    excludeSubjectRadiusFrac: SUBJECT_EXCLUDE_RADIUS_FRAC,
    fixedTranslation: { dx, dy },
    ms: performance.now() - t0,
  };
}