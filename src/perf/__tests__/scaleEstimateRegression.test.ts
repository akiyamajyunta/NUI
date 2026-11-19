import {
  finalizeScaleEstimate,
  fineSearchScalesAround,
  SCALE_ADOPT_MAX_DEFAULT,
  SCALE_ADOPT_MIN_DEFAULT,
  SCALE_FINE_ADOPT_MIN_NCC,
  SCALE_FINE_RADIUS,
  SCALE_FINE_STEP,
  type CoarseSearchResult,
  type GrayScalePair,
} from '@/perf/alignScaleDiagnosticCore';
import { clearScaleEstimateHistoryForTests } from '@/perf/scaleEstimateHistory';

function grayPair(w: number, h: number, v = 0.5): GrayScalePair {
  const g = new Float32Array(w * h);
  g.fill(v);
  return { grayNear: g, grayFar: g.slice(), w, h };
}

describe('scaleEstimateRegression', () => {
  const opts = {
    adoptMin: SCALE_ADOPT_MIN_DEFAULT,
    adoptMax: SCALE_ADOPT_MAX_DEFAULT,
    fixedScale: 1.02,
    fineAdoptMinNcc: SCALE_FINE_ADOPT_MIN_NCC,
    minGain: 0.001,
  };

  const diagnosticCoarseTop: CoarseSearchResult = {
    coarseBest: { scale: 1.045, ncc: 0.91 },
    coarseTopNcc: [
      { scale: 1.045, ncc: 0.91 },
      { scale: 1.04, ncc: 0.905 },
      { scale: 1.05, ncc: 0.9 },
      { scale: 1.035, ncc: 0.895 },
      { scale: 1.055, ncc: 0.89 },
    ],
    peakSharpness: -0.01,
    coarseMs: 42,
    coarseLongSide: 80,
  };

  it('診断例（平坦・上位1.04台）でも粗最良を採用し固定値に落ちない', () => {
    clearScaleEstimateHistoryForTests();
    const coarse = grayPair(80, 60);
    const fine = grayPair(160, 120);
    const est = finalizeScaleEstimate(
      diagnosticCoarseTop,
      coarse,
      fine,
      { x: -1, y: -1 },
      opts,
      performance.now(),
    );
    expect(est.fellBack).toBe(false);
    expect(est.appliedScale).toBe(1.045);
    expect(est.scaleSource).toBe('coarse');
    expect(est.scaleSource).not.toBe('fixed');
    expect(est.coarseTopNcc.map((p) => p.scale)).toEqual([1.045, 1.04, 1.05, 1.035, 1.055]);
  });

  it('粗最良が採用範囲外（1.12）のときフォールバック', () => {
    clearScaleEstimateHistoryForTests();
    const coarse = grayPair(80, 60);
    const outOfRange: CoarseSearchResult = {
      ...diagnosticCoarseTop,
      coarseBest: { scale: 1.12, ncc: 0.92 },
    };
    const est = finalizeScaleEstimate(
      outOfRange,
      coarse,
      null,
      { x: -1, y: -1 },
      opts,
      performance.now(),
    );
    expect(est.fellBack).toBe(true);
    expect(est.appliedScale).toBe(1.02);
    expect(est.scaleSource).toBe('fixed');
    expect(est.fineSkipped).toBe(true);
  });

  it('精密探索は ±0.01 を step 0.002 の11点', () => {
    const scales = fineSearchScalesAround(1.045);
    expect(scales).toHaveLength(11);
    expect(scales[0]).toBeCloseTo(1.045 - SCALE_FINE_RADIUS, 3);
    expect(scales[scales.length - 1]).toBeCloseTo(1.045 + SCALE_FINE_RADIUS, 3);
    for (let i = 1; i < scales.length; i += 1) {
      expect(scales[i] - scales[i - 1]).toBeCloseTo(SCALE_FINE_STEP, 3);
    }
  });
});