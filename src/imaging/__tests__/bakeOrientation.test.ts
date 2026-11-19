import { orientedOutputSize, sourcePixelToDest } from '@/imaging/bakeOrientation';
import { laplacianVarianceInRect } from '@/perf/fusionDiagnosticsCore';

const SRC_W = 1920;
const SRC_H = 1440;

describe('orientedOutputSize', () => {
  it('right / left は縦（1440×1920）、down / up は横のまま', () => {
    expect(orientedOutputSize(SRC_W, SRC_H, 'right')).toEqual({ width: 1440, height: 1920 });
    expect(orientedOutputSize(SRC_W, SRC_H, 'left')).toEqual({ width: 1440, height: 1920 });
    expect(orientedOutputSize(SRC_W, SRC_H, 'down')).toEqual({ width: 1920, height: 1440 });
    expect(orientedOutputSize(SRC_W, SRC_H, 'up')).toEqual({ width: 1920, height: 1440 });
  });
});

describe('sourcePixelToDest', () => {
  const w = 8;
  const h = 6;
  const sx = 2;
  const sy = 1;

  it('up は動かない', () => {
    expect(sourcePixelToDest(sx, sy, w, h, 'up')).toEqual({ x: 2, y: 1 });
  });

  it('right は 270° 時計回り', () => {
    expect(sourcePixelToDest(sx, sy, w, h, 'right')).toEqual({ x: 1, y: 5 });
  });

  it('left は 90° 時計回り', () => {
    expect(sourcePixelToDest(sx, sy, w, h, 'left')).toEqual({ x: 4, y: 2 });
  });

  it('down は 180°', () => {
    expect(sourcePixelToDest(sx, sy, w, h, 'down')).toEqual({ x: 5, y: 4 });
  });
});

describe('90度回転はラプラシアン分散を変えない', () => {
  it('チェッカーを整数回転しても同じ領域の分散は一致する', () => {
    const w = 32;
    const h = 24;
    const src = new Float32Array(w * h);
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) src[y * w + x] = (x + y) % 2 === 0 ? 0.2 : 0.8;
    }
    const size = orientedOutputSize(w, h, 'right');
    const dst = new Float32Array(size.width * size.height);
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const p = sourcePixelToDest(x, y, w, h, 'right');
        dst[p.y * size.width + p.x] = src[y * w + x];
      }
    }
    const before = laplacianVarianceInRect(src, w, h, 4, 4, 20, 16);
    const corner = sourcePixelToDest(4, 4, w, h, 'right');
    const opposite = sourcePixelToDest(19, 15, w, h, 'right');
    const x0 = Math.min(corner.x, opposite.x);
    const y0 = Math.min(corner.y, opposite.y);
    const x1 = Math.max(corner.x, opposite.x) + 1;
    const y1 = Math.max(corner.y, opposite.y) + 1;
    const after = laplacianVarianceInRect(dst, size.width, size.height, x0, y0, x1, y1);
    expect(after).toBeCloseTo(before, 6);
  });
});