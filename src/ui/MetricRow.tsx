import { StyleSheet, Text, View } from 'react-native';

type Props = {
  label: string;
  value: string;
};

export function MetricRow({ label, value }: Props) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  label: { color: '#888', fontSize: 12 },
  value: { color: '#ccc', fontSize: 12 },
});