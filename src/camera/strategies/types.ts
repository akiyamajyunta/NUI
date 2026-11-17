import type { CameraRef } from 'react-native-vision-camera';
import type { CameraPhotoOutput } from 'react-native-vision-camera/lib/specs/outputs/CameraPhotoOutput.nitro';
import type { CaptureSettings } from '@/config/constants';
import type { FocusSessionSnapshot } from '@/camera/smartFocusBeforeShot';
import type { CapturedPhoto, FocusABeforeShotReport, NormalizedPoint } from '@/types';

export type CaptureStrategyContext = {
  camera: CameraRef;
  photoOutput: CameraPhotoOutput;
  nearPoint: NormalizedPoint;
  farPoint: NormalizedPoint;
  previewWidth: number;
  previewHeight: number;
  mark: (label: string) => void;
  settings: CaptureSettings;
  /** 最後のタップがぬい点なら true（レガシー互換） */
  focusedOnNear: boolean;
  focusSession: FocusSessionSnapshot;
};

export type CaptureStrategyRunResult = {
  near: CapturedPhoto;
  far: CapturedPhoto;
  focusABeforeShot: FocusABeforeShotReport;
};

export interface CaptureStrategy {
  id: string;
  label: string;
  run(ctx: CaptureStrategyContext): Promise<CaptureStrategyRunResult>;
}