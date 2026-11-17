import * as ImageManipulator from 'expo-image-manipulator';

/** image-picker の orientation 相当（数字または文字列）を0/90/180/270度に正規化 */
export function exifOrientationToDegrees(orientation: unknown): number {
  if (orientation == null) return 0;
  if (typeof orientation === 'number') {
    switch (orientation) {
      case 1:
        return 0;
      case 3:
        return 180;
      case 6:
        return 90;
      case 8:
        return 270;
      default:
        return 0;
    }
  }
  const s = String(orientation).toLowerCase();
  if (s.includes('90')) return 90;
  if (s.includes('180')) return 180;
  if (s.includes('270')) return 270;
  return 0;
}

export async function applyOrientationIfNeeded(
  uri: string,
  orientation: unknown,
): Promise<{ uri: string; width: number; height: number; orientation: string }> {
  const deg = exifOrientationToDegrees(orientation);
  if (deg === 0) {
    return { uri, width: 0, height: 0, orientation: 'up' };
  }
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ rotate: deg }],
    { compress: 1, format: ImageManipulator.SaveFormat.JPEG },
  );
  return {
    uri: result.uri,
    width: result.width,
    height: result.height,
    orientation: 'up',
  };
}