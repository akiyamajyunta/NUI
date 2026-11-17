import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AppStateProvider } from '@/state/AppState';

void SplashScreen.preventAutoHideAsync().catch(() => {
  /* 初回起動などでは失敗しても続行 */
});

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    if (__DEV__) console.error('Root ErrorBoundary', error);
  }

  render() {
    if (this.state.error) {
      return (
        <View style={styles.err}>
          <Text style={styles.errTitle}>エラーが発生しました</Text>
          <Text style={styles.errBody}>{this.state.error.message}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

export default function RootLayout() {
  useEffect(() => {
    void SplashScreen.hideAsync();
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <AppStateProvider>
        <ErrorBoundary>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: '#111' },
              headerTintColor: '#fff',
              contentStyle: { backgroundColor: '#111' },
            }}
          />
        </ErrorBoundary>
      </AppStateProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#111' },
  err: { flex: 1, backgroundColor: '#111', justifyContent: 'center', padding: 24 },
  errTitle: { color: '#fff', fontSize: 18, marginBottom: 8 },
  errBody: { color: '#ccc' },
});