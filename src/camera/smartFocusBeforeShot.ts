import type { CaptureSettings } from '@/config/constants';

export type FocusTarget = 'subject' | 'background' | 'none';

export type FocusSessionSnapshot = {
  lastTarget: FocusTarget;
  lastAtMs: number;
};

/** 撮影1前フォーカスをスキップした理由（fresh＝実行不要） */
export type FocusABeforeShotReason =
  | 'forced'
  | 'not_shot1_target'
  | 'stale'
  | 'fresh';

export type FocusABeforeShotDecision = {
  run: boolean;
  reason: FocusABeforeShotReason;
  lastTarget: FocusTarget;
  elapsedMs: number;
};

export function decideFocusBeforeShot1(
  settings: CaptureSettings,
  session: FocusSessionSnapshot,
  shot1Target: FocusTarget,
  nowMs = Date.now(),
): FocusABeforeShotDecision {
  const elapsedMs = session.lastAtMs > 0 ? Math.max(0, nowMs - session.lastAtMs) : Number.POSITIVE_INFINITY;
  const lastTarget = session.lastTarget;
  if (settings.refocusBeforeFirst) {
    return { run: true, reason: 'forced', lastTarget, elapsedMs: Number.isFinite(elapsedMs) ? elapsedMs : 0 };
  }
  if (lastTarget !== shot1Target) {
    return {
      run: true,
      reason: 'not_shot1_target',
      lastTarget,
      elapsedMs: Number.isFinite(elapsedMs) ? elapsedMs : 0,
    };
  }
  if (elapsedMs >= settings.focusFreshMaxMs) {
    return { run: true, reason: 'stale', lastTarget, elapsedMs };
  }
  return { run: false, reason: 'fresh', lastTarget, elapsedMs };
}

/** @deprecated 互換用。`decideFocusBeforeShot1` を使用 */
export function decideFocusBeforeShotA(
  settings: CaptureSettings,
  session: FocusSessionSnapshot,
  nowMs = Date.now(),
): FocusABeforeShotDecision {
  return decideFocusBeforeShot1(settings, session, 'background', nowMs);
}