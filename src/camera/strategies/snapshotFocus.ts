import { maybeFocusFarBeforeShot1 } from '@/camera/focusBeforeShotA';
import { focusThenSettle } from '@/camera/focusMetering';
import { normalizedToView } from '@/camera/focusPoints';
import { captureSnapshotToUri } from '@/camera/snapshotToUri';
import type { CaptureStrategy } from '@/camera/strategies/types';

export const snapshotFocusStrategy: CaptureStrategy = {
  id: 'S2',
  label: 'スナップショット (S2)',
  async run(ctx) {
    const settle = ctx.settings.focusSettleMs;
    const nearView = normalizedToView(ctx.nearPoint, ctx.previewWidth, ctx.previewHeight);
    const focusABeforeShot = await maybeFocusFarBeforeShot1(ctx);

    ctx.mark('photoA_start');
    const far = await captureSnapshotToUri(ctx.camera, ctx.farPoint, 'FAR');
    ctx.mark('photoA_end');

    ctx.mark('focusB_start');
    await focusThenSettle(ctx.camera, nearView, ctx.settings.focusTimeoutMs, 'near', settle);
    ctx.mark('focusB_end');

    ctx.mark('photoB_start');
    const near = await captureSnapshotToUri(ctx.camera, ctx.nearPoint, 'NEAR');
    ctx.mark('photoB_end');

    return { near, far, focusABeforeShot };
  },
};