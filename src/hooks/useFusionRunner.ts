import { useCallback, useEffect, useRef, useState } from 'react';
import { fuse, type FuseOptions } from '@/fusion/fuse';
import { loadImage } from '@/imaging/loadImage';
import { useAppState } from '@/state/AppState';
import { PREVIEW_FUSION_LONG_SIDE } from '@/config/constants';
import type { FusionParams, FusionResult } from '@/types';

export function useFusionRunner(
  nearUri: string | undefined,
  farUri: string | undefined,
  params: FusionParams,
  previewOnly: boolean,
  extra?: Pick<FuseOptions, 'referenceUriForPsnr'>,
) {
  const { state, dispatch } = useAppState();
  const [result, setResult] = useState<FusionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<string>('');
  const [running, setRunning] = useState(false);
  const runId = useRef(0);
  // `extra` は呼び出し側で毎レンダー新しいオブジェクトになるため、値だけを依存に使う
  const referenceUriForPsnr = extra?.referenceUriForPsnr;
  const manualMaskUri = state.manualMaskUri;
  const subjectPoint = state.fusionSource?.nearPoint;
  const imageOrientation = state.fusionSource?.nearOrientation;

  const run = useCallback(async () => {
    if (!nearUri || !farUri) return;
    const id = ++runId.current;
    setRunning(true);
    setError(null);
    setStage('');
    try {
      const outputLongSide = previewOnly ? PREVIEW_FUSION_LONG_SIDE : undefined;
      let manualMask;
      if (manualMaskUri) {
        manualMask = (await loadImage(manualMaskUri)).image;
      }
      const onStage = (s: string) => {
        if (id === runId.current) setStage(s);
      };
      const fr = await fuse(nearUri, farUri, params, onStage, outputLongSide, {
        saveDebug: true,
        referenceUriForPsnr,
        manualMask,
        subjectPoint,
        orientation: imageOrientation,
      });
      if (id === runId.current) {
        setResult(fr);
        dispatch({ type: 'SET_LAST_FUSION', payload: fr.timings });
      }
    } catch (e) {
      if (id === runId.current) {
        setError(e instanceof Error ? e.message : '合成エラー');
      }
    } finally {
      if (id === runId.current) setRunning(false);
    }
  }, [
    nearUri,
    farUri,
    params,
    previewOnly,
    referenceUriForPsnr,
    manualMaskUri,
    subjectPoint,
    imageOrientation,
    dispatch,
  ]);

  useEffect(() => {
    const t = setTimeout(() => {
      void run();
    }, previewOnly ? 120 : 0);
    return () => clearTimeout(t);
  }, [run, previewOnly]);

  return { result, error, stage, running, rerun: run };
}

export async function probeImageUri(uri: string) {
  const loaded = await loadImage(uri);
  return { width: loaded.width, height: loaded.height };
}