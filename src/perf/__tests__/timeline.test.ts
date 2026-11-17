import { Timeline } from '@/perf/timeline';

describe('timeline', () => {
  it('区間時間を算出する', () => {
    const tl = new Timeline();
    tl.mark('a');
    tl.mark('b');
    const segs = tl.segmentDurations();
    expect(Object.keys(segs)).toContain('a→b');
    expect(segs['a→b']).toBeGreaterThanOrEqual(0);
  });
});