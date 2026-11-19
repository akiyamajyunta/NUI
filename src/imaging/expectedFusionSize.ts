import { loadImage } from '@/imaging/loadImage';
import { fusionPixelSize } from '@/imaging/fusionOutputSize';

/** 保存フル解像度。Skia 適用後の寸法を、向きでは入れ替えない */
export function fullFusionOutputSize(
  width: number,
  height: number,
): { width: number; height: number } {
  return fusionPixelSize(width, height);
}

/** 保存（exportFullFusionToCache）と同じフル解像度出力の寸法 */
export async function expectedFullFusionOutputSize(
  nearUri: string,
  farUri: string,
  nearOrientation?: unknown,
  farOrientation?: unknown,
): Promise<{ width: number; height: number }> {
  const near = await loadImage(nearUri);
  void farUri;
  void nearOrientation;
  void farOrientation;
  return fullFusionOutputSize(near.width, near.height);
}