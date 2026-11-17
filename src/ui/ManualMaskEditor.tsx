import {
  Canvas,
  Image as SkImageComp,
  PaintStyle,
  Skia,
  useImage,
} from '@shopify/react-native-skia';
import { useCallback, useEffect, useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';
import { encodeToCacheJpeg } from '@/imaging/saveImage';

type Props = {
  width: number;
  height: number;
  baseMaskUri?: string;
  onSaved: (uri: string) => void;
};

/** M9: 簡易ブラシ（NEAR=白）でマスクを上書き */
export function ManualMaskEditor({ width, height, baseMaskUri, onSaved }: Props) {
  const base = useImage(baseMaskUri);
  const strokes = useRef<{ x: number; y: number }[]>([]);
  const exportMaskRef = useRef<() => Promise<void>>(async () => {});
  const [busy, setBusy] = useState(false);

  const exportMask = useCallback(async () => {
    setBusy(true);
    try {
      const surface = Skia.Surface.MakeOffscreen(width, height);
      if (!surface) return;
      const canvas = surface.getCanvas();
      canvas.clear(Skia.Color('#000000'));
      if (base) {
        const paint = Skia.Paint();
        canvas.drawImage(base, 0, 0, paint);
      }
      const brush = Skia.Paint();
      brush.setColor(Skia.Color('#FFFFFF'));
      brush.setStyle(PaintStyle.Fill);
      brush.setAntiAlias(true);
      const pts = strokes.current;
      for (const pt of pts) {
        canvas.drawCircle(pt.x, pt.y, 12, brush);
      }
      const img = surface.makeImageSnapshot();
      surface.dispose();
      const uri = await encodeToCacheJpeg(img, 'manual-mask');
      onSaved(uri);
    } finally {
      setBusy(false);
    }
  }, [base, height, onSaved, width]);

  useEffect(() => {
    exportMaskRef.current = exportMask;
  }, [exportMask]);

  const [panHandlers] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        const { locationX, locationY } = e.nativeEvent;
        strokes.current = [{ x: locationX, y: locationY }];
      },
      onPanResponderMove: (e) => {
        const { locationX, locationY } = e.nativeEvent;
        strokes.current.push({ x: locationX, y: locationY });
      },
      onPanResponderRelease: () => {
        void exportMaskRef.current();
      },
    }).panHandlers,
  );

  return (
    <View {...panHandlers} style={[styles.box, { height }]}>
      <Canvas style={{ width, height }}>
        {base && <SkImageComp image={base} x={0} y={0} width={width} height={height} fit="fill" />}
      </Canvas>
      <Text style={styles.hint}>{busy ? '保存中…' : '指で NEAR にしたい領域をなぞる'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: '#000', borderRadius: 8, overflow: 'hidden', marginVertical: 8 },
  hint: { position: 'absolute', bottom: 8, left: 8, color: '#aaa', fontSize: 11 },
});