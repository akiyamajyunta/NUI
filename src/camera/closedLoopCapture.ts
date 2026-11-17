import type { CameraRef } from 'react-native-vision-camera';
import type { CameraPhotoOutput } from 'react-native-vision-camera/lib/specs/outputs/CameraPhotoOutput.nitro';
import { focusThenSettle } from '@/camera/focusMetering';
import { normalizedToView } from '@/camera/focusPoints';
import { captureFarPhoto, captureNearPhoto } from '@/camera/photoCapture';
import { closedLoopRetryPlan } from '@/camera/closedLoopPlan';
import type { CaptureSettings } from '@/config/constants';
import { runFocusAnalysis } from '@/perf/focusAnalysis';
import type { CapturedPhoto, ClosedLoopRetryReport, NormalizedPoint } from '@/types';

export type { ClosedLoopRetryReport };

type RetryCtx = {
  camera: CameraRef;
  photoOutput: CameraPhotoOutput;
  settings: CaptureSettings;
  nearPoint: NormalizedPoint;
  farPoint: NormalizedPoint;
  previewWidth: number;
  previewHeight: number;
  mark: (label: string) => void;
};

export async function applyClosedLoopRetries(
  ctx: RetryCtx,
  near: CapturedPhoto,
  far: CapturedPhoto,
  enabled: boolean,
): Promise<{ near: CapturedPhoto; far: CapturedPhoto; report: ClosedLoopRetryReport }> {
  if (!enabled) {
    return { near, far, report: { enabled: false, farRetried: false, nearRetried: false } };
  }
  const settle = ctx.settings.focusSettleMs;
  let workNear = near;
  let workFar = far;
  let farRetried = false;
  let nearRetried = false;
  const t0 = performance.now();

  const { table } = await runFocusAnalysis({
    nearUri: workNear.uri,
    farUri: workFar.uri,
    nearOrientation: workNear.orientation,
    farOrientation: workFar.orientation,
    nearPoint: ctx.nearPoint,
    farPoint: ctx.farPoint,
  });
  const plan = closedLoopRetryPlan(table);

  if (plan.retryFar) {
    farRetried = true;
    const farView = normalizedToView(ctx.farPoint, ctx.previewWidth, ctx.previewHeight);
    ctx.mark('retryFar_start');
    await focusThenSettle(
      ctx.camera,
      farView,
      ctx.settings.focusTimeoutMs,
      'far-retry',
      settle,
    );
    ctx.mark('retryFar_focus_end');
    ctx.mark('retryFar_photo_start');
    workFar = await captureFarPhoto(ctx.photoOutput, ctx.farPoint);
    ctx.mark('retryFar_photo_end');
    ctx.mark('retryFar_end');
  }

  const afterFar = await runFocusAnalysis({
    nearUri: workNear.uri,
    farUri: workFar.uri,
    nearOrientation: workNear.orientation,
    farOrientation: workFar.orientation,
    nearPoint: ctx.nearPoint,
    farPoint: ctx.farPoint,
  });
  const planNear = closedLoopRetryPlan(afterFar.table);

  if (planNear.retryNear) {
    nearRetried = true;
    const nearView = normalizedToView(ctx.nearPoint, ctx.previewWidth, ctx.previewHeight);
    ctx.mark('retryNear_start');
    await focusThenSettle(
      ctx.camera,
      nearView,
      ctx.settings.focusTimeoutMs,
      'near-retry',
      settle,
    );
    ctx.mark('retryNear_focus_end');
    ctx.mark('retryNear_photo_start');
    workNear = await captureNearPhoto(ctx.photoOutput, ctx.nearPoint);
    ctx.mark('retryNear_photo_end');
    ctx.mark('retryNear_end');
  }

  const retryTotalMs =
    farRetried || nearRetried ? Math.round(performance.now() - t0) : undefined;

  return {
    near: workNear,
    far: workFar,
    report: {
      enabled: true,
      farRetried,
      nearRetried,
      retryTotalMs,
    },
  };
}