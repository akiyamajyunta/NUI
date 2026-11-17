import { AlphaType, ColorType, type SkImage } from '@shopify/react-native-skia';
import { fitLongSide, resizeSkImage } from '@/imaging/downscale';

export function readGrayFromSkImage(image: SkImage, targetLongSide = 256): Float32Array {
  const w0 = image.width();
  const h0 = image.height();
  const { width: w, height: h } = fitLongSide(w0, h0, targetLongSide);
  const resized = w === w0 && h === h0 ? image : resizeSkImage(image, w, h);
  const rgba = resized.readPixels(0, 0, {
    width: w,
    height: h,
    colorType: ColorType.RGBA_8888,
    alphaType: AlphaType.Unpremul,
  });
  if (!rgba) throw new Error('readPixels failed');
  const gray = new Float32Array(w * h);
  for (let i = 0; i < w * h; i += 1) {
    const r = rgba[i * 4] / 255;
    const g = rgba[i * 4 + 1] / 255;
    const b = rgba[i * 4 + 2] / 255;
    gray[i] = 0.299 * r + 0.587 * g + 0.114 * b;
  }
  return gray;
}

export function readRgbMeans(image: SkImage, targetLongSide = 256): [number, number, number] {
  const w0 = image.width();
  const h0 = image.height();
  const { width: w, height: h } = fitLongSide(w0, h0, targetLongSide);
  const resized = w === w0 && h === h0 ? image : resizeSkImage(image, w, h);
  const rgba = resized.readPixels(0, 0, {
    width: w,
    height: h,
    colorType: ColorType.RGBA_8888,
    alphaType: AlphaType.Unpremul,
  });
  if (!rgba) return [0, 0, 0];
  let rSum = 0;
  let gSum = 0;
  let bSum = 0;
  const n = w * h;
  for (let i = 0; i < n; i += 1) {
    rSum += rgba[i * 4] / 255;
    gSum += rgba[i * 4 + 1] / 255;
    bSum += rgba[i * 4 + 2] / 255;
  }
  return [rSum / n, gSum / n, bSum / n];
}

export function grayToGradientMag(gray: Float32Array, w: number, h: number): Float32Array {
  const out = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y += 1) {
    for (let x = 1; x < w - 1; x += 1) {
      const i = y * w + x;
      const gx =
        gray[i - 1 - w] +
        2 * gray[i - 1] +
        gray[i - 1 + w] -
        (gray[i + 1 - w] + 2 * gray[i + 1] + gray[i + 1 + w]);
      const gy =
        gray[i - w - 1] +
        2 * gray[i - w] +
        gray[i - w + 1] -
        (gray[i + w - 1] + 2 * gray[i + w] + gray[i + w + 1]);
      out[i] = Math.sqrt(gx * gx + gy * gy);
    }
  }
  return out;
}