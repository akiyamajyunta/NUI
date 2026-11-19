import { PREVIEW_FUSION_LONG_SIDE } from '@/config/constants';
import { fusionPixelSize } from '@/imaging/fusionOutputSize';

type EncodedImage = { width: () => number; height: () => number; delete: () => void };
type Surface = {
  getCanvas: () => { clear: (c: unknown) => void };
  makeImageSnapshot: () => {
    encodeToBytes: (fmt: unknown, q: number) => Uint8Array;
    delete: () => void;
  };
  delete: () => void;
};
type CanvasKitApi = {
  MakeSurface: (w: number, h: number) => Surface;
  Color4f: (r: number, g: number, b: number, a: number) => unknown;
  ImageFormat: { JPEG: unknown };
  MakeImageFromEncoded: (bytes: Uint8Array) => EncodedImage;
};

declare const require: {
  (id: string): (opts?: { locateFile?: (file: string) => string }) => Promise<CanvasKitApi>;
  resolve(id: string): string;
};

let CanvasKit: CanvasKitApi;

function u16le(n: number): number[] {
  return [n & 255, (n >> 8) & 255];
}

function u32le(n: number): number[] {
  return [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >> 24) & 255];
}

function withExifOrientation(jpeg: Uint8Array, value: number): Uint8Array {
  const tiff = [
    0x49, 0x49,
    ...u16le(42),
    ...u32le(8),
    ...u16le(1),
    ...u16le(0x0112),
    ...u16le(3),
    ...u32le(1),
    ...u16le(value),
    0, 0,
    ...u32le(0),
  ];
  const payload = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff];
  const len = payload.length + 2;
  const app1 = [0xff, 0xe1, (len >> 8) & 255, len & 255, ...payload];
  const out = new Uint8Array(jpeg.length + app1.length);
  out[0] = jpeg[0] ?? 0;
  out[1] = jpeg[1] ?? 0;
  out.set(app1, 2);
  out.set(jpeg.subarray(2), 2 + app1.length);
  return out;
}

function jpeg(width: number, height: number): Uint8Array {
  const surface = CanvasKit.MakeSurface(width, height);
  surface.getCanvas().clear(CanvasKit.Color4f(0.2, 0.4, 0.6, 1));
  const image = surface.makeImageSnapshot();
  const bytes = image.encodeToBytes(CanvasKit.ImageFormat.JPEG, 90);
  image.delete();
  surface.delete();
  return bytes;
}

function skiaSize(bytes: Uint8Array): { width: number; height: number } {
  const image = CanvasKit.MakeImageFromEncoded(bytes);
  const size = { width: image.width(), height: image.height() };
  image.delete();
  return size;
}

describe('実機と同じ EXIF の合成寸法', () => {
  jest.setTimeout(60000);

  beforeAll(async () => {
    const init = require('canvaskit-wasm/bin/full/canvaskit.js');
    CanvasKit = await init({
      locateFile: (file: string) => require.resolve(`canvaskit-wasm/bin/full/${file}`),
    });
  });

  it('格納 1920×1440・EXIF 6 は Skia 後 1440×1920、保存もプレビューも縦', () => {
    const decoded = skiaSize(withExifOrientation(jpeg(1920, 1440), 6));
    expect(decoded).toEqual({ width: 1440, height: 1920 });
    expect(fusionPixelSize(decoded.width, decoded.height)).toEqual({
      width: 1440,
      height: 1920,
    });
    expect(fusionPixelSize(decoded.width, decoded.height, PREVIEW_FUSION_LONG_SIDE)).toEqual({
      width: 768,
      height: 1024,
    });
  });

  it('ギャラリー同様、EXIF 1 と向き情報なしは格納画素のまま', () => {
    const landscape = jpeg(1920, 1440);
    const portrait = jpeg(1440, 1920);
    const exif1 = skiaSize(withExifOrientation(landscape, 1));
    const bare = skiaSize(landscape);
    const upright = skiaSize(withExifOrientation(portrait, 1));
    expect(fusionPixelSize(exif1.width, exif1.height)).toEqual({ width: 1920, height: 1440 });
    expect(fusionPixelSize(bare.width, bare.height)).toEqual({ width: 1920, height: 1440 });
    expect(fusionPixelSize(upright.width, upright.height)).toEqual({ width: 1440, height: 1920 });
    expect(fusionPixelSize(upright.width, upright.height, PREVIEW_FUSION_LONG_SIDE)).toEqual({
      width: 768,
      height: 1024,
    });
  });
});
