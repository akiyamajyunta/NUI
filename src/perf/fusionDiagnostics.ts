import { AlphaType, ColorType, type SkImage } from '@shopify/react-native-skia';
import { FOCUS_VERIFY_LONG_SIDE } from '@/config/constants';
import { laplacianVarianceAtPoint } from '@/perf/fusionDiagnosticsCore';
import {
  analysisPointCoords,
  laplacianVarianceGrid4x4,
  type AnalysisPointCoords,
} from '@/perf/sharpnessGrid';
import { fitLongSide } from '@/imaging/downscale';
import { readGrayFromSkImage } from '@/imaging/imagePixels';
import { loadImage } from '@/imaging/loadImage';
import type { NormalizedPoint } from '@/types';

export { laplacianVarianceAtPoint } from '@/perf/fusionDiagnosticsCore';

export type SharpnessTriple = { near: number; far: number; fused: number };

export type FusionQualityTable = {
  atSubjectPoint: SharpnessTriple;
  atBackgroundPoint: SharpnessTriple;
};

export type Grid4x4LaplacianTable = number[][];

export type SharpnessGridReport = {
  analysisSize: { width: number; height: number };
  near: Grid4x4LaplacianTable;
  far: Grid4x4LaplacianTable;
};

export type DiagnosticPointLayout = {
  subject: AnalysisPointCoords;
  background: AnalysisPointCoords;
  grids: SharpnessGridReport;
};

export async function computeQualityTable(
  nearUri: string,
  farUri: string,
  fusedUri: string,
  nearPoint: NormalizedPoint,
  farPoint: NormalizedPoint,
  orientations?: { near?: unknown; far?: unknown },
): Promise<FusionQualityTable> {
  const [nearL, farL, fusedL] = await Promise.all([
    loadImage(nearUri, orientations?.near),
    loadImage(farUri, orientations?.far),
    loadImage(fusedUri, orientations?.near),
  ]);
  const { width: w, height: h } = fitLongSide(nearL.width, nearL.height, FOCUS_VERIFY_LONG_SIDE);
  const gn = readGrayFromSkImage(nearL.image, FOCUS_VERIFY_LONG_SIDE);
  const gf = readGrayFromSkImage(farL.image, FOCUS_VERIFY_LONG_SIDE);
  const gout = readGrayFromSkImage(fusedL.image, FOCUS_VERIFY_LONG_SIDE);
  const atPoint = (point: NormalizedPoint): SharpnessTriple => ({
    near: laplacianVarianceAtPoint(gn, w, h, point),
    far: laplacianVarianceAtPoint(gf, w, h, point),
    fused: laplacianVarianceAtPoint(gout, w, h, point),
  });
  return {
    atSubjectPoint: atPoint(nearPoint),
    atBackgroundPoint: atPoint(farPoint),
  };
}

export async function computeDiagnosticPointLayout(
  nearUri: string,
  farUri: string,
  nearPoint: NormalizedPoint,
  farPoint: NormalizedPoint,
  orientations?: { near?: unknown; far?: unknown },
): Promise<DiagnosticPointLayout> {
  const [nearL, farL] = await Promise.all([
    loadImage(nearUri, orientations?.near),
    loadImage(farUri, orientations?.far),
  ]);
  const { width: w, height: h } = fitLongSide(nearL.width, nearL.height, FOCUS_VERIFY_LONG_SIDE);
  const gn = readGrayFromSkImage(nearL.image, FOCUS_VERIFY_LONG_SIDE);
  const gf = readGrayFromSkImage(farL.image, FOCUS_VERIFY_LONG_SIDE);
  return {
    subject: analysisPointCoords(nearPoint, w, h),
    background: analysisPointCoords(farPoint, w, h),
    grids: {
      analysisSize: { width: w, height: h },
      near: laplacianVarianceGrid4x4(gn, w, h),
      far: laplacianVarianceGrid4x4(gf, w, h),
    },
  };
}

export type MaskBucketStats = {
  below01: number;
  mid: number;
  above09: number;
  sampleCount: number;
};

export function maskBucketStatsFromImage(mask: SkImage): MaskBucketStats {
  const w = mask.width();
  const h = mask.height();
  const rgba = mask.readPixels(0, 0, {
    width: w,
    height: h,
    colorType: ColorType.RGBA_8888,
    alphaType: AlphaType.Unpremul,
  });
  if (!rgba) {
    return { below01: 0, mid: 0, above09: 0, sampleCount: 0 };
  }
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  const n = w * h;
  for (let i = 0; i < n; i += 1) {
    const m = rgba[i * 4] / 255;
    if (m < 0.1) b0 += 1;
    else if (m <= 0.9) b1 += 1;
    else b2 += 1;
  }
  return {
    below01: b0 / n,
    mid: b1 / n,
    above09: b2 / n,
    sampleCount: n,
  };
}

export async function maskBucketStatsFromUri(maskUri: string): Promise<MaskBucketStats> {
  const loaded = await loadImage(maskUri);
  return maskBucketStatsFromImage(loaded.image);
}