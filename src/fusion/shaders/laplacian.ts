/**
 * 3x3 ラプラシアンの絶対値。座標はピクセル単位なので、隣接画素は ±1.0 で参照する。
 * 出力は sqrt(lap / lapMax)（8bit での階調確保。復号は maskCore.decodeSharpness）。
 */
export const LAPLACIAN_SKSL = `
uniform shader image;
uniform float lapMax;

half luminance(half3 c) {
  return dot(c, half3(0.299, 0.587, 0.114));
}

half4 main(float2 coord) {
  float c = luminance(image.eval(coord).rgb);
  float l = luminance(image.eval(coord - float2(1.0, 0.0)).rgb);
  float r = luminance(image.eval(coord + float2(1.0, 0.0)).rgb);
  float t = luminance(image.eval(coord - float2(0.0, 1.0)).rgb);
  float b = luminance(image.eval(coord + float2(0.0, 1.0)).rgb);
  float lap = abs(4.0 * c - l - r - t - b);
  float enc = sqrt(clamp(lap / lapMax, 0.0, 1.0));
  return half4(enc, enc, enc, 1.0);
}
`;
