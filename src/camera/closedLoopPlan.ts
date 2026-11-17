import { CLOSED_LOOP_CAPTURE_K } from '@/config/constants';
import type { FocusSharpnessTable } from '@/perf/focusVerify';

export function closedLoopRetryPlan(
  table: FocusSharpnessTable,
  k = CLOSED_LOOP_CAPTURE_K,
): { retryFar: boolean; retryNear: boolean } {
  const subjectOk = table.atSubjectPoint.near > table.atSubjectPoint.far * k;
  const bgOk = table.atBackgroundPoint.far > table.atBackgroundPoint.near * k;
  return { retryFar: !bgOk, retryNear: !subjectOk };
}