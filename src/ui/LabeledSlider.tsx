import Slider from '@react-native-community/slider';
import { StyleSheet, Text, View } from 'react-native';

type Props = {
  label: string;
  value: number;
  minimumValue: number;
  maximumValue: number;
  step?: number;
  onValueChange: (v: number) => void;
};

export function LabeledSlider({
  label,
  value,
  minimumValue,
  maximumValue,
  step = 0.01,
  onValueChange,
}: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>
        {label}: {value.toFixed(2)}
      </Text>
      <Slider
        minimumValue={minimumValue}
        maximumValue={maximumValue}
        step={step}
        value={value}
        onValueChange={onValueChange}
        minimumTrackTintColor="#3d7eff"
        maximumTrackTintColor="#444"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginVertical: 4 },
  label: { color: '#ccc', fontSize: 13 },
});