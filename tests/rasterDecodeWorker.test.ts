import { expect, it, vi } from 'vitest';

import type {
  RasterDecodeWorkerRequest,
  RasterDecodeWorkerResponse,
} from '../src/components/ImagePreview/renderers/raster-webgl/rasterDecodeProtocol';

it('parses header dimensions and sends a bounded target into the first bitmap decode', async () => {
  const responses: RasterDecodeWorkerResponse[] = [];
  const workerScope = {
    onmessage: null as ((event: MessageEvent<RasterDecodeWorkerRequest>) => void) | null,
    postMessage(message: RasterDecodeWorkerResponse) {
      responses.push(message);
    },
  };
  const createImageBitmap = vi.fn(async (_blob: Blob, options: ImageBitmapOptions) => ({
    width: options.resizeWidth!,
    height: options.resizeHeight!,
    close: vi.fn(),
  } as unknown as ImageBitmap));
  vi.stubGlobal('self', workerScope);
  vi.stubGlobal('createImageBitmap', createImageBitmap);
  await import('../src/components/ImagePreview/renderers/raster-webgl/rasterDecode.worker');

  const pngHeader = new Uint8Array(24);
  pngHeader.set([0x89, 0x50, 0x4e, 0x47], 0);
  new DataView(pngHeader.buffer).setUint32(16, 20_000);
  new DataView(pngHeader.buffer).setUint32(20, 10_000);
  await workerScope.onmessage?.(new MessageEvent('message', {
    data: {
      id: 7,
      blob: new Blob([pngHeader], { type: 'image/png' }),
      fitWidth: 1000,
      fitHeight: 1000,
      maxTextureSize: 4096,
    },
  }));

  expect(createImageBitmap).toHaveBeenCalledTimes(1);
  expect(createImageBitmap).toHaveBeenCalledWith(expect.any(Blob), expect.objectContaining({
    resizeWidth: 1000,
    resizeHeight: 500,
  }));
  expect(responses).toContainEqual(expect.objectContaining({
    id: 7,
    naturalWidth: 20_000,
    naturalHeight: 10_000,
  }));
  vi.unstubAllGlobals();
});
