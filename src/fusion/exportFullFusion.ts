import { fuse, type FuseOptions } from '@/fusion/fuse';
import type { FusionParams } from '@/types';
import { encodeToCacheJpeg, saveImageToGallery, shareCacheFile } from '@/imaging/saveImage';
import { loadImage } from '@/imaging/loadImage';

export type ExportFusionOpts = {
  nearUri: string;
  farUri: string;
  params: FusionParams;
  manualMask?: FuseOptions['manualMask'];
  referenceUriForPsnr?: string;
  forceMask?: 'near' | 'far';
  onProgress?: (stage: string) => void;
};

/** 保存ボタンと同じ：フル解像度で fuse → 再読込 → JPEG エンコード */
export async function exportFullFusionToCache(opts: ExportFusionOpts): Promise<string> {
  const full = await fuse(opts.nearUri, opts.farUri, opts.params, opts.onProgress, undefined, {
    manualMask: opts.manualMask,
    referenceUriForPsnr: opts.referenceUriForPsnr,
    forceMask: opts.forceMask,
    saveDebug: false,
  });
  const loaded = await loadImage(full.imageUri);
  return encodeToCacheJpeg(loaded.image, opts.forceMask ? `passthrough-${opts.forceMask}` : 'export');
}

export async function saveCacheUriToGallery(cacheUri: string): Promise<'gallery' | 'share'> {
  try {
    await saveImageToGallery(cacheUri);
    return 'gallery';
  } catch (e) {
    if (String(e).includes('MEDIA_PERMISSION_DENIED')) {
      await shareCacheFile(cacheUri);
      return 'share';
    }
    throw e;
  }
}