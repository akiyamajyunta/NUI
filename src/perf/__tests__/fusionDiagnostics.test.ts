import { laplacianVarianceAtPoint } from '@/perf/fusionDiagnosticsCore';

describe('laplacianVarianceAtPoint', () => {
  it('均一領域は分散が小さい', () => {
    const w = 64;
    const h = 64;
    const gray = new Float32Array(w * h).fill(0.5);
    const v = laplacianVarianceAtPoint(gray, w, h, { x: 0.5, y: 0.5 });
    expect(v).toBe(0);
  });

  it('チェッカーパターンは分散が大きい', () => {
    const w = 64;
    const h = 64;
    const gray = new Float32Array(w * h);
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        gray[y * w + x] = (x + y) % 2 === 0 ? 0.2 : 0.8;
      }
    }
    const v = laplacianVarianceAtPoint(gray, w, h, { x: 0.5, y: 0.5 });
    expect(v).toBeGreaterThan(0.01);
  });
});