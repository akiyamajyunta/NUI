import { focusThenSettle } from '@/camera/focusMetering';
import { normalizedToView } from '@/camera/focusPoints';
import type { CaptureStrategyContext } from '@/camera/strategies/types';
import { decideFocusBeforeShotA } from '@/camera/smartFocusBeforeShot';
import type { FocusABeforeShotReport } from '@/types';

export async function maybeFocusFarBeforeShot1(
  ctx: CaptureStrategyContext,
): Promise<FocusABeforeShotReport> {
  const decision = decideFocusBeforeShotA(ctx.settings, ctx.focusSession);
  const base = {
    reason: decision.reason,
    lastFocusTarget: decision.lastTarget,
    elapsedSinceFocusMs: Math.round(decision.elapsedMs),
  };
  if (!decision.run) {
    ctx.mark('focusA_skipped');
    return { executed: false, ...base };
  }
  const farView = normalizedToView(ctx.farPoint, ctx.previewWidth, ctx.previewHeight);
  ctx.mark('focusA_start');
  await focusThenSettle(
    ctx.camera,
    farView,
    ctx.settings.focusTimeoutMs,
    'far',
    ctx.settings.focusSettleMs,
  );
  ctx.mark('focusA_end');
  return { executed: true, ...base };
}