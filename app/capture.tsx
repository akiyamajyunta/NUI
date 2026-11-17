import { router, Stack, useIsFocused } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Camera, usePhotoOutput, type CameraRef } from 'react-native-vision-camera';
import { mapCaptureError } from '@/camera/focusMetering';
import { runCaptureSequence } from '@/camera/captureSequence';
import { normalizedToView, viewToNormalized } from '@/camera/focusPoints';
import { useCameraSetup } from '@/camera/useCameraSetup';
import { resolutionForPreset } from '@/config/photoResolution';
import { fitLongSide } from '@/imaging/downscale';
import { loadImage } from '@/imaging/loadImage';
import { readGrayFromSkImage } from '@/imaging/imagePixels';
import { verifyFocusFromGray } from '@/perf/focusVerify';
import { registerTempUri } from '@/hooks/useTempFileCleanup';
import { useAppState } from '@/state/AppState';
import { ErrorBanner } from '@/ui/ErrorBanner';
import { FocusMarker } from '@/ui/FocusMarker';
import { PrimaryButton } from '@/ui/PrimaryButton';
import { ProgressOverlay } from '@/ui/ProgressOverlay';
import { S } from '@/ui/strings';
import type { NormalizedPoint } from '@/types';
type PointMode = 'subject' | 'background';

export default function CaptureScreen() {
  const { state, dispatch } = useAppState();
  const { device, supportsFocus, hasPermission, requestPermission } = useCameraSetup();
  const focused = useIsFocused();
  const { width: winW, height: winH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [previewHeight, setPreviewHeight] = useState(() => Math.max(300, winH - 360));

  const cameraRef = useRef<CameraRef>(null);
  const focusedOnNearRef = useRef(false);
  const photoOutput = usePhotoOutput({
    targetResolution: resolutionForPreset(state.captureSettings.photoResolution),
    qualityPrioritization: 'speed',
    containerFormat: 'jpeg',
    quality: 0.9,
  });

  const [nearPoint, setNearPoint] = useState<NormalizedPoint>({ x: 0.5, y: 0.45 });
  const [farPoint, setFarPoint] = useState<NormalizedPoint | null>(null);
  const [mode, setMode] = useState<PointMode>('subject');
  const [busy, setBusy] = useState(false);
  const [lastCaptureMs, setLastCaptureMs] = useState<number | null>(null);
  const [error, setError] = useState('');

  const farReady = farPoint != null;
  const canShutter = farReady && !busy && device != null && supportsFocus;

  const onTapPreview = useCallback(
    async (x: number, y: number) => {
      const n = viewToNormalized(x, y, winW, previewHeight);
      if (mode === 'subject') setNearPoint(n);
      else setFarPoint(n);
      try {
        const view = normalizedToView(n, winW, previewHeight);
        await cameraRef.current?.focusTo(view);
        focusedOnNearRef.current = mode === 'subject';
      } catch {
        focusedOnNearRef.current = false;
      }
    },
    [mode, previewHeight, winW],
  );

  const onShutter = useCallback(async () => {
    if (!cameraRef.current || !photoOutput || !farPoint) return;
    setBusy(true);
    setError('');
    let goResult = false;
    try {
      const result = await runCaptureSequence({
        strategyId: state.captureSettings.strategyId,
        settings: state.captureSettings,
        camera: cameraRef.current,
        photoOutput,
        nearPoint,
        farPoint,
        previewWidth: winW,
        previewHeight,
        focusedOnNear: focusedOnNearRef.current,
      });
      focusedOnNearRef.current = true;
      setLastCaptureMs(result.totalMs);
      try {
        const { width: w, height: h } = fitLongSide(result.near.width, result.near.height, 512);
        const nearLoaded = await loadImage(result.near.uri);
        const farLoaded = await loadImage(result.far.uri);
        const gn = readGrayFromSkImage(nearLoaded.image, 512);
        const gf = readGrayFromSkImage(farLoaded.image, 512);
        const fv = verifyFocusFromGray(gn, gf, w, h, nearPoint, farPoint);
        dispatch({ type: 'SET_FOCUS_VERIFY', payload: fv });
      } catch {
        dispatch({ type: 'SET_FOCUS_VERIFY', payload: null });
      }
      dispatch({ type: 'SET_CAPTURE_RESULT', payload: result });
      dispatch({
        type: 'SET_FUSION_SOURCE',
        payload: { nearUri: result.near.uri, farUri: result.far.uri, from: 'capture' },
      });
      registerTempUri(dispatch, result.near.uri);
      registerTempUri(dispatch, result.far.uri);

      if (!state.captureSettings.saveOriginals) {
        // 合成後に掃除（result 側で完了画像のみ残す想定）
      }

      try {
        await cameraRef.current.focusTo(normalizedToView(nearPoint, winW, previewHeight));
        focusedOnNearRef.current = true;
      } catch {
        focusedOnNearRef.current = false;
      }

      goResult = state.captureSettings.autoFuseAfterCapture;
    } catch (e) {
      setError(mapCaptureError(e));
    } finally {
      setBusy(false);
    }
    if (goResult) {
      router.push('/result');
    }
  }, [dispatch, farPoint, nearPoint, photoOutput, previewHeight, state.captureSettings, winW]);

  if (!hasPermission) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: '撮影' }} />
        <Text style={styles.msg}>{S.permissionCamera}</Text>
        <PrimaryButton label="権限を許可" onPress={() => void requestPermission()} />
        <PrimaryButton
          label={S.openSettings}
          onPress={() => void Linking.openSettings()}
          style={{ marginTop: 12 }}
        />
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.center}>
        <Text style={styles.msg}>背面カメラが見つかりません</Text>
      </View>
    );
  }

  if (!supportsFocus) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: '撮影' }} />
        <ErrorBanner message="この端末はタップフォーカスに非対応です。ギャラリー合成は利用できます。" />
        <PrimaryButton label="ギャラリー合成へ" onPress={() => router.push('/import')} />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: '撮影',
          headerRight: () => (
            <Pressable onPress={() => router.push('/settings')} style={{ padding: 8 }}>
              <Text style={{ color: '#3d7eff' }}>設定</Text>
            </Pressable>
          ),
        }}
      />
      <View style={styles.root}>
        <Pressable
          style={styles.preview}
          onLayout={(e) => setPreviewHeight(Math.round(e.nativeEvent.layout.height))}
          onPress={(e) => {
            const { locationX, locationY } = e.nativeEvent;
            void onTapPreview(locationX, locationY);
          }}
        >
          <Camera
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            device={device}
            isActive={focused}
            outputs={[photoOutput]}
          />
          <FocusMarker
            point={nearPoint}
            previewWidth={winW}
            previewHeight={previewHeight}
            label={S.subjectLabel}
            color="#7ee787"
          />
          {farPoint && (
            <FocusMarker
              point={farPoint}
              previewWidth={winW}
              previewHeight={previewHeight}
              label={S.backgroundLabel}
              color="#58a6ff"
            />
          )}
        </Pressable>

        <View style={[styles.controls, { paddingBottom: insets.bottom + 24 }]}>
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
          {busy && <Text style={styles.hint}>{S.captureHold}</Text>}
          {lastCaptureMs != null && (
            <Text style={styles.metric}>撮影 {Math.round(lastCaptureMs)}ms</Text>
          )}
          {state.lastFocusVerify && (
            <Text style={styles.metric}>
              ピント検証 {state.lastFocusVerify}（戦略 {state.captureSettings.strategyId}）
            </Text>
          )}
          <ErrorBanner message={error} />
          <PrimaryButton
            label="シャッター"
            disabled={!canShutter}
            onPress={() => void onShutter()}
            style={{ marginTop: 8 }}
            accessibilityLabel="シャッター"
          />
        </View>
      </View>
      <ProgressOverlay visible={busy} message="撮影中…" />
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  preview: { flex: 1, overflow: 'hidden' },
  controls: { paddingHorizontal: 16, paddingTop: 12 },
  segmentRow: { flexDirection: 'row', gap: 8 },
  segBtn: { flex: 1, backgroundColor: '#333' },
  segActive: { backgroundColor: '#2a4a8a' },
  hint: { color: '#f0c674', marginTop: 8, fontSize: 13 },
  metric: { color: '#aaa', marginTop: 4 },
  center: { flex: 1, justifyContent: 'center', padding: 24 },
  msg: { color: '#ccc', marginBottom: 16, textAlign: 'center' },
});