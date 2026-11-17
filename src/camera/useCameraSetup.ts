import { useMemo } from 'react';
import {
  CommonResolutions,
  useCameraDevice,
  useCameraPermission,
} from 'react-native-vision-camera';

export function useCameraSetup() {
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back', {
    physicalDevices: ['wide-angle'],
  });

  const supportsFocus = device?.supportsFocusMetering ?? false;

  const photoTarget = useMemo(() => CommonResolutions.FHD_4_3, []);

  return {
    hasPermission,
    requestPermission,
    device,
    supportsFocus,
    photoTarget,
  };
}