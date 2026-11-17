import { computeStats, percentile } from '@/perf/stats';

describe('stats', () => {
  it('percentile', () => {
    const sorted = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(percentile(sorted, 0.5)).toBeCloseTo(5.5, 5);
    expect(percentile(sorted, 0.9)).toBeCloseTo(9.1, 5);
  });

  it('computeStats', () => {
    const s = computeStats([10, 20, 30, 100]);
    expect(s.min).toBe(10);
    expect(s.max).toBe(100);
    expect(s.mean).toBe(40);
    expect(s.median).toBe(25);
  });

  it('空配列', () => {
    const s = computeStats([]);
    expect(s.median).toBe(0);
  });
});