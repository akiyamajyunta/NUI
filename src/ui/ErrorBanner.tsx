import { StyleSheet, Text, View } from 'react-native';

export function ErrorBanner({ message }: { message: string }) {
  if (!message) return null;
  return (
    <View style={styles.banner}>
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#5c1f1f',
    padding: 12,
    borderRadius: 8,
    marginVertical: 8,
  },
  text: { color: '#ffd4d4' },
});