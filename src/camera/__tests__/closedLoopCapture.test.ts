import { closedLoopRetryPlan } from '@/camera/closedLoopPlan';
import { CLOSED_LOOP_CAPTURE_K } from '@/config/constants';

describe('closedLoopRetryPlan', () => {
  it('背景・被写体とも k 倍を満たせば再撮なし', () => {
    const plan = closedLoopRetryPlan(
      {
        atSubjectPoint: { near: 0.05, far: 0.02 },
        atBackgroundPoint: { near: 0.01, far: 0.04 },
      },
      CLOSED_LOOP_CAPTURE_K,
    );
    expect(plan.retryFar).toBe(false);
    expect(plan.retryNear).toBe(false);
  });

  it('FAR 背景が弱ければ FAR 再撮', () => {
    const plan = closedLoopRetryPlan(
      {
        atSubjectPoint: { near: 0.05, far: 0.02 },
        atBackgroundPoint: { near: 0.02, far: 0.025 },
      },
      1.3,
    );
    expect(plan.retryFar).toBe(true);
  });
});