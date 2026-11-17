import { FOCUS_VERIFY_K } from '@/config/constants';
import { laplacianVarianceAtPoint, SHARPNESS_REGION_FRAC } from '@/perf/fusionDiagnosticsCore';
import type { NormalizedPoint } from '@/types';

export type FocusVerifyResult = 'OK' | 'PARTIAL' | 'NG';

/** 診断の画質比較表と同じ指標（ラプラシアン分散） */
export type FocusSharpnessTable = {
  atSubjectPoint: { near: number; far: number };
  atBackgroundPoint: { near: number; far: number };
};

export function focusSharpnessTableFromGray(
  nearGray: Float32Array,
  farGray: Float32Array,
  w: number,
  h: number,
  nearPoint: NormalizedPoint,
  farPoint: NormalizedPoint,
  regionFrac = SHARPNESS_REGION_FRAC,
): FocusSharpnessTable {
  return {
    atSubjectPoint: {
      near: laplacianVarianceAtPoint(nearGray, w, h, nearPoint, regionFrac),
      far: laplacianVarianceAtPoint(farGray, w, h, nearPoint, regionFrac),
    },
    atBackgroundPoint: {
      near: laplacianVarianceAtPoint(nearGray, w, h, farPoint, regionFrac),
      far: laplacianVarianceAtPoint(farGray, w, h, farPoint, regionFrac),
    },
  };
}

/** 画質表から mode/08 と同じ条件で判定する（回帰テスト向けに公開） */
export function verifyFocusFromSharpnessTable(
  table: FocusSharpnessTable,
  k = FOCUS_VERIFY_K,
): FocusVerifyResult {
  const subjectOk = table.atSubjectPoint.near > table.atSubjectPoint.far * k;
  const bgOk = table.atBackgroundPoint.far > table.atBackgroundPoint.near * k;
  if (subjectOk && bgOk) return 'OK';
  if (subjectOk || bgOk) return 'PARTIAL';
  return 'NG';
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
  const table = focusSharpnessTableFromGray(nearGray, farGray, w, h, nearPoint, farPoint);
  return verifyFocusFromSharpnessTable(table, k);
}