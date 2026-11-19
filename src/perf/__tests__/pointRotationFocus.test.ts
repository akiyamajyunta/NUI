import {
  bufferPixelToGrid4,
  displayNormalizedToBufferPixel,
  sensorBuffer,
} from '@/imaging/displayPoint';
import { laplacianVarianceGrid4x4 } from '@/perf/sharpnessGrid';
import { verifyFocusFromGray } from '@/perf/focusVerify';

/** 診断レポートのセル値（行1列3 / 行3列3、1始まり） */
const NEAR_R1C3 = 0.0311;
const NEAR_R3C3 = 0.00921;
const FAR_R1C3 = 0.00145;
const FAR_R3C3 = 0.0796;

const W = 512;
const H = 384;
/** 縦持ち・Vision Camera right。表示上の点 */
const SUBJECT = { x: 0.125, y: 0.375 };
const BACKGROUND = { x: 0.625, y: 0.375 };
const ORIENT = 'right';

function fillCell(
  gray: Float32Array,
  row: number,
  col: number,
  amplitude: number,
): void {
  const y0 = Math.floor((row * H) / 4);
  const y1 = Math.floor(((row + 1) * H) / 4);
  const x0 = Math.floor((col * W) / 4);
  const x1 = Math.floor(((col + 1) * W) / 4);
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      gray[y * W + x] = (x + y) % 2 === 0 ? amplitude : 0;
    }
  }
}

function ampForVariance(v: number): number {
  return Math.sqrt(v / 16);
}

describe('点座標の回転回帰', () => {
  const near = new Float32Array(W * H);
  const far = new Float32Array(W * H);
  fillCell(near, 0, 2, ampForVariance(NEAR_R1C3));
  fillCell(near, 2, 2, ampForVariance(NEAR_R3C3));
  fillCell(far, 0, 2, ampForVariance(FAR_R1C3));
  fillCell(far, 2, 2, ampForVariance(FAR_R3C3));

  it('被写体は行1列3、背景は行3列3', () => {
    const s = displayNormalizedToBufferPixel(SUBJECT, W, H, sensorBuffer(ORIENT));
    const b = displayNormalizedToBufferPixel(BACKGROUND, W, H, sensorBuffer(ORIENT));
    expect(bufferPixelToGrid4(s.x, s.y, W, H)).toEqual({ row: 0, col: 2 });
    expect(bufferPixelToGrid4(b.x, b.y, W, H)).toEqual({ row: 2, col: 2 });
  });

  it('そのセルの診断値でピント検証が OK', () => {
    const nearGrid = laplacianVarianceGrid4x4(near, W, H);
    const farGrid = laplacianVarianceGrid4x4(far, W, H);
    expect(nearGrid[0][2]).toBeCloseTo(NEAR_R1C3, 2);
    expect(nearGrid[2][2]).toBeCloseTo(NEAR_R3C3, 3);
    expect(farGrid[0][2]).toBeCloseTo(FAR_R1C3, 3);
    expect(farGrid[2][2]).toBeCloseTo(FAR_R3C3, 2);
    expect(
      verifyFocusFromGray(near, far, W, H, SUBJECT, BACKGROUND, undefined, sensorBuffer(ORIENT)),
    ).toBe('OK');
  });
});

describe('表示向き 384×512 では点を回転しない', () => {
  const w = 384;
  const h = 512;
  const subject = { x: 0.2988, y: 0.387 };
  const background = { x: 0.6506, y: 0.4132 };
  const nearRow = [0.02487, 0.04283, 0.00726, 0.00414];
  const farRow = [0.01458, 0.00426, 0.05621, 0.02304];

  function fillRow(gray: Float32Array, values: number[]): void {
    const y0 = Math.floor(h / 4);
    const y1 = Math.floor(h / 2);
    for (let col = 0; col < 4; col += 1) {
      const x0 = Math.floor((col * w) / 4);
      const x1 = Math.floor(((col + 1) * w) / 4);
      const amp = Math.sqrt(values[col] / 16);
      for (let y = y0; y < y1; y += 1) {
        for (let x = x0; x < x1; x += 1) {
          gray[y * w + x] = (x + y) % 2 === 0 ? amp : 0;
        }
      }
    }
  }

  const near = new Float32Array(w * h);
  const far = new Float32Array(w * h);
  fillRow(near, nearRow);
  fillRow(far, farRow);

  it('被写体は2行2列、背景は2行3列', () => {
    const s = displayNormalizedToBufferPixel(subject, w, h);
    const b = displayNormalizedToBufferPixel(background, w, h);
    expect(bufferPixelToGrid4(s.x, s.y, w, h)).toEqual({ row: 1, col: 1 });
    expect(bufferPixelToGrid4(b.x, b.y, w, h)).toEqual({ row: 1, col: 2 });
  });

  it('2行の診断値でピント検証が OK', () => {
    const nearGrid = laplacianVarianceGrid4x4(near, w, h);
    const farGrid = laplacianVarianceGrid4x4(far, w, h);
    nearRow.forEach((v, i) => expect(nearGrid[1][i]).toBeCloseTo(v, 3));
    farRow.forEach((v, i) => expect(farGrid[1][i]).toBeCloseTo(v, 3));
    expect(verifyFocusFromGray(near, far, w, h, subject, background)).toBe('OK');
  });
});