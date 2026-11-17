import { Skia, TileMode, type SkImage } from '@shopify/react-native-skia';
import { SHARPNESS_LAP_MAX } from '@/config/constants';
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
  try {
    return runChildShader(LAPLACIAN_SKSL, image, [SHARPNESS_LAP_MAX]);
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

/**
 * 窓の半径（px）をガウスの sigma に換算する。半径 r の一様窓の標準偏差は r/√3。
 * blurSingleChannel は引数をそのまま sigma として使うため、半径で指定する箇所はここを通す。
 */
export function windowRadiusToSigma(radiusPx: number): number {
  return radiusPx / Math.sqrt(3);
}

/** 鮮鋭度マップ。windowRadius は作業解像度での px（窓の半径） */
export function buildSharpnessMap(image: SkImage, windowRadius: number): SkImage {
  const lap = laplacianSharpness(image);
  if (windowRadius <= 0) return lap;
  return blurSingleChannel(lap, windowRadiusToSigma(windowRadius));
}