import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IMAGE_DECODE_TIMEOUT_MS } from './imagePreviewTuning';
import { scheduleRevealAfterDecode } from './lib/imagePreviewDecode';
import {
  DISPLAY_PRELOAD_IDLE_MS,
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
}

export interface UseNeighborDisplayPreloadResult {
  slotIndexes: number[];
  displayReadyIndexes: ReadonlySet<number>;
  isSrcDisplayReady(src: string): boolean;
  getMeta(src: string): DisplaySlotMeta | undefined;
  /** Record that the main view finished decoding this `src` (feeds fast-reveal later). */
  markSrcDisplayReady(src: string, meta?: DisplaySlotMeta): void;
  /** Offscreen entries for `'slot'` mode. */
  slotRenderEntries: { index: number; src: string }[];
  onSlotImgLoad(index: number, el: HTMLImageElement): void;
  notifyInteraction(): void;
}

/**
 * Keeps up to `displaySlots` neighbors display-ready (load + decode).
 * - `'slot'`: render {@link slotRenderEntries} offscreen; call {@link onSlotImgLoad} on load.
 * - `'decode'`: detached `Image()` + `decode()` only.
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
  const [idleOk, setIdleOk] = useState(true);
  /** Bumps when readySrcRef changes so isSrcDisplayReady closures refresh. */
  const [readyEpoch, setReadyEpoch] = useState(0);

  const metaBySrcRef = useRef<Map<string, DisplaySlotMeta>>(new Map());
  const readySrcRef = useRef<Set<string>>(new Set());
  const decodeImagesRef = useRef<Map<number, HTMLImageElement>>(new Map());
  const inFlightRef = useRef<Set<number>>(new Set());

  const bumpReady = useCallback(() => {
    setReadyEpoch((n) => n + 1);
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
    setIdleOk(false);
  }, []);

  useEffect(() => {
    if (interactionBusy) {
      setIdleOk(false);
      return;
    }
    const id = window.setTimeout(() => setIdleOk(true), DISPLAY_PRELOAD_IDLE_MS);
    return () => window.clearTimeout(id);
  }, [interactionBusy, currentIndex]);

  useEffect(() => {
    const allowed = new Set(slotIndexes);
    setDisplayReadyIndexes((prev) => {
      let changed = false;
      const next = new Set<number>();
      for (const idx of prev) {
        if (allowed.has(idx)) next.add(idx);
        else changed = true;
      }
      for (const idx of allowed) {
        const src = images[idx]?.src;
        if (src && readySrcRef.current.has(src) && !next.has(idx)) {
          next.add(idx);
          changed = true;
        }
      }
      return changed || next.size !== prev.size ? next : prev;
    });
    for (const [idx, img] of [...decodeImagesRef.current.entries()]) {
      if (!allowed.has(idx)) {
        img.onload = null;
        img.onerror = null;
        img.src = '';
        decodeImagesRef.current.delete(idx);
        inFlightRef.current.delete(idx);
      }
    }
  }, [slotIndexes, images]);

  const slotCeiling = resolvePreloadDisplaySlotCeiling(displaySlots, memoryBudgetBytes);

  useEffect(() => {
    if (!idleOk || mode !== 'decode' || slotCeiling <= 0 || radius <= 0) return;

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
  }, [idleOk, mode, slotCeiling, radius, slotIndexes, images, markIndexReady]);

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

  // When idle resumes, finish decode for already-complete slot imgs.
  useEffect(() => {
    if (!idleOk || mode !== 'slot') return;
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
  }, [idleOk, mode, slotIndexes, images]);

  const slotRenderEntries = useMemo(() => {
    if (mode !== 'slot' || slotCeiling <= 0 || radius <= 0) return [];
    const indexes = new Set(slotIndexes);
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
  }, [mode, slotCeiling, radius, slotIndexes, images, currentIndex, readyEpoch]);

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
      for (const img of decodeImagesRef.current.values()) {
        img.onload = null;
        img.onerror = null;
        img.src = '';
      }
      decodeImagesRef.current.clear();
    };
  }, []);

  return {
    slotIndexes,
    displayReadyIndexes,
    isSrcDisplayReady,
    getMeta,
    markSrcDisplayReady,
    slotRenderEntries,
    onSlotImgLoad,
    notifyInteraction,
  };
}
