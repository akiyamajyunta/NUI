import type { PhotoFile } from 'react-native-vision-camera/lib/specs/outputs/CameraPhotoOutput.nitro';
import { focusThenSettle } from '@/camera/focusMetering';
import { normalizedToView } from '@/camera/focusPoints';
import type { CaptureStrategy } from '@/camera/strategies/types';
import type { CapturedPhoto, NormalizedPoint } from '@/types';

function photoFileToCaptured(
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

/** S3: 背景フォーカス後に追加待ちを入れてから1枚目（背景）を撮る */
export const fixedDelayStrategy: CaptureStrategy = {
  id: 'S3',
  label: '固定遅延 (S3)',
  async run(ctx) {
    const photoSettings = { flashMode: 'off' as const };
    const nearView = normalizedToView(ctx.nearPoint, ctx.previewWidth, ctx.previewHeight);
    const farView = normalizedToView(ctx.farPoint, ctx.previewWidth, ctx.previewHeight);

    if (ctx.settings.refocusBeforeFirst || ctx.focusedOnNear) {
      ctx.mark('focusA_start');
      await focusThenSettle(ctx.camera, farView, ctx.settings.focusTimeoutMs, 'far');
      ctx.mark('focusA_end');
    }

    ctx.mark('delay_start');
    await new Promise((r) => setTimeout(r, ctx.settings.s3ExtraDelayMs));
    ctx.mark('delay_end');

    ctx.mark('photoA_start');
    const farFile = await ctx.photoOutput.capturePhotoToFile(photoSettings, {});
    ctx.mark('photoA_end');

    ctx.mark('focusB_start');
    await focusThenSettle(ctx.camera, nearView, ctx.settings.focusTimeoutMs, 'near');
    ctx.mark('focusB_end');

    ctx.mark('photoB_start');
    const nearFile = await ctx.photoOutput.capturePhotoToFile(photoSettings, {});
    ctx.mark('photoB_end');

    return {
      near: photoFileToCaptured(nearFile, ctx.nearPoint, 'NEAR'),
      far: photoFileToCaptured(farFile, ctx.farPoint, 'FAR'),
    };
  },
};