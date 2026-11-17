import * as ImagePicker from 'expo-image-picker';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppState } from '@/state/AppState';
import { ErrorBanner } from '@/ui/ErrorBanner';
import { PrimaryButton } from '@/ui/PrimaryButton';
import { S } from '@/ui/strings';

async function pickImage(): Promise<ImagePicker.ImagePickerAsset | null> {
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 1,
  });
  if (res.canceled || !res.assets[0]) return null;
  return res.assets[0];
}

export default function ImportScreen() {
  const { dispatch } = useAppState();
  const [near, setNear] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [far, setFar] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [warning, setWarning] = useState('');

  const ready = near != null && far != null;

  const onFuse = () => {
    if (!near || !far) return;
    if (near.width !== far.width || near.height !== far.height) {
      setWarning(
        `解像度が異なります（${near.width}x${near.height} vs ${far.width}x${far.height}）。縮小して合成します。`,
      );
    } else {
      setWarning('');
    }
    dispatch({
      type: 'SET_FUSION_SOURCE',
      payload: { nearUri: near.uri, farUri: far.uri, from: 'import' },
    });
    router.push('/result');
  };

  return (
    <>
      <Stack.Screen options={{ title: 'ギャラリー合成' }} />
      <View style={styles.container}>
        <Slot
          title={S.importNear}
          asset={near}
          onPick={async () => setNear(await pickImage())}
        />
        <Slot
          title={S.importFar}
          asset={far}
          onPick={async () => setFar(await pickImage())}
        />
        <ErrorBanner message={warning} />
        <PrimaryButton label={S.fuse} disabled={!ready} onPress={onFuse} style={{ marginTop: 16 }} />
      </View>
    </>
  );
}

function Slot({
  title,
  asset,
  onPick,
}: {
  title: string;
  asset: ImagePicker.ImagePickerAsset | null;
  onPick: () => void;
}) {
  return (
    <Pressable style={styles.slot} onPress={() => void onPick()}>
      <Text style={styles.slotTitle}>{title}</Text>
      {asset ? (
        <Image source={{ uri: asset.uri }} style={styles.thumb} resizeMode="cover" />
      ) : (
        <Text style={styles.tap}>タップして選択</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  slot: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#444',
    borderRadius: 12,
    padding: 12,
    minHeight: 160,
  },
  slotTitle: { color: '#ccc', marginBottom: 8 },
  thumb: { flex: 1, borderRadius: 8 },
  tap: { color: '#888', marginTop: 24, textAlign: 'center' },
});