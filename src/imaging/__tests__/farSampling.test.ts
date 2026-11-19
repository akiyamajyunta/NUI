import { laplacianVarianceAtPoint } from '@/perf/fusionDiagnosticsCore';
import {
  FAR_CATMULL_B,
  FAR_CATMULL_C,
  farUsesNearestSample,
} from '@/imaging/farSampling';

type EncodedImage = {
  width: () => number;
  height: () => number;
  readPixels: (x: number, y: number, info: unknown) => Uint8Array;
  makeShaderOptions: (...args: unknown[]) => { delete: () => void };
  makeShaderCubic: (...args: unknown[]) => { delete: () => void };
  delete: () => void;
};
type CanvasKitApi = {
  ColorType: { RGBA_8888: unknown };
  AlphaType: { Unpremul: unknown };
  ColorSpace: { SRGB: unknown };
  TileMode: { Clamp: unknown };
  FilterMode: { Linear: unknown; Nearest: unknown };
  MipmapMode: { None: unknown };
  LTRBRect: (l: number, t: number, r: number, b: number) => Float32Array;
  MakeImage: (info: unknown, pixels: Uint8Array, rowBytes: number) => EncodedImage;
  RuntimeEffect: { Make: (sksl: string) => { makeShaderWithChildren: (u: number[], c: unknown[]) => { delete: () => void } } | null };
  MakeSurface: (w: number, h: number) => {
    getCanvas: () => {
      drawPaint: (p: unknown) => void;
      drawImageRect: (img: EncodedImage, src: Float32Array, dst: Float32Array, paint: unknown) => void;
    };
    makeImageSnapshot: () => EncodedImage;
    delete: () => void;
  };
  Paint: new () => { setShader: (s: unknown) => void; delete: () => void };
};

declare const require: {
  (id: string): (opts?: { locateFile?: (file: string) => string }) => Promise<CanvasKitApi>;
  resolve(id: string): string;
};

const W = 480;
const H = 480;
const SUBJECT = { x: 0.32, y: 0.4 };
const BACKGROUND = { x: 0.7, y: 0.62 };

function grayOf(raw: Uint8Array, w: number, h: number): Float32Array {
  const gray = new Float32Array(w * h);
  for (let i = 0; i < w * h; i += 1) {
    gray[i] = (0.299 * raw[i * 4] + 0.587 * raw[i * 4 + 1] + 0.114 * raw[i * 4 + 2]) / 255;
  }
  return gray;
}

describe('FAR の拡大サンプリング', () => {
  jest.setTimeout(60000);

  it('1.0 付近は最近傍、離れていれば Catmull-Rom', () => {
    expect(farUsesNearestSample(1)).toBe(true);
    expect(farUsesNearestSample(1.0005)).toBe(true);
    expect(farUsesNearestSample(1.018)).toBe(false);
  });

  it('scale 1.018 の Catmull-Rom は被写体点と背景点で元の 95% 以上', async () => {
    const init = require('canvaskit-wasm/bin/full/canvaskit.js');
    const CK = await init({
      locateFile: (file: string) => require.resolve(`canvaskit-wasm/bin/full/${file}`),
    });
    const pixels = new Uint8Array(W * H * 4);
    for (let y = 0; y < H; y += 1) {
      for (let x = 0; x < W; x += 1) {
        let v = 70 + Math.round(18 * Math.sin(x * 0.08) + 14 * Math.cos(y * 0.07));
        if (x >= 148 && x < 160) v = 210;
        if (y >= 186 && y < 198) v = 40;
        if (x >= 328 && x < 340) v = 200;
        if (y >= 290 && y < 302) v = 36;
        const i = (y * W + x) * 4;
        pixels[i] = v;
        pixels[i + 1] = v;
        pixels[i + 2] = v;
        pixels[i + 3] = 255;
      }
    }
    const info = {
      width: W,
      height: H,
      colorType: CK.ColorType.RGBA_8888,
      alphaType: CK.AlphaType.Unpremul,
      colorSpace: CK.ColorSpace.SRGB,
    };
    const src = CK.MakeImage(info, pixels, W * 4);
    const analysis = 160;
    const infoSmall = { ...info, width: analysis, height: analysis };
    const downsample = (image: EncodedImage) => {
      const surface = CK.MakeSurface(analysis, analysis);
      const paint = new CK.Paint();
      surface.getCanvas().drawImageRect(
        image,
        CK.LTRBRect(0, 0, W, H),
        CK.LTRBRect(0, 0, analysis, analysis),
        paint,
      );
      const out = surface.makeImageSnapshot();
      const gray = grayOf(out.readPixels(0, 0, infoSmall), analysis, analysis);
      out.delete();
      paint.delete();
      surface.delete();
      return gray;
    };
    const base = downsample(src);
    const effect = CK.RuntimeEffect.Make(`
      uniform shader img;
      uniform float scale;
      half4 main(float2 coord) {
        float2 center = float2(${W / 2}, ${H / 2});
        return img.eval((coord - center) / scale + center);
      }
    `);
    if (!effect) throw new Error('sksl');
    const sample = (child: { delete: () => void }, scale: number) => {
      const shader = effect.makeShaderWithChildren([scale], [child]);
      const surface = CK.MakeSurface(W, H);
      const paint = new CK.Paint();
      paint.setShader(shader);
      surface.getCanvas().drawPaint(paint);
      const out = surface.makeImageSnapshot();
      const gray = downsample(out);
      out.delete();
      paint.delete();
      shader.delete();
      surface.delete();
      child.delete();
      return gray;
    };
    const ratio = (gray: Float32Array, point: { x: number; y: number }) =>
      laplacianVarianceAtPoint(gray, analysis, analysis, point) /
      laplacianVarianceAtPoint(base, analysis, analysis, point);

    const cubic = sample(
      src.makeShaderCubic(CK.TileMode.Clamp, CK.TileMode.Clamp, FAR_CATMULL_B, FAR_CATMULL_C),
      1.018,
    );
    expect(ratio(cubic, SUBJECT)).toBeGreaterThanOrEqual(0.95);
    expect(ratio(cubic, BACKGROUND)).toBeGreaterThanOrEqual(0.95);

    const nearest = sample(
      src.makeShaderOptions(
        CK.TileMode.Clamp,
        CK.TileMode.Clamp,
        CK.FilterMode.Nearest,
        CK.MipmapMode.None,
      ),
      1,
    );
    expect(farUsesNearestSample(1)).toBe(true);
    expect(ratio(nearest, SUBJECT)).toBeGreaterThanOrEqual(0.95);
    expect(ratio(nearest, BACKGROUND)).toBeGreaterThanOrEqual(0.95);
    src.delete();
  });
});
