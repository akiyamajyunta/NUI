/** Skia SkCubicResampler::CatmullRom。Mitchell (1/3, 1/3) よりエッジを残す */
export const FAR_CATMULL_B = 0;
export const FAR_CATMULL_C = 0.5;

/** この範囲は等倍とみなし、補間せず最近傍で読む */
export const FAR_NEAREST_SCALE_EPS = 0.001;

export function farUsesNearestSample(scale: number): boolean {
  return Math.abs(scale - 1) <= FAR_NEAREST_SCALE_EPS;
}
