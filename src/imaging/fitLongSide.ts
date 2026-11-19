/** 長辺を targetLongSide に合わせた出力サイズ */
export function fitLongSide(
  width: number,
  height: number,
  targetLongSide: number,
): { width: number; height: number } {
  const long = Math.max(width, height);
  if (long <= targetLongSide) return { width, height };
  const scale = targetLongSide / long;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}
