import type { NormalizedPoint } from '@/types';
import { FOCUS_VERIFY_K } from '@/config/constants';

export type FocusVerifyResult = 'OK' | 'PARTIAL' | 'NG';

function regionSharpness(
  gray: Float32Array,
  w: number,
  h: number,
  point: NormalizedPoint,
  regionFrac = 0.15,
): number {
  const rw = Math.max(4, Math.floor(w * regionFrac));
  const rh = Math.max(4, Math.floor(h * regionFrac));
  const cx = Math.floor(point.x * w);
  const cy = Math.floor(point.y * h);
  const x0 = Math.max(1, cx - Math.floor(rw / 2));
  const y0 = Math.max(1, cy - Math.floor(rh / 2));
  const x1 = Math.min(w - 2, x0 + rw);
  const y1 = Math.min(h - 2, y0 + rh);
  let sum = 0;
  let count = 0;
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const i = y * w + x;
      const c = gray[i];
      const l = gray[i - 1];
      const r = gray[i + 1];
      const t = gray[i - w];
      const b = gray[i + w];
      const lap = Math.abs(4 * c - l - r - t - b);
      sum += lap;
      count += 1;
    }
  }
  return count > 0 ? sum / count : 0;
}

export function verifyFocusFromGray(
  nearGray: Float32Array,
  farGray: Float32Array,
  w: number,
  h: number,
  nearPoint: NormalizedPoint,
  farPoint: NormalizedPoint,
  k = FOCUS_VERIFY_K,
): FocusVerifyResult {
  const sn = regionSharpness(nearGray, w, h, nearPoint);
  const sf = regionSharpness(farGray, w, h, farPoint);
  const snAtNear = regionSharpness(nearGray, w, h, nearPoint);
  const sfAtNear = regionSharpness(farGray, w, h, nearPoint);
  const snAtFar = regionSharpness(nearGray, w, h, farPoint);
  const sfAtFar = regionSharpness(farGray, w, h, farPoint);

  const subjectOk = snAtNear > sfAtNear * k;
  const bgOk = sfAtFar > snAtFar * k;

  if (subjectOk && bgOk) return 'OK';
  if (subjectOk || bgOk) return 'PARTIAL';
  void sn;
  void sf;
  return 'NG';
}