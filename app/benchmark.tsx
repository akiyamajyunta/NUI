import * as Clipboard from 'expo-clipboard';
import Constants from 'expo-constants';
import { router, Stack, useIsFocused } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Camera, usePhotoOutput, type CameraRef } from 'react-native-vision-camera';
import { runCaptureSequence } from '@/camera/captureSequence';
import { normalizedToView, viewToNormalized } from '@/camera/focusPoints';
import { useCameraSetup } from '@/camera/useCameraSetup';
import {
  BENCHMARK_INTERVAL_MS,
  BENCHMARK_RUNS_DEFAULT,
} from '@/config/constants';
import { resolutionForPreset, resolutionLabel } from '@/config/photoResolution';
import { fitLongSide } from '@/imaging/downscale';
import { loadImage } from '@/imaging/loadImage';
import { readGrayFromSkImage } from '@/imaging/imagePixels';
import type { CaptureSegmentTimings } from '@/perf/timelineSegments';
import { captureSegments } from '@/perf/timelineSegments';
import type { FocusVerifyResult } from '@/perf/focusVerify';
import { verifyFocusFromGray } from '@/perf/focusVerify';
import { computeStats } from '@/perf/stats';
import { useAppState } from '@/state/AppState';
import { FocusMarker } from '@/ui/FocusMarker';
import { MetricRow } from '@/ui/MetricRow';
import { PrimaryButton } from '@/ui/PrimaryButton';
import { ProgressOverlay } from '@/ui/ProgressOverlay';
import { S } from '@/ui/strings';
import type { FusionTimings, NormalizedPoint } from '@/types';

type RunRow = {
  totalMs: number;
  focusVerify: FocusVerifyResult;
  segments: CaptureSegmentTimings;
};

type PointMode = 'subject' | 'background';

function segCell(v?: number): string {
  return v != null ? `${Math.round(v)}` : '—';
}

function focusOkRate(runs: RunRow[]): number {
  if (runs.length === 0) return 0;
  return runs.filter((r) => r.focusVerify === 'OK').length / runs.length;
}

function buildBenchmarkJson(
  runs: RunRow[],
  settings: ReturnType<typeof useAppState>['state']['captureSettings'],
  deviceId: string,
  fusionTimings: FusionTimings | null | undefined,
) {
  const totals = runs.map((r) => r.totalMs);
  const stats = computeStats(totals);
  return {
    device: {
      model: Constants.deviceName ?? Platform.OS,
      androidVersion: String(Platform.Version),
      cameraDevice: deviceId,
      format: resolutionLabel(settings.photoResolution),
    },
    strategy: settings.strategyId,
    runs: runs.map((r) => ({
      totalMs: Math.round(r.totalMs),
      segments: r.segments,
      focusVerify: r.focusVerify,
    })),
    stats: {
      min: Math.round(stats.min),
      max: Math.round(stats.max),
      mean: Math.round(stats.mean),
      median: Math.round(stats.median),
      p90: Math.round(stats.p90),
    },
    medianUnder1000ms: stats.median <= 1000,
    focusOkRate: focusOkRate(runs),
    fusionTimings: fusionTimings ?? undefined,
    s3ExtraDelayMs: settings.s3ExtraDelayMs,
  };
}

export default function BenchmarkScreen() {
  const { state } = useAppState();
  const settings = state.captureSettings;
  const { device, supportsFocus, hasPermission, requestPermission } = useCameraSetup();
  const focused = useIsFocused();
  const { width: previewW, height: winH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const previewHeight = Math.max(280, Math.min(420, winH * 0.42));

  const cameraRef = useRef<CameraRef>(null);
  const focusedOnNearRef = useRef(false);
  const photoOutput = usePhotoOutput({
    targetResolution: resolutionForPreset(settings.photoResolution),
    qualityPrioritization: 'speed',
    containerFormat: 'jpeg',
    quality: 0.85,
  });

  const [nearPoint, setNearPoint] = useState<NormalizedPoint>({ x: 0.5, y: 0.45 });
  const [farPoint, setFarPoint] = useState<NormalizedPoint | null>(null);
  const [mode, setMode] = useState<PointMode>('subject');
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [jsonCopied, setJsonCopied] = useState(false);

  const farReady = farPoint != null;
  const canRun = farReady && !busy && device != null && supportsFocus;

  const onTapPreview = useCallback(
    async (x: number, y: number) => {
      if (busy) return;
      const n = viewToNormalized(x, y, previewW, previewHeight);
      if (mode === 'subject') setNearPoint(n);
      else setFarPoint(n);
      try {
        const view = normalizedToView(n, previewW, previewHeight);
        await cameraRef.current?.focusTo(view);
        focusedOnNearRef.current = mode === 'subject';
      } catch {
        focusedOnNearRef.current = false;
      }
    },
    [busy, mode, previewHeight, previewW],
  );

  const copyJson = useCallback(
    async (completed: RunRow[]) => {
      if (!device || completed.length === 0) return;
      const json = buildBenchmarkJson(completed, settings, device.id, state.lastFusionTimings);
      await Clipboard.setStringAsync(JSON.stringify(json, null, 2));
      setJsonCopied(true);
    },
    [device, settings, state.lastFusionTimings],
  );

  const runBench = useCallback(async () => {
    if (!cameraRef.current || !device || !farPoint) return;
    setBusy(true);
    setRuns([]);
    setJsonCopied(false);
    const out: RunRow[] = [];
    let lensOnNear = focusedOnNearRef.current;
    for (let i = 0; i < BENCHMARK_RUNS_DEFAULT; i += 1) {
      const result = await runCaptureSequence({
        strategyId: settings.strategyId,
        settings,
        camera: cameraRef.current,
        photoOutput,
        nearPoint,
        farPoint,
        previewWidth: previewW,
        previewHeight,
        focusedOnNear: lensOnNear,
      });
      lensOnNear = true;
      const near = await loadImage(result.near.uri);
      const far = await loadImage(result.far.uri);
      const { width: w, height: h } = fitLongSide(near.width, near.height, 512);
      const gn = readGrayFromSkImage(near.image, 512);
      const gf = readGrayFromSkImage(far.image, 512);
      const fv = verifyFocusFromGray(gn, gf, w, h, nearPoint, farPoint);
      out.push({
        totalMs: result.totalMs,
        focusVerify: fv,
        segments: captureSegments(result.timeline),
      });
      setRuns([...out]);
      if (i < BENCHMARK_RUNS_DEFAULT - 1) {
        await new Promise((r) => setTimeout(r, BENCHMARK_INTERVAL_MS));
      }
    }
    focusedOnNearRef.current = false;
    setBusy(false);
    await copyJson(out);
  }, [copyJson, device, farPoint, nearPoint, photoOutput, previewHeight, previewW, settings]);

  const stats = useMemo(() => computeStats(runs.map((r) => r.totalMs)), [runs]);
  const passMedian = runs.length > 0 && stats.median <= 1000;
  const okRate = focusOkRate(runs);

  if (!hasPermission) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: 'ベンチマーク' }} />
        <Text style={styles.msg}>{S.permissionCamera}</Text>
        <PrimaryButton label="カメラ許可" onPress={() => void requestPermission()} />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'ベンチマーク',
          headerRight: () => (
            <Pressable onPress={() => router.push('/settings')} style={{ padding: 8 }}>
              <Text style={{ color: '#3d7eff' }}>設定</Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView contentContainerStyle={[styles.wrap, { paddingBottom: insets.bottom + 48 }]}>
        <Pressable
          style={{ width: previewW, height: previewHeight, alignSelf: 'center' }}
          onPress={(e) => {
            const { locationX, locationY } = e.nativeEvent;
            void onTapPreview(locationX, locationY);
          }}
        >
          <View style={[styles.preview, { height: previewHeight, width: previewW }]}>
            {device && (
              <Camera
                ref={cameraRef}
                style={StyleSheet.absoluteFill}
                device={device}
                isActive={focused}
                outputs={[photoOutput]}
              />
            )}
          </View>
          <FocusMarker
            point={nearPoint}
            previewWidth={previewW}
            previewHeight={previewHeight}
            label={S.subjectLabel}
            color="#7ee787"
          />
          {farPoint && (
            <FocusMarker
              point={farPoint}
              previewWidth={previewW}
              previewHeight={previewHeight}
              label={S.backgroundLabel}
              color="#58a6ff"
            />
          )}
        </Pressable>

        <View style={styles.segmentRow}>
          <PrimaryButton
            label="ぬいぐるみ点"
            onPress={() => setMode('subject')}
            style={[styles.segBtn, mode === 'subject' && styles.segActive]}
          />
          <PrimaryButton
            label="背景点"
            onPress={() => setMode('background')}
            style={[styles.segBtn, mode === 'background' && styles.segActive]}
          />
        </View>
        {!farReady && <Text style={styles.hint}>{S.captureNeedFar}</Text>}

        <Text style={styles.meta}>
          戦略 {settings.strategyId} / {resolutionLabel(settings.photoResolution)} / S3 +{settings.s3ExtraDelayMs}ms
        </Text>

        <PrimaryButton
          label={
            busy
              ? '計測中…'
              : `${BENCHMARK_RUNS_DEFAULT}回実行（間隔 ${BENCHMARK_INTERVAL_MS / 1000}s）`
          }
          disabled={!canRun}
          onPress={() => void runBench()}
        />
        {runs.length > 0 && (
          <PrimaryButton
            label={jsonCopied ? 'JSONを再コピー' : 'JSONをコピー'}
            onPress={() => void copyJson(runs)}
            style={{ marginTop: 8, backgroundColor: '#333' }}
          />
        )}

        {runs.length > 0 && (
          <View style={styles.statsBox}>
            <Text style={styles.sectionTitle}>統計（totalMs）</Text>
            <MetricRow label="最小" value={`${Math.round(stats.min)} ms`} />
            <MetricRow label="中央値" value={`${Math.round(stats.median)} ms`} />
            <MetricRow label="p90" value={`${Math.round(stats.p90)} ms`} />
            <MetricRow label="最大" value={`${Math.round(stats.max)} ms`} />
            <MetricRow label="1000ms判定（中央値）" value={passMedian ? '✔ OK' : '✘ NG'} />
            <MetricRow
              label="ピント検証 OK率"
              value={`${Math.round(okRate * 100)}% (${runs.filter((r) => r.focusVerify === 'OK').length}/${runs.length})`}
            />
            {state.lastFusionTimings && (
              <Text style={styles.fusionHint}>
                直近合成: 合計 {Math.round(state.lastFusionTimings.totalMs)} ms
              </Text>
            )}
          </View>
        )}

        {runs.length > 0 && (
          <View style={styles.table}>
            <Text style={styles.sectionTitle}>各回の区間（ms）</Text>
            <Text style={styles.tableHeader}>
              {'#'.padEnd(3)} {'計'.padStart(5)}{' '}
              {'fA'.padStart(4)} {'pA'.padStart(4)} {'fB'.padStart(4)} {'del'.padStart(4)}{' '}
              {'pB'.padStart(4)} {'焦点'.padStart(6)}
            </Text>
            {runs.map((r, i) => (
              <Text key={i} style={styles.tableRow}>
                {`${i + 1}`.padEnd(3)} {`${Math.round(r.totalMs)}`.padStart(5)}{' '}
                {segCell(r.segments.focusA).padStart(4)} {segCell(r.segments.photoA).padStart(4)}{' '}
                {segCell(r.segments.focusB).padStart(4)} {segCell(r.segments.delay).padStart(4)}{' '}
                {segCell(r.segments.photoB).padStart(4)} {r.focusVerify.padStart(6)}
              </Text>
            ))}
          </View>
        )}
      </ScrollView>
      <ProgressOverlay visible={busy} message="ベンチマーク実行中…" />
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, paddingBottom: 48 },
  preview: { backgroundColor: '#000', borderRadius: 8, overflow: 'hidden' },
  segmentRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  segBtn: { flex: 1, backgroundColor: '#333' },
  segActive: { backgroundColor: '#2a4a8a' },
  hint: { color: '#f0c674', marginTop: 8, fontSize: 13 },
  meta: { color: '#888', marginVertical: 12, fontSize: 12 },
  statsBox: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
  },
  sectionTitle: { color: '#aaa', marginBottom: 8, fontSize: 13, fontWeight: '600' },
  fusionHint: { color: '#888', fontSize: 11, marginTop: 8 },
  table: { marginTop: 16, padding: 8, backgroundColor: '#111', borderRadius: 8 },
  tableHeader: {
    color: '#7ee787',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    fontSize: 11,
    marginBottom: 4,
  },
  tableRow: {
    color: '#ccc',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    fontSize: 11,
    marginTop: 2,
  },
  center: { flex: 1, justifyContent: 'center', padding: 24 },
  msg: { color: '#ccc', marginBottom: 16, textAlign: 'center' },
});