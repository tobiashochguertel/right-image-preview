import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { MediaPresentationPhase } from '../../core/media-contract';
import type { MediaSource } from '../../core/media-source';
import type { RasterQuadTransform, RasterViewport } from './rasterQuad';
import {
  DEFAULT_RASTER_TEXTURE_BUDGET_BYTES,
  RasterPipeline,
  type RasterRuntimeSnapshot,
} from './RasterPipeline';
import type { RasterTextureEntry } from './types';
import type { RasterDecodeWorkerSetting } from './rasterDecodePolicy';
import { WebGLRasterRenderer } from './WebGLRasterRenderer';
import {
  RASTER_FULL_RESOLUTION_SETTLE_MS,
  needsRasterFullResolution,
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
  textureBudgetBytes?: number;
  decodeWorkers?: RasterDecodeWorkerSetting;
  decodeWorkerMax?: number;
  onPreloadStateChange?(
    item: RasterPreloadSource,
    phase: 'loading' | 'browse-ready' | 'display-ready' | 'evicted' | 'error',
    targetLod?: 'browse' | 'screen',
  ): void;
  onRuntimeStateChange?(snapshot: RasterRuntimeSnapshot): void;
  onPreloadPlanChange?(snapshot: RasterPreloadPlanSnapshot): void;
  transform: RasterQuadTransform;
  knownSize?: { width: number; height: number };
  onDimensions(width: number, height: number): void;
  onPhaseChange(phase: MediaPresentationPhase): void;
  onError(error: Error): void;
  onPresented(): void;
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
  textureBudgetBytes,
  decodeWorkers,
  decodeWorkerMax,
  onPreloadStateChange,
  onRuntimeStateChange,
  onPreloadPlanChange,
  transform,
  knownSize,
  onDimensions,
  onPhaseChange,
  onError,
  onPresented,
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
  const planCallbackRef = useRef(onPreloadPlanChange);
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
  const [cacheSnapshot, setCacheSnapshot] = useState({ count: 0, usedBytes: 0, maxBytes: 0 });
  const [residentTextures, setResidentTextures] = useState<RasterRuntimeSnapshot['residentTextures']>([]);
  const knownWidth = knownSize?.width;
  const knownHeight = knownSize?.height;
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
  const screenBox = useMemo(() => ({
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
  const foregroundNeedsFull = !!(
    active &&
    resourceKey &&
    entry?.resourceKey === resourceKey &&
    entry.quality === 'display' &&
    needsRasterFullResolution(
      { width: entry.naturalWidth, height: entry.naturalHeight },
      { width: entry.textureWidth, height: entry.textureHeight },
      transform.scale,
      viewport.dpr,
    )
  );

  useLayoutEffect(() => {
    activeRef.current = active;
    resourceKeyRef.current = resourceKey;
    callbacksRef.current = { onDimensions, onPhaseChange, onError, onPresented };
    preloadCallbackRef.current = onPreloadStateChange;
    runtimeCallbackRef.current = onRuntimeStateChange;
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
      const pipeline = new RasterPipeline(
        new WebGLRasterRenderer(canvas),
        DEFAULT_RASTER_TEXTURE_BUDGET_BYTES,
        { decodeWorkers, decodeWorkerMax },
      );
      setRendererMaxTextureSize(pipeline.renderer.maxTextureSize);
      pipelineErrorRef.current = null;
      pipelineRef.current = pipeline;
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
        if (pipeline.isContextLost) {
          if (activeRef.current) callbacksRef.current.onPhaseChange('restoring');
          return;
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
      if (activeRef.current) {
        callbacksRef.current.onPhaseChange('unsupported');
        callbacksRef.current.onError(error);
      }
      return;
    }
  }, [decodeWorkers, decodeWorkerMax]);

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
    if (!pipeline) {
      const error = pipelineErrorRef.current;
      if (error) {
        callbacksRef.current.onPhaseChange('unsupported');
        callbacksRef.current.onError(error);
      }
      return;
    }
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
    const naturalSize = knownWidth && knownHeight
      ? { width: knownWidth, height: knownHeight }
      : undefined;
    if (previewSource && !residentBrowse) {
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
    void pipeline.prepare(resourceKey, source, 'display', naturalSize, 100, screenBox)
      .then((display) => {
        if (generationRef.current !== generation) return;
        displayReadyGenerationRef.current = generation;
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
        .catch(() => undefined);
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
  ]);

  useEffect(() => {
    const pipeline = pipelineRef.current;
    if (!active || !pipeline) return;
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
        try {
          await pipeline.prepare(
            item.resourceKey,
            item.source,
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
  ]);

  useLayoutEffect(() => {
    const pipeline = pipelineRef.current;
    if (!active || !pipeline || !entry || !resourceKey) return;
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
    if (!pipeline.renderer.render(drawableEntry, viewport, transform)) return;
    const id = requestAnimationFrame(() => callbacksRef.current.onPresented());
    return () => cancelAnimationFrame(id);
  }, [active, entry, resourceKey, viewport, transform]);

  const entryMatchesActiveResource = !!(
    resourceKey &&
    entry &&
    (entry.resourceKey === resourceKey || entry.resourceKey === resourceKey + '|preview')
  );
  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    if (!active) {
      suppressCanvasUntilActiveEntryRef.current = true;
      host.style.visibility = 'hidden';
      return;
    }
    if (entryMatchesActiveResource) suppressCanvasUntilActiveEntryRef.current = false;
    host.style.visibility = suppressCanvasUntilActiveEntryRef.current ? 'hidden' : 'visible';
  }, [active, entryMatchesActiveResource]);

  return (
    <div
      ref={hostRef}
      data-rip-raster-webgl=""
      data-rip-raster-quality={entry?.quality ?? 'pending'}
      data-rip-raster-resource={entry?.resourceKey}
      data-rip-raster-active={active ? 'true' : 'false'}
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
    </div>
  );
}
