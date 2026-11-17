import { laplacianVarianceAtPoint, laplacianVarianceInRect } from '@/perf/fusionDiagnosticsCore';
import type { NormalizedPoint } from '@/types';

export type AnalysisPointCoords = {
  normalized: NormalizedPoint;
  pixelCenter: { x: number; y: number };
  analysisSize: { width: number; height: number };
};

export function analysisPointCoords(
  point: NormalizedPoint,
  analysisWidth: number,
  analysisHeight: number,
): AnalysisPointCoords {
  return {
    normalized: { x: point.x, y: point.y },
    pixelCenter: {
      x: Math.floor(point.x * analysisWidth),
      y: Math.floor(point.y * analysisHeight),
    },
    analysisSize: { width: analysisWidth, height: analysisHeight },
  };
}

/** 画像を 4×4 に分割し、各セルのラプラシアン分散（境界は隣接セルと共有しないよう内部のみ） */
export function laplacianVarianceGrid4x4(
  gray: Float32Array,
  width: number,
  height: number,
): number[][] {
  const rows: number[][] = [];
  for (let row = 0; row < 4; row += 1) {
    const y0 = Math.max(1, Math.floor((row * height) / 4));
    const y1 = Math.min(height - 1, Math.floor(((row + 1) * height) / 4));
    const cells: number[] = [];
    for (let col = 0; col < 4; col += 1) {
      const x0 = Math.max(1, Math.floor((col * width) / 4));
      const x1 = Math.min(width - 1, Math.floor(((col + 1) * width) / 4));
      cells.push(laplacianVarianceInRect(gray, width, height, x0, y0, x1, y1));
    }
    rows.push(cells);
  }
  return rows;
}

/** 点周辺（診断と同一領域）の分散。グリッド算出用の補助 */
export function varianceAtPoint(
  gray: Float32Array,
  w: number,
  h: number,
  point: NormalizedPoint,
): number {
  return laplacianVarianceAtPoint(gray, w, h, point);
}