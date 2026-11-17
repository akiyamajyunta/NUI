export type DescriptiveStats = {
  min: number;
  max: number;
  mean: number;
  median: number;
  p90: number;
};

function sortedCopy(values: number[]): number[] {
  return [...values].sort((a, b) => a - b);
}

export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (sorted.length - 1) * p;
  const low = Math.floor(idx);
  const high = Math.ceil(idx);
  if (low === high) return sorted[low];
  const w = idx - low;
  return sorted[low] * (1 - w) + sorted[high] * w;
}

export function computeStats(values: number[]): DescriptiveStats {
  if (values.length === 0) {
    return { min: 0, max: 0, mean: 0, median: 0, p90: 0 };
  }
  const sorted = sortedCopy(values);
  const sum = values.reduce((a, b) => a + b, 0);
  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    mean: sum / values.length,
    median: percentile(sorted, 0.5),
    p90: percentile(sorted, 0.9),
  };
}