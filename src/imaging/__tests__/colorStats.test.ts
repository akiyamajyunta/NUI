import { clampGain, colorCorrectionFromMeans } from '@/imaging/colorStats';

describe('colorStats', () => {
  it('clampGain', () => {
    expect(clampGain(2)).toBe(1.25);
    expect(clampGain(0.1)).toBe(0.8);
  });

  it('colorCorrectionFromMeans', () => {
    const c = colorCorrectionFromMeans([100, 100, 100], [80, 80, 80]);
    expect(c.gain[0]).toBeGreaterThan(1);
  });
});