export type ColorCorrection = {
  gain: [number, number, number];
  bias: [number, number, number];
};

export const IDENTITY_COLOR: ColorCorrection = {
  gain: [1, 1, 1],
  bias: [0, 0, 0],
};

export function clampGain(g: number, min = 0.8, max = 1.25): number {
  return Math.min(max, Math.max(min, g));
}

/** チャンネル平均から簡易なゲイン・バイアス（M5 本格版のプレースホルダ） */
export function colorCorrectionFromMeans(
  meanNear: [number, number, number],
  meanFar: [number, number, number],
): ColorCorrection {
  const gain: [number, number, number] = [1, 1, 1];
  const bias: [number, number, number] = [0, 0, 0];
  for (let c = 0; c < 3; c += 1) {
    const f = meanFar[c] || 1e-3;
    const g = clampGain(meanNear[c] / f);
    gain[c] = g;
    bias[c] = meanNear[c] - meanFar[c] * g;
  }
  return { gain, bias };
}