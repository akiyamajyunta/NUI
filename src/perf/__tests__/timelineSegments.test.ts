import { captureSegments } from '@/perf/timelineSegments';

describe('captureSegments', () => {
  it('フォーカス実行有無を含む', () => {
    const marks = [
      { label: 'focusA_skipped', t: 0 },
      { label: 'photoA_start', t: 1 },
      { label: 'photoA_end', t: 50 },
      { label: 'focusB_start', t: 51 },
      { label: 'focusB_end', t: 120 },
    ];
    const s = captureSegments(marks);
    expect(s.focusA.executed).toBe(false);
    expect(s.focusB.executed).toBe(true);
    expect(s.focusB.ms).toBe(69);
  });
});