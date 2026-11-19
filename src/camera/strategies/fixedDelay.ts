import { captureFarPhoto, captureNearPhoto } from '@/camera/photoCapture';
import { runOrderedTwoShots } from '@/camera/twoShotCapture';
import type { CaptureStrategy } from '@/camera/strategies/types';

/** S3: 撮影1前の待ちを追加 */
export const fixedDelayStrategy: CaptureStrategy = {
  id: 'S3',
  label: '固定遅延 (S3)',
  async run(ctx) {
    return runOrderedTwoShots(
      ctx,
      {
        captureFar: () => captureFarPhoto(ctx.photoOutput, ctx.farPoint),
        captureNear: () => captureNearPhoto(ctx.photoOutput, ctx.nearPoint),
      },
      () => new Promise((r) => setTimeout(r, ctx.settings.s3ExtraDelayMs)),
    );
  },
};