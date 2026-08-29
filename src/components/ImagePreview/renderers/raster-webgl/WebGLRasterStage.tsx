import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { MediaPresentationPhase } from '../../core/media-contract';
import type { MediaSource } from '../../core/media-source';
import type { TransformState } from '../../useImageTransform';
import { RasterFallbackViewer } from '../raster-dom/RasterFallbackViewer';
import type { RasterViewport } from './rasterQuad';
import {
  DEFAULT_RASTER_TEXTURE_BUDGET_BYTES,
  RasterPipeline,
  type RasterPipelineOptions,
  type RasterRuntimeSnapshot,
} from './RasterPipeline';
import type { RasterTextureEntry } from './types';
import type { RasterDecodeWorkerSetting } from './rasterDecodePolicy';
import { WebGLRasterRenderer } from './WebGLRasterRenderer';
import {
  RASTER_FULL_DECODE_MAX_BYTES,
  RASTER_FULL_RESOLUTION_SETTLE_MS,
  capRasterSizeToEdge,
  needsRasterFullResolution,
  resolveRasterFullDecodePolicy,
  scaleRasterLodBox,
} from './rasterLod';
import { detectRasterTextureBudgetBytes } from './rasterMemoryBudget';
import {
  rememberRasterScreenHistory,
  selectRasterScreenHistoryPins,
  type RasterScreenHistoryEntry,
} from './rasterScreenHistory';
import {
  estimateRasterTextureBytes,
  planRasterNeighborLods,
  type RasterPlannedPreload,
  type RasterPreloadPlanSnapshot,
  type RasterPreloadSource,
} from './rasterPreloadPlan';
import {
  rasterFallbackReason,
  rasterFallbackNaturalSize,
  resolveRasterRendererRoute,
  type RasterFallbackReason,
  type RasterRendererState,
} from './rasterRendererState';

export interface WebGLRasterStageProps {
  active: boolean;
  resourceKey?: string;
  currentFlatIndex?: number;
  source?: MediaSource;
  previewSource?: MediaSource;
  preloadSources?: readonly RasterPreloadSource[];
  preloadEnabled?: boolean;
  preloadPaused?: boolean;
  fullResolutionPaused?: boolean;
  fullResolutionSettleMs?: number;
  fullDecodeMaxBytes?: number;
  textureBudgetBytes?: number;
  decodeWorkers?: RasterDecodeWorkerSetting;
  decodeWorkerMax?: number;
  onPreloadStateChange?(
    item: RasterPreloadSource,
    phase: 'loading' | 'browse-ready' | 'display-ready' | 'evicted' | 'error',
    targetLod?: 'browse' | 'screen',
  ): void;
  onRuntimeStateChange?(snapshot: RasterRuntimeSnapshot): void;
  onRendererStateChange?(state: RasterRendererState): void;
  onPreloadPlanChange?(snapshot: RasterPreloadPlanSnapshot): void;
  transform: TransformState;
  knownSize?: { width: number; height: number };
  onDimensions(width: number, height: number): void;
  onPhaseChange(phase: MediaPresentationPhase): void;
  onError(error: Error): void;
  onPresented(): void;
  /** Internal test injection; normal consumers always use the default WebGL pipeline. */
  createPipeline?(
    canvas: HTMLCanvasElement,
    budgetBytes: number,
    options: RasterPipelineOptions,
  ): RasterPipeline;
}

interface ActiveRasterFallback {
  resourceKey?: string;
  reason: RasterFallbackReason;
  naturalSize?: { width: number; height: number };
}

function isAbortError(cause: unknown): boolean {
  return cause instanceof Error && cause.name === 'AbortError';
}

function sameResidentTextures(
  previous: readonly RasterRuntimeSnapshot['residentTextures'][number][],
  next: readonly RasterRuntimeSnapshot['residentTextures'][number][],
): boolean {
  return previous.length === next.length && previous.every((item, index) => {
    const candidate = next[index];
    return candidate != null &&
      item.resourceKey === candidate.resourceKey &&
      item.quality === candidate.quality &&
      item.width === candidate.width &&
      item.height === candidate.height &&
      item.naturalWidth === candidate.naturalWidth &&
      item.naturalHeight === candidate.naturalHeight &&
      item.bytes === candidate.bytes;
  });
}

function sameRendererState(
  previous: RasterRendererState | null,
  next: RasterRendererState,
): boolean {
  return !!previous &&
    previous.resourceKey === next.resourceKey &&
    previous.renderer === next.renderer &&
    previous.routeReason === next.routeReason &&
    previous.fallbackReason === next.fallbackReason &&
    previous.webgl2Available === next.webgl2Available &&
    previous.maxTextureSize === next.maxTextureSize &&
    previous.safeTextureSize === next.safeTextureSize &&
    previous.sourceWidth === next.sourceWidth &&
    previous.sourceHeight === next.sourceHeight &&
    previous.contextStatus === next.contextStatus &&
    previous.decodeSource === next.decodeSource &&
    previous.fullDecodeStatus === next.fullDecodeStatus &&
    previous.fullDecodeEstimatedBytes === next.fullDecodeEstimatedBytes &&
    previous.fullDecodeLimitBytes === next.fullDecodeLimitBytes;
}

function defaultCreatePipeline(
  canvas: HTMLCanvasElement,
  budgetBytes: number,
  options: RasterPipelineOptions,
): RasterPipeline {
  return new RasterPipeline(new WebGLRasterRenderer(canvas), budgetBytes, options);
}

export function WebGLRasterStage({
  active,
  resourceKey,
  currentFlatIndex,
  source,
  previewSource,
  preloadSources = [],
  preloadEnabled = true,
  preloadPaused = false,
  fullResolutionPaused = false,
  fullResolutionSettleMs = RASTER_FULL_RESOLUTION_SETTLE_MS,
  fullDecodeMaxBytes = RASTER_FULL_DECODE_MAX_BYTES,
  textureBudgetBytes,
  decodeWorkers,
  decodeWorkerMax,
  onPreloadStateChange,
  onRuntimeStateChange,
  onRendererStateChange,
  onPreloadPlanChange,
  transform,
  knownSize,
  onDimensions,
  onPhaseChange,
  onError,
  onPresented,
  createPipeline = defaultCreatePipeline,
}: WebGLRasterStageProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pipelineRef = useRef<RasterPipeline | null>(null);
  const resourceKeyRef = useRef(resourceKey);
  const pipelineErrorRef = useRef<Error | null>(null);
  const activeRef = useRef(active);
  const generationRef = useRef(0);
  const displayReadyGenerationRef = useRef(0);
  const callbacksRef = useRef({ onDimensions, onPhaseChange, onError, onPresented });
  const preloadCallbackRef = useRef(onPreloadStateChange);
  const runtimeCallbackRef = useRef(onRuntimeStateChange);
  const rendererStateCallbackRef = useRef(onRendererStateChange);
  const planCallbackRef = useRef(onPreloadPlanChange);
  const lastRendererStateRef = useRef<RasterRendererState | null>(null);
  const suppressCanvasUntilActiveEntryRef = useRef(true);
  const activeFullResourceRef = useRef<string | null>(null);
  const retentionKeysRef = useRef<readonly string[]>([]);
  const lastActiveRasterRef = useRef<RasterScreenHistoryEntry | null>(
    resourceKey ? { resourceKey, flatIndex: currentFlatIndex } : null,
  );
  const [entry, setEntry] = useState<RasterTextureEntry | null>(null);
  const [screenHistory, setScreenHistory] = useState<readonly RasterScreenHistoryEntry[]>([]);
  const [viewport, setViewport] = useState<RasterViewport>({ width: 1, height: 1, dpr: 1 });
  const [autoBudgetBytes] = useState(detectRasterTextureBudgetBytes);
  const [contextGeneration, setContextGeneration] = useState(0);
  const [rendererMaxTextureSize, setRendererMaxTextureSize] = useState(16_384);
  const rendererMaxTextureSizeRef = useRef<number | undefined>(undefined);
  const [fallback, setFallback] = useState<ActiveRasterFallback | null>(null);
  const [cacheSnapshot, setCacheSnapshot] = useState({ count: 0, usedBytes: 0, maxBytes: 0 });
  const [residentTextures, setResidentTextures] = useState<RasterRuntimeSnapshot['residentTextures']>([]);
  const knownWidth = knownSize?.width;
  const knownHeight = knownSize?.height;
  const activeFallback = fallback &&
    (fallback.resourceKey == null || fallback.resourceKey === resourceKey)
    ? fallback
    : null;
  const protectedKeys = useMemo(() => {
    if (!resourceKey) return [];
    const keys = [
      resourceKey + '|display',
      resourceKey + '|full',
      // A planned Browse texture becomes the immediate foreground frame on
      // navigation. Keep it through the current-image handoff; otherwise the
      // neighbor pruning effect can delete it between setEntry() and paint.
      resourceKey + '|browse',
    ];
    return keys;
  }, [resourceKey]);
  const screenBox = useMemo(() => capRasterSizeToEdge({
    width: Math.max(1, Math.round(viewport.width * viewport.dpr)),
    height: Math.max(1, Math.round(viewport.height * viewport.dpr)),
  }), [viewport.width, viewport.height, viewport.dpr]);
  const browseBox = useMemo(() => scaleRasterLodBox(screenBox), [screenBox]);
  const effectiveBudgetBytes = textureBudgetBytes ?? autoBudgetBytes ??
    DEFAULT_RASTER_TEXTURE_BUDGET_BYTES;
  const maxTextureSize = rendererMaxTextureSize;
  const actualCurrentBytes = residentTextures
    .filter((texture) => texture.resourceKey === resourceKey)
    .reduce((sum, texture) => sum + texture.bytes, 0);
  const estimatedCurrentBytes = resourceKey && knownWidth && knownHeight
    ? estimateRasterTextureBytes(
        { width: knownWidth, height: knownHeight },
        { width: knownWidth, height: knownHeight },
        maxTextureSize,
      ) + estimateRasterTextureBytes(
        { width: knownWidth, height: knownHeight },
        screenBox,
        maxTextureSize,
      )
    : actualCurrentBytes;
  const currentReservedBytes = Math.max(actualCurrentBytes, estimatedCurrentBytes);
  const immediateNeighborScreenBytes = useMemo(() => {
    const nearest = (side: RasterPreloadSource['side']) => preloadSources
      .filter((candidate) => candidate.side === side)
      .sort((a, b) => a.distance - b.distance)[0];
    return (['forward', 'backward'] as const).reduce((sum, side) => {
      const candidate = nearest(side);
      return sum + (candidate
        ? estimateRasterTextureBytes(candidate.knownSize, screenBox, maxTextureSize)
        : 0);
    }, 0);
  }, [preloadSources, screenBox, maxTextureSize]);
  const historyPins = useMemo(() => selectRasterScreenHistoryPins({
    enabled: preloadEnabled,
    resourceKey,
    history: screenHistory,
    residentTextures,
    budgetBytes: effectiveBudgetBytes,
    currentReservedBytes,
    immediateNeighborScreenBytes,
  }), [
    preloadEnabled,
    resourceKey,
    residentTextures,
    effectiveBudgetBytes,
    currentReservedBytes,
    immediateNeighborScreenBytes,
    screenHistory,
  ]);
  const historyPinKeys = useMemo(
    () => historyPins.map((pin) => pin.resourceKey + '|display'),
    [historyPins],
  );
  const retentionKeys = useMemo(
    () => [...protectedKeys, ...historyPinKeys],
    [protectedKeys, historyPinKeys],
  );
  const planningSources = useMemo(
    () => preloadSources.filter((candidate) =>
      !historyPins.some((pin) => pin.resourceKey === candidate.resourceKey)),
    [preloadSources, historyPins],
  );
  const historyReservedBytes = historyPins.reduce((sum, pin) => sum + pin.bytes, 0);
  const lodPlan = useMemo(() => planRasterNeighborLods({
    candidates: preloadEnabled ? planningSources : [],
    viewport,
    budgetBytes: effectiveBudgetBytes,
    reservedBytes: currentReservedBytes + historyReservedBytes,
    maxTextureSize,
  }), [
    preloadEnabled,
    planningSources,
    viewport,
    effectiveBudgetBytes,
    currentReservedBytes,
    historyReservedBytes,
    maxTextureSize,
  ]);
  const planSnapshot = useMemo<RasterPreloadPlanSnapshot>(() => ({
    ...lodPlan.snapshot,
    historyScreenIndexes: historyPins
      .map((pin) => pin.flatIndex)
      .filter((flatIndex): flatIndex is number => flatIndex != null),
    historyScreenBytes: historyReservedBytes,
  }), [lodPlan.snapshot, historyPins, historyReservedBytes]);
  const foregroundFullDecodePolicy = resolveRasterFullDecodePolicy(
    entry && entry.resourceKey === resourceKey
      ? { width: entry.naturalWidth, height: entry.naturalHeight }
      : knownWidth && knownHeight
        ? { width: knownWidth, height: knownHeight }
        : undefined,
    fullDecodeMaxBytes,
  );
  const foregroundNeedsFull = !!(
    active &&
    resourceKey &&
    entry?.resourceKey === resourceKey &&
    entry.quality === 'display' &&
    foregroundFullDecodePolicy.allowed &&
    needsRasterFullResolution(
      { width: entry.naturalWidth, height: entry.naturalHeight },
      { width: entry.textureWidth, height: entry.textureHeight },
      transform.scale,
      viewport.dpr,
    )
  );

  const publishRendererState = useCallback((next: RasterRendererState) => {
    if (sameRendererState(lastRendererStateRef.current, next)) return;
    lastRendererStateRef.current = next;
    rendererStateCallbackRef.current?.(next);
  }, []);

  const activateFallback = useCallback((
    reason: RasterFallbackReason,
    targetResourceKey: string | undefined,
    naturalSize?: { width: number; height: number },
    contextStatus: RasterRendererState['contextStatus'] = 'healthy',
    decodeSource: RasterRendererState['decodeSource'] = 'original',
  ) => {
    setFallback((previous) =>
      previous?.reason === reason &&
      previous.resourceKey === targetResourceKey &&
      previous.naturalSize?.width === naturalSize?.width &&
      previous.naturalSize?.height === naturalSize?.height
        ? previous
        : { reason, resourceKey: targetResourceKey, naturalSize },
    );
    const maxTextureSize = rendererMaxTextureSizeRef.current;
    const route = resolveRasterRendererRoute({
      webgl2Available: reason !== 'webgl2-unavailable',
      maxTextureSize,
      naturalSize,
    });
    const decodePolicy = resolveRasterFullDecodePolicy(naturalSize, fullDecodeMaxBytes);
    publishRendererState({
      resourceKey: targetResourceKey ?? resourceKeyRef.current,
      renderer: 'dom-image',
      routeReason: 'fallback',
      fallbackReason: reason,
      webgl2Available: reason !== 'webgl2-unavailable',
      maxTextureSize,
      safeTextureSize: route.safeTextureSize,
      sourceWidth: naturalSize?.width,
      sourceHeight: naturalSize?.height,
      contextStatus,
      decodeSource,
      fullDecodeStatus: decodePolicy.status,
      fullDecodeEstimatedBytes: decodePolicy.estimatedBytes,
      fullDecodeLimitBytes: decodePolicy.limitBytes,
    });
  }, [fullDecodeMaxBytes, publishRendererState]);

  const publishWebGLFastPath = useCallback((
    targetResourceKey: string | undefined,
    naturalSize?: { width: number; height: number },
    contextStatus: RasterRendererState['contextStatus'] = 'healthy',
    decodeSource: RasterRendererState['decodeSource'] = 'original',
  ) => {
    const maxTextureSize = rendererMaxTextureSizeRef.current;
    const route = resolveRasterRendererRoute({
      webgl2Available: true,
      maxTextureSize,
      naturalSize,
    });
    const decodePolicy = resolveRasterFullDecodePolicy(naturalSize, fullDecodeMaxBytes);
    publishRendererState({
      resourceKey: targetResourceKey,
      renderer: 'webgl2',
      routeReason: 'fast-path',
      webgl2Available: true,
      maxTextureSize,
      safeTextureSize: route.safeTextureSize,
      sourceWidth: naturalSize?.width,
      sourceHeight: naturalSize?.height,
      contextStatus,
      decodeSource,
      fullDecodeStatus: decodePolicy.status,
      fullDecodeEstimatedBytes: decodePolicy.estimatedBytes,
      fullDecodeLimitBytes: decodePolicy.limitBytes,
    });
  }, [fullDecodeMaxBytes, publishRendererState]);

  useLayoutEffect(() => {
    activeRef.current = active;
    resourceKeyRef.current = resourceKey;
    callbacksRef.current = { onDimensions, onPhaseChange, onError, onPresented };
    preloadCallbackRef.current = onPreloadStateChange;
    runtimeCallbackRef.current = onRuntimeStateChange;
    rendererStateCallbackRef.current = onRendererStateChange;
    planCallbackRef.current = onPreloadPlanChange;
  }, [
    active,
    resourceKey,
    onDimensions,
    onPhaseChange,
    onError,
    onPresented,
    onPreloadStateChange,
    onRuntimeStateChange,
    onRendererStateChange,
    onPreloadPlanChange,
  ]);

  useLayoutEffect(() => {
    retentionKeysRef.current = retentionKeys;
  }, [retentionKeys]);

  useLayoutEffect(() => {
    if (!active || !resourceKey) return;
    const leaving = lastActiveRasterRef.current;
    if (leaving && leaving.resourceKey !== resourceKey) {
      setScreenHistory((previous) =>
        rememberRasterScreenHistory(previous, leaving, resourceKey));
    }
    lastActiveRasterRef.current = { resourceKey, flatIndex: currentFlatIndex };
  }, [active, resourceKey, currentFlatIndex]);

  useLayoutEffect(() => {
    planCallbackRef.current?.(planSnapshot);
  }, [planSnapshot]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const pipeline = createPipeline(
        canvas,
        DEFAULT_RASTER_TEXTURE_BUDGET_BYTES,
        { decodeWorkers, decodeWorkerMax, fullDecodeMaxBytes },
      );
      setRendererMaxTextureSize(pipeline.renderer.maxTextureSize);
      rendererMaxTextureSizeRef.current = pipeline.renderer.maxTextureSize;
      pipelineErrorRef.current = null;
      pipelineRef.current = pipeline;
      publishWebGLFastPath(resourceKeyRef.current);
      // Worker settings are runtime props. A recreated pipeline owns a new GL
      // cache, so never keep rendering an entry whose texture belonged to the
      // disposed instance.
      setEntry(null);
      setResidentTextures([]);
      const unsubscribe = pipeline.subscribe(() => {
        const snapshot = pipeline.cache.snapshot();
        setCacheSnapshot((previous) =>
          previous.count === snapshot.count &&
          previous.usedBytes === snapshot.usedBytes &&
          previous.maxBytes === snapshot.maxBytes
            ? previous
            : {
                count: snapshot.count,
                usedBytes: snapshot.usedBytes,
                maxBytes: snapshot.maxBytes,
              });
        const runtime = pipeline.runtimeSnapshot();
        setResidentTextures((previous) =>
          sameResidentTextures(previous, runtime.residentTextures)
            ? previous
            : runtime.residentTextures);
        setEntry((previous) => {
          if (!previous || pipeline.cache.isResident(previous)) return previous;
          const currentResourceKey = resourceKeyRef.current;
          return currentResourceKey
            ? pipeline.cache.bestResident(currentResourceKey) ?? previous
            : previous;
        });
        runtimeCallbackRef.current?.(runtime);
        if (pipeline.currentContextStatus === 'lost') {
          activateFallback('context-lost', resourceKeyRef.current, undefined, 'lost');
          if (activeRef.current) callbacksRef.current.onPhaseChange('restoring');
          return;
        }
        if (pipeline.currentContextStatus === 'restore-failed') {
          activateFallback(
            'context-restore-failed',
            resourceKeyRef.current,
            undefined,
            'restore-failed',
          );
          return;
        }
        if (pipeline.currentContextStatus === 'restored') {
          activateFallback('context-lost', resourceKeyRef.current, undefined, 'restored');
        }
        setContextGeneration(pipeline.generation);
      });
      return () => {
        unsubscribe();
        pipeline.dispose();
        pipeline.renderer.dispose();
        pipelineRef.current = null;
      };
    } catch (cause) {
      const error = cause instanceof Error ? cause : new Error(String(cause));
      pipelineErrorRef.current = error;
      activateFallback(
        rasterFallbackReason(cause) ?? 'renderer-initialization-failed',
        undefined,
      );
      return;
    }
  }, [
    activateFallback,
    createPipeline,
    decodeWorkers,
    decodeWorkerMax,
    fullDecodeMaxBytes,
    publishWebGLFastPath,
  ]);

  useLayoutEffect(() => {
    pipelineRef.current?.reconcileViewportLods(screenBox, browseBox, resourceKey);
  }, [screenBox, browseBox, resourceKey]);

  useEffect(() => {
    pipelineRef.current?.setBudgetBytes(
      effectiveBudgetBytes,
    );
  }, [effectiveBudgetBytes, decodeWorkers, decodeWorkerMax]);

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const update = () => {
      const rect = host.getBoundingClientRect();
      setViewport({
        width: Math.max(1, rect.width),
        height: Math.max(1, rect.height),
        dpr: Math.max(1, window.devicePixelRatio || 1),
      });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(host);
    window.addEventListener('resize', update);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
    };
  }, []);

  useEffect(() => {
    const pipeline = pipelineRef.current;
    const generation = ++generationRef.current;
    displayReadyGenerationRef.current = 0;
    const previousFullResource = activeFullResourceRef.current;
    if (previousFullResource && previousFullResource !== resourceKey) {
      pipeline?.release(previousFullResource + '|full');
    }
    activeFullResourceRef.current = active && resourceKey ? resourceKey : null;
    if (!active || !resourceKey || !source) return;
    const activeFullKey = resourceKey + '|full';
    const naturalSize = knownWidth && knownHeight
      ? { width: knownWidth, height: knownHeight }
      : undefined;
    const decodePolicy = resolveRasterFullDecodePolicy(naturalSize, fullDecodeMaxBytes);
    const originalDecodeBlocked = decodePolicy.status === 'blocked';
    const displaySource = originalDecodeBlocked ? previewSource : source;
    const displayDecodeSource: RasterRendererState['decodeSource'] = originalDecodeBlocked
      ? 'preview'
      : 'original';
    if (!displaySource) {
      const error = new Error(
        `Raster original decode requires ${decodePolicy.estimatedBytes ?? 0} bytes, ` +
        `exceeding the ${decodePolicy.limitBytes}-byte safety limit; provide a Preview source`,
      );
      error.name = 'RasterDecodeSafetyError';
      const blockedRoute = resolveRasterRendererRoute({
        webgl2Available: !!pipeline,
        maxTextureSize: pipeline?.renderer.maxTextureSize,
        naturalSize,
      });
      publishRendererState({
        resourceKey,
        renderer: blockedRoute.renderer,
        routeReason: blockedRoute.renderer === 'webgl2' ? 'fast-path' : 'fallback',
        fallbackReason: blockedRoute.fallbackReason,
        webgl2Available: !!pipeline,
        maxTextureSize: pipeline?.renderer.maxTextureSize,
        safeTextureSize: blockedRoute.safeTextureSize,
        sourceWidth: naturalSize?.width,
        sourceHeight: naturalSize?.height,
        contextStatus: pipeline?.currentContextStatus ?? 'healthy',
        decodeSource: 'preview',
        fullDecodeStatus: decodePolicy.status,
        fullDecodeEstimatedBytes: decodePolicy.estimatedBytes,
        fullDecodeLimitBytes: decodePolicy.limitBytes,
      });
      callbacksRef.current.onPhaseChange('error');
      callbacksRef.current.onError(error);
      return;
    }
    const route = resolveRasterRendererRoute({
      webgl2Available: !!pipeline,
      maxTextureSize: pipeline?.renderer.maxTextureSize,
      naturalSize,
    });
    if (route.renderer === 'dom-image') {
      activateFallback(
        pipeline
          ? route.fallbackReason ?? 'texture-too-large'
          : rasterFallbackReason(pipelineErrorRef.current) ?? 'webgl2-unavailable',
        pipeline ? resourceKey : undefined,
        naturalSize,
        pipeline?.currentContextStatus ?? 'healthy',
        displayDecodeSource,
      );
      callbacksRef.current.onPhaseChange('loading');
      return;
    }
    if (!pipeline) {
      return;
    }
    if (pipeline.isContextLost) {
      activateFallback(
        pipeline.currentContextStatus === 'restore-failed'
          ? 'context-restore-failed'
          : 'context-lost',
        resourceKey,
        naturalSize,
        pipeline.currentContextStatus,
        displayDecodeSource,
      );
      callbacksRef.current.onPhaseChange('restoring');
      return;
    }
    if (activeFallback && activeFallback.reason !== 'context-lost') return;
    setEntry((previous) => previous?.resourceKey === resourceKey ? previous : null);
    const residentBrowse = pipeline.cache.get(resourceKey + '|browse');
    if (residentBrowse) {
      setEntry(residentBrowse);
      callbacksRef.current.onDimensions(
        residentBrowse.naturalWidth,
        residentBrowse.naturalHeight,
      );
      // Browse is deliberately lower resolution, but it is already a fenced
      // GPU texture and can be drawn in this frame. Treat it as presented for
      // shell loading purposes: `preview-ready` is reserved for a thumbnail
      // placeholder that still needs a displayable image.
      callbacksRef.current.onPhaseChange('display-ready');
    } else {
      callbacksRef.current.onPhaseChange('loading');
    }
    if (previewSource && !residentBrowse && !originalDecodeBlocked) {
      void pipeline.prepare(resourceKey, previewSource, 'preview', naturalSize, 80)
        .then((preview) => {
          if (generationRef.current !== generation) return;
          if (displayReadyGenerationRef.current === generation) return;
          setEntry(preview);
          callbacksRef.current.onDimensions(preview.naturalWidth, preview.naturalHeight);
          callbacksRef.current.onPhaseChange('preview-ready');
        })
        .catch(() => undefined);
    }
    const residentFull = pipeline.cache.get(activeFullKey);
    if (residentFull) {
      displayReadyGenerationRef.current = generation;
      pipeline.cache.protect(retentionKeysRef.current);
      setEntry(residentFull);
      callbacksRef.current.onDimensions(residentFull.naturalWidth, residentFull.naturalHeight);
      callbacksRef.current.onPhaseChange('display-ready');
      return;
    }
    void pipeline.prepare(resourceKey, displaySource, 'display', naturalSize, 100, screenBox)
      .then((display) => {
        if (generationRef.current !== generation) return;
        displayReadyGenerationRef.current = generation;
        setFallback((previous) =>
          previous?.resourceKey === resourceKey || previous?.resourceKey == null
            ? null
            : previous,
        );
        publishWebGLFastPath(
          resourceKey,
          { width: display.naturalWidth, height: display.naturalHeight },
          pipeline.currentContextStatus,
          displayDecodeSource,
        );
        pipeline.cache.protect(retentionKeysRef.current);
        pipeline.release(resourceKey + '|preview');
        pipeline.release(resourceKey + '|browse');
        setEntry(display);
        callbacksRef.current.onDimensions(display.naturalWidth, display.naturalHeight);
        callbacksRef.current.onPhaseChange('display-ready');
      })
      .catch((cause) => {
        if (generationRef.current !== generation) return;
        if (isAbortError(cause)) return;
        const fallbackReason = rasterFallbackReason(cause);
        if (fallbackReason) {
          const fallbackSize = rasterFallbackNaturalSize(cause) ?? naturalSize;
          const fallbackPolicy = resolveRasterFullDecodePolicy(
            fallbackSize,
            fullDecodeMaxBytes,
          );
          if (fallbackPolicy.status === 'blocked' && !previewSource) {
            const error = new Error(
              `Raster fallback requires a Preview because original decode exceeds ` +
              `${fallbackPolicy.limitBytes} bytes`,
            );
            error.name = 'RasterDecodeSafetyError';
            callbacksRef.current.onPhaseChange('error');
            callbacksRef.current.onError(error);
            return;
          }
          activateFallback(
            fallbackReason,
            resourceKey,
            fallbackSize,
            pipeline.currentContextStatus,
            fallbackPolicy.status === 'blocked' ? 'preview' : displayDecodeSource,
          );
          return;
        }
        const error = cause instanceof Error ? cause : new Error(String(cause));
        callbacksRef.current.onPhaseChange('error');
        callbacksRef.current.onError(error);
      });
  }, [
    active,
    resourceKey,
    source,
    previewSource,
    knownWidth,
    knownHeight,
    screenBox,
    contextGeneration,
    decodeWorkers,
    decodeWorkerMax,
    fullDecodeMaxBytes,
    activeFallback,
    activateFallback,
    publishWebGLFastPath,
    publishRendererState,
  ]);

  useEffect(() => {
    const pipeline = pipelineRef.current;
    if (!active || !pipeline || !resourceKey || !source || fullResolutionPaused) return;
    if (!entry || entry.resourceKey !== resourceKey || entry.quality !== 'display') return;
    if (!foregroundNeedsFull) return;
    const generation = generationRef.current;
    const key = resourceKey + '|full';
    const naturalSize = knownWidth && knownHeight
      ? { width: knownWidth, height: knownHeight }
      : { width: entry.naturalWidth, height: entry.naturalHeight };
    let cancelled = false;
    let started = false;
    const timer = setTimeout(() => {
      started = true;
      void pipeline.prepare(resourceKey, source, 'full', naturalSize, 90)
        .then((full) => {
          if (cancelled || generationRef.current !== generation || !activeRef.current) {
            pipeline.release(key);
            return;
          }
          pipeline.cache.protect(retentionKeysRef.current);
          setEntry(full);
          callbacksRef.current.onDimensions(full.naturalWidth, full.naturalHeight);
        })
        .catch((cause) => {
          if (cancelled || isAbortError(cause)) return;
          const reason = rasterFallbackReason(cause);
          if (reason) activateFallback(reason, resourceKey, naturalSize);
        });
    }, Math.max(0, fullResolutionSettleMs));
    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (!started) return;
      // createImageBitmap itself cannot be aborted. A stale completion is deleted
      // in the promise continuation above instead of becoming a retained Full LOD.
    };
  }, [
    active,
    resourceKey,
    source,
    entry,
    fullResolutionPaused,
    fullResolutionSettleMs,
    knownWidth,
    knownHeight,
    transform.scale,
    viewport.dpr,
    contextGeneration,
    foregroundNeedsFull,
    activateFallback,
  ]);

  useEffect(() => {
    const pipeline = pipelineRef.current;
    if (!active || !pipeline || activeFallback) return;
    let cancelled = false;
    const activeScreenReady = !!(
      resourceKey &&
      entry &&
      entry.resourceKey === resourceKey &&
      (entry.quality === 'display' || entry.quality === 'full')
    );
    pipeline.cache.protect(retentionKeys);
    pipeline.reconcileDecodePlan([
      ...retentionKeys,
      ...lodPlan.entries.flatMap((item) => item.lod === 'screen'
        ? [item.resourceKey + '|display']
        : [item.resourceKey + '|browse', item.resourceKey + '|display']),
    ]);
    // Full for the active zoom always wins.  Likewise, a live main/minimap drag
    // must not start another expensive decode/upload between pointer frames.
    // The currently running background task may finish, but the sequential
    // preload loop is cancelled before it can start the next neighbor.
    if (preloadPaused || foregroundNeedsFull) return;
    if (!preloadEnabled || !activeScreenReady) {
      pipeline.retainOnly(preloadEnabled ? retentionKeys : protectedKeys);
      return;
    }
    const priorities = new Map<string, number>();
    retentionKeys.forEach((key) => priorities.set(key, 100));
    lodPlan.entries.forEach((item) => {
      const itemDisplayKey = item.resourceKey + '|display';
      if (item.lod === 'screen') {
        priorities.set(itemDisplayKey, item.priority);
      } else {
        // A Screen texture already retained for this same resource is still
        // better than Browse, but no Browse item is promoted automatically.
        priorities.set(item.resourceKey + '|browse', item.priority);
        priorities.set(itemDisplayKey, item.priority);
      }
    });
    // A plan change (especially a viewport resize) must discard old distant
    // textures. Otherwise the cache remains under budget and stale blue items
    // survive between the new continuous bands.
    pipeline.retainOnly([...priorities.keys()]);
    pipeline.cache.prioritize(priorities);

    const reportResident = (item: RasterPlannedPreload) => {
      if (cancelled) return;
      const displayKey = item.resourceKey + '|display';
      const browseKey = item.resourceKey + '|browse';
      preloadCallbackRef.current?.(
        item,
        pipeline.cache.has(displayKey)
          ? 'display-ready'
          : pipeline.cache.has(browseKey)
            ? 'browse-ready'
            : 'evicted',
      );
    };

    type PreloadTask = { item: RasterPlannedPreload; quality: 'browse' | 'display' };
    // Quality is fixed by the plan: build the blue core first, then the
    // immediately adjacent violet ring. There is no Browse→Screen upgrade pass.
    const screenTasks: PreloadTask[] = lodPlan.entries
      .filter((item) => item.lod === 'screen')
      .map((item) => ({ item, quality: 'display' }));
    const browseTasks: PreloadTask[] = lodPlan.entries
      .filter((item) => item.lod === 'browse')
      .map((item) => ({ item, quality: 'browse' }));
    const tasks = [...screenTasks, ...browseTasks];

    const run = async () => {
      for (let index = 0; index < tasks.length; index += 1) {
        if (cancelled) return;
        const { item, quality } = tasks[index];
        const key = item.resourceKey + '|' + quality;
        const betterDisplay = quality === 'browse' && pipeline.cache.has(item.resourceKey + '|display');
        if (betterDisplay) {
          reportResident(item);
          continue;
        }
        if (pipeline.cache.has(key)) {
          reportResident(item);
          continue;
        }
        if (preloadPaused) return;
        preloadCallbackRef.current?.(
          item,
          'loading',
          quality === 'display' ? 'screen' : 'browse',
        );
        const decodePolicy = resolveRasterFullDecodePolicy(
          item.knownSize,
          fullDecodeMaxBytes,
        );
        const preloadSource = decodePolicy.status === 'blocked'
          ? item.previewSource
          : item.source;
        if (!preloadSource) {
          preloadCallbackRef.current?.(item, 'error');
          continue;
        }
        try {
          await pipeline.prepare(
            item.resourceKey,
            preloadSource,
            quality,
            item.knownSize,
            item.priority,
            item.targetBox,
          );
          if (cancelled) return;
          reportResident(item);
          // Admission uses actual uploaded texture bytes. Stop at the first texture that
          // cannot remain resident; farther candidates have lower retention priority.
          if (!pipeline.cache.has(key)) return;
        } catch (cause) {
          if (cancelled) return;
          if (isAbortError(cause)) return;
          preloadCallbackRef.current?.(item, 'error');
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [
    active,
    resourceKey,
    entry,
    lodPlan.entries,
    preloadEnabled,
    preloadPaused,
    foregroundNeedsFull,
    protectedKeys,
    retentionKeys,
    contextGeneration,
    activeFallback,
    fullDecodeMaxBytes,
  ]);

  useLayoutEffect(() => {
    const pipeline = pipelineRef.current;
    if (!active || activeFallback || !pipeline || !entry || !resourceKey) return;
    const drawableEntry = entry.resourceKey === resourceKey && pipeline.cache.isResident(entry)
      ? entry
      : pipeline.cache.bestResident(resourceKey);
    // Cache 准入可能淘汰 React 仍引用的纹理。禁止绑定这种已删除句柄；否则
    // WebGL 会沿用最近上传的邻图，并按当前图几何重绘，表现为低清轮播和变形裁切。
    if (!drawableEntry) return;
    if (drawableEntry !== entry) {
      setEntry(drawableEntry);
      return;
    }
    try {
      if (!pipeline.renderer.render(drawableEntry, viewport, transform)) {
        activateFallback(
          pipeline.isContextLost ? 'context-lost' : 'texture-invalid',
          resourceKey,
          { width: drawableEntry.naturalWidth, height: drawableEntry.naturalHeight },
          pipeline.currentContextStatus,
        );
        return;
      }
    } catch (cause) {
      activateFallback(
        rasterFallbackReason(cause) ?? 'texture-invalid',
        resourceKey,
        { width: drawableEntry.naturalWidth, height: drawableEntry.naturalHeight },
        pipeline.currentContextStatus,
      );
      return;
    }
    const id = requestAnimationFrame(() => callbacksRef.current.onPresented());
    return () => cancelAnimationFrame(id);
  }, [
    active,
    activeFallback,
    activateFallback,
    entry,
    resourceKey,
    viewport,
    transform,
  ]);

  const entryMatchesActiveResource = !!(
    resourceKey &&
    entry &&
    (entry.resourceKey === resourceKey || entry.resourceKey === resourceKey + '|preview')
  );
  const fallbackNaturalSize = activeFallback?.naturalSize ?? (knownWidth && knownHeight
    ? { width: knownWidth, height: knownHeight }
    : entry && entry.resourceKey === resourceKey
      ? { width: entry.naturalWidth, height: entry.naturalHeight }
      : undefined);
  const fallbackDecodePolicy = resolveRasterFullDecodePolicy(
    fallbackNaturalSize,
    fullDecodeMaxBytes,
  );
  const fallbackUsesPreview = fallbackDecodePolicy.status === 'blocked' && !!previewSource;
  const fallbackSource = fallbackUsesPreview ? previewSource : source;
  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    if (!active) {
      suppressCanvasUntilActiveEntryRef.current = true;
      host.style.visibility = 'hidden';
      return;
    }
    if (entryMatchesActiveResource || activeFallback) {
      suppressCanvasUntilActiveEntryRef.current = false;
    }
    host.style.visibility = suppressCanvasUntilActiveEntryRef.current ? 'hidden' : 'visible';
  }, [active, activeFallback, entryMatchesActiveResource]);

  return (
    <div
      ref={hostRef}
      data-rip-raster-webgl=""
      data-rip-raster-quality={entry?.quality ?? 'pending'}
      data-rip-raster-resource={entry?.resourceKey}
      data-rip-raster-active={active ? 'true' : 'false'}
      data-rip-raster-renderer={activeFallback ? 'dom-image' : 'webgl2'}
      data-rip-raster-fallback-reason={activeFallback?.reason}
      data-rip-raster-cache-count={cacheSnapshot.count}
      data-rip-raster-cache-bytes={cacheSnapshot.usedBytes}
      data-rip-raster-cache-max-bytes={cacheSnapshot.maxBytes}
      aria-hidden={!active}
      style={{
        position: 'absolute',
        inset: 0,
        visibility: 'hidden',
        pointerEvents: 'none',
      }}
    >
      <canvas
        ref={canvasRef}
        data-rip-raster-canvas=""
        style={{ display: 'block', width: '100%', height: '100%' }}
      />
      {active && activeFallback && fallbackSource ? (
        <RasterFallbackViewer
          key={resourceKey}
          source={fallbackSource}
          naturalSize={fallbackUsesPreview ? fallbackNaturalSize : undefined}
          alt=""
          transform={transform}
          onDimensions={onDimensions}
          onPhaseChange={onPhaseChange}
          onPresented={onPresented}
          onError={(error) => {
            callbacksRef.current.onPhaseChange('error');
            callbacksRef.current.onError(error);
          }}
        />
      ) : null}
    </div>
  );
}
