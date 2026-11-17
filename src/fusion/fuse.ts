import { Skia, type SkImage } from '@shopify/react-native-skia';
import type { FusionParams, FusionResult } from '@/types';
import { loadImage } from '@/imaging/loadImage';
import { fitLongSide, resizeSkImage, imageShaderBilinear } from '@/imaging/downscale';
import { encodeToCacheJpeg } from '@/imaging/saveImage';
import { colorCorrectionFromMeans, IDENTITY_COLOR } from '@/imaging/colorStats';
import { readRgbMeans, readGrayFromSkImage } from '@/imaging/imagePixels';
import { computePsnr } from '@/perf/psnr';
import { alignNearFar } from '@/fusion/align';
import { buildSharpnessMap, blurSingleChannel } from '@/fusion/sharpness';
import { MASK_SKSL } from '@/fusion/shaders/mask';
import { BLEND_SKSL } from '@/fusion/shaders/blend';
import { MAX_TEXTURE_LONG_SIDE } from '@/config/constants';
import { logError } from '@/util/log';

export type FuseProgress = (stage: string) => void;

export type FuseOptions = {
  manualMask?: import('@shopify/react-native-skia').SkImage;
  referenceUriForPsnr?: string;
  saveDebug?: boolean;
};

function renderMask(
  sharpNear: SkImage,
  sharpFar: SkImage,
  params: FusionParams,
): SkImage {
  const effect = Skia.RuntimeEffect.Make(MASK_SKSL);
  if (!effect) throw new Error('mask SkSL compile failed');
  const w = sharpNear.width();
  const h = sharpNear.height();
  const shader = effect.makeShaderWithChildren(
    [params.threshold, params.nearBias, params.haloShrink],
    [imageShaderBilinear(sharpNear, w, h), imageShaderBilinear(sharpFar, w, h)],
  );
  const surface = Skia.Surface.MakeOffscreen(w, h);
  if (!surface) throw new Error('mask surface failed');
  const paint = Skia.Paint();
  paint.setShader(shader);
  surface.getCanvas().drawPaint(paint);
  let mask = surface.makeImageSnapshot();
  surface.dispose();
  if (params.maskBlurRadius > 0) {
    mask = blurSingleChannel(mask, params.maskBlurRadius);
  }
  return mask;
}

function blendImages(
  near: SkImage,
  far: SkImage,
  mask: SkImage,
  params: FusionParams,
  colorGain: [number, number, number],
  colorBias: [number, number, number],
  align: { dx: number; dy: number },
): SkImage {
  const effect = Skia.RuntimeEffect.Make(BLEND_SKSL);
  if (!effect) throw new Error('blend SkSL compile failed');
  const w = near.width();
  const h = near.height();
  const mw = mask.width();
  const mh = mask.height();
  const shader = effect.makeShaderWithChildren(
    [
      align.dx,
      align.dy,
      mw / w,
      mh / h,
      colorGain[0],
      colorGain[1],
      colorGain[2],
      colorBias[0],
      colorBias[1],
      colorBias[2],
    ],
    [
      imageShaderBilinear(near, w, h),
      imageShaderBilinear(far, w, h),
      imageShaderBilinear(mask, mw, mh),
    ],
  );
  const surface = Skia.Surface.MakeOffscreen(w, h);
  if (!surface) throw new Error('blend surface failed');
  const paint = Skia.Paint();
  paint.setShader(shader);
  surface.getCanvas().drawPaint(paint);
  const out = surface.makeImageSnapshot();
  surface.dispose();
  return out;
}

export async function fuse(
  nearUri: string,
  farUri: string,
  params: FusionParams,
  onProgress?: FuseProgress,
  outputLongSide?: number,
  options?: FuseOptions,
): Promise<FusionResult> {
  const t0 = performance.now();
  let loadMs = 0;
  let alignMs = 0;
  let sharpnessMs = 0;
  let blendMs = 0;
  let encodeMs = 0;

  onProgress?.('読込');
  const tLoad = performance.now();
  // loadImage の内部ステージ名（decode/ready）は画面に出さない
  const nearLoaded = await loadImage(nearUri);
  const farLoaded = await loadImage(farUri);
  loadMs = performance.now() - tLoad;

  if (nearLoaded.orientation !== farLoaded.orientation) {
    throw new Error('2枚の向きが一致しません');
  }

  let nearImg = nearLoaded.image;
  let farImg = farLoaded.image;
  let outW = nearLoaded.width;
  let outH = nearLoaded.height;

  const maxLong = outputLongSide ?? Math.max(outW, outH);
  const capped = fitLongSide(outW, outH, Math.min(maxLong, MAX_TEXTURE_LONG_SIDE));
  if (capped.width !== outW || capped.height !== outH) {
    nearImg = resizeSkImage(nearImg, capped.width, capped.height);
    farImg = resizeSkImage(farImg, capped.width, capped.height);
    outW = capped.width;
    outH = capped.height;
  }

  let alignOffset = { dx: 0, dy: 0 };
  let alignConfidence = 1;
  let alignWarning = false;
  if (params.align) {
    onProgress?.('位置合わせ');
    const tAlign = performance.now();
    const ar = await alignNearFar(nearImg, farImg);
    alignMs = performance.now() - tAlign;
    alignOffset = { dx: ar.dx, dy: ar.dy };
    alignConfidence = ar.confidence;
    alignWarning = ar.warned;
  }

  const work = fitLongSide(outW, outH, params.workLongSide);
  const nearWork = resizeSkImage(nearImg, work.width, work.height);
  const farWork = resizeSkImage(farImg, work.width, work.height);

  onProgress?.('鮮鋭度');
  const tSharp = performance.now();
  const sNear = buildSharpnessMap(nearWork, params.sharpWindowRadius);
  const sFar = buildSharpnessMap(farWork, params.sharpWindowRadius);
  let mask = options?.manualMask
    ? resizeSkImage(
        options.manualMask,
        nearWork.width(),
        nearWork.height(),
      )
    : renderMask(sNear, sFar, params);
  if (params.maskBlurRadius > 0 && options?.manualMask) {
    mask = blurSingleChannel(mask, params.maskBlurRadius);
  }
  sharpnessMs = performance.now() - tSharp;

  let color = IDENTITY_COLOR;
  if (params.colorMatch) {
    const meanNear = readRgbMeans(nearWork);
    const meanFar = readRgbMeans(farWork);
    color = colorCorrectionFromMeans(meanNear, meanFar);
  }

  onProgress?.('ブレンド');
  const tBlend = performance.now();
  let resultImage: SkImage;
  try {
    resultImage = blendImages(nearImg, farImg, mask, params, color.gain, color.bias, alignOffset);
  } catch (e) {
    logError('fusion', 'blend failed', e);
    throw new Error('合成に失敗しました');
  }
  blendMs = performance.now() - tBlend;

  onProgress?.('エンコード');
  const tEnc = performance.now();
  const imageUri = await encodeToCacheJpeg(resultImage);
  encodeMs = performance.now() - tEnc;

  const totalMs = performance.now() - t0;

  const debug = options?.saveDebug
    ? {
        nearUri: await encodeToCacheJpeg(nearImg, 'dbg-near'),
        farUri: await encodeToCacheJpeg(farImg, 'dbg-far'),
        maskUri: await encodeToCacheJpeg(mask, 'dbg-mask'),
        sharpNearUri: await encodeToCacheJpeg(sNear, 'dbg-sn'),
        sharpFarUri: await encodeToCacheJpeg(sFar, 'dbg-sf'),
      }
    : undefined;

  let psnrDb: number | undefined;
  if (options?.referenceUriForPsnr) {
    try {
      const ref = await loadImage(options.referenceUriForPsnr);
      const refGray = readGrayFromSkImage(ref.image, 256);
      const outGray = readGrayFromSkImage(resultImage, 256);
      psnrDb = computePsnr(refGray, outGray);
    } catch {
      psnrDb = undefined;
    }
  }

  return {
    imageUri,
    width: outW,
    height: outH,
    timings: { loadMs, alignMs, sharpnessMs, blendMs, encodeMs, totalMs },
    alignOffset,
    alignConfidence,
    alignWarning,
    debug,
    psnrDb,
  };
}