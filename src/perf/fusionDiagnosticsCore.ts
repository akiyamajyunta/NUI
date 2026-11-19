import { DISPLAY_BUFFER, displayNormalizedToBufferPixel, type PixelBufferSpace } from '@/imaging/displayPoint';
import type { NormalizedPoint } from '@/types';

/** 被写体／背景点周辺の分析領域（画像幅に対する割合）。ピント検証と同一 */
export const SHARPNESS_REGION_FRAC = 0.15;

export function laplacianVarianceInRect(
  gray: Float32Array,
  w: number,
  h: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): number {
  if (x1 <= x0 + 1 || y1 <= y0 + 1) return 0;
  const laps: number[] = [];
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const i = y * w + x;
      const lap =
        4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - w] - gray[i + w];
      laps.push(lap);
    }
  }
  if (laps.length === 0) return 0;
  const mean = laps.reduce((a, b) => a + b, 0) / laps.length;
  let v = 0;
  for (const lap of laps) v += (lap - mean) ** 2;
  return v / laps.length;
}

export function laplacianVarianceAtPoint(
  gray: Float32Array,
  w: number,
  h: number,
  point: NormalizedPoint,
  regionFrac = SHARPNESS_REGION_FRAC,
  space: PixelBufferSpace = DISPLAY_BUFFER,
): number {
  const rw = Math.max(4, Math.floor(w * regionFrac));
  const rh = Math.max(4, Math.floor(h * regionFrac));
  const mapped = displayNormalizedToBufferPixel(point, w, h, space);
  const cx = Math.floor(mapped.x);
  const cy = Math.floor(mapped.y);
  const x0 = Math.max(1, cx - Math.floor(rw / 2));
  const y0 = Math.max(1, cy - Math.floor(rh / 2));
  const x1 = Math.min(w - 2, x0 + rw);
  const y1 = Math.min(h - 2, y0 + rh);
  return laplacianVarianceInRect(gray, w, h, x0, y0, x1, y1);
}

export type PointWindow = { x0: number; y0: number; x1: number; y1: number };

/** 鮮鋭度比較と同じ幅（画像幅の 15%）の矩形 */
export function pointWindow(
  w: number,
  h: number,
  point: NormalizedPoint,
  space: PixelBufferSpace = DISPLAY_BUFFER,
  regionFrac = SHARPNESS_REGION_FRAC,
): PointWindow {
  const rw = Math.max(4, Math.floor(w * regionFrac));
  const rh = Math.max(4, Math.floor(h * regionFrac));
  const mapped = displayNormalizedToBufferPixel(point, w, h, space);
  const cx = Math.floor(mapped.x);
  const cy = Math.floor(mapped.y);
  const x0 = Math.max(0, cx - Math.floor(rw / 2));
  const y0 = Math.max(0, cy - Math.floor(rh / 2));
  const x1 = Math.min(w, x0 + rw);
  const y1 = Math.min(h, y0 + rh);
  return { x0, y0, x1, y1 };
}

function midCountIn(
  rgba: ArrayLike<number>,
  w: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): { mid: number; count: number } {
  let mid = 0;
  let count = 0;
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const m = rgba[(y * w + x) * 4] / 255;
      if (m >= 0.1 && m <= 0.9) mid += 1;
      count += 1;
    }
  }
  return { mid, count };
}

/** 混合（0.1〜0.9）の割合。全体と、表示向きバッファ上の点周辺 */
export function maskMidFractions(
  rgba: ArrayLike<number>,
  w: number,
  h: number,
  subject?: NormalizedPoint,
  background?: NormalizedPoint,
  space: PixelBufferSpace = DISPLAY_BUFFER,
): { overall: number; subject: number | null; background: number | null } {
  const all = midCountIn(rgba, w, 0, 0, w, h);
  const at = (point?: NormalizedPoint): number | null => {
    if (!point) return null;
    const win = pointWindow(w, h, point, space);
    const part = midCountIn(rgba, w, win.x0, win.y0, win.x1, win.y1);
    return part.count > 0 ? part.mid / part.count : 0;
  };
  return {
    overall: all.count > 0 ? all.mid / all.count : 0,
    subject: at(subject),
    background: at(background),
  };
}