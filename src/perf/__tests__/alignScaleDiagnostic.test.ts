import {
  estimateAppliedScale,
  finalizeScaleEstimate,
  fineSearchScalesAround,
  maskedNccGray,
  refineScaleByParabola,
  runCoarseScaleSearch,
  SCALE_ADOPT_MAX_DEFAULT,
  SCALE_FINE_ADOPT_MIN_NCC,
  SCALE_FIXED_DEFAULT,
  SCALE_MIN_GAIN,
  SCALE_FINE_RADIUS,
  SCALE_MAX,
  SCALE_MIN,
  SCALE_STEP,
  type GrayScalePair,
} from '@/perf/alignScaleDiagnosticCore';
import { clearScaleEstimateHistoryForTests } from '@/perf/scaleEstimateHistory';

function grayPair(
  w: number,
  h: number,
  grayNear: Float32Array,
  grayFar: Float32Array,
): GrayScalePair {
  return { grayNear, grayFar, w, h };
}

describe('alignScaleDiagnostic grid', () => {
  it('粗探索は0.95〜1.10を0.005刻みで31点', () => {
    const n = Math.round((SCALE_MAX - SCALE_MIN) / SCALE_STEP) + 1;
    expect(n).toBe(31);
  });

  it('同一グレー画像の NCC は 1.0 に近い', () => {
    const w = 32;
    const h = 24;
    const gray = new Float32Array(w * h);
    for (let i = 0; i < gray.length; i += 1) gray[i] = (i % 17) / 20;
    const ncc = maskedNccGray(gray, gray, w, h, 1, 0, 0, { x: 0.5, y: 0.45 });
    expect(ncc).toBeGreaterThan(0.999);
  });

  it('放物線フィットは粗点の間を 0.001 刻みで補う', () => {
    const samples = [
      { scale: 1.0, ncc: 0.8 },
      { scale: 1.005, ncc: 0.9 },
      { scale: 1.01, ncc: 0.82 },
    ];
    const refined = refineScaleByParabola(samples, 1);
    expect(refined).toBeGreaterThan(1.0);
    expect(refined).toBeLessThan(1.01);
  });

  it('平坦粗ピークでも範囲内なら粗最良を採用（固定フォールバックなし）', () => {
    clearScaleEstimateHistoryForTests();
    const w = 40;
    const h = 30;
    const gray = new Float32Array(w * h);
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) gray[y * w + x] = x / w;
    }
    const coarse = grayPair(w, h, gray, gray);
    const fine = grayPair(w, h, gray, gray);
    const coarseResult = runCoarseScaleSearch(coarse, { x: -1, y: -1 });
    const est = finalizeScaleEstimate(
      coarseResult,
      coarse,
      fine,
      { x: -1, y: -1 },
      {
        adoptMin: SCALE_MIN,
        adoptMax: SCALE_ADOPT_MAX_DEFAULT,
        fixedScale: 1.02,
        fineAdoptMinNcc: SCALE_FINE_ADOPT_MIN_NCC,
        minGain: 0.001,
      },
      performance.now(),
    );
    expect(est.scaleSource).not.toBe('fixed');
    expect(est.fellBack).toBe(false);
    expect(est.coarseBestScale).toBe(coarseResult.coarseBest.scale);
    expect(est.appliedScale).toBe(coarseResult.coarseBest.scale);
  });

  it('精密探索は粗最良±0.01を0.002刻み（11点）', () => {
    const scales = fineSearchScalesAround(1.018);
    expect(scales).toHaveLength(11);
    expect(scales[0]).toBeCloseTo(1.018 - SCALE_FINE_RADIUS, 3);
    expect(scales[10]).toBeCloseTo(1.018 + SCALE_FINE_RADIUS, 3);
  });

  it('拡大した FAR で精密が粗より十分高ければ fine を採用', () => {
    clearScaleEstimateHistoryForTests();
    const w = 72;
    const h = 54;
    const near = new Float32Array(w * h);
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        near[y * w + x] = 0.5 + 0.5 * Math.sin(x * 0.45) * Math.cos(y * 0.55);
      }
    }
    const far = new Float32Array(w * h);
    const cx = (w - 1) / 2;
    const cy = (h - 1) / 2;
    const zoom = 1.08;
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const sx = (x - cx) / zoom + cx;
        const sy = (y - cy) / zoom + cy;
        const x0 = Math.min(w - 1, Math.max(0, Math.round(sx)));
        const y0 = Math.min(h - 1, Math.max(0, Math.round(sy)));
        far[y * w + x] = near[y0 * w + x0];
      }
    }
    const pair = grayPair(w, h, near, far);
    const est = estimateAppliedScale(
      pair,
      pair,
      { x: -1, y: -1 },
      'estimate',
      SCALE_FIXED_DEFAULT,
      SCALE_MIN_GAIN,
      SCALE_MIN,
      SCALE_MAX,
    );
    expect(est.coarseBestScale).toBeGreaterThan(0);
    expect(['coarse', 'fine']).toContain(est.scaleSource);
    expect(est.fellBack).toBe(false);
  });
});