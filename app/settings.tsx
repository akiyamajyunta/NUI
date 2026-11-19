import { Stack } from 'expo-router';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import {
  type CaptureSettings,
  type CaptureStrategyId,
  type PhotoResolutionPreset,
} from '@/config/constants';
import type { FusionParams, ScaleCorrectionMode } from '@/types';
import { useAppState } from '@/state/AppState';

const STRATEGIES: CaptureStrategyId[] = ['S1', 'S2', 'S3'];
const RESOLUTIONS: PhotoResolutionPreset[] = ['HD_4_3', 'FHD_4_3', 'UHD_4_3'];
const S3_DELAYS: CaptureSettings['s3ExtraDelayMs'][] = [0, 50, 100, 200];
const FOCUS_SETTLES: CaptureSettings['focusSettleMs'][] = [0, 100, 200, 300];
const SCALE_MODES: ScaleCorrectionMode[] = ['off', 'estimate', 'fixed'];
const SCALE_FIXED_VALUES = [0.95, 0.98, 1, 1.02, 1.05, 1.08, 1.1];
const SCALE_MIN_GAINS = [0.0005, 0.001, 0.002, 0.005];

function scaleModeLabel(mode: ScaleCorrectionMode): string {
  if (mode === 'off') return 'オフ';
  if (mode === 'fixed') return '固定値';
  return '毎回推定';
}

export default function SettingsScreen() {
  const { state, dispatch } = useAppState();
  const s = state.captureSettings;
  const fusion = state.fusionParams;

  const patch = (p: Partial<CaptureSettings>) => {
    dispatch({ type: 'SET_CAPTURE_SETTINGS', payload: { ...s, ...p } });
  };
  const patchFusion = (p: Partial<FusionParams>) => {
    dispatch({ type: 'PATCH_FUSION_PARAMS', payload: p });
  };

  const cycle = <T extends string | number>(list: T[], current: T): T => {
    const i = list.indexOf(current);
    return list[(i + 1) % list.length];
  };

  return (
    <>
      <Stack.Screen options={{ title: '撮影設定' }} />
      <View style={styles.container}>
        <PickerRow
          label="撮影戦略（M6/M7）"
          value={s.strategyId}
          onPress={() => patch({ strategyId: cycle(STRATEGIES, s.strategyId) })}
        />
        <PickerRow
          label="写真解像度"
          value={s.photoResolution}
          onPress={() => patch({ photoResolution: cycle(RESOLUTIONS, s.photoResolution) })}
        />
        {s.strategyId === 'S3' && (
          <PickerRow
            label="S3 追加待ち (ms)"
            value={String(s.s3ExtraDelayMs)}
            onPress={() => patch({ s3ExtraDelayMs: cycle(S3_DELAYS, s.s3ExtraDelayMs) })}
          />
        )}
        <Row
          label="撮影後に自動で合成へ"
          value={s.autoFuseAfterCapture}
          onChange={(v) => patch({ autoFuseAfterCapture: v })}
        />
        <PickerRow
          label="フォーカス後の待ち (ms)"
          value={String(s.focusSettleMs)}
          onPress={() => patch({ focusSettleMs: cycle(FOCUS_SETTLES, s.focusSettleMs) })}
        />
        <Row
          label="撮影1前に必ずフォーカス"
          value={s.refocusBeforeFirst}
          onChange={(v) => patch({ refocusBeforeFirst: v })}
        />
        <Row
          label="ピント維持（背景点・実験）"
          value={s.holdBackgroundFocus}
          onChange={(v) => patch({ holdBackgroundFocus: v })}
        />
        <Row
          label="閉ループ撮影（1回再撮・試作）"
          value={s.closedLoopCapture}
          onChange={(v) => patch({ closedLoopCapture: v })}
        />
        <Row label="元画像を保持" value={s.saveOriginals} onChange={(v) => patch({ saveOriginals: v })} />
        <Row
          label="撮影後、診断を自動でコピー"
          value={s.autoCopyDiagnosticsAfterFusion}
          onChange={(v) => patch({ autoCopyDiagnosticsAfterFusion: v })}
        />
        <PickerRow
          label="拡大率補正"
          value={scaleModeLabel(fusion.scaleMode)}
          onPress={() => patchFusion({ scaleMode: cycle(SCALE_MODES, fusion.scaleMode) })}
        />
        {fusion.scaleMode === 'fixed' ? (
          <PickerRow
            label="拡大率の固定値"
            value={fusion.scaleFixed.toFixed(2)}
            onPress={() =>
              patchFusion({ scaleFixed: cycle(SCALE_FIXED_VALUES, fusion.scaleFixed) })
            }
          />
        ) : null}
        <PickerRow
          label="拡大率フォールバックしきい値"
          value={fusion.scaleMinGain.toFixed(4)}
          onPress={() =>
            patchFusion({ scaleMinGain: cycle(SCALE_MIN_GAINS, fusion.scaleMinGain) })
          }
        />
        <Row
          label="拡大率×平行移動を診断（重い）"
          value={s.scaleJointSearch}
          onChange={(v) => patch({ scaleJointSearch: v })}
        />
        <Text style={styles.note}>
          S1=順次フォーカス / S2=スナップショットピント / S3=固定遅延。ベンチマークはホームから。
        </Text>
      </View>
    </>
  );
}

function Row({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Switch value={value} onValueChange={onChange} />
    </View>
  );
}

function PickerRow({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#333',
  },
  label: { color: '#ddd', flex: 1, paddingRight: 12 },
  value: { color: '#58a6ff', fontWeight: '600' },
  note: { color: '#666', marginTop: 24, fontSize: 12, lineHeight: 18 },
});