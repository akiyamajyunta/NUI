import { orientationToDegrees } from '@/imaging/orientation';

describe('orientationToDegrees', () => {
  it('Vision Camera の向きを回転度に変換する（x/y 入替えは画像側で解消）', () => {
    expect(orientationToDegrees('up')).toBe(0);
    expect(orientationToDegrees('down')).toBe(180);
    expect(orientationToDegrees('left')).toBe(90);
    expect(orientationToDegrees('right')).toBe(270);
  });

  it('EXIF 数値も扱う', () => {
    expect(orientationToDegrees(6)).toBe(90);
    expect(orientationToDegrees(8)).toBe(270);
  });
});