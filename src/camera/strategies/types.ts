import type { CameraRef } from 'react-native-vision-camera';
import type { CameraPhotoOutput } from 'react-native-vision-camera/lib/specs/outputs/CameraPhotoOutput.nitro';
import type { CaptureSettings } from '@/config/constants';
import type { CapturedPhoto, NormalizedPoint } from '@/types';

export type CaptureStrategyContext = {
  camera: CameraRef;
  photoOutput: CameraPhotoOutput;
  nearPoint: NormalizedPoint;
  farPoint: NormalizedPoint;
  previewWidth: number;
  previewHeight: number;
  mark: (label: string) => void;
  settings: CaptureSettings;
  /** 最後のタップがぬい点なら true。false なら背景ピント（1枚目=背景に有利） */
  focusedOnNear: boolean;
};

export interface CaptureStrategy {
  id: string;
  label: string;
  run(ctx: CaptureStrategyContext): Promise<{ near: CapturedPhoto; far: CapturedPhoto }>;
}