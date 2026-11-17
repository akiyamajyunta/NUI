import type { NormalizedPoint } from '@/types';

export function normalizedToView(
  point: NormalizedPoint,
  viewWidth: number,
  viewHeight: number,
): { x: number; y: number } {
  return { x: point.x * viewWidth, y: point.y * viewHeight };
}

export function viewToNormalized(
  x: number,
  y: number,
  viewWidth: number,
  viewHeight: number,
): NormalizedPoint {
  return {
    x: Math.min(1, Math.max(0, x / viewWidth)),
    y: Math.min(1, Math.max(0, y / viewHeight)),
  };
}