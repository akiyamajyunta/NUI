import { Skia } from '@shopify/react-native-skia';
import type { LoadedImageInfo } from '@/types';
import { applyOrientationIfNeeded } from '@/imaging/orientation';
import { logUri } from '@/util/log';

export type LoadImageProgress = (stage: string) => void;

function toFileUri(pathOrUri: string): string {
  if (pathOrUri.startsWith('file://') || pathOrUri.startsWith('content://')) {
    return pathOrUri;
  }
  return `file://${pathOrUri}`;
}

export async function loadImage(
  uri: string,
  orientation?: unknown,
  onProgress?: LoadImageProgress,
): Promise<LoadedImageInfo> {
  onProgress?.('decode');
  const oriented = await applyOrientationIfNeeded(toFileUri(uri), orientation ?? 0);
  const loadUri = oriented.uri;
  logUri('imaging', 'loadImage', loadUri);
  const data = await Skia.Data.fromURI(loadUri);
  const image = Skia.Image.MakeImageFromEncoded(data);
  if (!image) {
    throw new Error('画像のデコードに失敗しました');
  }
  const width = oriented.width > 0 ? oriented.width : image.width();
  const height = oriented.height > 0 ? oriented.height : image.height();
  onProgress?.('ready');
  return {
    image,
    width,
    height,
    uri: loadUri,
    orientation: oriented.orientation,
  };
}