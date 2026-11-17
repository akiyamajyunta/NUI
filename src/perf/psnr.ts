export function computePsnr(ref: Float32Array, test: Float32Array): number {
  if (ref.length !== test.length || ref.length === 0) return 0;
  let mse = 0;
  for (let i = 0; i < ref.length; i += 1) {
    const d = ref[i] - test[i];
    mse += d * d;
  }
  mse /= ref.length;
  if (mse < 1e-10) return 99;
  return 10 * Math.log10(1 / mse);
}