import type { SkImage } from '@shopify/react-native-skia';
import { fitLongSide } from '@/imaging/downscale';
import { grayToGradientMag, readGrayFromSkImage } from '@/imaging/imagePixels';
import { searchTranslation, type AlignEstimate } from '@/fusion/alignCore';

export type AlignResult = AlignEstimate;

const ALIGN_LONG = 256;

export async function alignNearFar(near: SkImage, far: SkImage): Promise<AlignResult> {
  const nw = near.width();
  const nh = near.height();
  const { width: w, height: h } = fitLongSide(nw, nh, ALIGN_LONG);

  const grayNear = readGrayFromSkImage(near, ALIGN_LONG);
  const grayFar = readGrayFromSkImage(far, ALIGN_LONG);
  const edgeNear = grayToGradientMag(grayNear, w, h);
  const edgeFar = grayToGradientMag(grayFar, w, h);

  const est = searchTranslation(edgeNear, edgeFar, w, h);

  const scaleX = nw / w;
  const scaleY = nh / h;
  return {
    ...est,
    dx: est.dx * scaleX,
    dy: est.dy * scaleY,
  };
}