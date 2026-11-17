import type { TimelineMark } from '@/types';

export function segmentMs(marks: readonly TimelineMark[], from: string, to: string): number | undefined {
  const a = marks.find((m) => m.label === from);
  const b = marks.find((m) => m.label === to);
  if (!a || !b) return undefined;
  return b.t - a.t;
}

export type CaptureSegmentTimings = {
  focusA?: number;
  photoA?: number;
  focusB?: number;
  delay?: number;
  photoB?: number;
};

export function captureSegments(marks: readonly TimelineMark[]): CaptureSegmentTimings {
  return {
    focusA: segmentMs(marks, 'focusA_start', 'focusA_end'),
    photoA: segmentMs(marks, 'photoA_start', 'photoA_end'),
    focusB: segmentMs(marks, 'focusB_start', 'focusB_end'),
    photoB: segmentMs(marks, 'photoB_start', 'photoB_end'),
    delay: segmentMs(marks, 'delay_start', 'delay_end'),
  };
}