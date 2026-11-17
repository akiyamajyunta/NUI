import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { exportFullFusionToCache, saveCacheUriToGallery } from '@/fusion/exportFullFusion';
import type { PassthroughSharpnessReport } from '@/perf/diagnosticReport';
import type { FusionParams, FusionResult, NormalizedPoint, RangeStats } from '@/types';
import {
  type FusionQualityTable,
  type MaskBucketStats,
  computeQualityTable,
  maskBucketStatsFromUri,
} from '@/perf/fusionDiagnostics';
import { loadImage } from '@/imaging/loadImage';
import { MetricRow } from '@/ui/MetricRow';
import { PrimaryButton } from '@/ui/PrimaryButton';

const DEFAULT_NEAR: NormalizedPoint = { x: 0.5, y: 0.45 };
const DEFAULT_FAR: NormalizedPoint = { x: 0.5, y: 0.72 };

type Props = {
  nearUri: string;
  farUri: string;
  fusedUri: string | null;
  result: FusionResult | null;
  params: FusionParams;
  nearPoint?: NormalizedPoint;
  farPoint?: NormalizedPoint;
  captureWidth?: number;
  captureHeight?: number;
  maskUri?: string;
  previewLongSide: number;
  referenceUriForPsnr?: string;
  saveBusy: boolean;
  onSaveBusy: (v: boolean) => void;
  onNotice: (msg: string) => void;
  passthroughReport: PassthroughSharpnessReport | null;
  diagCopyBusy: boolean;
  onCopyDiagnostics: () => Promise<void>;
};

function fmtVar(v: number): string {
  return v < 0.0001 ? v.toExponential(2) : v.toFixed(5);
}

function fmtRange(r: RangeStats, digits: number): string {
  return `${r.min.toFixed(digits)} / ${r.median.toFixed(digits)} / ${r.max.toFixed(digits)}`;
}

function QualityTable({
  title,
  row,
}: {
  title: string;
  row: FusionQualityTable['atSubjectPoint'];
}) {
  return (
    <View style={styles.tableBlock}>
      <Text style={styles.tableTitle}>{title}</Text>
      <Text style={styles.tableHeader}>
        {''.padEnd(8)} NEAR元{'   '}FAR元{'   '}合成
      </Text>
      <Text style={styles.tableRow}>
        ラプラシアン分散 {fmtVar(row.near).padStart(7)} {fmtVar(row.far).padStart(7)} {fmtVar(row.fused).padStart(7)}
      </Text>
    </View>
  );
}

export function ResultDiagnosticsPanel(props: Props) {
  const nearPt = props.nearPoint ?? DEFAULT_NEAR;
  const farPt = props.farPoint ?? DEFAULT_FAR;
  const [quality, setQuality] = useState<FusionQualityTable | null>(null);
  const [maskStats, setMaskStats] = useState<MaskBucketStats | null>(null);
  const [diagError, setDiagError] = useState('');

  useEffect(() => {
    const fusedUri = props.fusedUri;
    if (!fusedUri) return;
    let alive = true;
    void (async () => {
      try {
        const [q, m] = await Promise.all([
          computeQualityTable(props.nearUri, props.farUri, fusedUri, nearPt, farPt),
          props.maskUri ? maskBucketStatsFromUri(props.maskUri) : Promise.resolve(null),
        ]);
        if (alive) {
          setQuality(q);
          setMaskStats(m);
          setDiagError('');
        }
      } catch (e) {
        if (alive) setDiagError(e instanceof Error ? e.message : '診断計算に失敗');
      }
    })();
    return () => {
      alive = false;
    };
  }, [props.nearUri, props.farUri, props.fusedUri, props.maskUri, nearPt, farPt]);

  const runPassthrough = async (forceMask: 'near' | 'far') => {
    props.onSaveBusy(true);
    props.onNotice('');
    try {
      const cacheUri = await exportFullFusionToCache({
        nearUri: props.nearUri,
        farUri: props.farUri,
        params: props.params,
        referenceUriForPsnr: props.referenceUriForPsnr,
        forceMask,
      });
      await loadImage(cacheUri);
      const dest = await saveCacheUriToGallery(cacheUri);
      props.onNotice(
        dest === 'gallery'
          ? `パススルー（${forceMask.toUpperCase()}）をギャラリーに保存しました`
          : `パススルー（${forceMask.toUpperCase()}）を共有しました`,
      );
    } catch (e) {
      props.onNotice(e instanceof Error ? e.message : 'パススルー保存に失敗');
    } finally {
      props.onSaveBusy(false);
    }
  };

  const outW = props.result?.width ?? 0;
  const outH = props.result?.height ?? 0;
  const capW = props.captureWidth ?? 0;
  const capH = props.captureHeight ?? 0;

  return (
    <View style={styles.box}>
      <Text style={styles.sectionTitle}>診断（開発）</Text>
      <PrimaryButton
        label="診断をコピー"
        disabled={props.saveBusy || props.diagCopyBusy || !props.fusedUri}
        onPress={() => void props.onCopyDiagnostics()}
        style={styles.devBtn}
      />

      <Text style={styles.subTitle}>メタデータ</Text>
      <MetricRow
        label="出力JPEG（現表示）"
        value={outW > 0 ? `${outW}×${outH}px` : '—'}
      />
      <MetricRow
        label="撮影解像度（NEAR）"
        value={capW > 0 ? `${capW}×${capH}px` : 'ギャラリー／不明'}
      />
      <MetricRow label="作業解像度（長辺）" value={`${props.params.workLongSide}px`} />
      <MetricRow
        label="プレビュー合成長辺"
        value={`${props.previewLongSide}px（保存はフル）`}
      />
      {props.result && (
        <>
          <MetricRow
            label="位置合わせ offset"
            value={`dx ${props.result.alignOffset.dx.toFixed(2)} dy ${props.result.alignOffset.dy.toFixed(2)}`}
          />
          <MetricRow
            label="位置合わせ信頼度"
            value={`${(props.result.alignConfidence * 100).toFixed(1)}%${props.result.alignWarning ? '（警告）' : ''}`}
          />
        </>
      )}

      <Text style={styles.subTitle}>画質比較（ラプラシアン分散）</Text>
      {diagError ? <Text style={styles.err}>{diagError}</Text> : null}
      {quality ? (
        <>
          <QualityTable title="被写体点周辺" row={quality.atSubjectPoint} />
          <QualityTable title="背景点周辺" row={quality.atBackgroundPoint} />
        </>
      ) : (
        <Text style={styles.hint}>合成完了後に計算します…</Text>
      )}

      <Text style={styles.subTitle}>マスク分布（0〜1）</Text>
      {maskStats ? (
        <>
          <MetricRow label="&lt;0.1（FAR寄り）" value={`${(maskStats.below01 * 100).toFixed(1)}%`} />
          <MetricRow label="0.1〜0.9（混合）" value={`${(maskStats.mid * 100).toFixed(1)}%`} />
          <MetricRow label="&gt;0.9（NEAR寄り）" value={`${(maskStats.above09 * 100).toFixed(1)}%`} />
          <MetricRow label="サンプル数" value={String(maskStats.sampleCount)} />
        </>
      ) : (
        <Text style={styles.hint}>マスク未生成</Text>
      )}

      <Text style={styles.subTitle}>鮮鋭度マップ・正規化差（最小 / 中央値 / 最大）</Text>
      {props.result?.maskDiagnostics ? (
        <>
          <MetricRow label="S_near" value={fmtRange(props.result.maskDiagnostics.sNear, 4)} />
          <MetricRow label="S_far" value={fmtRange(props.result.maskDiagnostics.sFar, 4)} />
          <MetricRow label="d（正規化差）" value={fmtRange(props.result.maskDiagnostics.d, 3)} />
          <MetricRow
            label="低テクスチャ画素"
            value={`${(props.result.maskDiagnostics.lowTextureRatio * 100).toFixed(1)}%`}
          />
        </>
      ) : (
        <Text style={styles.hint}>未取得</Text>
      )}

      <Text style={styles.subTitle}>パススルー鮮鋭度比（自動計測・コピー時）</Text>
      {props.passthroughReport ? (
        <>
          <MetricRow
            label="強制NEAR・被写体 vs NEAR元"
            value={`${props.passthroughReport.forceNear.subjectVsNearOrigPct.toFixed(1)}%`}
          />
          <MetricRow
            label="強制NEAR・被写体 vs 通常合成"
            value={`${props.passthroughReport.forceNear.subjectVsNormalFusedPct.toFixed(1)}%`}
          />
          <MetricRow
            label="強制FAR・背景 vs FAR元"
            value={`${props.passthroughReport.forceFar.backgroundVsFarOrigPct.toFixed(1)}%`}
          />
          <MetricRow
            label="強制FAR・背景 vs 通常合成"
            value={`${props.passthroughReport.forceFar.backgroundVsNormalFusedPct.toFixed(1)}%`}
          />
        </>
      ) : (
        <Text style={styles.hint}>「診断をコピー」または自動コピーで算出します</Text>
      )}

      <Text style={styles.subTitle}>パススルー試験（ギャラリー保存・任意）</Text>
      <PrimaryButton
        label="マスク強制 NEAR で出力"
        disabled={props.saveBusy}
        onPress={() => void runPassthrough('near')}
        style={styles.devBtn}
      />
      <PrimaryButton
        label="マスク強制 FAR で出力"
        disabled={props.saveBusy}
        onPress={() => void runPassthrough('far')}
        style={[styles.devBtn, { marginTop: 8 }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#1a2433',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2a4a8a',
  },
  sectionTitle: { color: '#8ab4ff', fontWeight: '700', marginBottom: 8 },
  subTitle: { color: '#aaa', marginTop: 10, marginBottom: 4, fontSize: 13 },
  tableBlock: { marginVertical: 4 },
  tableTitle: { color: '#ccc', fontSize: 12, marginBottom: 2 },
  tableHeader: { color: '#888', fontSize: 11, fontFamily: 'monospace' },
  tableRow: { color: '#ddd', fontSize: 11, fontFamily: 'monospace' },
  hint: { color: '#666', fontSize: 12 },
  err: { color: '#f0c674', fontSize: 12 },
  devBtn: { backgroundColor: '#2a4a6a' },
});