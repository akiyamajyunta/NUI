import { decideFocusBeforeShotA } from '@/camera/smartFocusBeforeShot';
import { DEFAULT_CAPTURE_SETTINGS, FOCUS_A_STALE_MS } from '@/config/constants';

describe('decideFocusBeforeShotA', () => {
  const base = DEFAULT_CAPTURE_SETTINGS;

  it('必ずフォーカス ON なら forced', () => {
    const d = decideFocusBeforeShotA(
      { ...base, refocusBeforeFirst: true },
      { lastTarget: 'background', lastAtMs: Date.now() },
    );
    expect(d.run).toBe(true);
    expect(d.reason).toBe('forced');
  });

  it('直近が背景で fresh ならスキップ', () => {
    const d = decideFocusBeforeShotA(
      base,
      { lastTarget: 'background', lastAtMs: Date.now() - 100 },
    );
    expect(d.run).toBe(false);
    expect(d.reason).toBe('fresh');
  });

  it('stale なら実行', () => {
    const d = decideFocusBeforeShotA(
      base,
      { lastTarget: 'background', lastAtMs: Date.now() - FOCUS_A_STALE_MS - 1 },
    );
    expect(d.run).toBe(true);
    expect(d.reason).toBe('stale');
  });

  it('直近がぬいなら not_background', () => {
    const d = decideFocusBeforeShotA(
      base,
      { lastTarget: 'subject', lastAtMs: Date.now() },
    );
    expect(d.run).toBe(true);
    expect(d.reason).toBe('not_background');
  });
});