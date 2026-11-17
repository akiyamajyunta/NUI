import type { CameraRef, FocusOptions } from 'react-native-vision-camera';
import { FOCUS_SETTLE_MS } from '@/config/constants';

const CAPTURE_FOCUS_OPTIONS: FocusOptions = {
  responsiveness: 'snappy',
  adaptiveness: 'locked',
  modes: ['AF'],
  autoResetAfter: null,
};

export async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`FOCUS_TIMEOUT:${label}`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** タップ焦点を合わせ、レンズ安定の短い待ちを入れる */
export async function focusThenSettle(
  camera: CameraRef,
  view: { x: number; y: number },
  timeoutMs: number,
  label: string,
): Promise<void> {
  await withTimeout(camera.focusTo(view, CAPTURE_FOCUS_OPTIONS), timeoutMs, label);
  if (FOCUS_SETTLE_MS > 0) {
    await new Promise((r) => setTimeout(r, FOCUS_SETTLE_MS));
  }
}

export function mapCaptureError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes('FOCUS_TIMEOUT')) {
    return 'ピント合わせに失敗しました。再試行してください。';
  }
  if (msg.includes('Photo Output is not yet attached') || msg.includes('ImageCapture')) {
    return 'カメラの準備が完了していません。少し待ってから再試行してください。';
  }
  if (msg.includes('Camera is not yet ready') || msg.includes('Preview is not yet ready')) {
    return 'カメラプレビューの準備中です。画面を開き直してから撮影してください。';
  }
  return msg || '撮影に失敗しました';
}