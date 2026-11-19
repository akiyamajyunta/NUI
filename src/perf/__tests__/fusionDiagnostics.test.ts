import { laplacianVarianceAtPoint, maskMidFractions } from '@/perf/fusionDiagnosticsCore';

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

describe('maskMidFractions', () => {
  it('被写体周辺・背景・全体の混合率を分ける', () => {
    const w = 40;
    const h = 40;
    const rgba = new Uint8Array(w * h * 4);
    for (let i = 0; i < w * h; i += 1) {
      rgba[i * 4] = 255;
    }
    const sx = Math.floor(0.25 * w);
    const sy = Math.floor(0.25 * h);
    rgba[(sy * w + sx) * 4] = 128;
    const bx = Math.floor(0.75 * w);
    const by = Math.floor(0.75 * h);
    rgba[(by * w + bx) * 4] = 128;
    const mix = maskMidFractions(rgba, w, h, { x: 0.25, y: 0.25 }, { x: 0.75, y: 0.75 });
    expect(mix.overall).toBeGreaterThan(0);
    expect(mix.overall).toBeLessThan(0.2);
    expect(mix.subject).toBeGreaterThan(0);
    expect(mix.background).toBeGreaterThan(0);
  });
});