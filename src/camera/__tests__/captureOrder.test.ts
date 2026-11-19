import { captureShotPlan, shot1FocusTarget } from '@/camera/captureOrder';
import { decideFocusBeforeShot1 } from '@/camera/smartFocusBeforeShot';
import { DEFAULT_CAPTURE_SETTINGS } from '@/config/constants';

describe('captureOrder', () => {
  it('ぬい→背景でも NEAR/FAR の役割は撮影順だけ入れ替え', () => {
    const plan = captureShotPlan('near_then_far');
    expect(plan.shot1Role).toBe('near');
    expect(plan.shot2Role).toBe('far');
    expect(plan.shot1Label).toContain('NEAR');
    expect(plan.shot2Label).toContain('FAR');
    expect(shot1FocusTarget('near_then_far')).toBe('subject');
    expect(shot1FocusTarget('far_then_near')).toBe('background');
  });
});

describe('decideFocusBeforeShot1（ぬい→背景）', () => {
  const NOW = 50_000_000;
  const settings = { ...DEFAULT_CAPTURE_SETTINGS, captureOrder: 'near_then_far' as const };
  const shot1Target = shot1FocusTarget(settings.captureOrder);

  it('撮影1がぬい点で、直近もぬいなら fresh / stale を判定', () => {
    const fresh = decideFocusBeforeShot1(
      settings,
      { lastTarget: 'subject', lastAtMs: NOW - 500 },
      shot1Target,
      NOW,
    );
    expect(fresh.run).toBe(false);
    expect(fresh.reason).toBe('fresh');

    const stale = decideFocusBeforeShot1(
      settings,
      { lastTarget: 'subject', lastAtMs: NOW - settings.focusFreshMaxMs },
      shot1Target,
      NOW,
    );
    expect(stale.run).toBe(true);
    expect(stale.reason).toBe('stale');
  });
});