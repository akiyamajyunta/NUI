/**
 * マスク生成（2 パス）。式は maskCore.ts の CPU 実装と同じにすること。
 *
 * パス1（MASK_RAW_SKSL）: 鮮鋭度マップから、正規化差による判定 m0 と、テクスチャの確からしさ c を出す。
 *   出力 R = m0 * c、G = c、B = m0。
 * パス2（MASK_FILL_SKSL）: パス1を広い半径でぼかした画像から、低テクスチャ領域の値を補う。
 */
export const MASK_RAW_SKSL = `
uniform shader sharpNear;
uniform shader sharpFar;
uniform float threshold;
uniform float nearBias;
uniform float haloShrink;
uniform float eps;
uniform float texLo;
uniform float texHi;
uniform float lapMax;

half4 main(float2 coord) {
  float en = sharpNear.eval(coord).r;
  float ef = sharpFar.eval(coord).r;
  float sn = en * en * lapMax;
  float sf = ef * ef * lapMax;
  float sum = sn + sf;
  float d = (sn - sf) / (sum + eps);
  float m0 = smoothstep(-threshold, threshold, d + nearBias - haloShrink);
  float c = smoothstep(texLo, texHi, sum);
  return half4(m0 * c, c, m0, 1.0);
}
`;

export const MASK_FILL_SKSL = `
uniform shader rawMask;
uniform shader wideMask;
uniform float fillPrior;
uniform float fillFallback;

half4 main(float2 coord) {
  half4 raw = rawMask.eval(coord);
  half4 wide = wideMask.eval(coord);
  float c = raw.g;
  float m0 = raw.b;
  float fill = (wide.r + fillPrior * fillFallback) / (wide.g + fillPrior);
  fill = smoothstep(0.25, 0.75, fill);
  float m = mix(fill, m0, c);
  return half4(m, m, m, 1.0);
}
`;
