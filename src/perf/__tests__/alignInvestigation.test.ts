import { alignOutputStepPx, describeAlignSearchCost, formatAlignSubpixelNote } from '@/perf/alignInvestigation';

describe('alignInvestigation', () => {
  it('フル解像度での step が約7.5', () => {
    expect(alignOutputStepPx(1920)).toBeCloseTo(7.5);
    expect(formatAlignSubpixelNote(1920)).toContain('7.50');
  });

  it('コスト説明に候補数を含む', () => {
    expect(describeAlignSearchCost()).toMatch(/289候補/);
  });
});