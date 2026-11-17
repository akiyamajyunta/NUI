import { ImageFormat, type SkImage } from '@shopify/react-native-skia';
import * as FileSystem from 'expo-file-system/legacy';
import { createAlbumAsync, createAssetAsync, requestPermissionsAsync } from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { JPEG_QUALITY, MEDIA_ALBUM_NAME } from '@/config/constants';
import { logError, logUri } from '@/util/log';

export async function encodeToCacheJpeg(image: SkImage, prefix = 'fusion'): Promise<string> {
  const base64 = image.encodeToBase64(ImageFormat.JPEG, JPEG_QUALITY);
  const dir = FileSystem.cacheDirectory;
  if (!dir) throw new Error('キャッシュディレクトリがありません');
  const path = `${dir}${prefix}-${Date.now()}.jpg`;
  await FileSystem.writeAsStringAsync(path, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const uri = path.startsWith('file://') ? path : `file://${path}`;
  logUri('imaging', 'encoded', uri);
  return uri;
}

export async function saveImageToGallery(fileUri: string): Promise<void> {
  const permission = await requestPermissionsAsync(true);
  if (!permission.granted) {
    throw new Error('MEDIA_PERMISSION_DENIED');
  }
  const asset = await createAssetAsync(fileUri.replace(/^file:\/\//, ''));
  await createAlbumAsync(MEDIA_ALBUM_NAME, asset, false);
}

export async function shareCacheFile(fileUri: string): Promise<void> {
  const available = await Sharing.isAvailableAsync();
  if (!available) {
    throw new Error('共有が利用できません');
  }
  await Sharing.shareAsync(fileUri, { mimeType: 'image/jpeg' });
}

export async function saveImageWithFallback(image: SkImage): Promise<{ uri: string; savedToGallery: boolean }> {
  const uri = await encodeToCacheJpeg(image, 'save');
  try {
    await saveImageToGallery(uri);
    return { uri, savedToGallery: true };
  } catch (e) {
    logError('imaging', 'gallery save failed', e);
    if (String(e).includes('MEDIA_PERMISSION_DENIED')) {
      throw new Error('MEDIA_PERMISSION_DENIED');
    }
    throw e;
  }
}

export async function deleteTempFile(uri: string): Promise<void> {
  try {
    const path = uri.replace(/^file:\/\//, '');
    await FileSystem.deleteAsync(path, { idempotent: true });
  } catch {
    // 掃除失敗は無視
  }
}