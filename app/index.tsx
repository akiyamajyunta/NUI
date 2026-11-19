import { Canvas, Circle, Fill } from '@shopify/react-native-skia';
import { Link, Stack } from 'expo-router';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useCameraSetup } from '@/camera/useCameraSetup';
import { PrimaryButton } from '@/ui/PrimaryButton';
import { MetricRow } from '@/ui/MetricRow';
import { S } from '@/ui/strings';

/** ホーム上部に出す。JS を端末へ載せたときにここが変わる */
const APP_DISPLAY_VERSION = '1119-3';

export default function HomeScreen() {
  const { device, supportsFocus } = useCameraSetup();

  return (
    <>
      <Stack.Screen options={{ title: `${S.appTitle} ${APP_DISPLAY_VERSION}` }} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
        <View style={styles.versionBanner}>
          <Text style={styles.versionLabel}>表示バージョン</Text>
          <Text style={styles.versionValue}>{APP_DISPLAY_VERSION}</Text>
        </View>
        <View style={styles.skiaBox}>
          <Canvas style={{ width: 120, height: 80 }}>
            <Fill color="#1a1a2e" />
            <Circle cx={60} cy={40} r={28} color="#3d7eff" />
            <Circle cx={80} cy={30} r={10} color="#7ee787" />
          </Canvas>
          <Text style={styles.skiaHint}>Skia 描画確認（M0）</Text>
        </View>

        <Link href="/capture" asChild>
          <PrimaryButton label={S.homeCapture} onPress={() => {}} style={styles.btnGap} />
        </Link>
        <Link href="/import" asChild>
          <PrimaryButton label={S.homeImport} onPress={() => {}} style={styles.btnGap} />
        </Link>
        <Link href="/io-test" asChild>
          <PrimaryButton label={S.homeIoTest} onPress={() => {}} style={styles.btnGap} />
        </Link>
        <Link href="/benchmark" asChild>
          <PrimaryButton label={S.homeBenchmark} onPress={() => {}} style={styles.btnGap} />
        </Link>
        <Link href="/synthetic" asChild>
          <PrimaryButton label={S.homeSynthetic} onPress={() => {}} style={styles.btnGap} />
        </Link>

        <View style={styles.info}>
          <Text style={styles.infoTitle}>端末情報</Text>
          <MetricRow label="OS" value={`${Platform.OS} ${Platform.Version}`} />
          <MetricRow label="カメラ" value={device?.id ?? '未取得'} />
          <MetricRow label="フォーカス" value={supportsFocus ? '対応' : '非対応'} />
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#111' },
  container: { padding: 20, gap: 4 },
  versionBanner: {
    backgroundColor: '#3d7eff',
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  versionLabel: { color: '#d6e4ff', fontSize: 13 },
  versionValue: { color: '#fff', fontSize: 28, fontWeight: '800', marginTop: 2 },
  skiaBox: { alignItems: 'center', marginBottom: 16 },
  skiaHint: { color: '#888', fontSize: 12, marginTop: 8 },
  btnGap: { marginTop: 10 },
  info: { marginTop: 24, padding: 12, backgroundColor: '#1a1a1a', borderRadius: 8 },
  infoTitle: { color: '#aaa', marginBottom: 8, fontSize: 13 },
});