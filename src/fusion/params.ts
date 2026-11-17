import { DEFAULT_FUSION_PARAMS } from '@/config/constants';
import type { FusionParams } from '@/types';

export function defaultFusionParams(): FusionParams {
  return { ...DEFAULT_FUSION_PARAMS };
}

export function resetFusionParams(base?: FusionParams): FusionParams {
  return base ? { ...base } : defaultFusionParams();
}