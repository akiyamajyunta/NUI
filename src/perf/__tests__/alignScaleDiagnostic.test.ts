describe('alignScaleDiagnostic grid', () => {
  it('粗探索は0.95〜1.05を0.005刻みで21点', () => {
    const min = 0.95;
    const max = 1.05;
    const step = 0.005;
    const n = Math.round((max - min) / step) + 1;
    expect(n).toBe(21);
  });
});