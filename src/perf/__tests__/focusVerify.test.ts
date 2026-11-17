import { verifyFocusFromGray } from '@/perf/focusVerify';

const w = 64;
const h = 64;

function makeGray(sharpCenter: { x: number; y: number }): Float32Array {
  const g = new Float32Array(w * h);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const dx = x - sharpCenter.x;
      const dy = y - sharpCenter.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      g[y * w + x] = d < 6 ? 1.0 : 0.0;
    }
  }
  return g;
}

describe('focusVerify', () => {
  it('OK when each image sharp at its point', () => {
    const near = makeGray({ x: 16, y: 32 });
    const far = makeGray({ x: 48, y: 32 });
    const r = verifyFocusFromGray(near, far, w, h, { x: 0.25, y: 0.5 }, { x: 0.75, y: 0.5 });
    expect(r).toBe('OK');
  });
});