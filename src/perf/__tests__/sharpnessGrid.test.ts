import { laplacianVarianceGrid4x4 } from '@/perf/sharpnessGrid';

describe('laplacianVarianceGrid4x4', () => {
  it('4×4 セルを返す', () => {
    const w = 64;
    const h = 48;
    const g = new Float32Array(w * h);
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        g[y * w + x] = x < w / 2 ? (x + y) % 2 : 0.1;
      }
    }
    const grid = laplacianVarianceGrid4x4(g, w, h);
    expect(grid.length).toBe(4);
    expect(grid[0].length).toBe(4);
    expect(grid[0][0]).toBeGreaterThan(grid[3][3]);
  });
});