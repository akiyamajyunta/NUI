import {
  DISPLAY_BUFFER,
  displayNormalizedToBufferNormalized,
  type PixelBufferSpace,
} from '@/imaging/displayPoint';
import { fitLongSide } from '@/imaging/downscale';
import { readGrayFromSkImage } from '@/imaging/imagePixels';
import { loadImage } from '@/imaging/loadImage';
import type { NormalizedPoint } from '@/types';
import {
  boxBlurGray,
  runAlignScaleDiagnostic,
  SCALE_DIAG_BLUR_RADIUS_PX,
  SCALE_DIAG_LONG_SIDE,
  type AlignScaleDiagnostic,
} from '@/perf/alignScaleDiagnosticCore';

export type { AlignScaleDiagnostic, AlignScaleSearchResult } from '@/perf/alignScaleDiagnosticCore';
export { SCALE_DIAG_LONG_SIDE, maskedNccGray } from '@/perf/alignScaleDiagnosticCore';

export async function measureBackgroundEdgeScale(
  nearUri: string,
  farUri: string,
  subjectPoint: NormalizedPoint,
  analysisLongSide = SCALE_DIAG_LONG_SIDE,
  space: PixelBufferSpace = DISPLAY_BUFFER,
  jointSearch = false,
): Promise<AlignScaleDiagnostic> {
  const [nearLoaded, farLoaded] = await Promise.all([loadImage(nearUri), loadImage(farUri)]);
  const nw = nearLoaded.width;
  const nh = nearLoaded.height;
  const { width: w, height: h } = fitLongSide(nw, nh, analysisLongSide);
  let grayNear = readGrayFromSkImage(nearLoaded.image, analysisLongSide);
  let grayFar = readGrayFromSkImage(farLoaded.image, analysisLongSide);
  grayNear = boxBlurGray(grayNear, w, h, SCALE_DIAG_BLUR_RADIUS_PX);
  grayFar = boxBlurGray(grayFar, w, h, SCALE_DIAG_BLUR_RADIUS_PX);
  const subject = displayNormalizedToBufferNormalized(subjectPoint, w, h, space);
  return runAlignScaleDiagnostic(grayNear, grayFar, w, h, subject, analysisLongSide, jointSearch);
}