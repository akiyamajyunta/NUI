import {
  AlphaType,
  ColorType,
  Skia,
  type SkImage,
  type SkShader,
} from '@shopify/react-native-skia';
import type { FusionParams, FusionResult, MaskDiagnostics, NormalizedPoint, ScaleCorrectionReport } from '@/types';
import { DISPLAY_BUFFER, displayNormalizedToBufferNormalized } from '@/imaging/displayPoint';
import { loadImage } from '@/imaging/loadImage';
import { resizeSkImage, imageShaderBilinear } from '@/imaging/downscale';
import { fitLongSide } from '@/imaging/fitLongSide';
import { fusionPixelSize } from '@/imaging/fusionOutputSize';
import { encodeToCacheJpeg } from '@/imaging/saveImage';
import { colorCorrectionFromMeans, IDENTITY_COLOR } from '@/imaging/colorStats';
import { readRgbMeans, readGrayFromSkImage } from '@/imaging/imagePixels';
import { computePsnr } from '@/perf/psnr';
import { buildSharpnessMap, blurSingleChannel, windowRadiusToSigma } from '@/fusion/sharpness';
import {
  boxBlurGray,
  estimateAppliedScale,
  SCALE_DIAG_BLUR_RADIUS_PX,
  SCALE_ESTIMATE_LONG_SIDE,
  SCALE_MIN_GAIN,
} from '@/perf/alignScaleDiagnosticCore';
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
  /** 表示向きの被写体点。拡大率の除外円に使う */
  subjectPoint?: NormalizedPoint;
  /**
   * 撮影時の left/right など。画素の回転には使わない。
   * Skia が EXIF を適用済みで、ここから角度を足すと二重回転になる。
   */
  orientation?: unknown;
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
  farScale: number,
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
      farScale,
      w / 2,
      h / 2,
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

  const capped = fusionPixelSize(outW, outH, outputLongSide);
  if (capped.width !== outW || capped.height !== outH) {
    nearImg = resizeSkImage(nearImg, capped.width, capped.height);
    farImg = resizeSkImage(farImg, capped.width, capped.height);
    outW = capped.width;
    outH = capped.height;
  }

  const alignOffset = { dx: 0, dy: 0 };
  const alignEstimatedOffset = { dx: 0, dy: 0 };
  const alignOffsetApplied = false;
  const alignConfidence = 1;
  const alignWarning = false;
  let scaleCorrection: ScaleCorrectionReport = {
    mode: params.scaleMode ?? 'estimate',
    estimatedScale: 1,
    appliedScale: 1,
    nccBefore: 0,
    nccAtEstimate: 0,
    nccAfter: 0,
    fellBack: false,
    minGain: params.scaleMinGain ?? SCALE_MIN_GAIN,
    analysisLongSide: SCALE_ESTIMATE_LONG_SIDE,
    ms: 0,
  };
  if (scaleCorrection.mode !== 'off') {
    onProgress?.('拡大率');
    const { width: aw, height: ah } = fitLongSide(outW, outH, SCALE_ESTIMATE_LONG_SIDE);
    let grayNear = readGrayFromSkImage(nearImg, SCALE_ESTIMATE_LONG_SIDE);
    let grayFar = readGrayFromSkImage(farImg, SCALE_ESTIMATE_LONG_SIDE);
    grayNear = boxBlurGray(grayNear, aw, ah, SCALE_DIAG_BLUR_RADIUS_PX);
    grayFar = boxBlurGray(grayFar, aw, ah, SCALE_DIAG_BLUR_RADIUS_PX);
    const subject = displayNormalizedToBufferNormalized(
      options?.subjectPoint ?? { x: 0.5, y: 0.45 },
      aw,
      ah,
      DISPLAY_BUFFER,
    );
    const est = estimateAppliedScale(
      grayNear,
      grayFar,
      aw,
      ah,
      subject,
      scaleCorrection.mode,
      params.scaleFixed ?? 1,
      params.scaleMinGain ?? SCALE_MIN_GAIN,
    );
    scaleCorrection = { mode: scaleCorrection.mode, ...est };
    alignMs = est.ms;
  }
  const farScale = scaleCorrection.appliedScale;

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
    resultImage = blendImages(
      nearImg,
      farImg,
      mask,
      params,
      color.gain,
      color.bias,
      alignOffset,
      farScale,
    );
  } catch (e) {
    logError('fusion', 'blend failed', e);
    throw new Error('合成に失敗しました');
  }
  // 入力は MakeImageFromEncoded が表示向きにした画素。ここでは回さない。
  void options?.orientation;
  outW = resultImage.width();
  outH = resultImage.height();
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
    scaleCorrection,
  };
}