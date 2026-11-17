import {
  buildPassthroughSharpnessReport,
  formatDiagnosticReportClipboard,
  sharpnessRatioPct,
  type DiagnosticReportData,
} from '@/perf/diagnosticReport';
import { DEFAULT_FUSION_PARAMS } from '@/config/constants';

describe('sharpnessRatioPct', () => {
  it('参照に対する百分率', () => {
    expect(sharpnessRatioPct(50, 100)).toBe(50);
    expect(sharpnessRatioPct(100, 100)).toBe(100);
    expect(sharpnessRatioPct(0, 0)).toBe(100);
  });
});

describe('buildPassthroughSharpnessReport', () => {
  it('パススルーが元と同等なら約100%', () => {
    const table = {
      atSubjectPoint: { near: 0.02, far: 0.01, fused: 0.015 },
      atBackgroundPoint: { near: 0.01, far: 0.03, fused: 0.012 },
    };
    const pt = {
      atSubjectPoint: { near: 0.02, far: 0.01, fused: 0.02 },
      atBackgroundPoint: { near: 0.01, far: 0.03, fused: 0.01 },
    };
    const r = buildPassthroughSharpnessReport(table, pt, pt);
    expect(r.forceNear.subjectVsNearOrigPct).toBeCloseTo(100);
    expect(r.forceNear.backgroundVsNearOrigPct).toBeCloseTo(100);
  });
});

describe('formatDiagnosticReportClipboard', () => {
  it('日本語セクションとJSONを含むがURIを含まない', () => {
    const data: DiagnosticReportData = {
      generatedAtIso: '2026-01-01T00:00:00.000Z',
      sourceFrom: 'capture',
      strategyId: 'S1',
      captureMs: 900,
      focusVerify: 'OK',
      captureSize: { width: 4000, height: 3000 },
      outputPreview: { width: 1024, height: 768 },
      outputFull: { width: 3072, height: 4096 },
      captureSegments: {
        focusA: { executed: true, ms: 120 },
        photoA: 80,
        focusB: { executed: true, ms: 150 },
        photoB: 90,
        delay: 200,
      },
      closedLoop: { enabled: false, farRetried: false, nearRetried: false },
      pointLayout: null,
      previewLongSide: 1024,
      workLongSide: 1024,
      align: {
        dx: 1,
        dy: -2,
        estimatedDx: 4,
        estimatedDy: -8,
        offsetApplied: true,
        confidence: 0.9,
        warning: false,
      },
      focusABeforeShot: null,
      holdBackgroundFocus: null,
      quality: {
        atSubjectPoint: { near: 0.1, far: 0.05, fused: 0.08 },
        atBackgroundPoint: { near: 0.04, far: 0.12, fused: 0.1 },
      },
      mask: { below01: 0.2, mid: 0.3, above09: 0.5, sampleCount: 100 },
      maskInputs: {
        sNear: { min: 0.001, median: 0.02, max: 0.4 },
        sFar: { min: 0.002, median: 0.03, max: 0.5 },
        d: { min: -0.95, median: -0.1, max: 0.9 },
        lowTextureRatio: 0.25,
        sampleCount: 1000,
      },
      fusionParams: DEFAULT_FUSION_PARAMS,
      passthrough: null,
      alignScaleProbe: {
        bestScale: 1.01,
        bestMaskedSad: 0.02,
        atUnityMaskedSad: 0.025,
        searchMin: 0.95,
        searchMax: 1.05,
        step: 0.005,
        analysisLongSide: 256,
        excludeSubjectRadiusFrac: 0.25,
        fixedTranslation: { dx: 1, dy: -2 },
        ms: 120,
      },
    };
    const out = formatDiagnosticReportClipboard(data);
    expect(out).toContain('S_near: 最小 0.0010 / 中央値 0.0200 / 最大 0.4000');
    expect(out).toContain('S_far : 最小 0.0020 / 中央値 0.0300 / 最大 0.5000');
    expect(out).toContain('d = (sN-sF)/(sN+sF+eps): 最小 -0.950 / 中央値 -0.100 / 最大 0.900');
    expect(out).toContain('"maskInputs"');
    expect(out).toContain('撮影シーケンス');
    expect(out).toContain('保存時フル解像度合成: 3072×4096px');
    expect(out).toContain('診断レポート');
    expect(out).toContain('画質比較');
    expect(out).toContain('拡大率探索（診断のみ）');
    expect(out).toContain('--- JSON ---');
    expect(out).not.toMatch(/file:\/\//);
    expect(out).not.toMatch(/VisionCamera/);
  });
});