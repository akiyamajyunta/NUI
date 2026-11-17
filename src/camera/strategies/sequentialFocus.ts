import { maybeFocusFarBeforeShot1 } from '@/camera/focusBeforeShotA';
import { focusThenSettle } from '@/camera/focusMetering';
import { normalizedToView } from '@/camera/focusPoints';
import { captureFarPhoto, captureNearPhoto } from '@/camera/photoCapture';
import type { CaptureStrategy } from '@/camera/strategies/types';

/** 1枚目=FAR（背景）、2枚目=NEAR（ぬい） */
export const sequentialFocusStrategy: CaptureStrategy = {
  id: 'S1',
  label: '連続フォーカス (S1)',
  async run(ctx) {
    const settle = ctx.settings.focusSettleMs;
    const nearView = normalizedToView(ctx.nearPoint, ctx.previewWidth, ctx.previewHeight);
    const focusABeforeShot = await maybeFocusFarBeforeShot1(ctx);

    ctx.mark('photoA_start');
    const far = await captureFarPhoto(ctx.photoOutput, ctx.farPoint);
    ctx.mark('photoA_end');

    ctx.mark('focusB_start');
    await focusThenSettle(ctx.camera, nearView, ctx.settings.focusTimeoutMs, 'near', settle);
    ctx.mark('focusB_end');

    ctx.mark('photoB_start');
    const near = await captureNearPhoto(ctx.photoOutput, ctx.nearPoint);
    ctx.mark('photoB_end');

    return { near, far, focusABeforeShot };
  },
};