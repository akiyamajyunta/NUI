import { exportFullFusionToCache } from '@/fusion/exportFullFusion';
import {
  buildPassthroughSharpnessReport,
  type DiagnosticReportData,
} from '@/perf/diagnosticReport';
import {
  computeDiagnosticPointLayout,
  computeQualityTable,
  maskBucketStatsFromUri,
  type FusionQualityTable,
  type MaskBucketStats,
} from '@/perf/fusionDiagnostics';
import { expectedFullFusionOutputSize } from '@/imaging/expectedFusionSize';
import type { FocusVerifyResult } from '@/perf/focusVerify';
import { describeAlignSearchCost, formatAlignSubpixelNote } from '@/perf/alignInvestigation';
import { DISPLAY_BUFFER } from '@/imaging/displayPoint';
import { measureBackgroundEdgeScale } from '@/perf/alignScaleDiagnostic';
import { captureSegments } from '@/perf/timelineSegments';
import type {
  ClosedLoopRetryReport,
  FocusABeforeShotReport,
  FusionParams,
  FusionResult,
  HoldBackgroundFocusSessionStats,
  NormalizedPoint,
  TimelineMark,
} from '@/types';

export type CollectDiagnosticOpts = {
  sourceFrom: 'capture' | 'import';
  nearUri: string;
  farUri: string;
  fusedUri: string;
  nearPoint: NormalizedPoint;
  farPoint: NormalizedPoint;
  params: FusionParams;
  result: FusionResult;
  previewLongSide: number;
  maskUri?: string;
  strategyId?: string;
  captureMs?: number;
  focusVerify?: FocusVerifyResult | null;
  captureWidth?: number;
  captureHeight?: number;
  captureTimeline?: readonly TimelineMark[];
  nearOrientation?: unknown;
  farOrientation?: unknown;
  closedLoop?: ClosedLoopRetryReport;
  focusABeforeShot?: FocusABeforeShotReport;
  holdBackgroundFocus?: HoldBackgroundFocusSessionStats;
  includePassthrough: boolean;
  /** 診断の scale×平行移動。既定では実行しない */
  scaleJointSearch?: boolean;
};

async function measurePassthrough(
  opts: CollectDiagnosticOpts,
  normalQuality: FusionQualityTable,
): Promise<DiagnosticReportData['passthrough']> {
  if (!opts.includePassthrough) return null;
  const base = {
    nearUri: opts.nearUri,
    farUri: opts.farUri,
    params: opts.params,
    nearOrientation: opts.nearOrientation,
    farOrientation: opts.farOrientation,
    subjectPoint: opts.nearPoint,
    orientation: opts.nearOrientation,
  };
  const [nearPtUri, farPtUri] = await Promise.all([
    exportFullFusionToCache({ ...base, forceMask: 'near' }),
    exportFullFusionToCache({ ...base, forceMask: 'far' }),
  ]);
  const orient = { near: opts.nearOrientation, far: opts.farOrientation };
  const [qNear, qFar] = await Promise.all([
    computeQualityTable(opts.nearUri, opts.farUri, nearPtUri, opts.nearPoint, opts.farPoint, orient),
    computeQualityTable(opts.nearUri, opts.farUri, farPtUri, opts.nearPoint, opts.farPoint, orient),
  ]);
  return buildPassthroughSharpnessReport(normalQuality, qNear, qFar);
}

export async function collectDiagnosticReportData(
  opts: CollectDiagnosticOpts,
): Promise<DiagnosticReportData> {
  const orient = { near: opts.nearOrientation, far: opts.farOrientation };
  const alignScaleProbePromise = opts.scaleJointSearch
    ? measureBackgroundEdgeScale(
        opts.nearUri,
        opts.farUri,
        opts.nearPoint,
        undefined,
        DISPLAY_BUFFER,
        true,
      ).catch(() => null)
    : Promise.resolve(null);
  const [quality, mask, outputFull, pointLayout, alignScaleProbe] = await Promise.all([
    computeQualityTable(opts.nearUri, opts.farUri, opts.fusedUri, opts.nearPoint, opts.farPoint, orient),
    opts.maskUri
      ? maskBucketStatsFromUri(opts.maskUri, opts.nearPoint, opts.farPoint)
      : Promise.resolve(null as MaskBucketStats | null),
    expectedFullFusionOutputSize(
      opts.nearUri,
      opts.farUri,
      opts.nearOrientation,
      opts.farOrientation,
    ).catch(() => null),
    computeDiagnosticPointLayout(
      opts.nearUri,
      opts.farUri,
      opts.nearPoint,
      opts.farPoint,
      orient,
    ),
    alignScaleProbePromise,
  ]);
  const segments =
    opts.captureTimeline && opts.captureTimeline.length > 0
      ? captureSegments(opts.captureTimeline)
      : null;

  const passthrough = await measurePassthrough(opts, quality);

  return {
    generatedAtIso: new Date().toISOString(),
    sourceFrom: opts.sourceFrom,
    strategyId: opts.strategyId,
    captureMs: opts.captureMs,
    focusVerify: opts.focusVerify,
    captureSize:
      opts.captureWidth && opts.captureHeight
        ? { width: opts.captureWidth, height: opts.captureHeight }
        : undefined,
    outputPreview: { width: opts.result.width, height: opts.result.height },
    previewLongSide: opts.previewLongSide,
    workLongSide: opts.params.workLongSide,
    align: {
      dx: opts.result.alignOffset.dx,
      dy: opts.result.alignOffset.dy,
      estimatedDx: opts.result.alignEstimatedOffset.dx,
      estimatedDy: opts.result.alignEstimatedOffset.dy,
      offsetApplied: opts.result.alignOffsetApplied,
      confidence: opts.result.alignConfidence,
      warning: opts.result.alignWarning,
      performanceNote: describeAlignSearchCost(),
      subpixelNote: outputFull
        ? formatAlignSubpixelNote(Math.max(outputFull.width, outputFull.height))
        : undefined,
    },
    focusABeforeShot: opts.focusABeforeShot ?? null,
    holdBackgroundFocus: opts.holdBackgroundFocus ?? null,
    quality,
    mask,
    captureSegments: segments,
    closedLoop: opts.closedLoop ?? null,
    outputFull,
    pointLayout,
    maskInputs: opts.result.maskDiagnostics ?? null,
    fusionParams: { ...opts.params },
    timings: opts.result.timings,
    passthrough,
    alignScaleProbe,
    scaleCorrection: opts.result.scaleCorrection ?? null,
  };
}