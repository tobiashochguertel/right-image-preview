import { describe, expect, it, vi } from 'vitest';

import {
  RasterDecodeWorkerPool,
  type RasterDecodeWorkerLike,
} from '../src/components/ImagePreview/renderers/raster-webgl/RasterDecodeWorkerPool';
import type {
  RasterDecodeWorkerRequest,
  RasterDecodeWorkerResponse,
} from '../src/components/ImagePreview/renderers/raster-webgl/rasterDecodeProtocol';
import { resolveRasterDecodeWorkerCount } from '../src/components/ImagePreview/renderers/raster-webgl/rasterDecodePolicy';

describe('Raster decode Worker policy', () => {
  it('derives a conservative 1–3 Worker count from logical CPU concurrency', () => {
    expect(resolveRasterDecodeWorkerCount({ hardwareConcurrency: 4 })).toBe(1);
    expect(resolveRasterDecodeWorkerCount({ hardwareConcurrency: 8 })).toBe(2);
    expect(resolveRasterDecodeWorkerCount({ hardwareConcurrency: 16 })).toBe(3);
    expect(resolveRasterDecodeWorkerCount({ workers: 3, maxWorkers: 2 })).toBe(2);
    expect(resolveRasterDecodeWorkerCount({ workers: 99, maxWorkers: 99 })).toBe(3);
  });
});

describe('RasterDecodeWorkerPool', () => {
  it('lets an ultra-large decode exclusively occupy the pool', async () => {
    const workers: FakeWorker[] = [];
    const pool = createPool(3, workers);
    const first = pool.decode(request('first', 60, 100_000_000));
    const second = pool.decode(request('second', 50, 100_000_000));

    expect(totalMessages(workers)).toBe(1);
    workers.find((worker) => worker.messages.length > 0)!.succeed(bitmap());
    (await first).bitmap.close();
    expect(totalMessages(workers)).toBe(2);
    workers.find((worker) => worker.messages.some((message) => message.id === 2))!.succeed(bitmap());
    (await second).bitmap.close();
    pool.dispose();
  });

  it('hard-preempts lower-priority work for a new foreground decode', async () => {
    const workers: FakeWorker[] = [];
    const pool = createPool(1, workers);
    const background = pool.decode(request('background', 60));
    const current = pool.decode({ ...request('current', 100), foreground: true });

    expect(workers[0].terminated).toBe(true);
    await expect(background).rejects.toMatchObject({ name: 'AbortError' });
    expect(workers).toHaveLength(2);
    expect(workers[1].messages[0]).toMatchObject({ id: 2 });
    workers[1].succeed(bitmap());
    (await current).bitmap.close();
    pool.dispose();
  });

  it('removes queued jobs without terminating unrelated running work', async () => {
    const workers: FakeWorker[] = [];
    const pool = createPool(1, workers);
    const running = pool.decode(request('running', 60));
    const queued = pool.decode(request('queued', 50));

    expect(pool.cancel('queued', true)).toBe(true);
    await expect(queued).rejects.toMatchObject({ name: 'AbortError' });
    expect(workers[0].terminated).toBe(false);
    workers[0].succeed(bitmap());
    (await running).bitmap.close();
    pool.dispose();
  });

  it('sends URL acquisition to the Worker and forwards streamed progress without settling', async () => {
    const workers: FakeWorker[] = [];
    const pool = createPool(1, workers);
    const onProgress = vi.fn();
    const result = pool.decode({
      key: 'url-photo',
      priority: 100,
      foreground: true,
      url: { href: 'asset://localhost/photo.jpg', contentLength: 100 },
      targetSize: { width: 10, height: 10 },
      onProgress,
    });

    expect(workers[0].messages[0]).toMatchObject({
      url: 'asset://localhost/photo.jpg',
      contentLength: 100,
    });
    expect(workers[0].messages[0]?.blob).toBeUndefined();
    workers[0].progress({
      loadedBytes: 50,
      totalBytes: 100,
      progress: 0.5,
      complete: false,
    });
    expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({ progress: 0.5 }));

    workers[0].succeed(bitmap());
    (await result).bitmap.close();
    pool.dispose();
  });
});

function createPool(count: number, workers: FakeWorker[]): RasterDecodeWorkerPool {
  return new RasterDecodeWorkerPool({
    workers: count,
    maxWorkers: count,
    workerFactory: () => {
      const worker = new FakeWorker();
      workers.push(worker);
      return worker;
    },
  });
}

function request(key: string, priority: number, naturalPixels = 1_000_000) {
  return {
    key,
    priority,
    naturalPixels,
    blob: new Blob([key]),
    targetSize: { width: 10, height: 10 },
  };
}

function bitmap(width = 10, height = 10): ImageBitmap {
  return {
    width,
    height,
    close: vi.fn(),
  } as unknown as ImageBitmap;
}

function totalMessages(workers: readonly FakeWorker[]): number {
  return workers.reduce((sum, worker) => sum + worker.messages.length, 0);
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
        naturalWidth: result.width,
        naturalHeight: result.height,
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
