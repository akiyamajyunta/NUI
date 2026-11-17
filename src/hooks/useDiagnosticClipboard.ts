import * as Clipboard from 'expo-clipboard';
import { useCallback, useRef } from 'react';
import { collectDiagnosticReportData } from '@/perf/collectDiagnosticReport';
import { formatDiagnosticReportClipboard, type DiagnosticReportData } from '@/perf/diagnosticReport';
import type { CollectDiagnosticOpts } from '@/perf/collectDiagnosticReport';

export function useDiagnosticClipboard() {
  const lastAutoKey = useRef<string | null>(null);

  const copyReport = useCallback(async (opts: CollectDiagnosticOpts): Promise<DiagnosticReportData> => {
    const data = await collectDiagnosticReportData(opts);
    const text = formatDiagnosticReportClipboard(data);
    await Clipboard.setStringAsync(text);
    return data;
  }, []);

  const tryAutoCopyAfterFusion = useCallback(
    async (opts: CollectDiagnosticOpts, enabled: boolean): Promise<DiagnosticReportData | null> => {
      if (!enabled) return null;
      const key = `${opts.fusedUri}:${opts.result.timings.totalMs}`;
      if (lastAutoKey.current === key) return null;
      const data = await copyReport(opts);
      lastAutoKey.current = key;
      return data;
    },
    [copyReport],
  );

  return { copyReport, tryAutoCopyAfterFusion };
}