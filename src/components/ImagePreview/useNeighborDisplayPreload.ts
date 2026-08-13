import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IMAGE_DECODE_TIMEOUT_MS } from './imagePreviewTuning';
import { scheduleRevealAfterDecode } from './lib/imagePreviewDecode';
import {
  DISPLAY_PRELOAD_IDLE_MS,
  PRELOAD_DISPLAY_SETTLE_MS,
  defaultEstimateDecodedBytes,
  pickDisplaySlotIndexes,
  resolvePreloadDisplaySlotCeiling,
} from './lib/neighborDisplayPreload';
import type { ImageItem, PreloadDisplayMode } from './types';

export interface DisplaySlotMeta {
  naturalWidth: number;
  naturalHeight: number;
}

export interface UseNeighborDisplayPreloadParams {
  images: ImageItem[];
  currentIndex: number;
  radius: number;
  /** Max neighbor display-ready slots; `0` disables. */
  displaySlots: number;
  memoryBudgetBytes?: number;
  estimateDecodedBytes?: (item: ImageItem) => number;
  mode?: PreloadDisplayMode;
  /** When true, defer starting new decodes (e.g. while panning). */
  interactionBusy?: boolean;
  /**
   * After `currentIndex` changes, wait this long before warming neighbors.
   * Default {@link PRELOAD_DISPLAY_SETTLE_MS}.
   */
  settleMs?: number;
}

export interface UseNeighborDisplayPreloadResult {
  slotIndexes: number[];
  displayReadyIndexes: ReadonlySet<number>;
  isSrcDisplayReady(src: string): boolean;
  getMeta(src: string): DisplaySlotMeta | undefined;
  /** Record that the main view finished decoding this `src` (feeds fast-reveal later). */
  markSrcDisplayReady(src: string, meta?: DisplaySlotMeta): void;
  /** Offscreen entries for `'slot'` mode (empty while settle debounce is pending). */
  slotRenderEntries: { index: number; src: string }[];
  onSlotImgLoad(index: number, el: HTMLImageElement): void;
  notifyInteraction(): void;
  /** True when neighbor display preload is allowed to run (settled + not interaction-busy). */
  neighborWarmActive: boolean;
}

/**
 * Keeps up to `displaySlots` neighbors display-ready (load + decode).
 * - `'slot'`: render {@link slotRenderEntries} when settled; call {@link onSlotImgLoad} on load.
 * - `'decode'`: detached `Image()` + `decode()` only (also gated on settle).
 *
 * Neighbor warm-up is **debounced** after navigation: rapid index changes cancel the pending
 * timer so only the final settled image starts warming neighbors. Current main decode is separate.
 */
export function useNeighborDisplayPreload(
  p: UseNeighborDisplayPreloadParams,
): UseNeighborDisplayPreloadResult {
  const {
    images,
    currentIndex,
    radius,
    displaySlots,
    memoryBudgetBytes,
    estimateDecodedBytes = defaultEstimateDecodedBytes,
    mode = 'slot',
    interactionBusy = false,
    settleMs = PRELOAD_DISPLAY_SETTLE_MS,
  } = p;

  const estimateRef = useRef(estimateDecodedBytes);
  estimateRef.current = estimateDecodedBytes;

  const slotIndexes = useMemo(
    () =>
      pickDisplaySlotIndexes({
        currentIndex,
        radius,
        images,
        maxSlots: resolvePreloadDisplaySlotCeiling(displaySlots, memoryBudgetBytes),
        budgetBytes: memoryBudgetBytes,
        estimateBytes: (item) => estimateRef.current(item),
      }),
    [currentIndex, radius, images, displaySlots, memoryBudgetBytes],
  );

  const [displayReadyIndexes, setDisplayReadyIndexes] = useState<ReadonlySet<number>>(
    () => new Set(),
  );
  /** Navigation quiet long enough to warm neighbors. */
  const [navSettled, setNavSettled] = useState(false);
  /** Not panning / minimap-dragging (short idle after release). */
  const [panIdle, setPanIdle] = useState(true);
  /** Bumps when readySrcRef changes so isSrcDisplayReady closures refresh. */
  const [readyEpoch, setReadyEpoch] = useState(0);

  const neighborWarmActive = navSettled && panIdle && !interactionBusy;

  const metaBySrcRef = useRef<Map<string, DisplaySlotMeta>>(new Map());
  const readySrcRef = useRef<Set<string>>(new Set());
  const decodeImagesRef = useRef<Map<number, HTMLImageElement>>(new Map());
  const inFlightRef = useRef<Set<number>>(new Set());
  const panIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const bumpReady = useCallback(() => {
    setReadyEpoch((n) => n + 1);
  }, []);

  const clearPanIdleTimer = useCallback(() => {
    if (panIdleTimerRef.current != null) {
      window.clearTimeout(panIdleTimerRef.current);
      panIdleTimerRef.current = null;
    }
  }, []);

  const armPanIdle = useCallback(() => {
    clearPanIdleTimer();
    panIdleTimerRef.current = window.setTimeout(() => {
      panIdleTimerRef.current = null;
      setPanIdle(true);
    }, DISPLAY_PRELOAD_IDLE_MS);
  }, [clearPanIdleTimer]);

  const abortInFlightNeighborDecodes = useCallback(() => {
    for (const [idx, img] of [...decodeImagesRef.current.entries()]) {
      img.onload = null;
      img.onerror = null;
      img.src = '';
      decodeImagesRef.current.delete(idx);
      inFlightRef.current.delete(idx);
    }
  }, []);

  const markIndexReady = useCallback(
    (idx: number, src: string, img: HTMLImageElement) => {
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        metaBySrcRef.current.set(src, {
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight,
        });
      }
      readySrcRef.current.add(src);
      inFlightRef.current.delete(idx);
      bumpReady();
      setDisplayReadyIndexes((prev) => {
        if (prev.has(idx)) return prev;
        const next = new Set(prev);
        next.add(idx);
        return next;
      });
    },
    [bumpReady],
  );

  const markSrcDisplayReady = useCallback(
    (src: string, meta?: DisplaySlotMeta) => {
      if (!src) return;
      if (meta && meta.naturalWidth > 0 && meta.naturalHeight > 0) {
        metaBySrcRef.current.set(src, meta);
      }
      readySrcRef.current.add(src);
      bumpReady();
      setDisplayReadyIndexes((prev) => {
        const next = new Set(prev);
        let changed = false;
        for (const idx of slotIndexes) {
          if (images[idx]?.src === src && !next.has(idx)) {
            next.add(idx);
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    },
    [bumpReady, slotIndexes, images],
  );

  const notifyInteraction = useCallback(() => {
    setPanIdle(false);
    armPanIdle();
  }, [armPanIdle]);

  // Debounce neighbor warm after navigation (keydown scrub cancels pending timer).
  useEffect(() => {
    setNavSettled(false);
    abortInFlightNeighborDecodes();
    const delay = Math.max(0, settleMs);
    const id = window.setTimeout(() => setNavSettled(true), delay);
    return () => window.clearTimeout(id);
  }, [currentIndex, settleMs, abortInFlightNeighborDecodes]);

  // Pause while panning / minimap-dragging; resume shortly after release.
  useEffect(() => {
    if (interactionBusy) {
      clearPanIdleTimer();
      setPanIdle(false);
      abortInFlightNeighborDecodes();
      return undefined;
    }
    armPanIdle();
    return () => clearPanIdleTimer();
  }, [interactionBusy, abortInFlightNeighborDecodes, armPanIdle, clearPanIdleTimer]);

  useEffect(() => {
    if (!neighborWarmActive) abortInFlightNeighborDecodes();
  }, [neighborWarmActive, abortInFlightNeighborDecodes]);

  useEffect(() => {
    // Sticky by src: any flat index whose src was display-decoded stays marked, even after
    // leaving the neighbor window (strip + Demo path detection stay truthful).
    setDisplayReadyIndexes(() => {
      const next = new Set<number>();
      for (let i = 0; i < images.length; i++) {
        const src = images[i]?.src;
        if (src && readySrcRef.current.has(src)) next.add(i);
      }
      return next;
    });
    const allowed = new Set(slotIndexes);
    for (const [idx, img] of [...decodeImagesRef.current.entries()]) {
      if (!allowed.has(idx)) {
        img.onload = null;
        img.onerror = null;
        img.src = '';
        decodeImagesRef.current.delete(idx);
        inFlightRef.current.delete(idx);
      }
    }
  }, [slotIndexes, images, readyEpoch]);

  const slotCeiling = resolvePreloadDisplaySlotCeiling(displaySlots, memoryBudgetBytes);

  useEffect(() => {
    if (!neighborWarmActive || mode !== 'decode' || slotCeiling <= 0 || radius <= 0) return;

    for (const idx of slotIndexes) {
      if (inFlightRef.current.has(idx)) continue;
      const src = images[idx]?.src;
      if (!src) continue;
      if (readySrcRef.current.has(src)) {
        setDisplayReadyIndexes((prev) => {
          if (prev.has(idx)) return prev;
          const next = new Set(prev);
          next.add(idx);
          return next;
        });
        continue;
      }

      const img = new Image();
      inFlightRef.current.add(idx);
      decodeImagesRef.current.set(idx, img);
      img.onload = () => {
        scheduleRevealAfterDecode(
          img,
          () => markIndexReady(idx, src, img),
          IMAGE_DECODE_TIMEOUT_MS,
        );
      };
      img.onerror = () => {
        inFlightRef.current.delete(idx);
        decodeImagesRef.current.delete(idx);
      };
      img.src = src;
    }
  }, [neighborWarmActive, mode, slotCeiling, radius, slotIndexes, images, markIndexReady]);

  const onSlotImgLoad = useCallback(
    (index: number, el: HTMLImageElement) => {
      const src = images[index]?.src;
      if (!src || mode !== 'slot') return;
      scheduleRevealAfterDecode(
        el,
        () => markIndexReady(index, src, el),
        IMAGE_DECODE_TIMEOUT_MS,
      );
    },
    [mode, images, markIndexReady],
  );

  // When settle resumes, mark already-ready srcs in the new window.
  useEffect(() => {
    if (!neighborWarmActive || mode !== 'slot') return;
    for (const idx of slotIndexes) {
      const src = images[idx]?.src;
      if (!src) continue;
      if (readySrcRef.current.has(src)) {
        setDisplayReadyIndexes((prev) => {
          if (prev.has(idx)) return prev;
          const next = new Set(prev);
          next.add(idx);
          return next;
        });
      }
    }
  }, [neighborWarmActive, mode, slotIndexes, images]);

  const slotRenderEntries = useMemo(() => {
    if (mode !== 'slot' || slotCeiling <= 0 || radius <= 0) return [];
    const indexes = new Set<number>();
    for (const index of slotIndexes) {
      const src = images[index]?.src;
      if (!src) continue;
      // While settle/pan-idle pauses *new* warm-up, keep already-ready neighbors mounted
      // so WebView does not discard their decoded bitmaps.
      if (neighborWarmActive || readySrcRef.current.has(src)) {
        indexes.add(index);
      }
    }
    const curSrc = images[currentIndex]?.src;
    if (curSrc && readySrcRef.current.has(curSrc)) {
      indexes.add(currentIndex);
    }
    return [...indexes]
      .map((index) => {
        const src = images[index]?.src;
        return src ? { index, src } : null;
      })
      .filter((e): e is { index: number; src: string } => e != null);
  }, [
    mode,
    slotCeiling,
    radius,
    slotIndexes,
    images,
    currentIndex,
    readyEpoch,
    neighborWarmActive,
  ]);

  const isSrcDisplayReady = useCallback(
    (src: string) => (src ? readySrcRef.current.has(src) : false),
    [readyEpoch],
  );

  const getMeta = useCallback(
    (src: string) => metaBySrcRef.current.get(src),
    [readyEpoch],
  );

  useEffect(() => {
    return () => {
      clearPanIdleTimer();
      abortInFlightNeighborDecodes();
    };
  }, [abortInFlightNeighborDecodes, clearPanIdleTimer]);

  return {
    slotIndexes,
    displayReadyIndexes,
    isSrcDisplayReady,
    getMeta,
    markSrcDisplayReady,
    slotRenderEntries,
    onSlotImgLoad,
    notifyInteraction,
    neighborWarmActive,
  };
}
