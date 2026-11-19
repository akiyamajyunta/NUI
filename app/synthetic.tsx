import * as ImagePicker from 'expo-image-picker';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { loadImage } from '@/imaging/loadImage';
import { createSyntheticPair } from '@/imaging/syntheticPair';
import { useAppState } from '@/state/AppState';
import { ErrorBanner } from '@/ui/ErrorBanner';
import { PrimaryButton } from '@/ui/PrimaryButton';
import { ProgressOverlay } from '@/ui/ProgressOverlay';

/** M3: 擬似 NEAR/FAR を生成して合成へ */
export default function SyntheticScreen() {
  const { dispatch } = useAppState();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = async () => {
    setError('');
    const pick = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    if (pick.canceled || !pick.assets[0]) return;
    setBusy(true);
    try {
      const refUri = pick.assets[0].uri;
      const loaded = await loadImage(refUri);
      const pair = await createSyntheticPair(loaded.image, { farDx: 7, farDy: -4, farBrightness: 0.92 });
      dispatch({ type: 'SET_SYNTHETIC', payload: { referenceUri: refUri } });
      dispatch({
        type: 'SET_FUSION_SOURCE',
        payload: { nearUri: pair.nearUri, farUri: pair.farUri, from: 'import' },
      });
      dispatch({ type: 'PATCH_FUSION_PARAMS', payload: { align: true, colorMatch: true } });
      router.push('/result');
    } catch (e) {
      setError(e instanceof Error ? e.message : '擬似ペア生成に失敗');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: '擬似ペアテスト' }} />
      <View style={styles.box}>
        <Text style={styles.text}>
          鮮明な写真1枚から、NEAR/FAR の擬似ペアを作り合成します。結果画面で PSNR を表示します（M3）。
        </Text>
        <ErrorBanner message={error} />
        <PrimaryButton label="元画像を選んで合成へ" onPress={() => void run()} style={{ marginTop: 16 }} />
      </View>
      <ProgressOverlay visible={busy} message="擬似ペア生成中…" />
    </>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, padding: 20 },
  text: { color: '#ccc', lineHeight: 22 },
});