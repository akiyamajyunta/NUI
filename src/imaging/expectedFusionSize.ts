import { MAX_TEXTURE_LONG_SIDE } from '@/config/constants';
import { fitLongSide } from '@/imaging/downscale';
import { loadImage } from '@/imaging/loadImage';

/** 保存（exportFullFusionToCache）と同じフル解像度出力の寸法 */
export async function expectedFullFusionOutputSize(
  nearUri: string,
  farUri: string,
  nearOrientation?: unknown,
  farOrientation?: unknown,
): Promise<{ width: number; height: number }> {
  const [near, far] = await Promise.all([
    loadImage(nearUri, nearOrientation),
    loadImage(farUri, farOrientation),
  ]);
  if (near.orientation !== far.orientation) {
    throw new Error('2枚の向きが一致しません');
  }
  const outW = near.width;
  const outH = near.height;
  return fitLongSide(outW, outH, Math.min(Math.max(outW, outH), MAX_TEXTURE_LONG_SIDE));
}