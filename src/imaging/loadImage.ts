import { Skia } from '@shopify/react-native-skia';
import type { LoadedImageInfo } from '@/types';
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
  // EXIF は Skia が適用する。向き文字列で先に回すと二重回転になる。
  void orientation;
  onProgress?.('decode');
  const loadUri = toFileUri(uri);
  logUri('imaging', 'loadImage', loadUri);
  const data = await Skia.Data.fromURI(loadUri);
  const image = Skia.Image.MakeImageFromEncoded(data);
  if (!image) {
    throw new Error('画像のデコードに失敗しました');
  }
  onProgress?.('ready');
  return {
    image,
    width: image.width(),
    height: image.height(),
    uri: loadUri,
    orientation: 'up',
  };
}