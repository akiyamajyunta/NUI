import { focusThenSettle } from '@/camera/focusMetering';
import { normalizedToView } from '@/camera/focusPoints';
import { captureSnapshotToUri } from '@/camera/snapshotToUri';
import type { CaptureStrategy } from '@/camera/strategies/types';

export const snapshotFocusStrategy: CaptureStrategy = {
  id: 'S2',
  label: 'スナップショット (S2)',
  async run(ctx) {
    const nearView = normalizedToView(ctx.nearPoint, ctx.previewWidth, ctx.previewHeight);
    const farView = normalizedToView(ctx.farPoint, ctx.previewWidth, ctx.previewHeight);

    if (ctx.settings.refocusBeforeFirst || ctx.focusedOnNear) {
      ctx.mark('focusA_start');
      await focusThenSettle(ctx.camera, farView, ctx.settings.focusTimeoutMs, 'far');
      ctx.mark('focusA_end');
    }

    ctx.mark('photoA_start');
    const far = await captureSnapshotToUri(ctx.camera, ctx.farPoint, 'FAR');
    ctx.mark('photoA_end');

    ctx.mark('focusB_start');
    await focusThenSettle(ctx.camera, nearView, ctx.settings.focusTimeoutMs, 'near');
    ctx.mark('focusB_end');

    ctx.mark('photoB_start');
    const near = await captureSnapshotToUri(ctx.camera, ctx.nearPoint, 'NEAR');
    ctx.mark('photoB_end');

    return { near, far };
  },
};