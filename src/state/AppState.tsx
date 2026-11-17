import React, { createContext, useContext, useMemo, useReducer } from 'react';
import { DEFAULT_CAPTURE_SETTINGS, DEFAULT_FUSION_PARAMS } from '@/config/constants';
import type { CaptureSettings } from '@/config/constants';
import type { CaptureResult, FusionParams, FusionTimings, SyntheticSession } from '@/types';
import type { FocusVerifyResult } from '@/perf/focusVerify';

type FusionSource = {
  nearUri: string;
  farUri: string;
  from: 'import' | 'capture';
};

type State = {
  captureResult: CaptureResult | null;
  fusionParams: FusionParams;
  captureSettings: CaptureSettings;
  fusionSource: FusionSource | null;
  tempUris: string[];
  synthetic?: SyntheticSession | null;
  lastFocusVerify?: FocusVerifyResult | null;
  lastFusionTimings?: FusionTimings | null;
  manualMaskUri?: string | null;
};

type Action =
  | { type: 'SET_CAPTURE_RESULT'; payload: CaptureResult | null }
  | { type: 'SET_FUSION_PARAMS'; payload: FusionParams }
  | { type: 'PATCH_FUSION_PARAMS'; payload: Partial<FusionParams> }
  | { type: 'SET_CAPTURE_SETTINGS'; payload: CaptureSettings }
  | { type: 'SET_FUSION_SOURCE'; payload: FusionSource | null }
  | { type: 'ADD_TEMP_URI'; payload: string }
  | { type: 'CLEAR_TEMP_URIS' }
  | { type: 'SET_SYNTHETIC'; payload: SyntheticSession | null }
  | { type: 'SET_FOCUS_VERIFY'; payload: FocusVerifyResult | null }
  | { type: 'SET_LAST_FUSION'; payload: FusionTimings | null }
  | { type: 'SET_MANUAL_MASK'; payload: string | null };

const initialState: State = {
  captureResult: null,
  fusionParams: { ...DEFAULT_FUSION_PARAMS },
  captureSettings: { ...DEFAULT_CAPTURE_SETTINGS },
  fusionSource: null,
  tempUris: [],
  synthetic: null,
  lastFocusVerify: null,
  lastFusionTimings: null,
  manualMaskUri: null,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_CAPTURE_RESULT':
      return { ...state, captureResult: action.payload };
    case 'SET_FUSION_PARAMS':
      return { ...state, fusionParams: action.payload };
    case 'PATCH_FUSION_PARAMS':
      return { ...state, fusionParams: { ...state.fusionParams, ...action.payload } };
    case 'SET_CAPTURE_SETTINGS':
      return { ...state, captureSettings: action.payload };
    case 'SET_FUSION_SOURCE':
      return { ...state, fusionSource: action.payload };
    case 'ADD_TEMP_URI':
      if (state.tempUris.includes(action.payload)) return state;
      return { ...state, tempUris: [...state.tempUris, action.payload] };
    case 'CLEAR_TEMP_URIS':
      return { ...state, tempUris: [] };
    case 'SET_SYNTHETIC':
      return { ...state, synthetic: action.payload };
    case 'SET_FOCUS_VERIFY':
      return { ...state, lastFocusVerify: action.payload };
    case 'SET_LAST_FUSION':
      return { ...state, lastFusionTimings: action.payload };
    case 'SET_MANUAL_MASK':
      return { ...state, manualMaskUri: action.payload };
    default:
      return state;
  }
}

const AppStateContext = createContext<{
  state: State;
  dispatch: React.Dispatch<Action>;
} | null>(null);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('AppStateProvider missing');
  return ctx;
}