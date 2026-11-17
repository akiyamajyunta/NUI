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
): number {
  const rw = Math.max(4, Math.floor(w * regionFrac));
  const rh = Math.max(4, Math.floor(h * regionFrac));
  const cx = Math.floor(point.x * w);
  const cy = Math.floor(point.y * h);
  const x0 = Math.max(1, cx - Math.floor(rw / 2));
  const y0 = Math.max(1, cy - Math.floor(rh / 2));
  const x1 = Math.min(w - 2, x0 + rw);
  const y1 = Math.min(h - 2, y0 + rh);
  return laplacianVarianceInRect(gray, w, h, x0, y0, x1, y1);
}