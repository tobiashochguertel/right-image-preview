import { describe, expect, it, vi } from 'vitest';

import {
  RasterDecodeWorkerPool,
  type RasterDecodeWorkerLike,
} from '../src/components/ImagePreview/renderers/raster-webgl/RasterDecodeWorkerPool';
import type {
  RasterDecodeWorkerRequest,
  RasterDecodeWorkerResponse,
} from '../src/components/ImagePreview/renderers/raster-webgl/rasterDecodeProtocol';
import { RasterPipeline } from '../src/components/ImagePreview/renderers/raster-webgl/RasterPipeline';
import type { WebGLRasterRenderer } from '../src/components/ImagePreview/renderers/raster-webgl/WebGLRasterRenderer';

describe('RasterPipeline Worker decode integration', () => {
  it('hard-preempts the previous current Screen when navigation selects a new image', async () => {
    const workers: FakeWorker[] = [];
    const decodePool = new RasterDecodeWorkerPool({
      workers: 1,
      workerFactory: () => {
        const worker = new FakeWorker();
        workers.push(worker);
        return worker;
      },
    });
    const renderer = createRenderer();
    const pipeline = new RasterPipeline(renderer, 1024 * 1024, { decodePool });
    const naturalSize = { width: 1000, height: 800 };
    const screenBox = { width: 100, height: 80 };

    const first = pipeline.prepare(
      'first',
      { type: 'blob', blob: new Blob(['first']) },
      'display',
      naturalSize,
      100,
      screenBox,
    );
    await vi.waitFor(() => expect(workers[0].messages).toHaveLength(1));

    const second = pipeline.prepare(
      'second',
      { type: 'blob', blob: new Blob(['second']) },
      'display',
      naturalSize,
      100,
      screenBox,
    );
    await expect(first).rejects.toMatchObject({ name: 'AbortError' });
    expect(workers[0].terminated).toBe(true);
    await vi.waitFor(() => expect(workers[1].messages).toHaveLength(1));

    workers[1].succeed(bitmap(100, 80));
    await expect(second).resolves.toMatchObject({
      resourceKey: 'second',
      quality: 'display',
      textureWidth: 100,
      textureHeight: 80,
    });
    expect(renderer.upload).toHaveBeenCalledTimes(1);
    pipeline.dispose();
  });

  it('promotes and reuses an in-flight neighbor Screen when it becomes current', async () => {
    const workers: FakeWorker[] = [];
    const decodePool = new RasterDecodeWorkerPool({
      workers: 1,
      workerFactory: () => {
        const worker = new FakeWorker();
        workers.push(worker);
        return worker;
      },
    });
    const renderer = createRenderer();
    const pipeline = new RasterPipeline(renderer, 1024 * 1024, { decodePool });
    const naturalSize = { width: 1000, height: 800 };
    const screenBox = { width: 100, height: 80 };

    const first = pipeline.prepare(
      'first',
      { type: 'blob', blob: new Blob(['first']) },
      'display',
      naturalSize,
      100,
      screenBox,
    );
    await vi.waitFor(() => expect(workers[0].messages).toHaveLength(1));
    workers[0].succeed(bitmap(100, 80));
    await first;

    const neighbor = pipeline.prepare(
      'second',
      { type: 'blob', blob: new Blob(['second']) },
      'display',
      naturalSize,
      89,
      screenBox,
    );
    await vi.waitFor(() => expect(workers[0].messages).toHaveLength(2));
    const current = pipeline.prepare(
      'second',
      { type: 'blob', blob: new Blob(['second']) },
      'display',
      naturalSize,
      100,
      screenBox,
    );

    expect(current).toBe(neighbor);
    expect(workers[0].terminated).toBe(false);
    expect(workers[0].messages).toHaveLength(2);
    workers[0].succeed(bitmap(100, 80));
    await expect(Promise.all([neighbor, current])).resolves.toHaveLength(2);
    expect(renderer.upload).toHaveBeenCalledTimes(2);
    pipeline.dispose();
  });

  it('keeps URL fetch and Blob assembly inside the decode Worker', async () => {
    const workers: FakeWorker[] = [];
    const decodePool = new RasterDecodeWorkerPool({
      workers: 1,
      workerFactory: () => {
        const worker = new FakeWorker();
        workers.push(worker);
        return worker;
      },
    });
    const renderer = createRenderer();
    const pipeline = new RasterPipeline(renderer, 1024 * 1024, { decodePool });

    const prepared = pipeline.prepare(
      'asset-photo',
      {
        type: 'url',
        href: 'asset://localhost/large.jpg',
        contentLength: 100_000_000,
      },
      'display',
      { width: 10_000, height: 8_000 },
      100,
      { width: 1000, height: 800 },
    );

    expect(workers[0].messages[0]).toMatchObject({
      url: 'asset://localhost/large.jpg',
      contentLength: 100_000_000,
    });
    expect(workers[0].messages[0]?.resizeWidth).toBeGreaterThan(0);
    expect(workers[0].messages[0]?.resizeHeight).toBeGreaterThan(0);
    expect(workers[0].messages[0]?.blob).toBeUndefined();
    workers[0].progress({
      loadedBytes: 50_000_000,
      totalBytes: 100_000_000,
      progress: 0.5,
      complete: false,
    });
    expect(pipeline.runtimeSnapshot().downloads['asset-photo']).toMatchObject({ progress: 0.5 });

    workers[0].succeed(bitmap(
      workers[0].messages[0]!.resizeWidth!,
      workers[0].messages[0]!.resizeHeight!,
    ));
    await expect(prepared).resolves.toMatchObject({ resourceKey: 'asset-photo' });
    pipeline.dispose();
  });

  it('rejects Full decode above the configured RGBA limit before Worker allocation', async () => {
    const workers: FakeWorker[] = [];
    const decodePool = new RasterDecodeWorkerPool({
      workers: 1,
      workerFactory: () => {
        const worker = new FakeWorker();
        workers.push(worker);
        return worker;
      },
    });
    const pipeline = new RasterPipeline(createRenderer(), 1024 * 1024, {
      decodePool,
      fullDecodeMaxBytes: 1024,
    });

    await expect(pipeline.prepare(
      'too-large-for-full',
      { type: 'blob', blob: new Blob(['image']) },
      'full',
      { width: 100, height: 100 },
      90,
    )).rejects.toMatchObject({
      name: 'RasterFullDecodeBlockedError',
      estimatedBytes: 40_000,
      limitBytes: 1024,
    });
    expect(workers[0].messages).toHaveLength(0);
    pipeline.dispose();
  });
});

function createRenderer(): WebGLRasterRenderer {
  return {
    gl: { deleteTexture: vi.fn() } as unknown as WebGL2RenderingContext,
    maxTextureSize: 16_384,
    upload: vi.fn(async () => ({} as WebGLTexture)),
    subscribeContext() {
      return () => undefined;
    },
  } as unknown as WebGLRasterRenderer;
}

function bitmap(width: number, height: number): ImageBitmap {
  return {
    width,
    height,
    close: vi.fn(),
  } as unknown as ImageBitmap;
}

class FakeWorker implements RasterDecodeWorkerLike {
  onmessage: ((event: MessageEvent<RasterDecodeWorkerResponse>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  readonly messages: RasterDecodeWorkerRequest[] = [];
  terminated = false;

  postMessage(message: RasterDecodeWorkerRequest): void {
    this.messages.push(message);
  }

  terminate(): void {
    this.terminated = true;
  }

  succeed(result: ImageBitmap): void {
    const message = this.messages.at(-1);
    if (!message) throw new Error('Fake Worker has no active request');
    this.onmessage?.(new MessageEvent('message', {
      data: {
        id: message.id,
        bitmap: result,
        naturalWidth: 1000,
        naturalHeight: 800,
      } satisfies RasterDecodeWorkerResponse,
    }));
  }

  progress(progress: NonNullable<RasterDecodeWorkerResponse['progress']>): void {
    const message = this.messages.at(-1);
    if (!message) throw new Error('Fake Worker has no active request');
    this.onmessage?.(new MessageEvent('message', {
      data: { id: message.id, progress } satisfies RasterDecodeWorkerResponse,
    }));
  }
}
