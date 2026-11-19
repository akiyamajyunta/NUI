import { decideFocusBeforeShot1, decideFocusBeforeShotA } from '@/camera/smartFocusBeforeShot';
import { DEFAULT_CAPTURE_SETTINGS } from '@/config/constants';

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
      { lastTarget: 'background', lastAtMs: Date.now() - base.focusFreshMaxMs - 1 },
    );
    expect(d.run).toBe(true);
    expect(d.reason).toBe('stale');
  });

  it('撮影1が背景で直近がぬいなら not_shot1_target', () => {
    const d = decideFocusBeforeShot1(
      base,
      { lastTarget: 'subject', lastAtMs: Date.now() },
      'background',
    );
    expect(d.run).toBe(true);
    expect(d.reason).toBe('not_shot1_target');
  });

  it('撮影1がぬいで直近がぬいかつ fresh ならスキップ', () => {
    const d = decideFocusBeforeShot1(
      base,
      { lastTarget: 'subject', lastAtMs: Date.now() - 100 },
      'subject',
    );
    expect(d.run).toBe(false);
    expect(d.reason).toBe('fresh');
  });
});

describe('focusFreshMaxMs の境界', () => {
  const NOW = 20_000_000;
  const session = { lastTarget: 'background' as const, lastAtMs: 0 };

  it.each([
    [2000, 1999, 'fresh'],
    [2000, 2000, 'stale'],
    [4000, 3999, 'fresh'],
    [4000, 4000, 'stale'],
    [8000, 7999, 'fresh'],
    [8000, 8000, 'stale'],
  ] as const)('許容 %i ms で経過 %i ms → %s', (maxMs, elapsed, expected) => {
    const d = decideFocusBeforeShot1(
      { ...DEFAULT_CAPTURE_SETTINGS, focusFreshMaxMs: maxMs },
      { ...session, lastAtMs: NOW - elapsed },
      'background',
      NOW,
    );
    expect(d.reason).toBe(expected);
    expect(d.run).toBe(expected === 'stale');
  });
});