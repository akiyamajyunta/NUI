import { captureFarPhoto, captureNearPhoto } from '@/camera/photoCapture';
import { runOrderedTwoShots } from '@/camera/twoShotCapture';
import type { CaptureStrategy } from '@/camera/strategies/types';

/** NEAR/FAR の役割は固定。撮影順は設定で入れ替え */
export const sequentialFocusStrategy: CaptureStrategy = {
  id: 'S1',
  label: '連続フォーカス (S1)',
  async run(ctx) {
    return runOrderedTwoShots(ctx, {
      captureFar: () => captureFarPhoto(ctx.photoOutput, ctx.farPoint),
      captureNear: () => captureNearPhoto(ctx.photoOutput, ctx.nearPoint),
    });
  },
};