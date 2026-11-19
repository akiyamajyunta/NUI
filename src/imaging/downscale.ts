import {
  Skia,
  FilterMode,
  MipmapMode,
  TileMode,
  type SkImage,
} from '@shopify/react-native-skia';
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