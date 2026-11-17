import { FOCUS_VERIFY_LONG_SIDE } from '@/config/constants';
import { fitLongSide } from '@/imaging/downscale';
import { loadImage } from '@/imaging/loadImage';
import { readGrayFromSkImage } from '@/imaging/imagePixels';
import { focusSharpnessTableFromGray, verifyFocusFromGray } from '@/perf/focusVerify';
import type { FocusVerifyResult } from '@/perf/focusVerify';
import type { NormalizedPoint } from '@/types';

export type FocusAnalysisInput = {
  nearUri: string;
  farUri: string;
  nearPoint: NormalizedPoint;
  farPoint: NormalizedPoint;
  /** Vision Camera / EXIF。未指定なら回転なしとして読む */
  nearOrientation?: unknown;
  farOrientation?: unknown;
};

export async function runFocusAnalysis(input: FocusAnalysisInput): Promise<{
  verify: FocusVerifyResult;
  table: ReturnType<typeof focusSharpnessTableFromGray>;
  analysisWidth: number;
  analysisHeight: number;
}> {
  const [nearLoaded, farLoaded] = await Promise.all([
    loadImage(input.nearUri, input.nearOrientation),
    loadImage(input.farUri, input.farOrientation),
  ]);
  const { width: w, height: h } = fitLongSide(
    nearLoaded.width,
    nearLoaded.height,
    FOCUS_VERIFY_LONG_SIDE,
  );
  const gn = readGrayFromSkImage(nearLoaded.image, FOCUS_VERIFY_LONG_SIDE);
  const gf = readGrayFromSkImage(farLoaded.image, FOCUS_VERIFY_LONG_SIDE);
  const table = focusSharpnessTableFromGray(gn, gf, w, h, input.nearPoint, input.farPoint);
  const verify = verifyFocusFromGray(gn, gf, w, h, input.nearPoint, input.farPoint);
  return { verify, table, analysisWidth: w, analysisHeight: h };
}