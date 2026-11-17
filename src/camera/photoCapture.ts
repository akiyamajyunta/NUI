import type {
  CameraPhotoOutput,
  PhotoFile,
} from 'react-native-vision-camera/lib/specs/outputs/CameraPhotoOutput.nitro';
import type { CapturedPhoto, NormalizedPoint } from '@/types';

const PHOTO_SETTINGS = { flashMode: 'off' as const };

export function photoFileToCaptured(
  file: PhotoFile,
  focusPoint: NormalizedPoint,
  role: 'NEAR' | 'FAR',
): CapturedPhoto {
  const uri = file.filePath.startsWith('file://') ? file.filePath : `file://${file.filePath}`;
  return {
    uri,
    width: file.width,
    height: file.height,
    orientation: String(file.orientation),
    focusPoint,
    role,
  };
}

export async function captureFarPhoto(
  photoOutput: CameraPhotoOutput,
  farPoint: NormalizedPoint,
): Promise<CapturedPhoto> {
  const file = await photoOutput.capturePhotoToFile(PHOTO_SETTINGS, {});
  return photoFileToCaptured(file, farPoint, 'FAR');
}

export async function captureNearPhoto(
  photoOutput: CameraPhotoOutput,
  nearPoint: NormalizedPoint,
): Promise<CapturedPhoto> {
  const file = await photoOutput.capturePhotoToFile(PHOTO_SETTINGS, {});
  return photoFileToCaptured(file, nearPoint, 'NEAR');
}