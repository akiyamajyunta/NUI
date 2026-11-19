export const BLEND_SKSL = `
uniform shader imgNear;
uniform shader imgFar;
uniform shader maskImg;
uniform float farDx;
uniform float farDy;
uniform float farScale;
uniform float farCenterX;
uniform float farCenterY;
uniform float maskScaleX;
uniform float maskScaleY;
uniform half3 colorGain;
uniform half3 colorBias;

half4 main(float2 coord) {
  half4 n = imgNear.eval(coord);
  float2 center = float2(farCenterX, farCenterY);
  float2 src = (coord - center) / farScale + center + float2(farDx, farDy);
  half4 f = imgFar.eval(src);
  f.rgb = clamp(f.rgb * colorGain + colorBias, 0.0, 1.0);
  half m = maskImg.eval(coord * float2(maskScaleX, maskScaleY)).r;
  return mix(f, n, m);
}
`;