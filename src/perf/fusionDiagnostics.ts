import { AlphaType, ColorType, type SkImage } from '@shopify/react-native-skia';
import { FOCUS_VERIFY_LONG_SIDE } from '@/config/constants';
import { DISPLAY_BUFFER, type PixelBufferSpace } from '@/imaging/displayPoint';
import { laplacianVarianceAtPoint, maskMidFractions } from '@/perf/fusionDiagnosticsCore';
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

/** 合成JPEGも Skia 適用済みの表示向き。left/right では回さない */
export function fusedOutputBufferSpace(orientation?: unknown): PixelBufferSpace {
  void orientation;
  return DISPLAY_BUFFER;
}

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
    loadImage(nearUri),
    loadImage(farUri),
    loadImage(fusedUri),
  ]);
  const nearSize = fitLongSide(nearL.width, nearL.height, FOCUS_VERIFY_LONG_SIDE);
  const farSize = fitLongSide(farL.width, farL.height, FOCUS_VERIFY_LONG_SIDE);
  const fusedSize = fitLongSide(fusedL.width, fusedL.height, FOCUS_VERIFY_LONG_SIDE);
  const gn = readGrayFromSkImage(nearL.image, FOCUS_VERIFY_LONG_SIDE);
  const gf = readGrayFromSkImage(farL.image, FOCUS_VERIFY_LONG_SIDE);
  const gout = readGrayFromSkImage(fusedL.image, FOCUS_VERIFY_LONG_SIDE);
  const nearSpace = DISPLAY_BUFFER;
  const farSpace = DISPLAY_BUFFER;
  const fusedSpace = fusedOutputBufferSpace(orientations?.near ?? orientations?.far);
  const atPoint = (point: NormalizedPoint, nearFarSpace: PixelBufferSpace): SharpnessTriple => ({
    near: laplacianVarianceAtPoint(
      gn,
      nearSize.width,
      nearSize.height,
      point,
      undefined,
      nearFarSpace,
    ),
    far: laplacianVarianceAtPoint(gf, farSize.width, farSize.height, point, undefined, nearFarSpace),
    fused: laplacianVarianceAtPoint(
      gout,
      fusedSize.width,
      fusedSize.height,
      point,
      undefined,
      fusedSpace,
    ),
  });
  return {
    atSubjectPoint: atPoint(nearPoint, nearSpace),
    atBackgroundPoint: atPoint(farPoint, farSpace),
  };
}

export async function computeDiagnosticPointLayout(
  nearUri: string,
  farUri: string,
  nearPoint: NormalizedPoint,
  farPoint: NormalizedPoint,
  orientations?: { near?: unknown; far?: unknown },
): Promise<DiagnosticPointLayout> {
  void orientations;
  const [nearL, farL] = await Promise.all([loadImage(nearUri), loadImage(farUri)]);
  const { width: w, height: h } = fitLongSide(nearL.width, nearL.height, FOCUS_VERIFY_LONG_SIDE);
  const gn = readGrayFromSkImage(nearL.image, FOCUS_VERIFY_LONG_SIDE);
  const gf = readGrayFromSkImage(farL.image, FOCUS_VERIFY_LONG_SIDE);
  return {
    subject: analysisPointCoords(nearPoint, w, h, DISPLAY_BUFFER),
    background: analysisPointCoords(farPoint, w, h, DISPLAY_BUFFER),
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
  /** 被写体周辺の混合率。点が無いときは null */
  midAtSubject: number | null;
  /** 背景周辺の混合率。点が無いときは null */
  midAtBackground: number | null;
};

export function maskBucketStatsFromImage(
  mask: SkImage,
  subject?: NormalizedPoint,
  background?: NormalizedPoint,
): MaskBucketStats {
  const w = mask.width();
  const h = mask.height();
  const rgba = mask.readPixels(0, 0, {
    width: w,
    height: h,
    colorType: ColorType.RGBA_8888,
    alphaType: AlphaType.Unpremul,
  });
  if (!rgba) {
    return {
      below01: 0,
      mid: 0,
      above09: 0,
      sampleCount: 0,
      midAtSubject: null,
      midAtBackground: null,
    };
  }
  let b0 = 0;
  let b2 = 0;
  const n = w * h;
  for (let i = 0; i < n; i += 1) {
    const m = rgba[i * 4] / 255;
    if (m < 0.1) b0 += 1;
    else if (m > 0.9) b2 += 1;
  }
  const mix = maskMidFractions(rgba, w, h, subject, background, DISPLAY_BUFFER);
  return {
    below01: b0 / n,
    mid: mix.overall,
    above09: b2 / n,
    sampleCount: n,
    midAtSubject: mix.subject,
    midAtBackground: mix.background,
  };
}

export async function maskBucketStatsFromUri(
  maskUri: string,
  subject?: NormalizedPoint,
  background?: NormalizedPoint,
): Promise<MaskBucketStats> {
  const loaded = await loadImage(maskUri);
  return maskBucketStatsFromImage(loaded.image, subject, background);
}