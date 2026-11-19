import { orientationToDegrees } from '@/imaging/orientation';
import type { NormalizedPoint } from '@/types';

/**
 * 画素バッファの向き。
 * - display: 本番の画素。Skia が EXIF を適用済みなので点はそのまま。
 * - sensor: 回転前のセンサー画素。本番経路では使わない。
 */
export type PixelBufferSpace =
  | { kind: 'display' }
  | { kind: 'sensor'; orientation: unknown };

export const DISPLAY_BUFFER: PixelBufferSpace = { kind: 'display' };

export function sensorBuffer(orientation: unknown): PixelBufferSpace {
  return { kind: 'sensor', orientation };
}

/**
 * 表示向きの正規化座標を、指定したバッファの連続画素座標へ変換する。
 * display のときは回転しない。sensor のときだけ EXIF 回転を適用する。
 */
export function displayNormalizedToBufferPixel(
  point: NormalizedPoint,
  bufferWidth: number,
  bufferHeight: number,
  space: PixelBufferSpace = DISPLAY_BUFFER,
): { x: number; y: number } {
  if (space.kind === 'display') {
    return { x: point.x * bufferWidth, y: point.y * bufferHeight };
  }
  const deg = ((orientationToDegrees(space.orientation) % 360) + 360) % 360;
  const w = bufferWidth;
  const h = bufferHeight;
  const nx = point.x;
  const ny = point.y;
  let x: number;
  let y: number;
  switch (deg) {
    case 90:
      x = ny * w;
      y = h * (1 - nx);
      break;
    case 180:
      x = w * (1 - nx);
      y = h * (1 - ny);
      break;
    case 270:
      x = w * (1 - ny);
      y = h * nx;
      break;
    default:
      x = nx * w;
      y = ny * h;
      break;
  }
  return { x, y };
}

/** バッファ幅・高さに対する 0〜1。分析画像上の除外円などに使う */
export function displayNormalizedToBufferNormalized(
  point: NormalizedPoint,
  bufferWidth: number,
  bufferHeight: number,
  space: PixelBufferSpace = DISPLAY_BUFFER,
): NormalizedPoint {
  const p = displayNormalizedToBufferPixel(point, bufferWidth, bufferHeight, space);
  return {
    x: bufferWidth > 0 ? p.x / bufferWidth : 0,
    y: bufferHeight > 0 ? p.y / bufferHeight : 0,
  };
}

/** 4×4 グリッド（行=上→下、列=左→右、0 始まり） */
export function bufferPixelToGrid4(
  x: number,
  y: number,
  bufferWidth: number,
  bufferHeight: number,
): { row: number; col: number } {
  const col = Math.min(3, Math.max(0, Math.floor((x / bufferWidth) * 4)));
  const row = Math.min(3, Math.max(0, Math.floor((y / bufferHeight) * 4)));
  return { row, col };
}