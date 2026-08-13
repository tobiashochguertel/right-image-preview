import { useCallback, useEffect, useRef, useState } from 'react';
import { PRELOAD_DISPLAY_SETTLE_MS } from './lib/neighborDisplayPreload';
import type { ImageItem, NeighborPreloadEntry, NeighborPreloadStatusMap } from './types';

/** Max concurrent `Image()` neighbor preloads. */
export const NEIGHBOR_PRELOAD_MAX_CONCURRENT = 4;

/**
 * While {@link HTMLImageElement} preload has no byte progress, the strip shows this
 * fraction of green (rest gray) until load finishes — **active window only**.
 */
export const NEIGHBOR_PRELOAD_INDETERMINATE_PROGRESS = 1 / 3;

export type { NeighborPreloadEntry, NeighborPreloadPhase, NeighborPreloadStatusMap } from './types';

export interface UseNeighborPreloadParams {
  images: ImageItem[];
  currentIndex: number;
  /** Flat-index radius; `0` disables neighbor fetching (session-warm marks can still apply). */
  radius: number;
  maxConcurrent?: number;
  /** Debounce before starting neighbor byte fetches after navigation. */
  settleMs?: number;
  onPreloadIndexesChange?: (indexes: number[]) => void;
  onPreloadStatusChange?: (status: NeighborPreloadStatusMap) => void;
}

export interface UseNeighborPreloadResult {
  status: NeighborPreloadStatusMap;
  /** Record that a full `src` finished loading (main view or preload). */
  markSrcReady(src: string): void;
}

function wantedIndexes(currentIndex: number, radius: number, length: number): number[] {
  const r = Math.max(0, Math.floor(radius));
  if (r === 0 || length === 0) return [];
  const out: number[] = [];
  for (let i = currentIndex - r; i <= currentIndex + r; i++) {
    if (i < 0 || i >= length || i === currentIndex) continue;
    out.push(i);
  }
  return out;
}

function buildStatusMap(
  images: ImageItem[],
  currentIndex: number,
  wanted: number[],
  doneSrc: Set<string>,
  loadingIndexes: Set<number>,
  errorIndexes: Set<number>,
): NeighborPreloadStatusMap {
  const wantedSet = new Set(wanted);
  const next: Record<number, NeighborPreloadEntry> = {};

  for (let idx = 0; idx < images.length; idx++) {
    const src = images[idx]?.src;
    if (!src) continue;

    // Current main image is definitely loaded when marked — dark green `ready`.
    if (idx === currentIndex) {
      if (doneSrc.has(src)) {
        next[idx] = { phase: 'ready', progress: 1 };
      }
      continue;
    }

    if (wantedSet.has(idx)) {
      if (errorIndexes.has(idx)) {
        next[idx] = { phase: 'error', progress: 0 };
      } else if (loadingIndexes.has(idx)) {
        next[idx] = { phase: 'loading' };
      } else if (doneSrc.has(src)) {
        next[idx] = { phase: 'ready', progress: 1 };
      }
      continue;
    }

    // Outside active window: session-warm only (HTTP cache likely, not guaranteed).
    if (doneSrc.has(src)) {
      next[idx] = { phase: 'warm', progress: 1 };
    }
  }

  return next;
}

/**
 * Prefetch full `src` for neighbors within `radius`, and track session-warm URLs for strip UI.
 * - `loading` / `ready`: current image or active preload window (dark green).
 * - `warm`: loaded earlier this session, outside the window (light green).
 */
export function useNeighborPreload(p: UseNeighborPreloadParams): UseNeighborPreloadResult {
  const {
    images,
    currentIndex,
    radius,
    maxConcurrent = NEIGHBOR_PRELOAD_MAX_CONCURRENT,
    settleMs = PRELOAD_DISPLAY_SETTLE_MS,
    onPreloadIndexesChange,
    onPreloadStatusChange,
  } = p;

  const [status, setStatus] = useState<NeighborPreloadStatusMap>({});

  const onIndexesRef = useRef(onPreloadIndexesChange);
  onIndexesRef.current = onPreloadIndexesChange;
  const onStatusRef = useRef(onPreloadStatusChange);
  onStatusRef.current = onPreloadStatusChange;

  const activeRef = useRef<Map<number, HTMLImageElement>>(new Map());
  const doneSrcRef = useRef<Set<string>>(new Set());
  const loadingRef = useRef<Set<number>>(new Set());
  const errorRef = useRef<Set<number>>(new Set());
  const imagesRef = useRef(images);
  imagesRef.current = images;
  const wantedRef = useRef<number[]>([]);

  const currentIndexRef = useRef(currentIndex);
  currentIndexRef.current = currentIndex;

  const publish = useCallback((wanted: number[]) => {
    wantedRef.current = wanted;
    const next = buildStatusMap(
      imagesRef.current,
      currentIndexRef.current,
      wanted,
      doneSrcRef.current,
      loadingRef.current,
      errorRef.current,
    );
    setStatus(next);
    onStatusRef.current?.(next);
  }, []);

  const markSrcReady = useCallback((src: string) => {
    if (!src) return;
    doneSrcRef.current.add(src);
    // Clear error for indexes sharing this src.
    for (const [idx, img] of imagesRef.current.entries()) {
      if (img.src === src) errorRef.current.delete(idx);
    }
    publish(wantedRef.current);
  }, [publish]);

  useEffect(() => {
    const wanted = wantedIndexes(currentIndex, radius, images.length);
    onIndexesRef.current?.(wanted);
    wantedRef.current = wanted;
    const wantedSet = new Set(wanted);

    // Abort all in-flight neighbor byte loads on navigation (debounce restart).
    for (const [idx, img] of [...activeRef.current.entries()]) {
      img.onload = null;
      img.onerror = null;
      img.src = '';
      activeRef.current.delete(idx);
      loadingRef.current.delete(idx);
    }

    // Drop error marks outside window (warm/ready handled via doneSrc).
    for (const idx of [...errorRef.current]) {
      if (!wantedSet.has(idx)) errorRef.current.delete(idx);
    }

    publish(wanted);

    if (wanted.length === 0) return undefined;

    const delay = Math.max(0, settleMs);
    const startId = window.setTimeout(() => {
      const pump = () => {
        if (activeRef.current.size >= maxConcurrent) return;
        for (const idx of wantedRef.current) {
          if (activeRef.current.size >= maxConcurrent) break;
          if (activeRef.current.has(idx)) continue;
          const src = imagesRef.current[idx]?.src;
          if (!src) continue;
          if (doneSrcRef.current.has(src)) {
            loadingRef.current.delete(idx);
            errorRef.current.delete(idx);
            continue;
          }

          const img = new Image();
          activeRef.current.set(idx, img);
          loadingRef.current.add(idx);
          errorRef.current.delete(idx);
          publish(wantedRef.current);

          const finish = (ok: boolean) => {
            activeRef.current.delete(idx);
            loadingRef.current.delete(idx);
            if (ok) {
              doneSrcRef.current.add(src);
              errorRef.current.delete(idx);
            } else {
              errorRef.current.add(idx);
            }
            publish(wantedRef.current);
            pump();
          };
          img.onload = () => finish(true);
          img.onerror = () => finish(false);
          img.src = src;
        }
      };

      pump();
    }, delay);

    return () => {
      window.clearTimeout(startId);
      for (const [idx, img] of [...activeRef.current.entries()]) {
        img.onload = null;
        img.onerror = null;
        img.src = '';
        activeRef.current.delete(idx);
        loadingRef.current.delete(idx);
      }
    };
  }, [images, currentIndex, radius, maxConcurrent, settleMs, publish]);

  useEffect(() => {
    const active = activeRef.current;
    return () => {
      for (const img of active.values()) {
        img.onload = null;
        img.onerror = null;
        img.src = '';
      }
      active.clear();
      loadingRef.current.clear();
    };
  }, []);

  return { status, markSrcReady };
}
