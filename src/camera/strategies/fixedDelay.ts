import { maybeFocusFarBeforeShot1 } from '@/camera/focusBeforeShotA';
import { focusThenSettle } from '@/camera/focusMetering';
import { normalizedToView } from '@/camera/focusPoints';
import { captureFarPhoto, captureNearPhoto } from '@/camera/photoCapture';
import type { CaptureStrategy } from '@/camera/strategies/types';

/** S3: 背景フォーカス後に追加待ちを入れてから1枚目（背景）を撮る */
export const fixedDelayStrategy: CaptureStrategy = {
  id: 'S3',
  label: '固定遅延 (S3)',
  async run(ctx) {
    const settle = ctx.settings.focusSettleMs;
    const nearView = normalizedToView(ctx.nearPoint, ctx.previewWidth, ctx.previewHeight);
    const focusABeforeShot = await maybeFocusFarBeforeShot1(ctx);

    ctx.mark('delay_start');
    await new Promise((r) => setTimeout(r, ctx.settings.s3ExtraDelayMs));
    ctx.mark('delay_end');

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