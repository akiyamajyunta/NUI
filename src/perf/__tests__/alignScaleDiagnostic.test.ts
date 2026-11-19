import {
  estimateAppliedScale,
  maskedNccGray,
  refineScaleByParabola,
  SCALE_MAX,
  SCALE_MIN,
  SCALE_STEP,
} from '@/perf/alignScaleDiagnosticCore';

describe('alignScaleDiagnostic grid', () => {
  it('粗探索は0.95〜1.10を0.005刻みで31点', () => {
    const min = SCALE_MIN;
    const max = SCALE_MAX;
    const step = SCALE_STEP;
    const n = Math.round((max - min) / step) + 1;
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
    expect(Math.round(refined * 1000)).toBe(Math.round(refined * 1000));
  });

  it('同一画像は改善が小さいので scale=1 に戻し、NCC は下がらない', () => {
    const w = 40;
    const h = 30;
    const gray = new Float32Array(w * h);
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) gray[y * w + x] = x / w;
    }
    const est = estimateAppliedScale(gray, gray, w, h, { x: -1, y: -1 }, 'estimate');
    expect(est.appliedScale).toBe(1);
    expect(est.nccAfter).toBeCloseTo(est.nccBefore, 5);
    expect(est.nccAtEstimate).toBeGreaterThan(0);
    expect(est.fellBack).toBe(true);
  });

  it('しきい値未満でも推定 scale の NCC を残す', () => {
    const w = 24;
    const h = 16;
    const near = new Float32Array(w * h);
    const far = new Float32Array(w * h);
    for (let i = 0; i < near.length; i += 1) {
      near[i] = (i % 5) / 5;
      far[i] = near[i];
    }
    far[10] += 0.01;
    const est = estimateAppliedScale(near, far, w, h, { x: -1, y: -1 }, 'estimate', 1, 1);
    expect(est.fellBack).toBe(true);
    expect(est.appliedScale).toBe(1);
    expect(est.nccAtEstimate).not.toBe(0);
    expect(est.estimatedScale).toBeGreaterThan(0);
  });

  it('拡大した FAR は補正後 NCC が補正前より高い', () => {
    const w = 36;
    const h = 28;
    const near = new Float32Array(w * h);
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        near[y * w + x] = 0.5 + 0.5 * Math.sin(x * 0.45) * Math.cos(y * 0.55);
      }
    }
    const far = new Float32Array(w * h);
    const cx = (w - 1) / 2;
    const cy = (h - 1) / 2;
    const zoom = 1.06;
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const sx = Math.round((x - cx) / zoom + cx);
        const sy = Math.round((y - cy) / zoom + cy);
        far[y * w + x] =
          sx >= 0 && sy >= 0 && sx < w && sy < h ? near[sy * w + sx] : near[y * w + x];
      }
    }
    const est = estimateAppliedScale(near, far, w, h, { x: -1, y: -1 }, 'estimate');
    expect(est.nccAfter).toBeGreaterThan(est.nccBefore);
    expect(est.fellBack).toBe(false);
  });
});