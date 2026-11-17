import { Skia, TileMode, type SkImage } from '@shopify/react-native-skia';
import { LAPLACIAN_SKSL } from '@/fusion/shaders/laplacian';
import { imageShaderBilinear } from '@/imaging/downscale';
import { logError } from '@/util/log';

function runChildShader(effectSource: string, image: SkImage, uniforms: number[]): SkImage {
  const effect = Skia.RuntimeEffect.Make(effectSource);
  if (!effect) {
    throw new Error('SkSL compile failed');
  }
  const w = image.width();
  const h = image.height();
  const child = imageShaderBilinear(image, w, h);
  const shader = effect.makeShaderWithChildren(uniforms, [child]);
  const surface = Skia.Surface.MakeOffscreen(w, h);
  if (!surface) throw new Error('surface failed');
  const paint = Skia.Paint();
  paint.setShader(shader);
  surface.getCanvas().drawPaint(paint);
  const out = surface.makeImageSnapshot();
  surface.dispose();
  return out;
}

export function laplacianSharpness(image: SkImage): SkImage {
  const w = image.width();
  const h = image.height();
  const texelX = 1 / w;
  const texelY = 1 / h;
  try {
    return runChildShader(LAPLACIAN_SKSL, image, [texelX, texelY]);
  } catch (e) {
    logError('fusion', 'laplacian shader failed', e);
    throw e;
  }
}

export function blurSingleChannel(image: SkImage, radius: number): SkImage {
  const sigma = Math.max(0.5, radius);
  const blur = Skia.ImageFilter.MakeBlur(sigma, sigma, TileMode.Clamp, null);
  const w = image.width();
  const h = image.height();
  const surface = Skia.Surface.MakeOffscreen(w, h);
  if (!surface) throw new Error('surface failed');
  const paint = Skia.Paint();
  paint.setImageFilter(blur);
  const shader = imageShaderBilinear(image, w, h);
  paint.setShader(shader);
  surface.getCanvas().drawPaint(paint);
  const out = surface.makeImageSnapshot();
  surface.dispose();
  return out;
}

export function buildSharpnessMap(image: SkImage, windowRadius: number): SkImage {
  const lap = laplacianSharpness(image);
  if (windowRadius <= 0) return lap;
  return blurSingleChannel(lap, windowRadius);
}