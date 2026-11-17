import { analyzeSharpnessQuantization } from '@/fusion/maskCore';

describe('analyzeSharpnessQuantization', () => {
  it('同一バイトのとき 8bit が原因と説明する', () => {
    const hist = new Uint32Array(256);
    hist[3] = 100;
    const s = { min: 0.000138, median: 0.000138, max: 0.01 };
    const text = analyzeSharpnessQuantization(s, s, 3, 3, 3, 3, hist, hist, 100);
    expect(text).toContain('8bit');
    expect(text).toContain('主因');
  });
});