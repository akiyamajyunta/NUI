export type NormalizedPoint = { x: number; y: number };

export type CapturedPhoto = {
  uri: string;
  width: number;
  height: number;
  orientation: string;
  focusPoint: NormalizedPoint;
  role: 'NEAR' | 'FAR';
};

export type TimelineMark = { label: string; t: number };

export type CaptureResult = {
  near: CapturedPhoto;
  far: CapturedPhoto;
  timeline: TimelineMark[];
  totalMs: number;
  strategyId: string;
};

export type FusionParams = {
  workLongSide: number;
  sharpWindowRadius: number;
  maskBlurRadius: number;
  threshold: number;
  nearBias: number;
  haloShrink: number;
  colorMatch: boolean;
  align: boolean;
};

export type FusionTimings = {
  loadMs: number;
  alignMs: number;
  sharpnessMs: number;
  blendMs: number;
  encodeMs: number;
  totalMs: number;
};

export type FusionDebugUris = {
  nearUri?: string;
  farUri?: string;
  maskUri?: string;
  sharpNearUri?: string;
  sharpFarUri?: string;
};

export type FusionResult = {
  imageUri: string;
  width: number;
  height: number;
  timings: FusionTimings;
  alignOffset: { dx: number; dy: number };
  alignConfidence: number;
  alignWarning: boolean;
  debug?: FusionDebugUris;
  psnrDb?: number;
};

export type SyntheticSession = {
  referenceUri: string;
};

export type ResultViewMode =
  | 'result'
  | 'near'
  | 'far'
  | 'mask'
  | 'sharpNear'
  | 'sharpFar';

export type FusionPreviewImages = {
  nearUri?: string;
  farUri?: string;
  maskPreviewUri?: string;
};

export type FusionInput = {
  nearUri: string;
  farUri: string;
  params: FusionParams;
  outputLongSide?: number;
};

export type LoadedImageInfo = {
  image: import('@shopify/react-native-skia').SkImage;
  width: number;
  height: number;
  uri: string;
  orientation: string;
};