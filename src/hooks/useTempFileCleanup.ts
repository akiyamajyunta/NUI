import { useEffect } from 'react';
import { deleteTempFile } from '@/imaging/saveImage';
import { useAppState } from '@/state/AppState';

export function useTempFileCleanupOnUnmount() {
  const { state, dispatch } = useAppState();
  useEffect(() => {
    const uris = state.tempUris;
    return () => {
      void Promise.all(uris.map((u) => deleteTempFile(u))).finally(() => {
        dispatch({ type: 'CLEAR_TEMP_URIS' });
      });
    };
    // アンマウント時のみ掃除（依存は意図的に固定）
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cleanup on unmount only
  }, []);
}

export function registerTempUri(dispatch: ReturnType<typeof useAppState>['dispatch'], uri: string) {
  dispatch({ type: 'ADD_TEMP_URI', payload: uri });
}