import {
  decodeSharpness,
  encodeSharpness,
  fillMaskValue,
  finalMaskValue,
  maskDiagnosticsFromEncoded,
  normalizedDiff,
  rawMaskValue,
  textureConfidence,
} from '@/fusion/maskCore';
import {
  DEFAULT_FUSION_PARAMS,
  MASK_FILL_FALLBACK,
  MASK_LOW_TEXTURE_HI,
  MASK_LOW_TEXTURE_LO,
} from '@/config/constants';

const P = DEFAULT_FUSION_PARAMS;

function toByte(lap: number): number {
  return Math.round(encodeSharpness(lap) * 255);
}

describe('normalizedDiff', () => {
  it('明るさ・コントラストの絶対量に依らず同じ値になる', () => {
    const a = normalizedDiff(0.2, 0.1, 0);
    const b = normalizedDiff(0.02, 0.01, 0);
    expect(a).toBeCloseTo(1 / 3);
    expect(b).toBeCloseTo(1 / 3);
  });

  it('範囲は -1〜1', () => {
    expect(normalizedDiff(1, 0)).toBeLessThanOrEqual(1);
    expect(normalizedDiff(0, 1)).toBeGreaterThanOrEqual(-1);
    expect(normalizedDiff(0, 0)).toBe(0);
  });
});

describe('rawMaskValue（既定パラメータ）', () => {
  it('NEAR が明確にシャープなら 0.9 超', () => {
    expect(rawMaskValue(0.1, 0.03, P)).toBeGreaterThan(0.9);
  });

  it('FAR が明確にシャープなら 0.1 未満', () => {
    expect(rawMaskValue(0.03, 0.1, P)).toBeLessThan(0.1);
  });

  it('小さい絶対値でも比が同じなら同じ判定になる（旧式では 0.5 付近だった）', () => {
    expect(rawMaskValue(0.03, 0.009, P)).toBeGreaterThan(0.9);
    expect(rawMaskValue(0.009, 0.03, P)).toBeLessThan(0.1);
  });

  it('nearBias は正規化後の値として効く', () => {
    const base = rawMaskValue(0.05, 0.05, { ...P, nearBias: 0 });
    const biased = rawMaskValue(0.05, 0.05, { ...P, nearBias: 0.05 });
    expect(base).toBeCloseTo(0.5);
    expect(biased).toBeGreaterThan(base);
  });

  it('既定値は指定の範囲にある', () => {
    expect(P.threshold).toBeGreaterThanOrEqual(0.1);
    expect(P.threshold).toBeLessThanOrEqual(0.2);
    expect(P.nearBias).toBeGreaterThanOrEqual(0);
    expect(P.nearBias).toBeLessThanOrEqual(0.05);
    expect(P.sharpWindowRadius).toBe(6);
  });
});

describe('低テクスチャ領域の補完', () => {
  it('テクスチャの確からしさは sN+sF で決まる', () => {
    expect(textureConfidence(MASK_LOW_TEXTURE_LO / 2)).toBe(0);
    expect(textureConfidence(MASK_LOW_TEXTURE_HI * 2)).toBe(1);
  });

  it('低テクスチャ画素は周囲（広いぼかし）の値になる', () => {
    // 周囲は NEAR 判定が優勢
    const fillNear = fillMaskValue(0.3 * 0.95, 0.3);
    expect(finalMaskValue(0.5, 0, fillNear)).toBeGreaterThan(0.9);
    // 周囲は FAR 判定が優勢
    const fillFar = fillMaskValue(0.3 * 0.05, 0.3);
    expect(finalMaskValue(0.5, 0, fillFar)).toBeLessThan(0.1);
  });

  it('周囲にもテクスチャが無ければ既定値に寄る', () => {
    expect(fillMaskValue(0, 0)).toBeCloseTo(MASK_FILL_FALLBACK);
  });

  it('十分なテクスチャがある画素は自前の判定のまま', () => {
    expect(finalMaskValue(0.97, 1, 0)).toBeCloseTo(0.97);
  });
});

describe('鮮鋭度の 8bit 符号化', () => {
  it('小さい値も 8bit で潰れない', () => {
    expect(toByte(0.001)).toBeGreaterThan(4);
    expect(decodeSharpness(toByte(0.01) / 255)).toBeCloseTo(0.01, 3);
    expect(decodeSharpness(toByte(0.3) / 255)).toBeCloseTo(0.3, 2);
  });
});

describe('maskDiagnosticsFromEncoded', () => {
  it('S の最小・中央値・最大と d の範囲を返す', () => {
    const nearLap = [0.4, 0.1, 0.1, 0.02, 0.001];
    const farLap = [0.01, 0.01, 0.1, 0.2, 0.001];
    const near = new Uint8Array(nearLap.length * 4);
    const far = new Uint8Array(farLap.length * 4);
    nearLap.forEach((v, i) => {
      near[i * 4] = toByte(v);
    });
    farLap.forEach((v, i) => {
      far[i * 4] = toByte(v);
    });
    const r = maskDiagnosticsFromEncoded(near, far, nearLap.length, 4);
    expect(r.sampleCount).toBe(5);
    expect(r.sNear.min).toBeCloseTo(0.001, 3);
    expect(r.sNear.median).toBeCloseTo(0.1, 2);
    expect(r.sNear.max).toBeCloseTo(0.4, 2);
    expect(r.sFar.max).toBeCloseTo(0.2, 2);
    expect(r.d.max).toBeGreaterThan(0.9);
    expect(r.d.min).toBeLessThan(-0.75);
    expect(r.d.median).toBeCloseTo(0, 1);
    expect(r.lowTextureRatio).toBeCloseTo(0.2);
  });

  it('画素が無ければ 0 を返す', () => {
    const r = maskDiagnosticsFromEncoded(new Uint8Array(0), new Uint8Array(0), 0);
    expect(r.sampleCount).toBe(0);
  });
});
