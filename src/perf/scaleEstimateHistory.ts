const TRUSTWORTHY_HISTORY: number[] = [];
const MAX_TRUSTWORTHY = 5;

export function pushTrustworthyScale(scale: number): void {
  TRUSTWORTHY_HISTORY.push(scale);
  while (TRUSTWORTHY_HISTORY.length > MAX_TRUSTWORTHY) {
    TRUSTWORTHY_HISTORY.shift();
  }
}

export function medianRecentTrustworthyScales(): number | null {
  if (TRUSTWORTHY_HISTORY.length === 0) return null;
  const sorted = [...TRUSTWORTHY_HISTORY].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

/** @internal テスト用 */
export function clearScaleEstimateHistoryForTests(): void {
  TRUSTWORTHY_HISTORY.length = 0;
}