import { Skia } from '@shopify/react-native-skia';
import { loadImage } from '@/imaging/loadImage';
import { encodeToCacheJpeg } from '@/imaging/saveImage';

/** FAR を中心基準で拡大したプレビュー。scale>1 は内容を大きくする（ブレンドと同じ向き） */
export async function scaledFarPreviewUri(uri: string, scale: number): Promise<string> {
  if (Math.abs(scale - 1) < 1e-4) return uri;
  const loaded = await loadImage(uri);
  const image = loaded.image;
  const w = image.width();
  const h = image.height();
  const surface = Skia.Surface.MakeOffscreen(w, h);
  if (!surface) throw new Error('scale preview surface failed');
  const canvas = surface.getCanvas();
  canvas.clear(Skia.Color('#000000'));
  canvas.save();
  canvas.translate(w / 2, h / 2);
  canvas.scale(scale, scale);
  canvas.translate(-w / 2, -h / 2);
  canvas.drawImage(image, 0, 0);
  canvas.restore();
  const out = surface.makeImageSnapshot();
  surface.dispose();
  const encoded = await encodeToCacheJpeg(out, 'far-scaled');
  out.dispose();
  return encoded;
}