import type { CameraRef } from 'react-native-vision-camera';
import type { CameraPhotoOutput } from 'react-native-vision-camera/lib/specs/outputs/CameraPhotoOutput.nitro';
import { applyClosedLoopRetries } from '@/camera/closedLoopCapture';
import { getCaptureStrategy } from '@/camera/strategies';
import type { FocusSessionSnapshot } from '@/camera/smartFocusBeforeShot';
import type { CaptureSettings } from '@/config/constants';
import { Timeline } from '@/perf/timeline';
import type { CaptureResult, HoldBackgroundFocusSessionStats, NormalizedPoint } from '@/types';

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
  focusSession: FocusSessionSnapshot;
  holdFocusSession?: HoldBackgroundFocusSessionStats;
}): Promise<CaptureResult> {
  const timeline = new Timeline();
  timeline.mark('t0_press');
  const strategy = getCaptureStrategy(opts.strategyId);
  const { near, far, focusABeforeShot } = await strategy.run({
    camera: opts.camera,
    photoOutput: opts.photoOutput,
    nearPoint: opts.nearPoint,
    farPoint: opts.farPoint,
    previewWidth: opts.previewWidth,
    previewHeight: opts.previewHeight,
    settings: opts.settings,
    focusedOnNear: opts.focusedOnNear,
    focusSession: opts.focusSession,
    mark: (label) => timeline.mark(label),
  });

  const closed = await applyClosedLoopRetries(
    {
      camera: opts.camera,
      photoOutput: opts.photoOutput,
      settings: opts.settings,
      nearPoint: opts.nearPoint,
      farPoint: opts.farPoint,
      previewWidth: opts.previewWidth,
      previewHeight: opts.previewHeight,
      mark: (label) => timeline.mark(label),
    },
    near,
    far,
    opts.settings.closedLoopCapture,
  );

  timeline.mark('t_done');
  const totalMs = timeline.totalMs() ?? 0;

  let holdBackgroundFocus: HoldBackgroundFocusSessionStats | undefined;
  if (opts.settings.holdBackgroundFocus && opts.holdFocusSession) {
    const skipped = opts.holdFocusSession.focusASkippedCount + (focusABeforeShot.executed ? 0 : 1);
    const captures = opts.holdFocusSession.capturesWhileEnabled + 1;
    holdBackgroundFocus = {
      enabled: true,
      capturesWhileEnabled: captures,
      focusASkippedCount: skipped,
    };
  }

  return {
    near: closed.near,
    far: closed.far,
    timeline: [...timeline.getMarks()],
    totalMs,
    strategyId: strategy.id,
    closedLoop: closed.report,
    focusABeforeShot,
    holdBackgroundFocus,
  };
}