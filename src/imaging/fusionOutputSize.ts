import { MAX_TEXTURE_LONG_SIDE } from '@/config/constants';
import { fitLongSide } from '@/imaging/fitLongSide';

/**
 * fuse の出力寸法。入力は Skia が EXIF を適用したあとの幅・高さ。
 * outputLongSide を省略すると長辺 4096 まで。プレビューは 1024 を渡す。
 * 向きによる幅高さの入れ替えはしない。
 */
export function fusionPixelSize(
  width: number,
  height: number,
  outputLongSide?: number,
): { width: number; height: number } {
  const maxLong = outputLongSide ?? Math.max(width, height);
  return fitLongSide(width, height, Math.min(maxLong, MAX_TEXTURE_LONG_SIDE));
}
