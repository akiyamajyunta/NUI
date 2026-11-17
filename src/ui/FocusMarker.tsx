import { StyleSheet, Text, View } from 'react-native';
import type { NormalizedPoint } from '@/types';
import { normalizedToView } from '@/camera/focusPoints';

type Props = {
  point: NormalizedPoint;
  previewWidth: number;
  previewHeight: number;
  label: string;
  color: string;
};

export function FocusMarker({ point, previewWidth, previewHeight, label, color }: Props) {
  const { x, y } = normalizedToView(point, previewWidth, previewHeight);
  return (
    <View
      pointerEvents="none"
      style={[
        styles.marker,
        {
          left: x - 22,
          top: y - 22,
          borderColor: color,
        },
      ]}
    >
      <Text style={[styles.label, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  marker: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  label: { fontSize: 9, fontWeight: '600' },
});