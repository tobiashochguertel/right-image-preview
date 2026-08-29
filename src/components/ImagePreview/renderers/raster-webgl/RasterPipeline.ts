import {
  acquireMediaBlob,
  type MediaDownloadProgress,
  type MediaSource,
} from '../../core/media-source';
import { TextureCache } from './TextureCache';
import type { TextureCacheReservation } from './TextureCache';
import { WebGLRasterRenderer } from './WebGLRasterRenderer';
import type { RasterTextureEntry, RasterTextureQuality } from './types';
import { PriorityTaskQueue } from './PriorityTaskQueue';
import { readRasterNaturalSize } from './rasterDimensions';
import { fitRasterToScreenLod, type RasterSize } from './rasterLod';
import { RASTER_TEXTURE_BUDGET_4K_BYTES } from './rasterMemoryBudget';
import {
  RasterDecodeWorkerPool,
  type RasterDecodeWorkerPoolOptions,
} from './RasterDecodeWorkerPool';
import type { RasterDecodeWorkerSetting } from './rasterDecodePolicy';
import {
  RasterRendererFallbackError,
  resolveRasterRendererRoute,
  type RasterContextStatus,
} from './rasterRendererState';

export const DEFAULT_RASTER_TEXTURE_BUDGET_BYTES = RASTER_TEXTURE_BUDGET_4K_BYTES;

export interface RasterRuntimeSnapshot {
  downloads: Readonly<Record<string, MediaDownloadProgress>>;
  residentResourceKeys: readonly string[];
  residentTextures: readonly RasterResidentTextureSnapshot[];
  cache: {
    count: number;
    usedBytes: number;
    reservedBytes: number;
    maxBytes: number;
    oversubscribed: boolean;
  };
  context: {
    status: RasterContextStatus;
    generation: number;
  };
}

export interface RasterResidentTextureSnapshot {
  resourceKey: string;
  quality: RasterTextureQuality;
  width: number;
  height: number;
  naturalWidth: number;
  naturalHeight: number;
  bytes: number;
}

export interface RasterPipelineOptions {
  decodeWorkers?: RasterDecodeWorkerSetting;
  decodeWorkerMax?: number;
  /** Test/host injection point; normal consumers use the Worker settings above. */
  decodePool?: RasterDecodeWorkerPool;
}

interface RasterSchedulingState {
  priority: number;
  foreground: boolean;
}

interface RasterInFlightRecord {
  resourceKey: string;
  quality: RasterTextureQuality;
  viewportLod: boolean;
  activeSpecific: boolean;
  decodeKey: string;
  abortController: AbortController;
  scheduling: RasterSchedulingState;
  promise: Promise<RasterTextureEntry>;
}

interface PreparedRasterTexture {
  entry: RasterTextureEntry;
  reservation: TextureCacheReservation;
}

export class RasterPipeline {
  readonly renderer: WebGLRasterRenderer;
  readonly cache: TextureCache;
  private readonly inFlight = new Map<string, RasterInFlightRecord>();
  private readonly decodePool: RasterDecodeWorkerPool;
  private readonly uploadQueue = new PriorityTaskQueue(1);
  private disposed = false;
  private readonly unsubscribeContext: () => void;
  private contextGeneration = 0;
  private contextLost = false;
  private contextStatus: RasterContextStatus = 'healthy';
  private readonly listeners = new Set<() => void>();
  private readonly downloads = new Map<string, MediaDownloadProgress>();
  /** Only the foreground original is retained between Screen and Full LOD. */
  private foregroundBlob: { resourceKey: string; source: MediaSource; blob: Blob } | null = null;
  private displayGeneration = 0;
  private displayBox: RasterSize | null = null;
  private activeResourceKey: string | undefined;
  private requestSequence = 0;

  constructor(
    renderer: WebGLRasterRenderer,
    budgetBytes = DEFAULT_RASTER_TEXTURE_BUDGET_BYTES,
    options: RasterPipelineOptions = {},
  ) {
    this.renderer = renderer;
    this.cache = new TextureCache(renderer.gl, budgetBytes);
    this.decodePool = options.decodePool ?? new RasterDecodeWorkerPool({
      workers: options.decodeWorkers,
      maxWorkers: options.decodeWorkerMax,
    } satisfies RasterDecodeWorkerPoolOptions);
    this.unsubscribeContext = renderer.subscribeContext((event) => {
      if (event === 'lost') {
        this.contextLost = true;
        this.contextStatus = 'lost';
        this.cancelAllInFlight(true, 'WebGL context lost');
        this.cache.clear(false);
      } else if (event === 'restored') {
        this.contextLost = false;
        this.contextStatus = 'restored';
        this.contextGeneration += 1;
      } else {
        this.contextLost = true;
        this.contextStatus = 'restore-failed';
        this.cancelAllInFlight(true, 'WebGL context restoration failed');
        this.cache.clear(false);
      }
      this.emit();
    });
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  get generation(): number {
    return this.contextGeneration;
  }

  get isContextLost(): boolean {
    return this.contextLost;
  }

  get currentContextStatus(): RasterContextStatus {
    return this.contextStatus;
  }

  runtimeSnapshot(): RasterRuntimeSnapshot {
    const cache = this.cache.snapshot();
    return {
      downloads: Object.fromEntries(this.downloads),
      residentResourceKeys: this.cache.residentResourceKeys(),
      residentTextures: this.cache.residentEntries().map((entry) => ({
        resourceKey: entry.resourceKey,
        quality: entry.quality,
        width: entry.textureWidth,
        height: entry.textureHeight,
        naturalWidth: entry.naturalWidth,
        naturalHeight: entry.naturalHeight,
        bytes: entry.estimatedBytes,
      })),
      cache,
      context: {
        status: this.contextStatus,
        generation: this.contextGeneration,
      },
    };
  }

  /** Reconciles resident neighbor LODs with the current image-stage viewport. */
  reconcileViewportLods(
    screenBox: RasterSize,
    browseBox: RasterSize,
    keepResourceKey?: string,
  ): void {
    const previousBox = this.displayBox;
    const sizeClassChanged = !previousBox ||
      screenBox.width > previousBox.width * 1.1 ||
      screenBox.height > previousBox.height * 1.1 ||
      screenBox.width < previousBox.width * 0.9 ||
      screenBox.height < previousBox.height * 0.9;
    if (sizeClassChanged) {
      this.displayBox = screenBox;
      this.displayGeneration += 1;
      this.cancelInFlight(
        (record) => record.viewportLod,
        true,
        'Raster viewport LOD became stale after stage resize',
      );
    }
    let changed = false;
    for (const entry of this.cache.residentEntries()) {
      if (entry.resourceKey === keepResourceKey) continue;
      if (entry.quality === 'display') {
        if (this.cachedEntryMatchesTarget(entry, 'display', screenBox)) continue;
        if (this.cachedEntryMeetsMinimum(entry, 'browse', browseBox)) {
          const browseKey = entry.resourceKey + '|browse';
          this.cache.rekey(entry.key, browseKey, { quality: 'browse' });
          changed = true;
        } else {
          changed = this.cache.delete(entry.key) || changed;
        }
      } else if (entry.quality === 'browse' &&
        !this.cachedEntryMatchesTarget(entry, 'browse', browseBox)) {
        changed = this.cache.delete(entry.key) || changed;
      }
    }
    if (changed) this.emit();
  }

  retainOnly(keys: readonly string[]): void {
    if (this.cache.retainOnly(keys)) this.emit();
  }

  release(key: string): void {
    if (this.cache.delete(key)) this.emit();
  }

  setBudgetBytes(budgetBytes: number): void {
    this.cache.setMaxBytes(budgetBytes);
    this.emit();
  }

  /** Cancels background work removed by the latest Screen/Browse corridor plan. */
  reconcileDecodePlan(desiredTextureKeys: readonly string[]): void {
    const desired = new Set(desiredTextureKeys);
    this.cancelInFlight(
      (record) => !record.activeSpecific &&
        !desired.has(`${record.resourceKey}|${record.quality}`),
      false,
      'Raster decode removed from the current preload plan',
    );
  }

  prepare(
    resourceKey: string,
    source: MediaSource,
    quality: RasterTextureQuality,
    naturalSize?: { width: number; height: number },
    priority = 0,
    screenBox?: RasterSize,
  ): Promise<RasterTextureEntry> {
    const key = resourceKey + '|' + quality;
    const viewportLod = quality === 'display' || quality === 'browse';
    const activeDisplay = quality === 'display' && priority >= 100;
    if (activeDisplay) this.activateResource(resourceKey);
    const requestDisplayGeneration = this.displayGeneration;
    const inFlightKey = viewportLod
      ? `${key}@${requestDisplayGeneration}`
      : key;
    const cached = this.cache.get(key);
    if (cached && this.cachedEntryMeetsMinimum(cached, quality, screenBox)) {
      return Promise.resolve(cached);
    }
    const running = this.inFlight.get(inFlightKey);
    if (running) {
      if (activeDisplay) {
        running.activeSpecific = true;
        running.scheduling.priority = Math.max(running.scheduling.priority, priority);
        running.scheduling.foreground = true;
        this.decodePool.promote(running.decodeKey, running.scheduling.priority, true);
      }
      return running.promise;
    }
    const generation = this.contextGeneration;
    const abortController = new AbortController();
    const decodeKey = `${inFlightKey}#${++this.requestSequence}`;
    const scheduling: RasterSchedulingState = {
      priority,
      foreground: activeDisplay || quality === 'full',
    };
    const record = {} as RasterInFlightRecord;
    const promise = this.createEntry(
      key,
      resourceKey,
      source,
      quality,
      naturalSize,
      screenBox,
      scheduling,
      decodeKey,
      abortController.signal,
    )
      .then(({ entry, reservation }) => {
        if (this.disposed) {
          this.renderer.gl.deleteTexture(entry.texture);
          reservation.release();
          throw new DOMException('Raster pipeline has been disposed', 'AbortError');
        }
        if (generation !== this.contextGeneration || this.contextLost) {
          this.renderer.gl.deleteTexture(entry.texture);
          reservation.release();
          throw new DOMException(
            'Raster upload became stale after WebGL context loss',
            'AbortError',
          );
        }
        if (viewportLod && requestDisplayGeneration !== this.displayGeneration) {
          this.renderer.gl.deleteTexture(entry.texture);
          reservation.release();
          throw new DOMException(
            'Raster viewport LOD became stale after stage resize',
            'AbortError',
          );
        }
        if (!reservation.commit(entry, scheduling.priority)) {
          throw new DOMException(
            'Raster texture budget changed before upload admission completed',
            'AbortError',
          );
        }
        this.emit();
        return entry;
      })
      .finally(() => {
        if (this.inFlight.get(inFlightKey) === record) this.inFlight.delete(inFlightKey);
      });
    Object.assign(record, {
      resourceKey,
      quality,
      viewportLod,
      activeSpecific: activeDisplay || quality === 'preview' || quality === 'full',
      decodeKey,
      abortController,
      scheduling,
      promise,
    });
    this.inFlight.set(inFlightKey, record);
    return promise;
  }

  dispose(): void {
    this.disposed = true;
    this.unsubscribeContext();
    this.cancelAllInFlight(true, 'Raster pipeline has been disposed');
    this.decodePool.dispose();
    this.uploadQueue.dispose();
    this.cache.clear();
    this.foregroundBlob = null;
    this.listeners.clear();
  }

  private async createEntry(
    key: string,
    resourceKey: string,
    source: MediaSource,
    quality: RasterTextureQuality,
    naturalSize?: { width: number; height: number },
    screenBox?: RasterSize,
    scheduling: RasterSchedulingState = { priority: 0, foreground: false },
    decodeKey = `${resourceKey}|${quality}`,
    signal?: AbortSignal,
  ): Promise<PreparedRasterTexture> {
    const reportProgress = quality === 'preview'
      ? undefined
      : (progress: MediaDownloadProgress) => {
          this.downloads.set(resourceKey, progress);
          this.emit();
        };
    const currentOriginal = quality !== 'preview' && this.activeResourceKey === resourceKey;
    const retained = currentOriginal && this.foregroundBlob?.resourceKey === resourceKey &&
      sameMediaSource(this.foregroundBlob.source, source)
      ? this.foregroundBlob.blob
      : undefined;
    // URL 获取和 Blob 分块组装也必须在 Worker；只把 Blob/bytes 输入留在主线程包装。
    const blob = retained ?? (source.type === 'url'
      ? undefined
      : await acquireMediaBlob(source, { onProgress: reportProgress, signal }));
    signal?.throwIfAborted();
    if (currentOriginal && !retained && blob) {
      this.foregroundBlob = { resourceKey, source, blob };
    }

    const headerSize = quality === 'preview' || naturalSize || !blob
      ? undefined
      : await readRasterNaturalSize(blob).catch(() => undefined);
    let resolvedNaturalSize = naturalSize ?? headerSize;
    if (resolvedNaturalSize && quality !== 'preview') {
      const route = resolveRasterRendererRoute({
        webgl2Available: true,
        maxTextureSize: this.renderer.maxTextureSize,
        naturalSize: resolvedNaturalSize,
      });
      if (route.renderer === 'dom-image') {
        if (this.foregroundBlob?.resourceKey === resourceKey) this.foregroundBlob = null;
        throw new RasterRendererFallbackError(
          route.fallbackReason ?? 'texture-too-large',
          `Raster dimensions exceed the safe WebGL texture edge (${route.safeTextureSize ?? 0}px)`,
        );
      }
    }
    const textureSize = resolvedNaturalSize
      ? resolveTextureSize(
          quality,
          resolvedNaturalSize,
          screenBox,
          this.renderer.maxTextureSize,
          this.cache.maxBytes,
        )
      : undefined;
    const directTarget = textureSize && resolvedNaturalSize && (
      textureSize.width < resolvedNaturalSize.width ||
      textureSize.height < resolvedNaturalSize.height
    ) ? textureSize : undefined;
    const decoded = await this.decodePool.decode({
      key: decodeKey,
      blob,
      url: source.type === 'url'
        ? { href: source.href, contentLength: source.contentLength }
        : undefined,
      onProgress: reportProgress,
      targetSize: directTarget,
      fitBox: !resolvedNaturalSize && (quality === 'display' || quality === 'browse')
        ? screenBox
        : undefined,
      maxTextureSize: this.renderer.maxTextureSize,
      naturalPixels: quality !== 'preview' && resolvedNaturalSize
        ? resolvedNaturalSize.width * resolvedNaturalSize.height
        : undefined,
      priority: scheduling.priority,
      foreground: scheduling.foreground,
    });
    const bitmap = decoded.bitmap;
    if (
      blob &&
      quality !== 'preview' &&
      this.activeResourceKey === resourceKey &&
      (
        this.foregroundBlob?.resourceKey !== resourceKey ||
        !sameMediaSource(this.foregroundBlob.source, source)
      )
    ) {
      this.foregroundBlob = { resourceKey, source, blob };
    }
    if (signal?.aborted) {
      bitmap.close();
      signal.throwIfAborted();
    }

    if (!resolvedNaturalSize) {
      resolvedNaturalSize = decoded.naturalSize ?? { width: bitmap.width, height: bitmap.height };
    }
    if (quality !== 'preview') {
      const route = resolveRasterRendererRoute({
        webgl2Available: true,
        maxTextureSize: this.renderer.maxTextureSize,
        naturalSize: resolvedNaturalSize,
      });
      if (route.renderer === 'dom-image') {
        bitmap.close();
        if (this.foregroundBlob?.resourceKey === resourceKey) this.foregroundBlob = null;
        throw new RasterRendererFallbackError(
          route.fallbackReason ?? 'texture-too-large',
          `Raster dimensions exceed the safe WebGL texture edge (${route.safeTextureSize ?? 0}px)`,
        );
      }
    }
    const naturalWidth = resolvedNaturalSize.width;
    const naturalHeight = resolvedNaturalSize.height;
    const textureLimited = quality === 'full' && (
      bitmap.width !== naturalWidth || bitmap.height !== naturalHeight
    );
    try {
      const prepared = await this.uploadQueue.schedule(
        scheduling.priority,
        async () => {
          signal?.throwIfAborted();
          const estimatedBytes = bitmap.width * bitmap.height * 4;
          const reservation = this.cache.reserve(
            key,
            estimatedBytes,
            scheduling.foreground,
            scheduling.priority,
          );
          if (!reservation) {
            throw new DOMException(
              'Raster texture rejected by the configured texture budget',
              'QuotaExceededError',
            );
          }
          try {
            const texture = await this.renderer.upload(bitmap);
            if (signal?.aborted) {
              this.renderer.gl.deleteTexture(texture);
              signal.throwIfAborted();
            }
            const now = performance.now();
            return {
              entry: {
                key,
                resourceKey,
                quality,
                texture,
                textureWidth: bitmap.width,
                textureHeight: bitmap.height,
                naturalWidth,
                naturalHeight,
                estimatedBytes,
                lastUsedAt: now,
                readyAt: now,
                textureLimited,
              },
              reservation,
            } satisfies PreparedRasterTexture;
          } catch (error) {
            reservation.release();
            throw error;
          }
        },
        decodeKey,
      );
      return prepared;
    } finally {
      bitmap.close();
      if (quality === 'full' && this.foregroundBlob?.resourceKey === resourceKey) {
        this.foregroundBlob = null;
      }
    }
  }

  private activateResource(resourceKey: string): void {
    if (this.activeResourceKey === resourceKey) return;
    this.activeResourceKey = resourceKey;
    if (this.foregroundBlob?.resourceKey !== resourceKey) this.foregroundBlob = null;
    this.cancelInFlight(
      (record) => record.activeSpecific && record.resourceKey !== resourceKey,
      true,
      `Raster decode superseded by current resource: ${resourceKey}`,
    );
  }

  private cancelAllInFlight(hard: boolean, reason: string): void {
    this.cancelInFlight(() => true, hard, reason);
  }

  private cancelInFlight(
    predicate: (record: RasterInFlightRecord) => boolean,
    hard: boolean,
    reason: string,
  ): void {
    for (const [key, record] of this.inFlight) {
      if (!predicate(record)) continue;
      this.inFlight.delete(key);
      const cancellation = new DOMException(reason, 'AbortError');
      record.abortController.abort(cancellation);
      this.decodePool.cancel(record.decodeKey, hard);
      this.uploadQueue.cancelPending(record.decodeKey, cancellation);
    }
  }

  private cachedEntryMeetsMinimum(
    entry: RasterTextureEntry,
    quality: RasterTextureQuality,
    screenBox?: RasterSize,
  ): boolean {
    if ((quality !== 'display' && quality !== 'browse') || !screenBox) return true;
    const target = resolveTextureSize(
      quality,
      { width: entry.naturalWidth, height: entry.naturalHeight },
      screenBox,
      this.renderer.maxTextureSize,
      this.cache.maxBytes,
    );
    // Ignore tiny viewport jitter (scrollbars, fractional DPR); a real size-class
    // transition such as contained → 4K fullscreen still invalidates immediately.
    return entry.textureWidth >= target.width * 0.9 && entry.textureHeight >= target.height * 0.9;
  }

  private cachedEntryMatchesTarget(
    entry: RasterTextureEntry,
    quality: RasterTextureQuality,
    screenBox: RasterSize,
  ): boolean {
    if (!this.cachedEntryMeetsMinimum(entry, quality, screenBox)) return false;
    const target = resolveTextureSize(
      quality,
      { width: entry.naturalWidth, height: entry.naturalHeight },
      screenBox,
      this.renderer.maxTextureSize,
      this.cache.maxBytes,
    );
    return entry.textureWidth <= target.width * 1.35 && entry.textureHeight <= target.height * 1.35;
  }

  private emit(): void {
    this.listeners.forEach((listener) => listener());
  }
}

function resolveTextureSize(
  quality: RasterTextureQuality,
  naturalSize: RasterSize,
  screenBox: RasterSize | undefined,
  maxTextureSize: number,
  maxTextureBytes: number,
): RasterSize {
  const requested = (quality === 'display' || quality === 'browse') && screenBox
    ? fitRasterToScreenLod(
        naturalSize.width,
        naturalSize.height,
        screenBox.width,
        screenBox.height,
      )
    : naturalSize;
  const dimensionLimited = fitRasterToTextureLimit(
    requested.width,
    requested.height,
    maxTextureSize,
  );
  return fitRasterToByteLimit(
    dimensionLimited.width,
    dimensionLimited.height,
    maxTextureBytes,
  );
}

function sameMediaSource(a: MediaSource, b: MediaSource): boolean {
  if (a.type !== b.type) return false;
  if (a.type === 'url' && b.type === 'url') return a.href === b.href;
  if (a.type === 'blob' && b.type === 'blob') return a.blob === b.blob;
  if (a.type === 'bytes' && b.type === 'bytes') return a.data === b.data;
  return false;
}

export function fitRasterToTextureLimit(
  width: number,
  height: number,
  maxTextureSize: number,
): { width: number; height: number } {
  const safeWidth = Math.max(1, Math.floor(width));
  const safeHeight = Math.max(1, Math.floor(height));
  const safeLimit = Math.max(1, Math.floor(maxTextureSize));
  const maxDimension = Math.max(safeWidth, safeHeight);
  if (maxDimension <= safeLimit) return { width: safeWidth, height: safeHeight };
  const ratio = safeLimit / maxDimension;
  return {
    width: Math.max(1, Math.round(safeWidth * ratio)),
    height: Math.max(1, Math.round(safeHeight * ratio)),
  };
}

export function fitRasterToByteLimit(
  width: number,
  height: number,
  maxBytes: number,
): { width: number; height: number } {
  const safeWidth = Math.max(1, Math.floor(width));
  const safeHeight = Math.max(1, Math.floor(height));
  const safeBytes = Math.max(0, Math.floor(maxBytes));
  const estimatedBytes = safeWidth * safeHeight * 4;
  if (estimatedBytes <= safeBytes) return { width: safeWidth, height: safeHeight };
  if (safeBytes < 4) return { width: 1, height: 1 };
  const maxPixels = Math.floor(safeBytes / 4);
  const ratio = Math.sqrt(safeBytes / estimatedBytes);
  let targetWidth = Math.max(1, Math.floor(safeWidth * ratio));
  let targetHeight = Math.max(1, Math.floor(safeHeight * ratio));
  // 极端细长图会把较短边钳到 1；再次约束长边，仍保证最终像素数不越界。
  if (targetWidth * targetHeight > maxPixels) {
    if (targetWidth >= targetHeight) {
      targetWidth = Math.max(1, Math.floor(maxPixels / targetHeight));
    } else {
      targetHeight = Math.max(1, Math.floor(maxPixels / targetWidth));
    }
  }
  return { width: targetWidth, height: targetHeight };
}
