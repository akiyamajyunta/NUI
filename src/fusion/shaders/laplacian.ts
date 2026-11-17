export const LAPLACIAN_SKSL = `
uniform shader image;
uniform float texelX;
uniform float texelY;

half luminance(half3 c) {
  return dot(c, half3(0.299, 0.587, 0.114));
}

half4 main(float2 coord) {
  half c = luminance(image.eval(coord).rgb);
  half l = luminance(image.eval(coord - float2(texelX, 0.0)).rgb);
  half r = luminance(image.eval(coord + float2(texelX, 0.0)).rgb);
  half t = luminance(image.eval(coord - float2(0.0, texelY)).rgb);
  half b = luminance(image.eval(coord + float2(0.0, texelY)).rgb);
  half lap = abs(4.0 * c - l - r - t - b);
  return half4(lap, lap, lap, 1.0);
}
`;