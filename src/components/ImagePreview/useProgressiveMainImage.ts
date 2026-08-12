import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { PROGRESSIVE_PRELOAD_TIMEOUT_MS } from './imagePreviewTuning';
import type { MainImageLoadStage } from './types';
import type { ImageDimensions } from './useImageTransform';

export interface UseProgressiveMainImageArgs {
  mainSrc: string;
  minimapSrc: string | undefined;
  /** When true, the item uses a custom minimap node — progressive main is disabled. */
  minimapCustom: boolean;
  enabled: boolean;
  /** Minimum ms the placeholder stays visible after the full image is ready (see {@link ImagePreviewProps.progressivePlaceholderMinMs}). */
  placeholderMinVisibleMs: number;
  /**
   * When true (e.g. neighbor was display-ready), skip artificial dwell but **keep** the
   * minimap underlay until the main viewport image has decoded — avoids a black frame.
   */
  preferFastReveal?: boolean;
  /** Optional known full-image size (from display-ready meta) to layout before the probe finishes. */
  knownDimensions?: ImageDimensions | null;
  onImageLayout: (d: ImageDimensions) => void;
  onStageChange?: (stage: MainImageLoadStage) => void;
}

export interface UseProgressiveMainImageResult {
  pipelineActive: boolean;
  preloadStage: MainImageLoadStage;
  fullDecoded: boolean;
  /**
   * True when the minimap URL should paint in the main area (parallel preload or placeholder).
   * Keeps the thumbnail visible during long main-image decode instead of a black box.
   */
  showMinimapUnderlay: boolean;
  /** Call from the visible &lt;img&gt; `onLoad` after optional `decode()`. */
  onMainImgDecoded: () => void;
}

function useLatestRef<T>(value: T) {
  const r = useRef(value);
  useLayoutEffect(() => {
    r.current = value;
  });
  return r;
}

/**
 * Preloads the full image to obtain natural dimensions (for layout / minimap),
 * then keeps a thumbnail underlay until the real &lt;img&gt; has loaded+decoded.
 */
export function useProgressiveMainImage({
  mainSrc,
  minimapSrc,
  minimapCustom,
  enabled,
  placeholderMinVisibleMs,
  preferFastReveal = false,
  knownDimensions = null,
  onImageLayout,
  onStageChange,
}: UseProgressiveMainImageArgs): UseProgressiveMainImageResult {
  const onStageChangeRef = useLatestRef(onStageChange);
  const onImageLayoutRef = useLatestRef(onImageLayout);
  const knownDimensionsRef = useLatestRef(knownDimensions);

  const pipelineActive =
    enabled && !!minimapSrc && minimapSrc !== mainSrc && !minimapCustom;

  const effectiveDwellMsRef = useLatestRef(preferFastReveal ? 0 : placeholderMinVisibleMs);

  const [preloadStage, setPreloadStage] = useState<MainImageLoadStage>('inactive');
  const [fullDecoded, setFullDecoded] = useState(false);
  /** Minimap `Image()` finished while main is still preloading — layout + underlay can show immediately. */
  const [minimapPrelayoutReady, setMinimapPrelayoutReady] = useState(false);
  const genRef = useRef(0);
  const preloadStageRef = useRef<MainImageLoadStage>(preloadStage);
  useLayoutEffect(() => {
    preloadStageRef.current = preloadStage;
  }, [preloadStage]);

  /** Main &lt;img&gt; is ready before preload promoted to `thumbnail-placeholder` (typical with HTTP cache). */
  const pendingMainRevealRef = useRef(false);
  const thumbPlaceholderEnteredAtRef = useRef<number | null>(null);
  const revealTimeoutRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  /** After we reveal the main layer, ignore duplicate `onMainImgDecoded` (decode + timeout). */
  const revealCompletedRef = useRef(false);

  const clearRevealTimeout = useCallback(() => {
    if (revealTimeoutRef.current !== null) {
      window.clearTimeout(revealTimeoutRef.current);
      revealTimeoutRef.current = null;
    }
  }, []);

  /**
   * Sync reset when `mainSrc` / pipeline flips — must run during render so refs are already
   * cleared before the new viewport `<img>` ref/onLoad runs (cached neighbors often complete
   * in the same commit; a post-paint reset would swallow that reveal forever).
   */
  const trackedSrcRef = useRef(mainSrc);
  const trackedPipelineRef = useRef(pipelineActive);
  if (trackedSrcRef.current !== mainSrc || trackedPipelineRef.current !== pipelineActive) {
    trackedSrcRef.current = mainSrc;
    trackedPipelineRef.current = pipelineActive;
    if (revealTimeoutRef.current !== null) {
      window.clearTimeout(revealTimeoutRef.current);
      revealTimeoutRef.current = null;
    }
    pendingMainRevealRef.current = false;
    thumbPlaceholderEnteredAtRef.current = null;
    revealCompletedRef.current = false;
    const nextStage: MainImageLoadStage = pipelineActive ? 'preloading' : 'inactive';
    preloadStageRef.current = nextStage;
    if (fullDecoded) setFullDecoded(false);
    if (minimapPrelayoutReady) setMinimapPrelayoutReady(false);
    if (preloadStage !== nextStage) setPreloadStage(nextStage);
  }

  const armRevealAfterDwell = useCallback(() => {
    if (revealCompletedRef.current) return;
    clearRevealTimeout();
    const t0 = thumbPlaceholderEnteredAtRef.current;
    const dwell = effectiveDwellMsRef.current;
    const elapsed = t0 == null ? 0 : performance.now() - t0;
    const wait = Math.max(0, dwell - elapsed);
    revealTimeoutRef.current = window.setTimeout(() => {
      revealTimeoutRef.current = null;
      revealCompletedRef.current = true;
      setFullDecoded(true);
      onStageChangeRef.current?.('full-ready');
    }, wait);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onStageChangeRef, effectiveDwellMsRef
  }, [clearRevealTimeout]);

  useEffect(() => {
    if (!pipelineActive) {
      return undefined;
    }
    onStageChangeRef.current?.('preloading');

    const gen = ++genRef.current;
    let cancelled = false;
    /** Main `Image()` probe finished (success or error) — do not apply late minimap dimensions after that. */
    let mainProbeFinished = false;

    const known = knownDimensionsRef.current;
    if (known && known.naturalWidth > 0 && known.naturalHeight > 0) {
      onImageLayoutRef.current(known);
      thumbPlaceholderEnteredAtRef.current = performance.now();
      preloadStageRef.current = 'thumbnail-placeholder';
      setPreloadStage('thumbnail-placeholder');
      onStageChangeRef.current?.('thumbnail-placeholder');
    }

    // Parallel minimap preload: small file → layout + underlay immediately while main may take seconds.
    if (minimapSrc && minimapSrc !== mainSrc) {
      const tEarly = new Image();
      tEarly.onload = () => {
        if (cancelled || gen !== genRef.current || mainProbeFinished) return;
        // Prefer known full-image dims for layout when available; still mark underlay ready.
        if (!known || known.naturalWidth <= 0) {
          onImageLayoutRef.current({
            naturalWidth: tEarly.naturalWidth,
            naturalHeight: tEarly.naturalHeight,
          });
        }
        setMinimapPrelayoutReady(true);
        if (preloadStageRef.current === 'preloading') {
          thumbPlaceholderEnteredAtRef.current = performance.now();
          preloadStageRef.current = 'thumbnail-placeholder';
          setPreloadStage('thumbnail-placeholder');
          onStageChangeRef.current?.('thumbnail-placeholder');
          if (pendingMainRevealRef.current) {
            pendingMainRevealRef.current = false;
            armRevealAfterDwell();
          }
        }
      };
      tEarly.onerror = () => {
        /* main or tryMinimapFallback will still attempt layout */
      };
      tEarly.src = minimapSrc;
    }

    const img = new Image();
    /** Timeout id assigned after `img.src` (sync cache `onload` must not read before assign). */
    const preloadTimeoutHolder: { id?: ReturnType<typeof window.setTimeout> } = {};
    /** After we fall back to minimap (or give up on main), ignore a very late main `onload`. */
    let ignoreMainPreloadResult = false;
    let minimapFallbackStarted = false;

    const tryMinimapFallback = () => {
      if (cancelled || gen !== genRef.current || minimapFallbackStarted) return;
      minimapFallbackStarted = true;
      ignoreMainPreloadResult = true;
      mainProbeFinished = true;
      if (!minimapSrc || minimapSrc === mainSrc) {
        preloadStageRef.current = 'error';
        setPreloadStage('error');
        onStageChangeRef.current?.('error');
        return;
      }
      const thumb = new Image();
      thumb.onload = () => {
        if (cancelled || gen !== genRef.current) return;
        onImageLayoutRef.current({
          naturalWidth: thumb.naturalWidth,
          naturalHeight: thumb.naturalHeight,
        });
        setFullDecoded(true);
        preloadStageRef.current = 'thumb-only';
        setPreloadStage('thumb-only');
        onStageChangeRef.current?.('thumb-only');
      };
      thumb.onerror = () => {
        if (cancelled || gen !== genRef.current) return;
        preloadStageRef.current = 'error';
        setPreloadStage('error');
        onStageChangeRef.current?.('error');
      };
      thumb.src = minimapSrc;
    };

    img.onload = () => {
      if (cancelled || gen !== genRef.current || ignoreMainPreloadResult) return;
      if (preloadTimeoutHolder.id !== undefined) window.clearTimeout(preloadTimeoutHolder.id);
      mainProbeFinished = true;
      onImageLayoutRef.current({
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
      });
      thumbPlaceholderEnteredAtRef.current = performance.now();
      preloadStageRef.current = 'thumbnail-placeholder';
      setPreloadStage('thumbnail-placeholder');
      onStageChangeRef.current?.('thumbnail-placeholder');
      if (pendingMainRevealRef.current) {
        pendingMainRevealRef.current = false;
        armRevealAfterDwell();
      }
    };
    img.onerror = () => {
      if (cancelled || gen !== genRef.current) return;
      mainProbeFinished = true;
      if (preloadTimeoutHolder.id !== undefined) window.clearTimeout(preloadTimeoutHolder.id);
      tryMinimapFallback();
    };
    img.src = mainSrc;

    preloadTimeoutHolder.id = window.setTimeout(() => {
      if (cancelled || gen !== genRef.current) return;
      tryMinimapFallback();
    }, PROGRESSIVE_PRELOAD_TIMEOUT_MS);

    return () => {
      cancelled = true;
      if (preloadTimeoutHolder.id !== undefined) window.clearTimeout(preloadTimeoutHolder.id);
    };
  },
  // eslint-disable-next-line react-hooks/exhaustive-deps -- onImageLayoutRef, onStageChangeRef, knownDimensionsRef
  [mainSrc, minimapSrc, pipelineActive, armRevealAfterDwell],
  );

  const onMainImgDecoded = useCallback(() => {
    const active = enabled && !!minimapSrc && minimapSrc !== mainSrc && !minimapCustom;
    if (!active) {
      setFullDecoded(true);
      onStageChangeRef.current?.('full-ready');
      return;
    }
    if (revealCompletedRef.current) return;

    const stage = preloadStageRef.current;
    if (stage === 'preloading') {
      pendingMainRevealRef.current = true;
      return;
    }
    if (stage === 'thumbnail-placeholder') {
      armRevealAfterDwell();
      return;
    }

    setFullDecoded(true);
    if (stage === 'error') {
      onStageChangeRef.current?.('full-ready');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- preloadStageRef, onStageChangeRef
  }, [enabled, minimapSrc, minimapCustom, mainSrc, armRevealAfterDwell]);

  const showMinimapUnderlay =
    pipelineActive &&
    !!minimapSrc &&
    (minimapPrelayoutReady ||
      preloadStage === 'thumbnail-placeholder' ||
      preloadStage === 'thumb-only');

  return { pipelineActive, preloadStage, fullDecoded, showMinimapUnderlay, onMainImgDecoded };
}
