import { captureShotPlan } from '@/camera/captureOrder';
import { maybeFocusBeforeShot1 } from '@/camera/focusBeforeShotA';
import { focusThenSettle } from '@/camera/focusMetering';
import { normalizedToView } from '@/camera/focusPoints';
import type { CaptureStrategyContext } from '@/camera/strategies/types';
import type { CapturedPhoto, FocusABeforeShotReport } from '@/types';

type ShotCapturers = {
  captureNear: () => Promise<CapturedPhoto>;
  captureFar: () => Promise<CapturedPhoto>;
};

export async function runOrderedTwoShots(
  ctx: CaptureStrategyContext,
  capturers: ShotCapturers,
  beforeShot1?: () => Promise<void>,
): Promise<{ near: CapturedPhoto; far: CapturedPhoto; focusABeforeShot: FocusABeforeShotReport }> {
  const plan = captureShotPlan(ctx.settings.captureOrder);
  const settle = ctx.settings.focusSettleMs;
  const focusABeforeShot = await maybeFocusBeforeShot1(ctx);

  if (beforeShot1) {
    ctx.mark('delay_start');
    await beforeShot1();
    ctx.mark('delay_end');
  }

  const focusShot2 = async (role: 'near' | 'far') => {
    const point = role === 'near' ? ctx.nearPoint : ctx.farPoint;
    const view = normalizedToView(point, ctx.previewWidth, ctx.previewHeight);
    ctx.mark('focusB_start');
    await focusThenSettle(ctx.camera, view, ctx.settings.focusTimeoutMs, role, settle);
    ctx.mark('focusB_end');
  };

  if (plan.shot1Role === 'far') {
    ctx.mark('photoA_start');
    const far = await capturers.captureFar();
    ctx.mark('photoA_end');
    await focusShot2('near');
    ctx.mark('photoB_start');
    const near = await capturers.captureNear();
    ctx.mark('photoB_end');
    return { near, far, focusABeforeShot };
  }

  ctx.mark('photoA_start');
  const near = await capturers.captureNear();
  ctx.mark('photoA_end');
  await focusShot2('far');
  ctx.mark('photoB_start');
  const far = await capturers.captureFar();
  ctx.mark('photoB_end');
  return { near, far, focusABeforeShot };
}