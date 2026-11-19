import * as ImagePicker from 'expo-image-picker';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { Canvas, Image as SkImageComp, useImage } from '@shopify/react-native-skia';
import { StyleSheet, Text, View } from 'react-native';
import { loadImage } from '@/imaging/loadImage';
import { encodeToCacheJpeg, saveImageToGallery, shareCacheFile } from '@/imaging/saveImage';
import { PrimaryButton } from '@/ui/PrimaryButton';
import { ErrorBanner } from '@/ui/ErrorBanner';

/** M2: 1枚選んで読み込み→表示→JPEG保存 */
export default function IoTestScreen() {
  const [uri, setUri] = useState<string | null>(null);
  const [size, setSize] = useState('');
  const [saved, setSaved] = useState('');
  const [error, setError] = useState('');
  const skUri = useImage(uri ?? undefined);

  const pick = async () => {
    setError('');
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    if (res.canceled || !res.assets[0]) return;
    const asset = res.assets[0];
    try {
      const loaded = await loadImage(asset.uri);
      setUri(loaded.uri);
      setSize(`${loaded.width} x ${loaded.height} / ${loaded.orientation}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : '読込失敗');
    }
  };

  const save = async () => {
    if (!uri) return;
    setError('');
    try {
      const loaded = await loadImage(uri);
      const out = await encodeToCacheJpeg(loaded.image, 'm2-test');
      try {
        await saveImageToGallery(out);
        setSaved('ギャラリーに保存しました');
      } catch {
        await shareCacheFile(out);
        setSaved('共有で保存してください');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失敗');
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: '画像IOテスト' }} />
      <View style={styles.container}>
        <PrimaryButton label="ギャラリーから1枚選ぶ" onPress={() => void pick()} />
        {size ? <Text style={styles.meta}>{size}</Text> : null}
        <View style={styles.canvasWrap}>
          {skUri ? (
            <Canvas style={{ flex: 1 }}>
              <SkImageComp image={skUri} x={0} y={0} width={320} height={240} fit="contain" />
            </Canvas>
          ) : (
            <Text style={styles.placeholder}>画像未選択</Text>
          )}
        </View>
        <ErrorBanner message={error} />
        {saved ? <Text style={styles.ok}>{saved}</Text> : null}
        <PrimaryButton
          label="JPEGで保存"
          disabled={!uri}
          onPress={() => void save()}
          style={{ marginTop: 12 }}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  meta: { color: '#aaa', marginVertical: 8 },
  canvasWrap: {
    height: 260,
    backgroundColor: '#000',
    borderRadius: 8,
    marginVertical: 12,
    justifyContent: 'center',
  },
  placeholder: { color: '#666', textAlign: 'center' },
  ok: { color: '#7ee787', marginTop: 8 },
});