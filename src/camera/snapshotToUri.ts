import * as FileSystem from 'expo-file-system/legacy';
import type { CameraRef } from 'react-native-vision-camera';
import type { CapturedPhoto, NormalizedPoint } from '@/types';

export async function captureSnapshotToUri(
  camera: CameraRef,
  focusPoint: NormalizedPoint,
  role: 'NEAR' | 'FAR',
): Promise<CapturedPhoto> {
  const image = await camera.takeSnapshot();
  const dir = FileSystem.cacheDirectory;
  if (!dir) throw new Error('cache missing');
  const path = `${dir}snap-${role.toLowerCase()}-${Date.now()}.jpg`;
  await image.saveToFileAsync(path, 'jpg', 90);
  const uri = path.startsWith('file://') ? path : `file://${path}`;
  return {
    uri,
    width: image.width,
    height: image.height,
    orientation: 'up',
    focusPoint,
    role,
  };
}