import { acquireMediaBlob, type MediaDownloadProgress } from '../../core/media-source';
import type { RasterSize } from './rasterLod';
import RasterDecodeWorker from './rasterDecode.worker?worker&inline';
import type {
  RasterDecodeWorkerRequest,
  RasterDecodeWorkerResponse,
} from './rasterDecodeProtocol';
import {
  isHeavyRasterDecode,
  resolveRasterDecodeWorkerCount,
  type RasterDecodeWorkerSetting,
} from './rasterDecodePolicy';

export interface RasterDecodeRequest {
  key: string;
  blob?: Blob;
  url?: { href: string; contentLength?: number };
  onProgress?: (progress: MediaDownloadProgress) => void;
  targetSize?: RasterSize;
  fitBox?: RasterSize;
  maxTextureSize?: number;
  naturalPixels?: number;
  priority: number;
  /** Foreground work may hard-preempt lower-priority running decodes. */
  foreground?: boolean;
}

export interface RasterDecodeResult {
  bitmap: ImageBitmap;
  naturalSize?: RasterSize;
}

export interface RasterDecodeWorkerLike {
  onmessage: ((event: MessageEvent<RasterDecodeWorkerResponse>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  postMessage(message: RasterDecodeWorkerRequest): void;
  terminate(): void;
}

export interface RasterDecodeWorkerPoolOptions {
  workers?: RasterDecodeWorkerSetting;
  maxWorkers?: number;
  hardwareConcurrency?: number;
  workerFactory?: () => RasterDecodeWorkerLike;
  inlineDecode?: (request: RasterDecodeRequest) => Promise<{
    bitmap: ImageBitmap;
    naturalSize?: RasterSize;
  }>;
}

interface PendingDecode {
  id: number;
  request: RasterDecodeRequest;
  sequence: number;
  heavy: boolean;
  cancelled: boolean;
  settled: boolean;
  resolve(result: RasterDecodeResult): void;
  reject(reason: unknown): void;
}

interface WorkerSlot {
  index: number;
  worker: RasterDecodeWorkerLike | null;
  version: number;
  running?: PendingDecode;
}

/**
 * Main-thread-owned scheduler. Workers execute one decode at a time and never own queues.
 * Ultra-large natural images are exclusive so decoder working sets remain bounded.
 */
export class RasterDecodeWorkerPool {
  readonly workerCount: number;
  private readonly slots: WorkerSlot[] = [];
  private readonly pending: PendingDecode[] = [];
  private readonly workerFactory: (() => RasterDecodeWorkerLike) | undefined;
  private readonly inlineDecode: (request: RasterDecodeRequest) => Promise<{
    bitmap: ImageBitmap;
    naturalSize?: RasterSize;
  }>;
  private inlineRunning: PendingDecode | undefined;
  private nextId = 1;
  private sequence = 0;
  private disposed = false;

  constructor(options: RasterDecodeWorkerPoolOptions = {}) {
    this.workerCount = resolveRasterDecodeWorkerCount({
      workers: options.workers,
      maxWorkers: options.maxWorkers,
      hardwareConcurrency: options.hardwareConcurrency,
    });
    this.workerFactory = options.workerFactory ?? defaultWorkerFactory();
    this.inlineDecode = options.inlineDecode ?? decodeInline;
    if (this.workerFactory) {
      for (let index = 0; index < this.workerCount; index += 1) {
        const slot: WorkerSlot = { index, worker: null, version: 0 };
        this.slots.push(slot);
        this.replaceWorker(slot);
      }
    }
  }

  decode(request: RasterDecodeRequest): Promise<RasterDecodeResult> {
    if (this.disposed) return Promise.reject(cancelledError('Raster decode pool has been disposed'));
    return new Promise<RasterDecodeResult>((resolve, reject) => {
      const job: PendingDecode = {
        id: this.nextId++,
        request,
        sequence: this.sequence++,
        heavy: isHeavyRasterDecode(request.naturalPixels),
        cancelled: false,
        settled: false,
        resolve,
        reject,
      };
      this.pending.push(job);
      this.sortPending();
      if (request.foreground) this.preemptLowerPriority(job);
      this.drain();
    });
  }

  promote(key: string, priority: number, foreground = false): void {
    for (const job of this.pending) {
      if (job.request.key !== key) continue;
      job.request.priority = Math.max(job.request.priority, priority);
      job.request.foreground ||= foreground;
      this.sortPending();
      if (job.request.foreground) this.preemptLowerPriority(job);
      this.drain();
      return;
    }
    for (const slot of this.slots) {
      const job = slot.running;
      if (job?.request.key !== key) continue;
      job.request.priority = Math.max(job.request.priority, priority);
      job.request.foreground ||= foreground;
      if (job.request.foreground) this.preemptLowerPriority(job);
      this.drain();
      return;
    }
    const job = this.inlineRunning;
    if (job?.request.key === key) {
      job.request.priority = Math.max(job.request.priority, priority);
      job.request.foreground ||= foreground;
    }
  }

  /** Queued work is removed; a hard running cancel terminates and recreates only its slot. */
  cancel(key: string, hard = false): boolean {
    let cancelled = false;
    for (let index = this.pending.length - 1; index >= 0; index -= 1) {
      const job = this.pending[index];
      if (job.request.key !== key) continue;
      this.pending.splice(index, 1);
      this.rejectJob(job, cancelledError(`Raster decode cancelled: ${key}`));
      cancelled = true;
    }
    for (const slot of this.slots) {
      const job = slot.running;
      if (job?.request.key !== key) continue;
      cancelled = true;
      if (hard) this.terminateRunning(slot, cancelledError(`Raster decode preempted: ${key}`));
      else this.softCancel(job, cancelledError(`Raster decode cancelled: ${key}`));
    }
    if (this.inlineRunning?.request.key === key) {
      cancelled = true;
      this.softCancel(this.inlineRunning, cancelledError(`Raster decode cancelled: ${key}`));
    }
    this.drain();
    return cancelled;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    const error = cancelledError('Raster decode pool has been disposed');
    for (const job of this.pending.splice(0)) this.rejectJob(job, error);
    for (const slot of this.slots) {
      if (slot.running) this.rejectJob(slot.running, error);
      slot.running = undefined;
      slot.worker?.terminate();
      slot.worker = null;
    }
    if (this.inlineRunning) this.softCancel(this.inlineRunning, error);
  }

  private drain(): void {
    if (this.disposed) return;
    const liveSlots = this.slots.filter((slot) => slot.worker);
    if (liveSlots.length === 0) {
      this.drainInline();
      return;
    }
    while (this.pending.length > 0) {
      const idle = liveSlots.find((slot) => !slot.running);
      if (!idle) return;
      const next = this.pending[0];
      const active = this.activeJobs();
      if (active.some((job) => job.heavy)) return;
      if (next.heavy && active.length > 0) return;
      this.pending.shift();
      this.runOnWorker(idle, next);
    }
  }

  private drainInline(): void {
    if (this.inlineRunning || this.pending.length === 0) return;
    const job = this.pending.shift()!;
    this.inlineRunning = job;
    void this.inlineDecode(job.request)
      .then(({ bitmap, naturalSize }) => {
        if (job.cancelled || this.disposed) {
          bitmap.close();
          return;
        }
        this.resolveJob(job, {
          bitmap,
          naturalSize,
        });
      }, (error) => this.rejectJob(job, error))
      .finally(() => {
        if (this.inlineRunning === job) this.inlineRunning = undefined;
        this.drain();
      });
  }

  private runOnWorker(slot: WorkerSlot, job: PendingDecode): void {
    const worker = slot.worker;
    if (!worker) {
      this.pending.unshift(job);
      return;
    }
    slot.running = job;
    const decodeSource = job.request.blob
      ? { blob: job.request.blob }
      : job.request.url
        ? {
            url: job.request.url.href,
            contentLength: job.request.url.contentLength,
          }
        : null;
    if (!decodeSource) {
      slot.running = undefined;
      this.rejectJob(job, new Error('Raster decode request has no Blob or URL source'));
      this.drain();
      return;
    }
    const message: RasterDecodeWorkerRequest = {
      id: job.id,
      ...decodeSource,
      resizeWidth: job.request.targetSize?.width,
      resizeHeight: job.request.targetSize?.height,
      fitWidth: job.request.fitBox?.width,
      fitHeight: job.request.fitBox?.height,
      maxTextureSize: job.request.maxTextureSize,
    };
    try {
      worker.postMessage(message);
    } catch (error) {
      slot.running = undefined;
      this.rejectJob(job, error);
      this.replaceWorker(slot);
      this.drain();
    }
  }

  private replaceWorker(slot: WorkerSlot): void {
    slot.worker?.terminate();
    slot.worker = null;
    if (!this.workerFactory || this.disposed) return;
    const version = ++slot.version;
    try {
      const worker = this.workerFactory();
      slot.worker = worker;
      worker.onmessage = (event) => {
        if (slot.version !== version || slot.worker !== worker) {
          event.data.bitmap?.close();
          return;
        }
        this.onWorkerMessage(slot, event.data);
      };
      worker.onerror = (event) => {
        event.preventDefault?.();
        if (slot.version !== version || slot.worker !== worker) return;
        const error = new Error(event.message || `Raster decode Worker ${slot.index} failed`);
        this.terminateRunning(slot, error);
        this.drain();
      };
    } catch {
      slot.worker = null;
    }
  }

  private onWorkerMessage(slot: WorkerSlot, response: RasterDecodeWorkerResponse): void {
    const job = slot.running;
    if (!job || job.id !== response.id) {
      response.bitmap?.close();
      return;
    }
    if (response.progress) {
      if (!job.cancelled && !this.disposed) job.request.onProgress?.(response.progress);
      return;
    }
    slot.running = undefined;
    if (job.cancelled || this.disposed) {
      response.bitmap?.close();
    } else if (response.bitmap) {
      this.resolveJob(job, {
        bitmap: response.bitmap,
        naturalSize: response.naturalWidth && response.naturalHeight
          ? { width: response.naturalWidth, height: response.naturalHeight }
          : undefined,
      });
    } else {
      this.rejectJob(job, new Error(response.error ?? 'Raster decode Worker returned no bitmap'));
    }
    this.drain();
  }

  private preemptLowerPriority(incoming: PendingDecode): void {
    const running = this.slots
      .filter((slot): slot is WorkerSlot & { running: PendingDecode } => !!slot.running)
      .sort((left, right) => left.running.request.priority - right.running.request.priority);
    const mustBeExclusive = incoming.heavy;
    for (const slot of running) {
      if (slot.running.request.priority >= incoming.request.priority) continue;
      if (!mustBeExclusive && this.hasIdleWorker()) break;
      this.terminateRunning(
        slot,
        cancelledError(`Raster decode preempted by ${incoming.request.key}`),
      );
      if (!mustBeExclusive) break;
    }
  }

  private terminateRunning(slot: WorkerSlot, reason: Error): void {
    const job = slot.running;
    slot.running = undefined;
    if (job) this.rejectJob(job, reason);
    this.replaceWorker(slot);
  }

  private activeJobs(): PendingDecode[] {
    const jobs = this.slots.flatMap((slot) => slot.running ? [slot.running] : []);
    if (this.inlineRunning) jobs.push(this.inlineRunning);
    return jobs;
  }

  private hasIdleWorker(): boolean {
    return this.slots.some((slot) => slot.worker && !slot.running);
  }

  private softCancel(job: PendingDecode, reason: Error): void {
    job.cancelled = true;
    this.rejectJob(job, reason);
  }

  private resolveJob(job: PendingDecode, result: RasterDecodeResult): void {
    if (job.settled) {
      result.bitmap.close();
      return;
    }
    job.settled = true;
    job.resolve(result);
  }

  private rejectJob(job: PendingDecode, reason: unknown): void {
    if (job.settled) return;
    job.settled = true;
    job.reject(reason);
  }

  private sortPending(): void {
    this.pending.sort((left, right) =>
      right.request.priority - left.request.priority || left.sequence - right.sequence);
  }
}

function defaultWorkerFactory(): (() => RasterDecodeWorkerLike) | undefined {
  if (typeof Worker === 'undefined') return undefined;
  return () => new RasterDecodeWorker({ name: 'right-image-preview-raster-decode' });
}

async function decodeInline(request: RasterDecodeRequest): Promise<{
  bitmap: ImageBitmap;
  naturalSize: RasterSize;
}> {
  const blob = request.blob ?? (request.url
    ? await acquireMediaBlob(
        {
          type: 'url',
          href: request.url.href,
          contentLength: request.url.contentLength,
        },
        { onProgress: request.onProgress },
      )
    : null);
  if (!blob) throw new Error('Raster decode request has no Blob or URL source');
  let bitmap = request.targetSize
    ? await createImageBitmap(blob, {
        imageOrientation: 'from-image',
        resizeWidth: request.targetSize.width,
        resizeHeight: request.targetSize.height,
        resizeQuality: 'high',
      })
    : await createImageBitmap(blob, { imageOrientation: 'from-image' });
  const naturalSize = { width: bitmap.width, height: bitmap.height };
  if (!request.targetSize) {
    const target = fitInlineTarget(bitmap, request.fitBox, request.maxTextureSize);
    if (target.width !== bitmap.width || target.height !== bitmap.height) {
      const resized = await createImageBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, {
        resizeWidth: target.width,
        resizeHeight: target.height,
        resizeQuality: 'high',
      });
      bitmap.close();
      bitmap = resized;
    }
  }
  return { bitmap, naturalSize };
}

function fitInlineTarget(
  bitmap: ImageBitmap,
  fitBox: RasterSize | undefined,
  maxTextureSize: number | undefined,
): RasterSize {
  const fitScale = fitBox
    ? Math.min(1, fitBox.width / bitmap.width, fitBox.height / bitmap.height)
    : 1;
  const safeLimit = Math.max(1, Math.floor(maxTextureSize ?? Number.POSITIVE_INFINITY));
  const scale = Math.min(fitScale, safeLimit / Math.max(bitmap.width, bitmap.height));
  return {
    width: Math.max(1, Math.round(bitmap.width * scale)),
    height: Math.max(1, Math.round(bitmap.height * scale)),
  };
}

function cancelledError(message: string): Error {
  const error = new Error(message);
  error.name = 'AbortError';
  return error;
}
