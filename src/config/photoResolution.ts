import { CommonResolutions } from 'react-native-vision-camera';
import type { PhotoResolutionPreset } from '@/config/constants';

export function resolutionForPreset(preset: PhotoResolutionPreset) {
  switch (preset) {
    case 'HD_4_3':
      return CommonResolutions.HD_4_3;
    case 'UHD_4_3':
      return CommonResolutions.UHD_4_3;
    case 'FHD_4_3':
    default:
      return CommonResolutions.FHD_4_3;
  }
}

export function resolutionLabel(preset: PhotoResolutionPreset): string {
  const { width, height } = resolutionForPreset(preset);
  return `${width}x${height}`;
}