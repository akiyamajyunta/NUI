export const MASK_SKSL = `
uniform shader sharpNear;
uniform shader sharpFar;
uniform float threshold;
uniform float nearBias;
uniform float haloShrink;

half4 main(float2 coord) {
  half sn = sharpNear.eval(coord).r;
  half sf = sharpFar.eval(coord).r;
  float d = (sn - sf) + nearBias - haloShrink;
  half m = smoothstep(-threshold, threshold, d);
  float low = max(sn, sf);
  if (low < 0.01) {
    m = 0.5;
  }
  return half4(m, m, m, 1.0);
}
`;