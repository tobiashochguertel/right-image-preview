import { fireEvent, render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { WebGLRasterStage } from '../src/components/ImagePreview/renderers/raster-webgl/WebGLRasterStage';
import { RasterRendererFallbackError } from '../src/components/ImagePreview/renderers/raster-webgl/rasterRendererState';
import type { RasterPipeline } from '../src/components/ImagePreview/renderers/raster-webgl/RasterPipeline';
import type { RasterTextureEntry } from '../src/components/ImagePreview/renderers/raster-webgl/types';

const transform = {
  scale: 1.5,
  translateX: 12,
  translateY: -8,
  rotation: 90,
  flipH: true,
  flipV: false,
  cssTransform: 'translate(12px, -8px) rotate(90deg) scale(-1.5, 1.5)',
};

describe('WebGLRasterStage safe fallback', () => {
  it('renders a native Raster image instead of reporting an error when WebGL2 is unavailable', async () => {
    const onDimensions = vi.fn();
    const onPhaseChange = vi.fn();
    const onError = vi.fn();
    const onPresented = vi.fn();
    const onRendererStateChange = vi.fn();
    const createPipeline = vi.fn(() => {
      throw new RasterRendererFallbackError('webgl2-unavailable', 'no WebGL2');
    });

    const view = render(
      <WebGLRasterStage
        active
        resourceKey="photo"
        source={{ type: 'url', href: '/photo.jpg' }}
        transform={transform}
        onDimensions={onDimensions}
        onPhaseChange={onPhaseChange}
        onError={onError}
        onPresented={onPresented}
        onRendererStateChange={onRendererStateChange}
        createPipeline={createPipeline}
      />,
    );

    const fallback = await waitFor(() => {
      const image = view.container.querySelector<HTMLImageElement>(
        '[data-rip-raster-fallback] img',
      );
      expect(image).not.toBeNull();
      return image!;
    });
    Object.defineProperty(fallback, 'naturalWidth', { configurable: true, value: 1200 });
    Object.defineProperty(fallback, 'naturalHeight', { configurable: true, value: 800 });
    fireEvent.load(fallback);

    expect(fallback.style.transform).toBe(transform.cssTransform);
    expect(onDimensions).toHaveBeenCalledWith(1200, 800);
    expect(onPhaseChange).toHaveBeenCalledWith('display-ready');
    expect(onPresented).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
    expect(onRendererStateChange).toHaveBeenCalledWith(expect.objectContaining({
      renderer: 'dom-image',
      routeReason: 'fallback',
      fallbackReason: 'webgl2-unavailable',
      webgl2Available: false,
    }));
  });

  it('keeps the DOM fallback visible through context loss and returns to WebGL after restore', async () => {
    const pipeline = new FakeRasterPipeline();
    const onRendererStateChange = vi.fn();
    const view = render(
      <WebGLRasterStage
        active
        resourceKey="photo"
        source={{ type: 'url', href: '/photo.jpg' }}
        transform={transform}
        onDimensions={vi.fn()}
        onPhaseChange={vi.fn()}
        onError={vi.fn()}
        onPresented={vi.fn()}
        onRendererStateChange={onRendererStateChange}
        createPipeline={() => pipeline as unknown as RasterPipeline}
      />,
    );

    await waitFor(() => {
      expect(view.container.querySelector('[data-rip-raster-renderer="webgl2"]'))
        .not.toBeNull();
    });
    pipeline.emitContext('lost');
    await waitFor(() => {
      expect(view.container.querySelector('[data-rip-raster-fallback]')).not.toBeNull();
    });
    expect(onRendererStateChange).toHaveBeenCalledWith(expect.objectContaining({
      renderer: 'dom-image',
      fallbackReason: 'context-lost',
      contextStatus: 'lost',
    }));

    pipeline.emitContext('restored');
    await waitFor(() => {
      expect(view.container.querySelector('[data-rip-raster-fallback]')).toBeNull();
      expect(view.container.querySelector('[data-rip-raster-renderer="webgl2"]'))
        .not.toBeNull();
    });
    expect(onRendererStateChange).toHaveBeenCalledWith(expect.objectContaining({
      renderer: 'webgl2',
      routeReason: 'fast-path',
      contextStatus: 'restored',
    }));
  });

  it('routes a source beyond the safe texture edge to the DOM fallback before upload', async () => {
    const pipeline = new FakeRasterPipeline();
    const onRendererStateChange = vi.fn();
    const view = render(
      <WebGLRasterStage
        active
        resourceKey="ultra-wide"
        source={{ type: 'url', href: '/ultra-wide.jpg' }}
        knownSize={{ width: 8000, height: 100 }}
        transform={transform}
        onDimensions={vi.fn()}
        onPhaseChange={vi.fn()}
        onError={vi.fn()}
        onPresented={vi.fn()}
        onRendererStateChange={onRendererStateChange}
        createPipeline={() => pipeline as unknown as RasterPipeline}
      />,
    );

    await waitFor(() => {
      expect(view.container.querySelector('[data-rip-raster-fallback]')).not.toBeNull();
    });
    expect(onRendererStateChange).toHaveBeenCalledWith(expect.objectContaining({
      renderer: 'dom-image',
      fallbackReason: 'texture-too-large',
      maxTextureSize: 8192,
      safeTextureSize: 7372,
      sourceWidth: 8000,
      sourceHeight: 100,
    }));
  });

  it('routes an active texture upload failure to the DOM fallback', async () => {
    const pipeline = new FakeRasterPipeline(
      new RasterRendererFallbackError('texture-upload-failed', 'upload failed'),
    );
    const onRendererStateChange = vi.fn();
    const view = render(
      <WebGLRasterStage
        active
        resourceKey="upload-failure"
        source={{ type: 'url', href: '/upload-failure.jpg' }}
        transform={transform}
        onDimensions={vi.fn()}
        onPhaseChange={vi.fn()}
        onError={vi.fn()}
        onPresented={vi.fn()}
        onRendererStateChange={onRendererStateChange}
        createPipeline={() => pipeline as unknown as RasterPipeline}
      />,
    );

    await waitFor(() => {
      expect(view.container.querySelector('[data-rip-raster-fallback]')).not.toBeNull();
    });
    expect(onRendererStateChange).toHaveBeenCalledWith(expect.objectContaining({
      renderer: 'dom-image',
      fallbackReason: 'texture-upload-failed',
    }));
  });

  it('uses only the bounded Preview in DOM fallback when original RGBA exceeds 1 GiB', async () => {
    const pipeline = new FakeRasterPipeline();
    const onDimensions = vi.fn();
    const onRendererStateChange = vi.fn();
    const view = render(
      <WebGLRasterStage
        active
        resourceKey="huge"
        source={{ type: 'url', href: '/huge.jpg' }}
        previewSource={{ type: 'url', href: '/huge-preview.jpg' }}
        knownSize={{ width: 20_000, height: 20_000 }}
        transform={transform}
        onDimensions={onDimensions}
        onPhaseChange={vi.fn()}
        onError={vi.fn()}
        onPresented={vi.fn()}
        onRendererStateChange={onRendererStateChange}
        createPipeline={() => pipeline as unknown as RasterPipeline}
      />,
    );

    const fallback = await waitFor(() => {
      const image = view.container.querySelector<HTMLImageElement>(
        '[data-rip-raster-fallback] img',
      );
      expect(image).not.toBeNull();
      return image!;
    });
    expect(fallback.getAttribute('src')).toBe('/huge-preview.jpg');
    expect(fallback.style.width).toBe('auto');
    expect(fallback.style.height).toBe('auto');
    expect(fallback.style.objectFit).toBe('contain');
    fireEvent.load(fallback);
    expect(onDimensions).toHaveBeenCalledWith(20_000, 20_000);
    expect(onRendererStateChange).toHaveBeenCalledWith(expect.objectContaining({
      renderer: 'dom-image',
      decodeSource: 'preview',
      fullDecodeStatus: 'blocked',
      fullDecodeEstimatedBytes: 1_600_000_000,
    }));
    expect(pipeline.prepareCalls).toHaveLength(0);
  });

  it('fails safely without reading an oversized original when no Preview exists', async () => {
    const pipeline = new FakeRasterPipeline();
    const onError = vi.fn();
    const view = render(
      <WebGLRasterStage
        active
        resourceKey="huge-without-preview"
        source={{ type: 'url', href: '/never-read.jpg' }}
        knownSize={{ width: 20_000, height: 20_000 }}
        transform={transform}
        onDimensions={vi.fn()}
        onPhaseChange={vi.fn()}
        onError={onError}
        onPresented={vi.fn()}
        createPipeline={() => pipeline as unknown as RasterPipeline}
      />,
    );

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith(expect.objectContaining({
        name: 'RasterDecodeSafetyError',
      }));
    });
    expect(view.container.querySelector('[data-rip-raster-fallback] img')).toBeNull();
    expect(pipeline.prepareCalls).toHaveLength(0);
  });

  it('keeps WebGL but decodes only Preview when a within-edge original exceeds 1 GiB', async () => {
    const pipeline = new FakeRasterPipeline();
    pipeline.renderer.maxTextureSize = 32_768;
    const onRendererStateChange = vi.fn();
    render(
      <WebGLRasterStage
        active
        resourceKey="large-square"
        source={{ type: 'url', href: '/large-square.jpg' }}
        previewSource={{ type: 'url', href: '/large-square-preview.jpg' }}
        knownSize={{ width: 17_000, height: 17_000 }}
        fullResolutionSettleMs={0}
        transform={transform}
        onDimensions={vi.fn()}
        onPhaseChange={vi.fn()}
        onError={vi.fn()}
        onPresented={vi.fn()}
        onRendererStateChange={onRendererStateChange}
        createPipeline={() => pipeline as unknown as RasterPipeline}
      />,
    );

    await waitFor(() => {
      expect(pipeline.prepareCalls).toHaveLength(1);
    });
    expect(pipeline.prepareCalls[0]).toMatchObject({
      resourceKey: 'large-square',
      source: { type: 'url', href: '/large-square-preview.jpg' },
      quality: 'display',
    });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(pipeline.prepareCalls).toHaveLength(1);
    expect(onRendererStateChange).toHaveBeenCalledWith(expect.objectContaining({
      renderer: 'webgl2',
      decodeSource: 'preview',
      fullDecodeStatus: 'blocked',
    }));
  });
});

class FakeRasterPipeline {
  generation = 0;
  isContextLost = false;
  currentContextStatus: 'healthy' | 'lost' | 'restored' = 'healthy';
  private listener: (() => void) | undefined;
  private entry: RasterTextureEntry | null = null;
  readonly prepareCalls: Array<{ resourceKey: string; source: unknown; quality: string }> = [];
  private readonly prepareFailure?: Error;

  constructor(prepareFailure?: Error) {
    this.prepareFailure = prepareFailure;
  }

  renderer = {
    maxTextureSize: 8192,
    gl: { deleteTexture: vi.fn() },
    render: vi.fn(() => true),
    dispose: vi.fn(),
  };

  cache = {
    snapshot: () => ({
      count: this.entry ? 1 : 0,
      usedBytes: this.entry?.estimatedBytes ?? 0,
      reservedBytes: 0,
      maxBytes: 1024 * 1024,
      oversubscribed: false,
    }),
    residentEntries: () => this.entry ? [this.entry] : [],
    residentResourceKeys: () => this.entry ? [this.entry.resourceKey] : [],
    isResident: (candidate: RasterTextureEntry) => candidate === this.entry,
    bestResident: (resourceKey: string) =>
      this.entry?.resourceKey === resourceKey ? this.entry : undefined,
    get: (key: string) => this.entry?.key === key ? this.entry : undefined,
    has: (key: string) => this.entry?.key === key,
    protect: vi.fn(),
    prioritize: vi.fn(),
  };

  subscribe(listener: () => void) {
    this.listener = listener;
    return () => { this.listener = undefined; };
  }

  runtimeSnapshot() {
    return {
      downloads: {},
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
      cache: this.cache.snapshot(),
      context: { status: this.currentContextStatus, generation: this.generation },
    };
  }

  prepare(
    resourceKey: string,
    source: unknown,
    quality: string,
    naturalSize?: { width: number; height: number },
  ) {
    this.prepareCalls.push({ resourceKey, source, quality });
    if (this.prepareFailure) return Promise.reject(this.prepareFailure);
    this.entry = rasterEntry(resourceKey, naturalSize);
    return Promise.resolve(this.entry);
  }

  emitContext(status: 'lost' | 'restored') {
    this.currentContextStatus = status;
    this.isContextLost = status === 'lost';
    if (status === 'lost') this.entry = null;
    else this.generation += 1;
    this.listener?.();
  }

  reconcileViewportLods() {}
  setBudgetBytes() {}
  release() {}
  retainOnly() {}
  reconcileDecodePlan() {}
  dispose() {}
}

function rasterEntry(
  resourceKey: string,
  naturalSize: { width: number; height: number } = { width: 800, height: 600 },
): RasterTextureEntry {
  return {
    key: resourceKey + '|display',
    resourceKey,
    quality: 'display',
    texture: {} as WebGLTexture,
    textureWidth: 800,
    textureHeight: 600,
    naturalWidth: naturalSize.width,
    naturalHeight: naturalSize.height,
    estimatedBytes: 800 * 600 * 4,
    lastUsedAt: 0,
    readyAt: 0,
    textureLimited: false,
  };
}
