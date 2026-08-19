import {
  acquireMediaBlob,
  type MediaDownloadProgress,
  type MediaSource,
} from '../../core/media-source';
import { TextureCache } from './TextureCache';
import { WebGLRasterRenderer } from './WebGLRasterRenderer';
import type { RasterTextureEntry, RasterTextureQuality } from './types';
import { PriorityTaskQueue } from './PriorityTaskQueue';
import { readRasterNaturalSize } from './rasterDimensions';
import { fitRasterToScreenLod, type RasterSize } from './rasterLod';
import { RASTER_TEXTURE_BUDGET_4K_BYTES } from './rasterMemoryBudget';

export const DEFAULT_RASTER_TEXTURE_BUDGET_BYTES = RASTER_TEXTURE_BUDGET_4K_BYTES;

export interface RasterRuntimeSnapshot {
  downloads: Readonly<Record<string, MediaDownloadProgress>>;
  residentResourceKeys: readonly string[];
  residentTextures: readonly RasterResidentTextureSnapshot[];
  cache: { count: number; usedBytes: number; maxBytes: number; oversubscribed: boolean };
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

export class RasterPipeline {
  readonly renderer: WebGLRasterRenderer;
  readonly cache: TextureCache;
  private readonly inFlight = new Map<string, Promise<RasterTextureEntry>>();
  private disposed = false;
  private readonly unsubscribeContext: () => void;
  private contextGeneration = 0;
  private contextLost = false;
  private readonly listeners = new Set<() => void>();
  private readonly downloads = new Map<string, MediaDownloadProgress>();
  /** Only the foreground original is retained between Screen and Full LOD. */
  private foregroundBlob: { resourceKey: string; source: MediaSource; blob: Blob } | null = null;
  private displayGeneration = 0;
  private displayBox: RasterSize | null = null;
  // Keep one lane available to the active image. Neighbor Screen work is still
  // important, but must not consume both expensive decode/upload lanes before
  // a newly selected image can start. Only the active Display request (100)
  // qualifies as foreground; Full/neighbor work remains pre-emptible.
  private readonly decodeQueue = new PriorityTaskQueue(2, 100);

  constructor(renderer: WebGLRasterRenderer, budgetBytes = DEFAULT_RASTER_TEXTURE_BUDGET_BYTES) {
    this.renderer = renderer;
    this.cache = new TextureCache(renderer.gl, budgetBytes);
    this.unsubscribeContext = renderer.subscribeContext((event) => {
      if (event === 'lost') {
        this.contextLost = true;
        this.cache.clear(false);
      } else {
        this.contextLost = false;
        this.contextGeneration += 1;
        this.inFlight.clear();
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
      this.decodeQueue.cancelPending('lod');
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
    this.cache.retainOnly(keys);
    this.emit();
  }

  release(key: string): void {
    if (this.cache.delete(key)) this.emit();
  }

  setBudgetBytes(budgetBytes: number): void {
    this.cache.setMaxBytes(budgetBytes);
    this.emit();
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
    const requestDisplayGeneration = this.displayGeneration;
    const inFlightKey = viewportLod
      ? `${key}@${requestDisplayGeneration}`
      : key;
    const cached = this.cache.get(key);
    if (cached && this.cachedEntryMeetsMinimum(cached, quality, screenBox)) {
      return Promise.resolve(cached);
    }
    const running = this.inFlight.get(inFlightKey);
    if (running) return running;
    const generation = this.contextGeneration;
    const promise = this.decodeQueue.schedule(
      priority,
      () => this.createEntry(key, resourceKey, source, quality, naturalSize, priority, screenBox),
      viewportLod ? 'lod' : undefined,
    )
      .then((entry) => {
        if (this.disposed) {
          this.renderer.gl.deleteTexture(entry.texture);
          throw new Error('Raster pipeline has been disposed');
        }
        if (generation !== this.contextGeneration || this.contextLost) {
          this.renderer.gl.deleteTexture(entry.texture);
          throw new Error('Raster upload became stale after WebGL context loss');
        }
        if (viewportLod && requestDisplayGeneration !== this.displayGeneration) {
          this.renderer.gl.deleteTexture(entry.texture);
          throw new Error('Raster viewport LOD became stale after stage resize');
        }
        this.cache.put(entry, priority);
        this.emit();
        return entry;
      })
      .finally(() => {
        if (this.inFlight.get(inFlightKey) === promise) this.inFlight.delete(inFlightKey);
      });
    this.inFlight.set(inFlightKey, promise);
    return promise;
  }

  dispose(): void {
    this.disposed = true;
    this.unsubscribeContext();
    this.decodeQueue.dispose();
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
    priority = 0,
    screenBox?: RasterSize,
  ): Promise<RasterTextureEntry> {
    const reportProgress = quality === 'preview'
      ? undefined
      : (progress: MediaDownloadProgress) => {
          this.downloads.set(resourceKey, progress);
          this.emit();
        };
    const foreground = quality !== 'preview' && priority >= 80;
    const retained = foreground && this.foregroundBlob?.resourceKey === resourceKey &&
      sameMediaSource(this.foregroundBlob.source, source)
      ? this.foregroundBlob.blob
      : undefined;
    const blob = retained ?? await acquireMediaBlob(source, { onProgress: reportProgress });
    if (foreground && !retained) this.foregroundBlob = { resourceKey, source, blob };

    const headerSize = quality === 'preview'
      ? undefined
      : await readRasterNaturalSize(blob).catch(() => undefined);
    let resolvedNaturalSize = naturalSize ?? headerSize;
    let textureSize = resolvedNaturalSize
      ? resolveTextureSize(quality, resolvedNaturalSize, screenBox, this.renderer.maxTextureSize)
      : undefined;
    let bitmap = textureSize && (
      textureSize.width < resolvedNaturalSize!.width ||
      textureSize.height < resolvedNaturalSize!.height
    )
      ? await createImageBitmap(blob, {
          imageOrientation: 'from-image',
          resizeWidth: textureSize.width,
          resizeHeight: textureSize.height,
          resizeQuality: 'high',
        })
      : await createImageBitmap(blob, { imageOrientation: 'from-image' });

    if (!resolvedNaturalSize) {
      resolvedNaturalSize = { width: bitmap.width, height: bitmap.height };
      textureSize = resolveTextureSize(
        quality,
        resolvedNaturalSize,
        screenBox,
        this.renderer.maxTextureSize,
      );
      if (textureSize.width !== bitmap.width || textureSize.height !== bitmap.height) {
        const resized = await createImageBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, {
          resizeWidth: textureSize.width,
          resizeHeight: textureSize.height,
          resizeQuality: 'high',
        });
        bitmap.close();
        bitmap = resized;
      }
    }
    const naturalWidth = resolvedNaturalSize.width;
    const naturalHeight = resolvedNaturalSize.height;
    const fullLimit = fitRasterToTextureLimit(
      naturalWidth,
      naturalHeight,
      this.renderer.maxTextureSize,
    );
    const textureLimited = quality === 'full' && (
      fullLimit.width !== naturalWidth || fullLimit.height !== naturalHeight
    );
    try {
      const texture = await this.renderer.upload(bitmap);
      const now = performance.now();
      return {
        key,
        resourceKey,
        quality,
        texture,
        textureWidth: bitmap.width,
        textureHeight: bitmap.height,
        naturalWidth,
        naturalHeight,
        estimatedBytes: bitmap.width * bitmap.height * 4,
        lastUsedAt: now,
        readyAt: now,
        textureLimited,
      };
    } finally {
      bitmap.close();
      if (quality === 'full' && this.foregroundBlob?.resourceKey === resourceKey) {
        this.foregroundBlob = null;
      }
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
): RasterSize {
  const requested = (quality === 'display' || quality === 'browse') && screenBox
    ? fitRasterToScreenLod(
        naturalSize.width,
        naturalSize.height,
        screenBox.width,
        screenBox.height,
      )
    : naturalSize;
  return fitRasterToTextureLimit(requested.width, requested.height, maxTextureSize);
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
