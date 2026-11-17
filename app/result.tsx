import { router, Stack } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
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
import { fuse } from '@/fusion/fuse';
import { defaultFusionParams } from '@/fusion/params';
import { useFusionRunner } from '@/hooks/useFusionRunner';
import {
  encodeToCacheJpeg,
  saveImageToGallery,
  shareCacheFile,
} from '@/imaging/saveImage';
import { loadImage } from '@/imaging/loadImage';
import { useAppState } from '@/state/AppState';
import { ErrorBanner } from '@/ui/ErrorBanner';
import { LabeledSlider } from '@/ui/LabeledSlider';
import { MetricRow } from '@/ui/MetricRow';
import { PrimaryButton } from '@/ui/PrimaryButton';
import { ProgressOverlay } from '@/ui/ProgressOverlay';
import { ManualMaskEditor } from '@/ui/ManualMaskEditor';
import { S } from '@/ui/strings';
import type { ResultViewMode } from '@/types';

const VIEW_TABS: { id: ResultViewMode; label: string }[] = [
  { id: 'result', label: '合成' },
  { id: 'mask', label: 'マスク' },
  { id: 'near', label: 'NEAR' },
  { id: 'far', label: 'FAR' },
  { id: 'sharpNear', label: '鮮鋭NEAR' },
  { id: 'sharpFar', label: '鮮鋭FAR' },
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
  const [notice, setNotice] = useState('');

  const nearUri = source?.nearUri;
  const farUri = source?.farUri;
  const refPsnr = state.synthetic?.referenceUri;

  const { result, error, stage, running } = useFusionRunner(nearUri, farUri, params, previewMode, {
    referenceUriForPsnr: refPsnr,
  });

  const previewUri = useMemo(() => {
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
  }, [farUri, nearUri, result, viewMode]);

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
      const full = await fuse(nearUri, farUri, params, () => undefined, undefined, {
        manualMask,
        referenceUriForPsnr: refPsnr,
      });
      const loaded = await loadImage(full.imageUri);
      const cacheUri = await encodeToCacheJpeg(loaded.image, 'export');
      try {
        await saveImageToGallery(cacheUri);
        setNotice('ギャラリーに保存しました');
      } catch (e) {
        if (String(e).includes('MEDIA_PERMISSION_DENIED')) {
          await shareCacheFile(cacheUri);
          setNotice('権限がないため共有シートを開きました');
        } else {
          throw e;
        }
      }
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
        </ScrollView>

        {previewUri ? (
          <Image source={{ uri: previewUri }} style={styles.preview} resizeMode="contain" />
        ) : (
          <View style={[styles.preview, styles.previewEmpty]}>
            <Text style={styles.msg}>プレビューを生成中…</Text>
          </View>
        )}

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

        <PrimaryButton
          label={S.save}
          onPress={() => void onSave()}
          disabled={saveBusy || running}
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
      <ProgressOverlay visible={running || saveBusy} message={saveBusy ? '保存中…' : stage || '合成中…'} />
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
  tabText: { color: '#ddd', fontSize: 12 },
  notice: { color: '#7ee787', marginTop: 8 },
  center: { flex: 1, justifyContent: 'center', padding: 24 },
  msg: { color: '#888', textAlign: 'center' },
});