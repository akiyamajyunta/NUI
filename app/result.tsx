import { router, Stack } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildAlignEdgeOverlayUri } from '@/perf/alignEdgeOverlay';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { defaultFusionParams } from '@/fusion/params';
import { exportFullFusionToCache, saveCacheUriToGallery } from '@/fusion/exportFullFusion';
import { useFusionRunner } from '@/hooks/useFusionRunner';
import { PREVIEW_FUSION_LONG_SIDE } from '@/config/constants';
import { loadImage } from '@/imaging/loadImage';
import { useAppState } from '@/state/AppState';
import { ErrorBanner } from '@/ui/ErrorBanner';
import { LabeledSlider } from '@/ui/LabeledSlider';
import { MetricRow } from '@/ui/MetricRow';
import { PrimaryButton } from '@/ui/PrimaryButton';
import { ProgressOverlay } from '@/ui/ProgressOverlay';
import { ManualMaskEditor } from '@/ui/ManualMaskEditor';
import { ResultDiagnosticsPanel } from '@/ui/ResultDiagnosticsPanel';
import { useDiagnosticClipboard } from '@/hooks/useDiagnosticClipboard';
import type { CollectDiagnosticOpts } from '@/perf/collectDiagnosticReport';
import type { PassthroughSharpnessReport } from '@/perf/diagnosticReport';
import { S } from '@/ui/strings';
import type { NormalizedPoint, ResultViewMode } from '@/types';

const DEFAULT_NEAR: NormalizedPoint = { x: 0.5, y: 0.45 };
const DEFAULT_FAR: NormalizedPoint = { x: 0.5, y: 0.72 };

const VIEW_TABS: { id: ResultViewMode; label: string }[] = [
  { id: 'result', label: '合成' },
  { id: 'mask', label: 'マスク' },
  { id: 'near', label: 'NEAR' },
  { id: 'far', label: 'FAR' },
  { id: 'sharpNear', label: '鮮鋭NEAR' },
  { id: 'sharpFar', label: '鮮鋭FAR' },
];

const DEV_VIEW_TABS: { id: ResultViewMode; label: string }[] = [
  { id: 'blink', label: 'NEAR/FAR点滅' },
  { id: 'edgeOverlay', label: 'エッジ重ね' },
];

export default function ResultScreen() {
  const { state, dispatch } = useAppState();
  const source = state.fusionSource;
  const params = state.fusionParams;
  const { width: winW } = useWindowDimensions();
  const [previewMode, setPreviewMode] = useState(true);
  const [viewMode, setViewMode] = useState<ResultViewMode>('result');
  const [maskEdit, setMaskEdit] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [diagCopyBusy, setDiagCopyBusy] = useState(false);
  const [passthroughReport, setPassthroughReport] = useState<PassthroughSharpnessReport | null>(null);
  const [notice, setNotice] = useState('');
  const [blinkShowNear, setBlinkShowNear] = useState(true);
  const [edgeAlignApplied, setEdgeAlignApplied] = useState(false);
  const [edgeOverlayUri, setEdgeOverlayUri] = useState<string | null>(null);
  const [edgeOverlayBusy, setEdgeOverlayBusy] = useState(false);
  const { copyReport, tryAutoCopyAfterFusion } = useDiagnosticClipboard();
  const autoCopyTriggered = useRef<string | null>(null);

  const nearUri = source?.nearUri;
  const farUri = source?.farUri;
  const refPsnr = state.synthetic?.referenceUri;

  const { result, error, stage, running } = useFusionRunner(nearUri, farUri, params, previewMode, {
    referenceUriForPsnr: refPsnr,
  });

  const buildDiagnosticOpts = useCallback((): CollectDiagnosticOpts | null => {
    if (!source || !nearUri || !farUri || !result?.imageUri) return null;
    return {
      sourceFrom: source.from,
      nearUri,
      farUri,
      fusedUri: result.imageUri,
      nearPoint: source.nearPoint ?? DEFAULT_NEAR,
      farPoint: source.farPoint ?? DEFAULT_FAR,
      params,
      result,
      previewLongSide: PREVIEW_FUSION_LONG_SIDE,
      maskUri: result.debug?.maskUri,
      strategyId: state.captureResult?.strategyId,
      captureMs: state.captureResult?.totalMs,
      focusVerify: state.lastFocusVerify,
      captureWidth: source.captureWidth,
      captureHeight: source.captureHeight,
      captureTimeline: state.captureResult?.timeline,
      closedLoop: state.captureResult?.closedLoop,
      focusABeforeShot: state.captureResult?.focusABeforeShot,
      holdBackgroundFocus: state.captureResult?.holdBackgroundFocus,
      nearOrientation: source.nearOrientation,
      farOrientation: source.farOrientation,
      includePassthrough: true,
    };
  }, [farUri, nearUri, params, result, source, state.captureResult, state.lastFocusVerify]);

  const onCopyDiagnostics = useCallback(async () => {
    const opts = buildDiagnosticOpts();
    if (!opts) return;
    setDiagCopyBusy(true);
    setNotice('');
    try {
      const data = await copyReport(opts);
      setPassthroughReport(data.passthrough);
      setNotice('診断レポートをコピーしました');
    } catch (e) {
      setNotice(e instanceof Error ? e.message : '診断のコピーに失敗しました');
    } finally {
      setDiagCopyBusy(false);
    }
  }, [buildDiagnosticOpts, copyReport]);

  useEffect(() => {
    if (!__DEV__ || !state.captureSettings.autoCopyDiagnosticsAfterFusion) return;
    if (!result?.imageUri || running) return;
    if (autoCopyTriggered.current === result.imageUri) return;
    const opts = buildDiagnosticOpts();
    if (!opts) return;
    autoCopyTriggered.current = result.imageUri;
    void (async () => {
      setDiagCopyBusy(true);
      try {
        const data = await tryAutoCopyAfterFusion(opts, true);
        if (data) {
          setPassthroughReport(data.passthrough);
          setNotice('診断を自動コピーしました');
        }
      } catch {
        setNotice('診断の自動コピーに失敗しました');
      } finally {
        setDiagCopyBusy(false);
      }
    })();
  }, [
    buildDiagnosticOpts,
    result?.imageUri,
    running,
    state.captureSettings.autoCopyDiagnosticsAfterFusion,
    tryAutoCopyAfterFusion,
  ]);

  useEffect(() => {
    if (viewMode !== 'blink' || !nearUri || !farUri) return undefined;
    const id = setInterval(() => setBlinkShowNear((v) => !v), 500);
    return () => clearInterval(id);
  }, [viewMode, nearUri, farUri]);

  useEffect(() => {
    if (viewMode !== 'edgeOverlay' || !nearUri || !farUri) return undefined;
    let alive = true;
    void (async () => {
      if (alive) setEdgeOverlayBusy(true);
      try {
        const est = result?.alignEstimatedOffset ?? { dx: 0, dy: 0 };
        const uri = await buildAlignEdgeOverlayUri({
          nearUri,
          farUri,
          alignDx: est.dx,
          alignDy: est.dy,
          applyAlignOffset: edgeAlignApplied,
        });
        if (alive) setEdgeOverlayUri(uri);
      } catch {
        if (alive) setEdgeOverlayUri(null);
      } finally {
        if (alive) setEdgeOverlayBusy(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [viewMode, nearUri, farUri, edgeAlignApplied, result?.alignEstimatedOffset]);

  const previewUri = useMemo(() => {
    if (viewMode === 'blink') {
      if (blinkShowNear) return result?.debug?.nearUri ?? nearUri ?? null;
      return result?.debug?.farUri ?? farUri ?? null;
    }
    if (viewMode === 'edgeOverlay') return edgeOverlayUri;
    if (!result) return null;
    switch (viewMode) {
      case 'result':
        return result.imageUri;
      case 'mask':
        return result.debug?.maskUri ?? null;
      case 'near':
        return result.debug?.nearUri ?? nearUri ?? null;
      case 'far':
        return result.debug?.farUri ?? farUri ?? null;
      case 'sharpNear':
        return result.debug?.sharpNearUri ?? null;
      case 'sharpFar':
        return result.debug?.sharpFarUri ?? null;
      default:
        return result.imageUri;
    }
  }, [blinkShowNear, edgeOverlayUri, farUri, nearUri, result, viewMode]);

  const patch = useCallback(
    (p: Partial<typeof params>) => {
      dispatch({ type: 'PATCH_FUSION_PARAMS', payload: p });
      setPreviewMode(true);
    },
    [dispatch],
  );

  const onSave = async () => {
    if (!nearUri || !farUri) return;
    setSaveBusy(true);
    setNotice('');
    try {
      setPreviewMode(false);
      let manualMask;
      if (state.manualMaskUri) {
        manualMask = (await loadImage(state.manualMaskUri)).image;
      }
      const cacheUri = await exportFullFusionToCache({
        nearUri,
        farUri,
        params,
        manualMask,
        referenceUriForPsnr: refPsnr,
      });
      await loadImage(cacheUri);
      const dest = await saveCacheUriToGallery(cacheUri);
      setNotice(dest === 'gallery' ? 'ギャラリーに保存しました' : '権限がないため共有シートを開きました');
    } catch (e) {
      setNotice(e instanceof Error ? e.message : '保存に失敗しました');
    } finally {
      setSaveBusy(false);
    }
  };

  if (!source) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: '合成結果' }} />
        <Text style={styles.msg}>合成する画像がありません</Text>
        <PrimaryButton label="ホーム" onPress={() => router.replace('/')} />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: '合成結果' }} />
      <ScrollView contentContainerStyle={styles.container}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabRow}>
          {VIEW_TABS.map((t) => (
            <Pressable
              key={t.id}
              onPress={() => setViewMode(t.id)}
              style={[styles.tab, viewMode === t.id && styles.tabActive]}
            >
              <Text style={styles.tabText}>{t.label}</Text>
            </Pressable>
          ))}
          {__DEV__
            ? DEV_VIEW_TABS.map((t) => (
                <Pressable
                  key={t.id}
                  onPress={() => setViewMode(t.id)}
                  style={[styles.tab, styles.tabDev, viewMode === t.id && styles.tabActive]}
                >
                  <Text style={styles.tabText}>{t.label}</Text>
                </Pressable>
              ))
            : null}
        </ScrollView>

        {previewUri ? (
          <Image source={{ uri: previewUri }} style={styles.preview} resizeMode="contain" />
        ) : (
          <View style={[styles.preview, styles.previewEmpty]}>
            <Text style={styles.msg}>
              {viewMode === 'edgeOverlay' && edgeOverlayBusy ? 'エッジ画像を生成中…' : 'プレビューを生成中…'}
            </Text>
          </View>
        )}

        {__DEV__ && viewMode === 'edgeOverlay' ? (
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>
              {edgeAlignApplied ? '位置合わせ後（推定 offset 適用）' : '位置合わせ前'}
            </Text>
            <Switch value={edgeAlignApplied} onValueChange={setEdgeAlignApplied} />
          </View>
        ) : null}
        {__DEV__ && viewMode === 'blink' ? (
          <Text style={styles.hintDev}>0.5秒ごとに NEAR / FAR を自動切替（赤=NEAR・点滅は原画）</Text>
        ) : null}
        {__DEV__ && viewMode === 'edgeOverlay' ? (
          <Text style={styles.hintDev}>赤=NEARエッジ / 青=FARエッジ（Sobel勾配、長辺256px）</Text>
        ) : null}

        <ErrorBanner message={error ?? ''} />
        {result?.psnrDb != null && (
          <MetricRow label="PSNR（M3）" value={`${result.psnrDb.toFixed(2)} dB`} />
        )}
        {result?.alignOffset && (
          <MetricRow
            label="位置合わせ"
            value={`dx ${result.alignOffset.dx.toFixed(1)} dy ${result.alignOffset.dy.toFixed(1)} conf ${(result.alignConfidence * 100).toFixed(0)}%`}
          />
        )}
        {result?.alignWarning && (
          <ErrorBanner message="位置合わせの信頼度が低い可能性があります。手動マスクで補正できます（M9）。" />
        )}

        <View style={styles.timings}>
          {result &&
            Object.entries(result.timings).map(([k, v]) => (
              <MetricRow key={k} label={k} value={`${Math.round(v)} ms`} />
            ))}
        </View>

        <LabeledSlider
          label="閾値"
          value={params.threshold}
          minimumValue={0.01}
          maximumValue={0.3}
          onValueChange={(v) => patch({ threshold: v })}
        />
        <LabeledSlider
          label="マスクぼかし"
          value={params.maskBlurRadius}
          minimumValue={0}
          maximumValue={12}
          step={1}
          onValueChange={(v) => patch({ maskBlurRadius: v })}
        />
        <LabeledSlider
          label="NEAR寄り"
          value={params.nearBias}
          minimumValue={-0.2}
          maximumValue={0.2}
          onValueChange={(v) => patch({ nearBias: v })}
        />
        <LabeledSlider
          label="境界収縮"
          value={params.haloShrink}
          minimumValue={0}
          maximumValue={0.1}
          onValueChange={(v) => patch({ haloShrink: v })}
        />

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>位置合わせ</Text>
          <Switch value={params.align} onValueChange={(v) => patch({ align: v })} />
        </View>
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>色合わせ（簡易）</Text>
          <Switch value={params.colorMatch} onValueChange={(v) => patch({ colorMatch: v })} />
        </View>

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>手動マスク編集（M9）</Text>
          <Switch value={maskEdit} onValueChange={setMaskEdit} />
        </View>
        {maskEdit && result?.debug?.maskUri && (
          <ManualMaskEditor
            width={winW - 32}
            height={220}
            baseMaskUri={state.manualMaskUri ?? result.debug.maskUri}
            onSaved={(uri) => {
              dispatch({ type: 'SET_MANUAL_MASK', payload: uri });
              setPreviewMode(true);
            }}
          />
        )}
        {state.manualMaskUri ? (
          <PrimaryButton
            label="手動マスクをクリア"
            onPress={() => dispatch({ type: 'SET_MANUAL_MASK', payload: null })}
            style={{ marginTop: 8, backgroundColor: '#333' }}
          />
        ) : null}

        {notice ? <Text style={styles.notice}>{notice}</Text> : null}

        {__DEV__ && nearUri && farUri ? (
          <ResultDiagnosticsPanel
            nearUri={nearUri}
            farUri={farUri}
            fusedUri={result?.imageUri ?? null}
            result={result}
            params={params}
            nearPoint={source.nearPoint}
            farPoint={source.farPoint}
            captureWidth={source.captureWidth}
            captureHeight={source.captureHeight}
            maskUri={result?.debug?.maskUri}
            referenceUriForPsnr={refPsnr}
            previewLongSide={PREVIEW_FUSION_LONG_SIDE}
            saveBusy={saveBusy}
            onSaveBusy={setSaveBusy}
            onNotice={setNotice}
            passthroughReport={passthroughReport}
            diagCopyBusy={diagCopyBusy}
            onCopyDiagnostics={onCopyDiagnostics}
          />
        ) : null}

        <PrimaryButton
          label={S.save}
          onPress={() => void onSave()}
          disabled={saveBusy || running || diagCopyBusy}
          style={{ marginTop: 12 }}
        />
        <PrimaryButton
          label={S.retake}
          onPress={() => router.push(source.from === 'capture' ? '/capture' : '/import')}
          style={{ marginTop: 10, backgroundColor: '#444' }}
        />
        <PrimaryButton
          label={S.resetParams}
          onPress={() => dispatch({ type: 'SET_FUSION_PARAMS', payload: defaultFusionParams() })}
          style={{ marginTop: 10, backgroundColor: '#333' }}
        />
      </ScrollView>
      <ProgressOverlay
        visible={running || saveBusy || diagCopyBusy}
        message={diagCopyBusy ? '診断を収集中…' : saveBusy ? '保存中…' : stage || '合成中…'}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40 },
  preview: { width: '100%', height: 280, backgroundColor: '#000', borderRadius: 8 },
  previewEmpty: { justifyContent: 'center', alignItems: 'center' },
  timings: { marginVertical: 12, padding: 8, backgroundColor: '#1a1a1a', borderRadius: 8 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 6,
  },
  switchLabel: { color: '#ccc' },
  tabRow: { marginBottom: 8, maxHeight: 40 },
  tab: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginRight: 6,
    backgroundColor: '#222',
    borderRadius: 6,
  },
  tabActive: { backgroundColor: '#2a4a8a' },
  tabDev: { borderWidth: 1, borderColor: '#3a5a9a' },
  tabText: { color: '#ddd', fontSize: 12 },
  hintDev: { color: '#7a9acc', fontSize: 11, marginBottom: 6 },
  notice: { color: '#7ee787', marginTop: 8 },
  center: { flex: 1, justifyContent: 'center', padding: 24 },
  msg: { color: '#888', textAlign: 'center' },
});