import type { TimelineMark } from '@/types';

export function segmentMs(marks: readonly TimelineMark[], from: string, to: string): number | undefined {
  const a = marks.find((m) => m.label === from);
  const b = marks.find((m) => m.label === to);
  if (!a || !b) return undefined;
  return b.t - a.t;
}

export function hasMark(marks: readonly TimelineMark[], label: string): boolean {
  return marks.some((m) => m.label === label);
}

export type FocusSegmentReport = {
  executed: boolean;
  ms?: number;
};

export type RetrySegmentReport = {
  executed: boolean;
  ms?: number;
};

export type CaptureSegmentTimings = {
  focusA: FocusSegmentReport;
  photoA?: number;
  focusB: FocusSegmentReport;
  delay?: number;
  photoB?: number;
  retryFar?: RetrySegmentReport;
  retryNear?: RetrySegmentReport;
};

export function captureSegments(marks: readonly TimelineMark[]): CaptureSegmentTimings {
  const focusAExecuted =
    hasMark(marks, 'focusA_start') && hasMark(marks, 'focusA_end');
  const focusBExecuted =
    hasMark(marks, 'focusB_start') && hasMark(marks, 'focusB_end');
  const retryFarExecuted =
    hasMark(marks, 'retryFar_start') && hasMark(marks, 'retryFar_end');
  const retryNearExecuted =
    hasMark(marks, 'retryNear_start') && hasMark(marks, 'retryNear_end');
  return {
    focusA: {
      executed: focusAExecuted,
      ms: focusAExecuted ? segmentMs(marks, 'focusA_start', 'focusA_end') : undefined,
    },
    photoA: segmentMs(marks, 'photoA_start', 'photoA_end'),
    focusB: {
      executed: focusBExecuted,
      ms: focusBExecuted ? segmentMs(marks, 'focusB_start', 'focusB_end') : undefined,
    },
    photoB: segmentMs(marks, 'photoB_start', 'photoB_end'),
    delay: segmentMs(marks, 'delay_start', 'delay_end'),
    retryFar: {
      executed: retryFarExecuted,
      ms: retryFarExecuted ? segmentMs(marks, 'retryFar_start', 'retryFar_end') : undefined,
    },
    retryNear: {
      executed: retryNearExecuted,
      ms: retryNearExecuted ? segmentMs(marks, 'retryNear_start', 'retryNear_end') : undefined,
    },
  };
}