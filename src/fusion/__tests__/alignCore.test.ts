import { searchTranslation, shiftArray } from '@/fusion/alignCore';

function noiseField(w: number, h: number): Float32Array {
  const a = new Float32Array(w * h);
  for (let i = 0; i < a.length; i += 1) {
    a[i] = ((i * 17 + 11) % 100) / 100;
  }
  return a;
}

describe('alignCore', () => {
  const w = 64;
  const h = 64;

  it('ゼロずれで 0 を返す', () => {
    const ref = noiseField(w, h);
    const est = searchTranslation(ref, ref, w, h);
    expect(Math.abs(est.dx)).toBeLessThanOrEqual(1);
    expect(Math.abs(est.dy)).toBeLessThanOrEqual(1);
  });

  it('既知ずれを復元', () => {
    const ref = noiseField(w, h);
    const tgt = shiftArray(ref, w, h, 4, -3);
    const est = searchTranslation(ref, tgt, w, h);
    expect(Math.abs(est.dx - 4)).toBeLessThanOrEqual(1);
    expect(Math.abs(est.dy + 3)).toBeLessThanOrEqual(1);
  });

  it('一様画像は warned', () => {
    const uniform = new Float32Array(w * h).fill(0.5);
    const est = searchTranslation(uniform, uniform, w, h);
    expect(est.warned).toBe(true);
  });
});