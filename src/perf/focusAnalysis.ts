import { FOCUS_VERIFY_LONG_SIDE } from '@/config/constants';
import { DISPLAY_BUFFER } from '@/imaging/displayPoint';
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
  // Skia は EXIF を適用して表示向き（縦）で返す。点は display のまま使う。
  const [nearLoaded, farLoaded] = await Promise.all([
    loadImage(input.nearUri),
    loadImage(input.farUri),
  ]);
  void input.nearOrientation;
  void input.farOrientation;
  const space = DISPLAY_BUFFER;
  const { width: w, height: h } = fitLongSide(
    nearLoaded.width,
    nearLoaded.height,
    FOCUS_VERIFY_LONG_SIDE,
  );
  const gn = readGrayFromSkImage(nearLoaded.image, FOCUS_VERIFY_LONG_SIDE);
  const gf = readGrayFromSkImage(farLoaded.image, FOCUS_VERIFY_LONG_SIDE);
  const table = focusSharpnessTableFromGray(
    gn,
    gf,
    w,
    h,
    input.nearPoint,
    input.farPoint,
    undefined,
    space,
  );
  const verify = verifyFocusFromGray(
    gn,
    gf,
    w,
    h,
    input.nearPoint,
    input.farPoint,
    undefined,
    space,
  );
  return { verify, table, analysisWidth: w, analysisHeight: h };
}