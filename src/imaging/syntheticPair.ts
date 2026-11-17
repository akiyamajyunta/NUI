import { ClipOp, Skia, TileMode, type SkImage } from '@shopify/react-native-skia';
import { encodeToCacheJpeg } from '@/imaging/saveImage';
import type { NormalizedPoint } from '@/types';

export type SyntheticPairOptions = {
  /** 中央付近を NEAR とする楕円の長辺（正規化半径） */
  subjectRadius?: number;
  blurSigma?: number;
  farDx?: number;
  farDy?: number;
  farBrightness?: number;
};

function blurImage(image: SkImage, sigma: number): SkImage {
  const blur = Skia.ImageFilter.MakeBlur(sigma, sigma, TileMode.Clamp, null);
  const w = image.width();
  const h = image.height();
  const surface = Skia.Surface.MakeOffscreen(w, h);
  if (!surface) throw new Error('blur surface failed');
  const paint = Skia.Paint();
  paint.setImageFilter(blur);
  surface.getCanvas().drawImage(image, 0, 0, paint);
  const out = surface.makeImageSnapshot();
  surface.dispose();
  return out;
}

function drawMaskedBlend(
  subject: SkImage,
  other: SkImage,
  subjectCenter: NormalizedPoint,
  radius: number,
): SkImage {
  const w = subject.width();
  const h = subject.height();
  const surface = Skia.Surface.MakeOffscreen(w, h);
  if (!surface) throw new Error('mask blend failed');
  const canvas = surface.getCanvas();
  const cx = subjectCenter.x * w;
  const cy = subjectCenter.y * h;
  const rw = radius * w;
  const rh = radius * h;
  canvas.drawImage(other, 0, 0);
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  const oval = Skia.XYWHRect(cx - rw, cy - rh, rw * 2, rh * 2);
  canvas.save();
  const path = Skia.Path.Oval(oval);
  canvas.clipPath(path, ClipOp.Intersect, true);
  canvas.drawImage(subject, 0, 0, paint);
  canvas.restore();
  const out = surface.makeImageSnapshot();
  surface.dispose();
  return out;
}

export async function createSyntheticPair(
  source: SkImage,
  opts: SyntheticPairOptions = {},
): Promise<{ nearUri: string; farUri: string; subjectCenter: NormalizedPoint }> {
  const {
    subjectRadius = 0.22,
    blurSigma = 6,
    farDx = 7,
    farDy = -4,
    farBrightness = 0.92,
  } = opts;
  const center: NormalizedPoint = { x: 0.5, y: 0.42 };
  const blurred = blurImage(source, blurSigma);
  const nearImg = drawMaskedBlend(source, blurred, center, subjectRadius);
  let farBase = drawMaskedBlend(blurred, source, center, subjectRadius);
  if (farBrightness < 1) {
    const scaleSurf = Skia.Surface.MakeOffscreen(farBase.width(), farBase.height());
    if (scaleSurf) {
      const p = Skia.Paint();
      p.setAlphaf(farBrightness);
      scaleSurf.getCanvas().drawImage(farBase, 0, 0, p);
      farBase = scaleSurf.makeImageSnapshot();
      scaleSurf.dispose();
    }
  }
  if (farDx !== 0 || farDy !== 0) {
    const w = farBase.width();
    const h = farBase.height();
    const shifted = Skia.Surface.MakeOffscreen(w, h);
    if (shifted) {
      shifted.getCanvas().clear(Skia.Color('#000000'));
      shifted.getCanvas().drawImage(farBase, farDx, farDy);
      farBase = shifted.makeImageSnapshot();
      shifted.dispose();
    }
  }
  const nearUri = await encodeToCacheJpeg(nearImg, 'syn-near');
  const farUri = await encodeToCacheJpeg(farBase, 'syn-far');
  return { nearUri, farUri, subjectCenter: center };
}

export function subjectCenterDefault(): NormalizedPoint {
  return { x: 0.5, y: 0.42 };
}