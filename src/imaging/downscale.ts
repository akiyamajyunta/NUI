import {
  Skia,
  FilterMode,
  MipmapMode,
  TileMode,
  type SkImage,
} from '@shopify/react-native-skia';
import {
  FAR_CATMULL_B,
  FAR_CATMULL_C,
  farUsesNearestSample,
} from '@/imaging/farSampling';
import { fitLongSide } from '@/imaging/fitLongSide';

export { fitLongSide };

export function resizeSkImage(source: SkImage, targetW: number, targetH: number): SkImage {
  const surface = Skia.Surface.MakeOffscreen(targetW, targetH);
  if (!surface) throw new Error('offscreen surface create failed');
  const canvas = surface.getCanvas();
  canvas.clear(Skia.Color('#000000'));
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  const srcW = source.width();
  const srcH = source.height();
  canvas.drawImageRect(
    source,
    Skia.XYWHRect(0, 0, srcW, srcH),
    Skia.XYWHRect(0, 0, targetW, targetH),
    paint,
  );
  const img = surface.makeImageSnapshot();
  surface.dispose();
  return img;
}

export function imageShaderBilinear(image: SkImage, w: number, h: number) {
  return image.makeShaderOptions(TileMode.Clamp, TileMode.Clamp, FilterMode.Linear, MipmapMode.None);
}

/** 拡大した FAR。1.0 付近は最近傍、それ以外は Catmull-Rom */
export function imageShaderForFar(image: SkImage, scale: number) {
  if (farUsesNearestSample(scale)) {
    return image.makeShaderOptions(TileMode.Clamp, TileMode.Clamp, FilterMode.Nearest, MipmapMode.None);
  }
  return image.makeShaderCubic(TileMode.Clamp, TileMode.Clamp, FAR_CATMULL_B, FAR_CATMULL_C);
}