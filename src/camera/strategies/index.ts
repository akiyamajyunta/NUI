import { fixedDelayStrategy } from '@/camera/strategies/fixedDelay';
import { sequentialFocusStrategy } from '@/camera/strategies/sequentialFocus';
import { snapshotFocusStrategy } from '@/camera/strategies/snapshotFocus';
import type { CaptureStrategy } from '@/camera/strategies/types';
import type { CaptureStrategyId } from '@/config/constants';

const REGISTRY: Record<CaptureStrategyId, CaptureStrategy> = {
  S1: sequentialFocusStrategy,
  S2: snapshotFocusStrategy,
  S3: fixedDelayStrategy,
};

export function getCaptureStrategy(id: CaptureStrategyId): CaptureStrategy {
  return REGISTRY[id] ?? sequentialFocusStrategy;
}