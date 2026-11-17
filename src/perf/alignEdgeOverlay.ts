import { AlphaType, ColorType, Skia, type SkImage } from '@shopify/react-native-skia';
import { ALIGN_LONG_SIDE } from '@/config/constants';
import { fitLongSide } from '@/imaging/downscale';
import { grayToGradientMag, readGrayFromSkImage } from '@/imaging/imagePixels';
import { loadImage } from '@/imaging/loadImage';
import { encodeToCacheJpeg } from '@/imaging/saveImage';
import { shiftArray } from '@/fusion/alignCore';

const EDGE_FLOOR = 0.04;

function rgbaToSkImage(rgba: Uint8Array, w: number, h: number): SkImage {
  const data = Skia.Data.fromBytes(rgba);
  const image = Skia.Image.MakeImage(
    {
      width: w,
      height: h,
      alphaType: AlphaType.Opaque,
      colorType: ColorType.RGBA_8888,
    },
    data,
    w * 4,
  );
  if (!image) throw new Error('edge overlay raster failed');
  return image;
}

function composeEdgeRgba(
  nearMag: Float32Array,
  farMag: Float32Array,
  w: number,
  h: number,
): Uint8Array {
  let maxN = 0;
  let maxF = 0;
  for (let i = 0; i < w * h; i += 1) {
    if (nearMag[i] > maxN) maxN = nearMag[i];
    if (farMag[i] > maxF) maxF = farMag[i];
  }
  const scaleN = maxN > 1e-6 ? 1 / maxN : 1;
  const scaleF = maxF > 1e-6 ? 1 / maxF : 1;
  const rgba = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i += 1) {
    const n = nearMag[i] * scaleN;
    const f = farMag[i] * scaleF;
    const o = i * 4;
    rgba[o] = n > EDGE_FLOOR ? Math.round(Math.min(1, n) * 255) : 0;
    rgba[o + 1] = 0;
    rgba[o + 2] = f > EDGE_FLOOR ? Math.round(Math.min(1, f) * 255) : 0;
    rgba[o + 3] = 255;
  }
  return rgba;
}

export type AlignEdgeOverlayOpts = {
  nearUri: string;
  farUri: string;
  /** フル解像度での推定 offset（合成パイプラインと同一スケール） */
  alignDx?: number;
  alignDy?: number;
  applyAlignOffset?: boolean;
  analysisLongSide?: number;
};

export async function buildAlignEdgeOverlayUri(opts: AlignEdgeOverlayOpts): Promise<string> {
  const long = opts.analysisLongSide ?? ALIGN_LONG_SIDE;
  const [nearLoaded, farLoaded] = await Promise.all([
    loadImage(opts.nearUri),
    loadImage(opts.farUri),
  ]);
  const nw = nearLoaded.width;
  const nh = nearLoaded.height;
  const { width: w, height: h } = fitLongSide(nw, nh, long);
  const grayNear = readGrayFromSkImage(nearLoaded.image, long);
  let grayFar = readGrayFromSkImage(farLoaded.image, long);
  const edgeNear = grayToGradientMag(grayNear, w, h);
  let edgeFar = grayToGradientMag(grayFar, w, h);

  if (opts.applyAlignOffset && (opts.alignDx || opts.alignDy)) {
    const dx = Math.round((opts.alignDx ?? 0) * (w / nw));
    const dy = Math.round((opts.alignDy ?? 0) * (h / nh));
    grayFar = shiftArray(grayFar, w, h, dx, dy);
    edgeFar = grayToGradientMag(grayFar, w, h);
  }

  const rgba = composeEdgeRgba(edgeNear, edgeFar, w, h);
  const image = rgbaToSkImage(rgba, w, h);
  const uri = await encodeToCacheJpeg(image, 'edge-overlay');
  image.dispose();
  return uri;
}