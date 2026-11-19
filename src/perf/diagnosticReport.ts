import type { CaptureSegmentTimings } from '@/perf/timelineSegments';
import type {
  ClosedLoopRetryReport,
  FocusABeforeShotReport,
  FusionParams,
  FusionTimings,
  HoldBackgroundFocusSessionStats,
  MaskDiagnostics,
  RangeStats,
  ScaleCorrectionReport,
} from '@/types';
import type {
  DiagnosticPointLayout,
  FusionQualityTable,
  MaskBucketStats,
} from '@/perf/fusionDiagnostics';
import type { FocusVerifyResult } from '@/perf/focusVerify';
import type { AlignScaleDiagnostic } from '@/perf/alignScaleDiagnostic';

export function sharpnessRatioPct(output: number, reference: number): number {
  if (reference <= 0) return output <= 0 ? 100 : 0;
  return (output / reference) * 100;
}

export type PassthroughSharpnessReport = {
  forceNear: {
    subjectVsNearOrigPct: number;
    backgroundVsNearOrigPct: number;
    subjectVsNormalFusedPct: number;
    backgroundVsNormalFusedPct: number;
  };
  forceFar: {
    subjectVsFarOrigPct: number;
    backgroundVsFarOrigPct: number;
    subjectVsNormalFusedPct: number;
    backgroundVsNormalFusedPct: number;
  };
};

/** 通常合成の画質表と、パススルー出力の画質表から鮮鋭度比（％）を算出 */
export function buildPassthroughSharpnessReport(
  normal: FusionQualityTable,
  forceNear: FusionQualityTable,
  forceFar: FusionQualityTable,
): PassthroughSharpnessReport {
  return {
    forceNear: {
      subjectVsNearOrigPct: sharpnessRatioPct(
        forceNear.atSubjectPoint.fused,
        normal.atSubjectPoint.near,
      ),
      backgroundVsNearOrigPct: sharpnessRatioPct(
        forceNear.atBackgroundPoint.fused,
        normal.atBackgroundPoint.near,
      ),
      subjectVsNormalFusedPct: sharpnessRatioPct(
        forceNear.atSubjectPoint.fused,
        normal.atSubjectPoint.fused,
      ),
      backgroundVsNormalFusedPct: sharpnessRatioPct(
        forceNear.atBackgroundPoint.fused,
        normal.atBackgroundPoint.fused,
      ),
    },
    forceFar: {
      subjectVsFarOrigPct: sharpnessRatioPct(
        forceFar.atSubjectPoint.fused,
        normal.atSubjectPoint.far,
      ),
      backgroundVsFarOrigPct: sharpnessRatioPct(
        forceFar.atBackgroundPoint.fused,
        normal.atBackgroundPoint.far,
      ),
      subjectVsNormalFusedPct: sharpnessRatioPct(
        forceFar.atSubjectPoint.fused,
        normal.atSubjectPoint.fused,
      ),
      backgroundVsNormalFusedPct: sharpnessRatioPct(
        forceFar.atBackgroundPoint.fused,
        normal.atBackgroundPoint.fused,
      ),
    },
  };
}

export type DiagnosticReportData = {
  generatedAtIso: string;
  sourceFrom: 'capture' | 'import';
  strategyId?: string;
  captureMs?: number;
  focusVerify?: FocusVerifyResult | null;
  captureSize?: { width: number; height: number };
  outputPreview: { width: number; height: number };
  /** ギャラリー保存時と同じフル解像度 fuse の出力寸法（想定） */
  outputFull: { width: number; height: number } | null;
  previewLongSide: number;
  workLongSide: number;
  captureSegments: CaptureSegmentTimings | null;
  closedLoop: ClosedLoopRetryReport | null;
  pointLayout: DiagnosticPointLayout | null;
  align: {
    dx: number;
    dy: number;
    estimatedDx: number;
    estimatedDy: number;
    offsetApplied: boolean;
    confidence: number;
    warning: boolean;
    performanceNote?: string;
    subpixelNote?: string;
  };
  /** 同時探索を設定で有効にしたときだけ入る */
  alignScaleProbe: AlignScaleDiagnostic | null;
  /** 合成に適用した拡大率と、適用前後の NCC */
  scaleCorrection: ScaleCorrectionReport | null;
  focusABeforeShot: FocusABeforeShotReport | null;
  holdBackgroundFocus: HoldBackgroundFocusSessionStats | null;
  quality: FusionQualityTable | null;
  mask: MaskBucketStats | null;
  /** 鮮鋭度マップ S_near・S_far と正規化差 d の値域（作業解像度） */
  maskInputs: MaskDiagnostics | null;
  fusionParams: FusionParams;
  timings?: FusionTimings;
  passthrough: PassthroughSharpnessReport | null;
};

function fmtVar(v: number): string {
  return v < 0.0001 ? v.toExponential(2) : v.toFixed(5);
}

function fmtRange(r: RangeStats, digits: number): string {
  return `最小 ${r.min.toFixed(digits)} / 中央値 ${r.median.toFixed(digits)} / 最大 ${r.max.toFixed(digits)}`;
}

function pct(v: number): string {
  return `${v.toFixed(1)}%`;
}

function fmtFocusSeg(label: string, seg: { executed: boolean; ms?: number }): string {
  const ms = seg.ms != null ? `${Math.round(seg.ms)}ms` : '—';
  return `${label}: ${seg.executed ? '実行' : 'スキップ'} ${ms}`;
}

function formatGrid4x4(title: string, grid: number[][], w: number, h: number): string[] {
  const out = [`${title}（分析 ${w}×${h}px、行=上→下 / 列=左→右）`];
  grid.forEach((row, ri) => {
    const cells = row.map((v) => fmtVar(v).padStart(9)).join(' ');
    out.push(`  行${ri + 1}: ${cells}`);
  });
  return out;
}

export function diagnosticReportJson(data: DiagnosticReportData): Record<string, unknown> {
  return {
    generatedAt: data.generatedAtIso,
    capture: {
      sourceFrom: data.sourceFrom,
      strategyId: data.strategyId,
      captureMs: data.captureMs,
      focusVerify: data.focusVerify,
      captureSize: data.captureSize,
    },
    resolution: {
      outputPreview: data.outputPreview,
      outputFull: data.outputFull,
      previewLongSide: data.previewLongSide,
      workLongSide: data.workLongSide,
    },
    captureSegmentsMs: data.captureSegments,
    closedLoopCapture: data.closedLoop,
    focusPoints: data.pointLayout,
    align: data.align,
    alignScaleProbe: data.alignScaleProbe,
    scaleCorrection: data.scaleCorrection,
    focusABeforeShot: data.focusABeforeShot,
    holdBackgroundFocus: data.holdBackgroundFocus,
    qualityLaplacianVariance: data.quality,
    maskDistribution: data.mask,
    maskInputs: data.maskInputs,
    fusionParams: data.fusionParams,
    fusionTimingsMs: data.timings,
    passthroughSharpnessPct: data.passthrough,
  };
}

export function formatDiagnosticReportText(data: DiagnosticReportData): string {
  const lines: string[] = [];
  lines.push('=== ぬいぐるみ合成 診断レポート ===');
  lines.push(`生成: ${data.generatedAtIso}`);
  lines.push('');
  lines.push('【撮影情報】');
  lines.push(`ソース: ${data.sourceFrom === 'capture' ? 'カメラ撮影' : 'ギャラリー'}`);
  if (data.strategyId) lines.push(`撮影戦略: ${data.strategyId}`);
  if (data.captureMs != null) lines.push(`撮影時間: ${Math.round(data.captureMs)} ms`);
  if (data.focusVerify) lines.push(`ピント検証: ${data.focusVerify}`);
  if (data.captureSize) {
    lines.push(`撮影解像度: ${data.captureSize.width}×${data.captureSize.height}px`);
  } else {
    lines.push('撮影解像度: 不明（ギャラリー等）');
  }
  if (data.focusABeforeShot) {
    const f = data.focusABeforeShot;
    lines.push('');
    lines.push('【撮影1前フォーカス（スマート）】');
    lines.push(`  実行: ${f.executed ? 'あり' : 'スキップ'} / 理由: ${f.reason}`);
    lines.push(
      `  直近フォーカス対象: ${f.lastFocusTarget} / 経過: ${f.elapsedSinceFocusMs} ms`,
    );
  }
  if (data.holdBackgroundFocus?.enabled) {
    const h = data.holdBackgroundFocus;
    const rate =
      h.capturesWhileEnabled > 0
        ? (h.focusASkippedCount / h.capturesWhileEnabled) * 100
        : 0;
    lines.push('');
    lines.push('【ピント維持（背景点）】');
    lines.push(
      `  撮影1前フォーカススキップ: ${h.focusASkippedCount}/${h.capturesWhileEnabled}（${rate.toFixed(1)}%）`,
    );
  }
  if (data.captureSegments) {
    lines.push('');
    lines.push('【撮影シーケンス ms】');
    const s = data.captureSegments;
    const ms = (v: number | undefined) => (v != null ? String(Math.round(v)) : '—');
    lines.push(`  ${fmtFocusSeg('背景フォーカス', s.focusA)}`);
    lines.push(`  撮影1（背景）: ${ms(s.photoA)}`);
    lines.push(`  待ち（S3等）: ${ms(s.delay)}`);
    lines.push(`  ${fmtFocusSeg('ぬいフォーカス', s.focusB)}`);
    lines.push(`  撮影2（ぬい）: ${ms(s.photoB)}`);
    if (s.retryFar?.executed || s.retryNear?.executed) {
      lines.push(
        `  閉ループ再撮: FAR ${s.retryFar?.executed ? `あり ${ms(s.retryFar.ms)}` : 'なし'} / NEAR ${s.retryNear?.executed ? `あり ${ms(s.retryNear.ms)}` : 'なし'}`,
      );
    }
  }
  if (data.closedLoop) {
    const cl = data.closedLoop;
    if (cl.enabled) {
      lines.push(
        `  閉ループ: FAR再撮=${cl.farRetried ? 'あり' : 'なし'} NEAR再撮=${cl.nearRetried ? 'あり' : 'なし'}${cl.retryTotalMs != null ? ` 追加 ${cl.retryTotalMs}ms` : ''}`,
      );
    }
  }
  lines.push('');
  lines.push('【寸法・解像度】');
  lines.push(
    `表示中合成JPEG: ${data.outputPreview.width}×${data.outputPreview.height}px（プレビュー長辺 ${data.previewLongSide}px）`,
  );
  if (data.outputFull) {
    lines.push(
      `保存時フル解像度合成: ${data.outputFull.width}×${data.outputFull.height}px`,
    );
  } else {
    lines.push('保存時フル解像度合成: （未取得）');
  }
  lines.push(`作業解像度（FusionParams）: 長辺 ${data.workLongSide}px`);
  lines.push('');
  lines.push('【位置合わせ】');
  lines.push(
    `適用 offset: dx ${data.align.dx.toFixed(2)} / dy ${data.align.dy.toFixed(2)}（適用=${data.align.offsetApplied ? 'あり' : 'なし・0固定'}）`,
  );
  lines.push(
    `推定 offset: dx ${data.align.estimatedDx.toFixed(2)} / dy ${data.align.estimatedDy.toFixed(2)}`,
  );
  lines.push(`信頼度: ${(data.align.confidence * 100).toFixed(1)}%`);
  lines.push(`警告: ${data.align.warning ? 'あり' : 'なし'}`);
  if (data.align.performanceNote) lines.push(`調査: ${data.align.performanceNote}`);
  if (data.align.subpixelNote) lines.push(`粗さ: ${data.align.subpixelNote}`);
  if (data.scaleCorrection) {
    const s = data.scaleCorrection;
    lines.push('');
    lines.push('【拡大率補正】');
    lines.push(
      `  mode=${s.mode} 推定=${s.estimatedScale.toFixed(3)} 適用=${s.appliedScale.toFixed(3)} fallback=${s.fellBack ? 'あり' : 'なし'} しきい値=${s.minGain.toFixed(4)} 長辺=${s.analysisLongSide}px`,
    );
    lines.push(
      `  補正前NCC=${s.nccBefore.toFixed(4)} 推定scaleのNCC=${s.nccAtEstimate.toFixed(4)} 適用後NCC=${s.nccAfter.toFixed(4)} / ${Math.round(s.ms)} ms`,
    );
  }
  const joint = data.alignScaleProbe?.joint;
  if (joint) {
    const j = joint;
    lines.push('');
    lines.push('【拡大率×平行移動（診断のみ・設定で有効）】');
    lines.push(
      `  scale=${j.bestScale.toFixed(3)} dx=${j.bestDx}px dy=${j.bestDy}px NCC=${j.bestNcc.toFixed(4)} 差=${j.nccGainVsUnity >= 0 ? '+' : ''}${j.nccGainVsUnity.toFixed(4)} / ${Math.round(j.ms)} ms`,
    );
  }
  lines.push('');
  if (data.pointLayout) {
    lines.push('');
    lines.push('【フォーカス点座標】（分析解像度上）');
    const pl = data.pointLayout;
    const fmtPt = (name: string, p: typeof pl.subject) =>
      `${name}: 正規化 (${p.normalized.x.toFixed(4)}, ${p.normalized.y.toFixed(4)}) → ピクセル (${p.pixelCenter.x}, ${p.pixelCenter.y})`;
    lines.push(`  ${fmtPt('被写体点', pl.subject)}`);
    lines.push(`  ${fmtPt('背景点', pl.background)}`);
    lines.push('');
    lines.push('【4×4 ラプラシアン分散】');
    const { width: aw, height: ah } = pl.grids.analysisSize;
    lines.push(...formatGrid4x4('NEAR 画像', pl.grids.near, aw, ah));
    lines.push(...formatGrid4x4('FAR 画像', pl.grids.far, aw, ah));
  }
  lines.push('');
  lines.push('【画質比較】ラプラシアン分散（高いほどシャープ）');
  if (data.quality) {
    const q = data.quality;
    lines.push('[被写体点周辺]');
    lines.push(
      `  NEAR元 ${fmtVar(q.atSubjectPoint.near)} | FAR元 ${fmtVar(q.atSubjectPoint.far)} | 合成 ${fmtVar(q.atSubjectPoint.fused)}`,
    );
    lines.push('[背景点周辺]');
    lines.push(
      `  NEAR元 ${fmtVar(q.atBackgroundPoint.near)} | FAR元 ${fmtVar(q.atBackgroundPoint.far)} | 合成 ${fmtVar(q.atBackgroundPoint.fused)}`,
    );
  } else {
    lines.push('  （未取得）');
  }
  lines.push('');
  lines.push('【マスク分布】');
  if (data.mask) {
    lines.push(`  FAR寄り (<0.1): ${pct(data.mask.below01 * 100)}`);
    lines.push(`  混合 (0.1〜0.9) 全体: ${pct(data.mask.mid * 100)}`);
    if (data.mask.midAtSubject != null) {
      lines.push(`  混合 被写体周辺: ${pct(data.mask.midAtSubject * 100)}`);
    }
    if (data.mask.midAtBackground != null) {
      lines.push(`  混合 背景周辺: ${pct(data.mask.midAtBackground * 100)}`);
    }
    lines.push(`  NEAR寄り (>0.9): ${pct(data.mask.above09 * 100)}`);
    lines.push(`  ピクセル数: ${data.mask.sampleCount}`);
  } else {
    lines.push('  （未取得）');
  }
  lines.push('');
  lines.push('【鮮鋭度マップ・正規化差】（作業解像度。S はラプラシアン絶対値の窓平均）');
  if (data.maskInputs) {
    const mi = data.maskInputs;
    lines.push(`  S_near: ${fmtRange(mi.sNear, 4)}`);
    lines.push(`  S_far : ${fmtRange(mi.sFar, 4)}`);
    lines.push(`  d = (sN-sF)/(sN+sF+eps): ${fmtRange(mi.d, 3)}`);
    lines.push(`  低テクスチャ画素: ${pct(mi.lowTextureRatio * 100)}（サンプル数 ${mi.sampleCount}）`);
    if (mi.quantizationAnalysis) {
      lines.push(`  量子化調査: ${mi.quantizationAnalysis}`);
    }
  } else {
    lines.push('  （未取得）');
  }
  lines.push('');
  lines.push('【FusionParams】');
  const p = data.fusionParams;
  lines.push(
    `  workLongSide=${p.workLongSide} sharpR=${p.sharpWindowRadius} maskBlur=${p.maskBlurRadius} threshold=${p.threshold}`,
  );
  lines.push(
    `  nearBias=${p.nearBias} haloShrink=${p.haloShrink} colorMatch=${p.colorMatch} align=${p.align}`,
  );
  if (data.timings) {
    lines.push('');
    lines.push('【合成タイミング ms】');
    lines.push(
      `  load ${Math.round(data.timings.loadMs)} align ${Math.round(data.timings.alignMs)} sharp ${Math.round(data.timings.sharpnessMs)} blend ${Math.round(data.timings.blendMs)} encode ${Math.round(data.timings.encodeMs)} total ${Math.round(data.timings.totalMs)}`,
    );
  }
  lines.push('');
  lines.push('【パススルー鮮鋭度比（％・元画像／通常合成に対する分散比）】');
  if (data.passthrough) {
    const pt = data.passthrough;
    lines.push('強制 NEAR:');
    lines.push(
      `  被写体点 vs NEAR元 ${pct(pt.forceNear.subjectVsNearOrigPct)} / vs 通常合成 ${pct(pt.forceNear.subjectVsNormalFusedPct)}`,
    );
    lines.push(
      `  背景点 vs NEAR元 ${pct(pt.forceNear.backgroundVsNearOrigPct)} / vs 通常合成 ${pct(pt.forceNear.backgroundVsNormalFusedPct)}`,
    );
    lines.push('強制 FAR:');
    lines.push(
      `  被写体点 vs FAR元 ${pct(pt.forceFar.subjectVsFarOrigPct)} / vs 通常合成 ${pct(pt.forceFar.subjectVsNormalFusedPct)}`,
    );
    lines.push(
      `  背景点 vs FAR元 ${pct(pt.forceFar.backgroundVsFarOrigPct)} / vs 通常合成 ${pct(pt.forceFar.backgroundVsNormalFusedPct)}`,
    );
  } else {
    lines.push('  （未取得）');
  }
  return lines.join('\n');
}

export function formatDiagnosticReportClipboard(data: DiagnosticReportData): string {
  const text = formatDiagnosticReportText(data);
  const json = JSON.stringify(diagnosticReportJson(data), null, 2);
  return `${text}\n\n--- JSON ---\n${json}`;
}