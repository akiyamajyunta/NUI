import type { CameraRef } from 'react-native-vision-camera';
import type { CameraPhotoOutput } from 'react-native-vision-camera/lib/specs/outputs/CameraPhotoOutput.nitro';
import { getCaptureStrategy } from '@/camera/strategies';
import type { CaptureSettings } from '@/config/constants';
import { Timeline } from '@/perf/timeline';
import type { CaptureResult, NormalizedPoint } from '@/types';

export async function runCaptureSequence(opts: {
  strategyId: CaptureSettings['strategyId'];
  settings: CaptureSettings;
  camera: CameraRef;
  photoOutput: CameraPhotoOutput;
  nearPoint: NormalizedPoint;
  farPoint: NormalizedPoint;
  previewWidth: number;
  previewHeight: number;
  focusedOnNear: boolean;
}): Promise<CaptureResult> {
  const timeline = new Timeline();
  timeline.mark('t0_press');
  const strategy = getCaptureStrategy(opts.strategyId);
  const { near, far } = await strategy.run({
    camera: opts.camera,
    photoOutput: opts.photoOutput,
    nearPoint: opts.nearPoint,
    farPoint: opts.farPoint,
    previewWidth: opts.previewWidth,
    previewHeight: opts.previewHeight,
    settings: opts.settings,
    focusedOnNear: opts.focusedOnNear,
    mark: (label) => timeline.mark(label),
  });
  timeline.mark('t_done');
  const totalMs = timeline.totalMs() ?? 0;
  return {
    near,
    far,
    timeline: [...timeline.getMarks()],
    totalMs,
    strategyId: strategy.id,
  };
}