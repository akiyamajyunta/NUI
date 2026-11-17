export type AlignEstimate = {
  dx: number;
  dy: number;
  confidence: number;
  warned: boolean;
};

function sad(
  ref: Float32Array,
  tgt: Float32Array,
  w: number,
  h: number,
  dx: number,
  dy: number,
): number {
  let sum = 0;
  let count = 0;
  for (let y = 1; y < h - 1; y += 1) {
    for (let x = 1; x < w - 1; x += 1) {
      const tx = x + dx;
      const ty = y + dy;
      if (tx < 0 || ty < 0 || tx >= w || ty >= h) continue;
      const d = ref[y * w + x] - tgt[ty * w + tx];
      sum += d < 0 ? -d : d;
      count += 1;
    }
  }
  return count > 0 ? sum / count : Number.MAX_VALUE;
}

function variance(data: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < data.length; i += 1) sum += data[i];
  const mean = sum / data.length;
  let v = 0;
  for (let i = 0; i < data.length; i += 1) {
    const d = data[i] - mean;
    v += d * d;
  }
  return v / data.length;
}

export function searchTranslation(
  ref: Float32Array,
  tgt: Float32Array,
  w: number,
  h: number,
  searchRange = 8,
): AlignEstimate {
  let bestDx = 0;
  let bestDy = 0;
  let bestCost = Number.MAX_VALUE;
  let secondCost = Number.MAX_VALUE;

  for (let dy = -searchRange; dy <= searchRange; dy += 1) {
    for (let dx = -searchRange; dx <= searchRange; dx += 1) {
      const c = sad(ref, tgt, w, h, dx, dy);
      const dist = Math.abs(dx) + Math.abs(dy);
      const bestDist = Math.abs(bestDx) + Math.abs(bestDy);
      if (c < bestCost || (c === bestCost && dist < bestDist)) {
        secondCost = bestCost;
        bestCost = c;
        bestDx = dx;
        bestDy = dy;
      } else if (c < secondCost) {
        secondCost = c;
      }
    }
  }

  const ratio = secondCost > 1e-6 ? bestCost / secondCost : 1;
  const confidence = Math.max(0, Math.min(1, 1 - ratio));
  const uniformRef = variance(ref) < 1e-4;
  const uniformTgt = variance(tgt) < 1e-4;
  const warned = uniformRef || uniformTgt || confidence < 0.35;

  return {
    dx: bestDx,
    dy: bestDy,
    confidence: warned ? Math.min(confidence, 0.3) : confidence,
    warned,
  };
}

export function shiftArray(src: Float32Array, w: number, h: number, dx: number, dy: number): Float32Array {
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const sx = x - dx;
      const sy = y - dy;
      if (sx >= 0 && sy >= 0 && sx < w && sy < h) {
        out[y * w + x] = src[sy * w + sx];
      }
    }
  }
  return out;
}