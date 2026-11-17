import * as ImageManipulator from 'expo-image-manipulator';

/**
 * EXIF 1/3/6/8、Vision Camera の up/right/down/left を、
 * `expo-image-manipulator` の rotate（時計回り・度）に変換する。
 *
 * プレビュー上の正規化座標 (x=横, y=縦) は、回転適用後の「上向き」画像と同じ軸を使う。
 * x/y の入れ替えは座標変換ではなく、ここで画像を直してから座標はそのまま使う。
 */
export function orientationToDegrees(orientation: unknown): number {
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
  const s = String(orientation).toLowerCase().trim();
  if (s === 'up' || s === '0') return 0;
  if (s === 'down') return 180;
  // Vision Camera: 上が右に来ている → 時計回り 270° で上向き
  if (s === 'right') return 270;
  // 上が左に来ている → 時計回り 90° で上向き
  if (s === 'left') return 90;
  if (s.includes('270')) return 270;
  if (s.includes('180')) return 180;
  if (s.includes('90')) return 90;
  return 0;
}

/** @deprecated orientationToDegrees を使用 */
export function exifOrientationToDegrees(orientation: unknown): number {
  return orientationToDegrees(orientation);
}

export async function applyOrientationIfNeeded(
  uri: string,
  orientation: unknown,
): Promise<{ uri: string; width: number; height: number; orientation: string }> {
  const deg = orientationToDegrees(orientation);
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