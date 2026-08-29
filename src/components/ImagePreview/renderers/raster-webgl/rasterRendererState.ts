import type { RasterFullDecodeStatus } from './rasterLod';

export const RASTER_SAFE_TEXTURE_EDGE_RATIO = 0.9;

export type RasterRendererKind = 'webgl2' | 'dom-image';

export type RasterFallbackReason =
  | 'webgl2-unavailable'
  | 'renderer-initialization-failed'
  | 'texture-too-large'
  | 'texture-budget-exceeded'
  | 'texture-create-failed'
  | 'texture-upload-failed'
  | 'context-lost'
  | 'context-restore-failed'
  | 'texture-invalid';

export type RasterContextStatus = 'healthy' | 'lost' | 'restored' | 'restore-failed';
export type RasterDecodeSourceKind = 'original' | 'preview';

export interface RasterRendererState {
  resourceKey?: string;
  renderer: RasterRendererKind;
  routeReason: 'fast-path' | 'fallback';
  fallbackReason?: RasterFallbackReason;
  webgl2Available: boolean;
  maxTextureSize?: number;
  safeTextureSize?: number;
  sourceWidth?: number;
  sourceHeight?: number;
  contextStatus: RasterContextStatus;
  decodeSource?: RasterDecodeSourceKind;
  fullDecodeStatus?: RasterFullDecodeStatus;
  fullDecodeEstimatedBytes?: number;
  fullDecodeLimitBytes?: number;
}

export interface RasterRendererRouteInput {
  webgl2Available: boolean;
  maxTextureSize?: number;
  naturalSize?: { width: number; height: number };
}

export interface RasterRendererRoute {
  renderer: RasterRendererKind;
  fallbackReason?: RasterFallbackReason;
  safeTextureSize?: number;
}

export function resolveRasterRendererRoute(
  input: RasterRendererRouteInput,
): RasterRendererRoute {
  if (!input.webgl2Available) {
    return { renderer: 'dom-image', fallbackReason: 'webgl2-unavailable' };
  }
  const maxTextureSize = Number(input.maxTextureSize);
  if (!Number.isFinite(maxTextureSize) || maxTextureSize <= 0) {
    return { renderer: 'dom-image', fallbackReason: 'renderer-initialization-failed' };
  }
  const safeTextureSize = Math.max(
    1,
    Math.floor(maxTextureSize * RASTER_SAFE_TEXTURE_EDGE_RATIO),
  );
  const width = Number(input.naturalSize?.width);
  const height = Number(input.naturalSize?.height);
  if (
    Number.isFinite(width) &&
    Number.isFinite(height) &&
    (width > safeTextureSize || height > safeTextureSize)
  ) {
    return { renderer: 'dom-image', fallbackReason: 'texture-too-large', safeTextureSize };
  }
  return { renderer: 'webgl2', safeTextureSize };
}

export class RasterRendererFallbackError extends Error {
  readonly reason: RasterFallbackReason;
  readonly cause?: unknown;
  readonly naturalSize?: { width: number; height: number };

  constructor(
    reason: RasterFallbackReason,
    message: string,
    cause?: unknown,
    naturalSize?: { width: number; height: number },
  ) {
    super(message);
    this.name = 'RasterRendererFallbackError';
    this.reason = reason;
    this.cause = cause;
    this.naturalSize = naturalSize;
  }
}

export function rasterFallbackNaturalSize(
  cause: unknown,
): { width: number; height: number } | undefined {
  return cause instanceof RasterRendererFallbackError ? cause.naturalSize : undefined;
}

export function rasterFallbackReason(cause: unknown): RasterFallbackReason | null {
  if (cause instanceof RasterRendererFallbackError) return cause.reason;
  if (cause instanceof DOMException && cause.name === 'QuotaExceededError') {
    return 'texture-budget-exceeded';
  }
  return null;
}
