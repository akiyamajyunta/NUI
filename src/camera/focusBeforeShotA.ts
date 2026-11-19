import { focusThenSettle } from '@/camera/focusMetering';
import { normalizedToView } from '@/camera/focusPoints';
import type { CaptureStrategyContext } from '@/camera/strategies/types';
import { shot1FocusTarget } from '@/camera/captureOrder';
import { decideFocusBeforeShot1 } from '@/camera/smartFocusBeforeShot';
import type { FocusABeforeShotReport } from '@/types';

export async function maybeFocusBeforeShot1(
  ctx: CaptureStrategyContext,
): Promise<FocusABeforeShotReport> {
  const shot1Target = shot1FocusTarget(ctx.settings.captureOrder);
  const decision = decideFocusBeforeShot1(ctx.settings, ctx.focusSession, shot1Target);
  const base = {
    reason: decision.reason,
    lastFocusTarget: decision.lastTarget,
    elapsedSinceFocusMs: Math.round(decision.elapsedMs),
    shot1Target: shot1Target === 'none' ? undefined : shot1Target,
    focusFreshMaxMs: ctx.settings.focusFreshMaxMs,
  };
  if (!decision.run) {
    ctx.mark('focusA_skipped');
    return { executed: false, ...base };
  }
  const point = shot1Target === 'subject' ? ctx.nearPoint : ctx.farPoint;
  const view = normalizedToView(point, ctx.previewWidth, ctx.previewHeight);
  ctx.mark('focusA_start');
  await focusThenSettle(
    ctx.camera,
    view,
    ctx.settings.focusTimeoutMs,
    shot1Target === 'subject' ? 'near' : 'far',
    ctx.settings.focusSettleMs,
  );
  ctx.mark('focusA_end');
  return { executed: true, ...base };
}

/** @deprecated `maybeFocusBeforeShot1` を使用 */
export async function maybeFocusFarBeforeShot1(
  ctx: CaptureStrategyContext,
): Promise<FocusABeforeShotReport> {
  return maybeFocusBeforeShot1(ctx);
}