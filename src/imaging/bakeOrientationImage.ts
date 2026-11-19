import { FilterMode, MipmapMode, Skia, TileMode, type SkImage } from '@shopify/react-native-skia';
import { orientedOutputSize } from '@/imaging/bakeOrientation';
import { orientationToDegrees } from '@/imaging/orientation';

const BAKE_SKSL = `
uniform shader src;
uniform float srcW;
uniform float srcH;
uniform float turns;

half4 main(float2 coord) {
  float dx = floor(coord.x);
  float dy = floor(coord.y);
  float sx = dx;
  float sy = dy;
  if (turns > 2.5) {
    sx = srcW - 1.0 - dy;
    sy = dx;
  } else if (turns > 1.5) {
    sx = srcW - 1.0 - dx;
    sy = srcH - 1.0 - dy;
  } else if (turns > 0.5) {
    sx = dy;
    sy = srcH - 1.0 - dx;
  }
  return src.eval(float2(sx + 0.5, sy + 0.5));
}
`;

/** ブレンド後の画像を、最近傍で表示向きへ焼く。0度なら同じ画像を返す */
export function bakeOrientation(image: SkImage, orientation: unknown): SkImage {
  const deg = ((orientationToDegrees(orientation) % 360) + 360) % 360;
  if (deg === 0) return image;
  const srcW = image.width();
  const srcH = image.height();
  const out = orientedOutputSize(srcW, srcH, orientation);
  const effect = Skia.RuntimeEffect.Make(BAKE_SKSL);
  if (!effect) throw new Error('orientation bake SkSL compile failed');
  const child = image.makeShaderOptions(
    TileMode.Clamp,
    TileMode.Clamp,
    FilterMode.Nearest,
    MipmapMode.None,
  );
  const turns = deg / 90;
  const shader = effect.makeShaderWithChildren([srcW, srcH, turns], [child]);
  const surface = Skia.Surface.MakeOffscreen(out.width, out.height);
  if (!surface) throw new Error('orientation bake surface failed');
  const paint = Skia.Paint();
  paint.setAntiAlias(false);
  paint.setShader(shader);
  surface.getCanvas().drawPaint(paint);
  const baked = surface.makeImageSnapshot();
  surface.dispose();
  return baked;
}