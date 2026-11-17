import {
  AlphaType,
  ColorType,
  Skia,
  type SkImage,
  type SkShader,
} from '@shopify/react-native-skia';
import type { FusionParams, FusionResult, MaskDiagnostics } from '@/types';
import { loadImage } from '@/imaging/loadImage';
import { fitLongSide, resizeSkImage, imageShaderBilinear } from '@/imaging/downscale';
import { encodeToCacheJpeg } from '@/imaging/saveImage';
import { colorCorrectionFromMeans, IDENTITY_COLOR } from '@/imaging/colorStats';
import { readRgbMeans, readGrayFromSkImage } from '@/imaging/imagePixels';
import { computePsnr } from '@/perf/psnr';
import { alignNearFar } from '@/fusion/align';
import { buildSharpnessMap, blurSingleChannel, windowRadiusToSigma } from '@/fusion/sharpness';
import { effectiveThreshold, maskDiagnosticsFromEncoded } from '@/fusion/maskCore';
import { MASK_FILL_SKSL, MASK_RAW_SKSL } from '@/fusion/shaders/mask';
import { BLEND_SKSL } from '@/fusion/shaders/blend';
import {
  MASK_EPS,
  MASK_FILL_BLUR_RADIUS,
  MASK_FILL_FALLBACK,
  MASK_FILL_PRIOR,
  MASK_LOW_TEXTURE_HI,
  MASK_LOW_TEXTURE_LO,
  ALIGN_MIN_CONFIDENCE,
  MAX_TEXTURE_LONG_SIDE,
  SHARPNESS_LAP_MAX,
} from '@/config/constants';
import { logError } from '@/util/log';

export type FuseProgress = (stage: string) => void;

export type FuseOptions = {
  manualMask?: import('@shopify/react-native-skia').SkImage;
  referenceUriForPsnr?: string;
  saveDebug?: boolean;
  /** 診断: 全画素で NEAR または FAR のみを選択 */
  forceMask?: 'near' | 'far';
};

function makeUniformMask(w: number, h: number, value: number): SkImage {
  const surface = Skia.Surface.MakeOffscreen(w, h);
  if (!surface) throw new Error('uniform mask surface failed');
  const canvas = surface.getCanvas();
  const paint = Skia.Paint();
  paint.setColor(value >= 0.5 ? Skia.Color('#FFFFFF') : Skia.Color('#000000'));
  canvas.drawRect(Skia.XYWHRect(0, 0, w, h), paint);
  const img = surface.makeImageSnapshot();
  surface.dispose();
  return img;
}

function drawShaderToImage(shader: SkShader, w: number, h: number): SkImage {
  const surface = Skia.Surface.MakeOffscreen(w, h);
  if (!surface) throw new Error('mask surface failed');
  const paint = Skia.Paint();
  paint.setShader(shader);
  surface.getCanvas().drawPaint(paint);
  const out = surface.makeImageSnapshot();
  surface.dispose();
  return out;
}

/** 診断用: 鮮鋭度マップ S_near・S_far と正規化差 d の値域 */
function readMaskDiagnostics(sharpNear: SkImage, sharpFar: SkImage): MaskDiagnostics | undefined {
  const w = sharpNear.width();
  const h = sharpNear.height();
  const info = {
    width: w,
    height: h,
    colorType: ColorType.RGBA_8888,
    alphaType: AlphaType.Unpremul,
  };
  const nearBytes = sharpNear.readPixels(0, 0, info);
  const farBytes = sharpFar.readPixels(0, 0, info);
  if (!nearBytes || !farBytes) return undefined;
  return maskDiagnosticsFromEncoded(nearBytes, farBytes, w * h, 4);
}

function renderMask(
  sharpNear: SkImage,
  sharpFar: SkImage,
  params: FusionParams,
): SkImage {
  const w = sharpNear.width();
  const h = sharpNear.height();

  // パス1: 正規化差による判定 m0 と、テクスチャの確からしさ c
  const rawEffect = Skia.RuntimeEffect.Make(MASK_RAW_SKSL);
  if (!rawEffect) throw new Error('mask SkSL compile failed');
  const raw = drawShaderToImage(
    rawEffect.makeShaderWithChildren(
      [
        effectiveThreshold(params.threshold),
        params.nearBias,
        params.haloShrink,
        MASK_EPS,
        MASK_LOW_TEXTURE_LO,
        MASK_LOW_TEXTURE_HI,
        SHARPNESS_LAP_MAX,
      ],
      [imageShaderBilinear(sharpNear, w, h), imageShaderBilinear(sharpFar, w, h)],
    ),
    w,
    h,
  );

  // パス2: 低テクスチャ領域を、広い半径でぼかした値で補う
  const wide = blurSingleChannel(raw, windowRadiusToSigma(MASK_FILL_BLUR_RADIUS));
  const fillEffect = Skia.RuntimeEffect.Make(MASK_FILL_SKSL);
  if (!fillEffect) throw new Error('mask fill SkSL compile failed');
  let mask = drawShaderToImage(
    fillEffect.makeShaderWithChildren(
      [MASK_FILL_PRIOR, MASK_FILL_FALLBACK],
      [imageShaderBilinear(raw, w, h), imageShaderBilinear(wide, w, h)],
    ),
    w,
    h,
  );

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
  let alignEstimatedOffset = { dx: 0, dy: 0 };
  let alignOffsetApplied = false;
  let alignConfidence = 1;
  let alignWarning = false;
  if (params.align) {
    onProgress?.('位置合わせ');
    const tAlign = performance.now();
    const ar = await alignNearFar(nearImg, farImg);
    alignMs = performance.now() - tAlign;
    alignEstimatedOffset = { dx: ar.dx, dy: ar.dy };
    alignConfidence = ar.confidence;
    alignWarning = ar.warned;
    if (ar.confidence >= ALIGN_MIN_CONFIDENCE) {
      alignOffset = alignEstimatedOffset;
      alignOffsetApplied = true;
    }
  }

  const work = fitLongSide(outW, outH, params.workLongSide);
  const nearWork = resizeSkImage(nearImg, work.width, work.height);
  const farWork = resizeSkImage(farImg, work.width, work.height);

  onProgress?.('鮮鋭度');
  const tSharp = performance.now();
  const workW = nearWork.width();
  const workH = nearWork.height();
  let sNear: SkImage | undefined;
  let sFar: SkImage | undefined;
  let mask: SkImage;
  if (options?.forceMask) {
    const v = options.forceMask === 'near' ? 1 : 0;
    mask = makeUniformMask(workW, workH, v);
    if (options.saveDebug) {
      sNear = buildSharpnessMap(nearWork, params.sharpWindowRadius);
      sFar = buildSharpnessMap(farWork, params.sharpWindowRadius);
    }
  } else if (options?.manualMask) {
    sNear = buildSharpnessMap(nearWork, params.sharpWindowRadius);
    sFar = buildSharpnessMap(farWork, params.sharpWindowRadius);
    mask = resizeSkImage(options.manualMask, workW, workH);
    if (params.maskBlurRadius > 0) {
      mask = blurSingleChannel(mask, params.maskBlurRadius);
    }
  } else {
    sNear = buildSharpnessMap(nearWork, params.sharpWindowRadius);
    sFar = buildSharpnessMap(farWork, params.sharpWindowRadius);
    mask = renderMask(sNear, sFar, params);
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
        sharpNearUri: sNear ? await encodeToCacheJpeg(sNear, 'dbg-sn') : undefined,
        sharpFarUri: sFar ? await encodeToCacheJpeg(sFar, 'dbg-sf') : undefined,
      }
    : undefined;

  let maskDiagnostics: MaskDiagnostics | undefined;
  if (options?.saveDebug && sNear && sFar) {
    try {
      maskDiagnostics = readMaskDiagnostics(sNear, sFar);
    } catch (e) {
      logError('fusion', 'mask diagnostics failed', e);
    }
  }

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
    alignEstimatedOffset,
    alignOffsetApplied,
    alignConfidence,
    alignWarning,
    debug,
    maskDiagnostics,
    psnrDb,
  };
}