import { ALIGN_LONG_SIDE } from '@/config/constants';

/** 位置合わせコストの静的見積（修正は行わない） */
export function describeAlignSearchCost(params?: {
  searchRange?: number;
  analysisLongSide?: number;
}): string {
  const range = params?.searchRange ?? 8;
  const long = params?.analysisLongSide ?? ALIGN_LONG_SIDE;
  const short = Math.round((long * 3) / 4);
  const candidates = (range * 2 + 1) ** 2;
  const innerW = Math.max(1, long - 2);
  const innerH = Math.max(1, short - 2);
  const sadOpsPerCandidate = innerW * innerH;
  const totalSadOps = candidates * sadOpsPerCandidate;
  return (
    `alignNearFar: 長辺${long}px（4:3想定で約${long}×${short}）のSobel→SAD全域探索 ` +
    `±${range}px → ${candidates}候補×内側${innerW}×${innerH}≈${totalSadOps}回の |ref-tgt| 加算/候補（JS二重ループ）。` +
    `加えて readPixels×2・グレースケール変換。≈1.8s はこの探索量が主因（粗い/細い2段階やGPU化は未実装）。`
  );
}

/** 256px探索の1ステップがフル解像度で何px相当か（サブピクセル要否の目安） */
export function alignOutputStepPx(fullLongSide: number, analysisLong = ALIGN_LONG_SIDE): number {
  return fullLongSide / analysisLong;
}

export function formatAlignSubpixelNote(fullLongSide: number): string {
  const step = alignOutputStepPx(fullLongSide);
  return (
    `探索1px@長辺${ALIGN_LONG_SIDE} → 出力長辺${Math.round(fullLongSide)}で約${step.toFixed(2)}px/step。` +
    (step >= 2
      ? '整数ステップのみのためサブピクセル補間（端数オフセット・二次探索）の検討余地あり。'
      : 'step≈1px未満のため現状の整数探索でも粗さは小さい。')
  );
}