import { normalizedToView, viewToNormalized } from '@/camera/focusPoints';

describe('focusPoints', () => {
  it('往復変換', () => {
    const n = viewToNormalized(180, 400, 360, 800);
    const v = normalizedToView(n, 360, 800);
    expect(v.x).toBeCloseTo(180);
    expect(v.y).toBeCloseTo(400);
  });
});