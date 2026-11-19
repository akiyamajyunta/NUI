import type { FocusTarget } from '@/camera/smartFocusBeforeShot';
import type { CaptureOrder } from '@/config/constants';

export function captureOrderLabel(order: CaptureOrder): string {
  return order === 'far_then_near' ? '背景→ぬい' : 'ぬい→背景';
}

export function shot1FocusTarget(order: CaptureOrder): FocusTarget {
  return order === 'near_then_far' ? 'subject' : 'background';
}

export type CaptureShotPlan = {
  shot1Label: string;
  shot2Label: string;
  shot1Role: 'near' | 'far';
  shot2Role: 'near' | 'far';
};

export function captureShotPlan(order: CaptureOrder): CaptureShotPlan {
  if (order === 'near_then_far') {
    return {
      shot1Label: 'ぬい（NEAR）',
      shot2Label: '背景（FAR）',
      shot1Role: 'near',
      shot2Role: 'far',
    };
  }
  return {
    shot1Label: '背景（FAR）',
    shot2Label: 'ぬい（NEAR）',
    shot1Role: 'far',
    shot2Role: 'near',
  };
}