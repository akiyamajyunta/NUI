import { orientationToDegrees } from '@/imaging/orientation';

function normalizedDegrees(orientation: unknown): number {
  return ((orientationToDegrees(orientation) % 360) + 360) % 360;
}

/** センサー画素を表示向きへ直したあとの寸法（90度単位、補間なし） */
export function orientedOutputSize(
  width: number,
  height: number,
  orientation: unknown,
): { width: number; height: number } {
  const deg = normalizedDegrees(orientation);
  if (deg === 90 || deg === 270) return { width: height, height: width };
  return { width, height };
}

/**
 * 回転前の画素 (sx, sy) が、表示向きへ焼いた画像のどこへ移るか。
 * orientationToDegrees と同じ時計回り。
 */
export function sourcePixelToDest(
  sx: number,
  sy: number,
  srcWidth: number,
  srcHeight: number,
  orientation: unknown,
): { x: number; y: number } {
  const deg = normalizedDegrees(orientation);
  switch (deg) {
    case 90:
      return { x: srcHeight - 1 - sy, y: sx };
    case 180:
      return { x: srcWidth - 1 - sx, y: srcHeight - 1 - sy };
    case 270:
      return { x: sy, y: srcWidth - 1 - sx };
    default:
      return { x: sx, y: sy };
  }
}