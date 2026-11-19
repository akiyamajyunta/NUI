import {
  bufferPixelToGrid4,
  displayNormalizedToBufferPixel,
  sensorBuffer,
} from '@/imaging/displayPoint';

describe('displayNormalizedToBufferPixel', () => {
  const w = 512;
  const h = 384;

  it('up はそのまま', () => {
    const p = displayNormalizedToBufferPixel({ x: 0.25, y: 0.5 }, w, h, sensorBuffer('up'));
    expect(p.x).toBeCloseTo(128);
    expect(p.y).toBeCloseTo(192);
  });

  it('right（270°）は縦表示の点をセンサー画素へ写す', () => {
    const p = displayNormalizedToBufferPixel({ x: 0.125, y: 0.375 }, w, h, sensorBuffer('right'));
    expect(bufferPixelToGrid4(p.x, p.y, w, h)).toEqual({ row: 0, col: 2 });
  });

  it('left（90°）と 180° も逆変換できる', () => {
    const left = displayNormalizedToBufferPixel({ x: 0.5, y: 0.25 }, w, h, sensorBuffer('left'));
    expect(left.x).toBeCloseTo(0.25 * w);
    expect(left.y).toBeCloseTo(0.5 * h);
    const down = displayNormalizedToBufferPixel({ x: 0.2, y: 0.3 }, w, h, sensorBuffer('down'));
    expect(down.x).toBeCloseTo(0.8 * w);
    expect(down.y).toBeCloseTo(0.7 * h);
  });
});