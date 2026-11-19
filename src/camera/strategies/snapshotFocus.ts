import { captureSnapshotToUri } from '@/camera/snapshotToUri';
import { runOrderedTwoShots } from '@/camera/twoShotCapture';
import type { CaptureStrategy } from '@/camera/strategies/types';

export const snapshotFocusStrategy: CaptureStrategy = {
  id: 'S2',
  label: 'スナップショット (S2)',
  async run(ctx) {
    return runOrderedTwoShots(ctx, {
      captureFar: () => captureSnapshotToUri(ctx.camera, ctx.farPoint, 'FAR'),
      captureNear: () => captureSnapshotToUri(ctx.camera, ctx.nearPoint, 'NEAR'),
    });
  },
};