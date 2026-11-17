import {
  focusSharpnessTableFromGray,
  verifyFocusFromGray,
  verifyFocusFromSharpnessTable,
} from '@/perf/focusVerify';

const w = 64;
const h = 64;

function makeGray(sharpCenter: { x: number; y: number }): Float32Array {
  const g = new Float32Array(w * h);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const dx = x - sharpCenter.x;
      const dy = y - sharpCenter.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      g[y * w + x] = d < 6 ? (x + y) % 2 === 0 ? 1.0 : 0.0 : 0.05;
    }
  }
  return g;
}

describe('verifyFocusFromSharpnessTable', () => {
  it('診断レポート値の回帰（被写体・背景ともに OK）', () => {
    const table = {
      atSubjectPoint: { near: 0.0344, far: 0.0075 },
      atBackgroundPoint: { near: 0.00085, far: 0.0235 },
    };
    expect(verifyFocusFromSharpnessTable(table)).toBe('OK');
  });
});

describe('verifyFocusFromGray', () => {
  it('各点でシャープな側が優勢なら OK', () => {
    const near = makeGray({ x: 16, y: 32 });
    const far = makeGray({ x: 48, y: 32 });
    const r = verifyFocusFromGray(near, far, w, h, { x: 0.25, y: 0.5 }, { x: 0.75, y: 0.5 });
    expect(r).toBe('OK');
  });

  it('診断と同じ laplacianVarianceAtPoint 経路を使う', () => {
    const near = makeGray({ x: 16, y: 32 });
    const far = makeGray({ x: 48, y: 32 });
    const nearPt = { x: 0.25, y: 0.5 };
    const farPt = { x: 0.75, y: 0.5 };
    const table = focusSharpnessTableFromGray(near, far, w, h, nearPt, farPt);
    expect(verifyFocusFromSharpnessTable(table)).toBe(
      verifyFocusFromGray(near, far, w, h, nearPt, farPt),
    );
  });
});