import { useCallback, useEffect, useRef } from 'react';
import { NAV_HOLD_MIN_VISIBLE_MS } from './imagePreviewTuning';

export type ThumbPaceHoldDir = 'prev' | 'next';

export interface UseThumbPacedNavigationParams {
  currentIndex: number;
  /**
   * True when the current image has something paintable in the main stage
   * (minimap underlay / full original / no progressive pipeline).
   */
  thumbReady: boolean;
  prev(): void;
  next(): void;
  /**
   * After each image becomes paintable, wait this long before allowing another
   * hold-step (and only if still held). Default {@link NAV_HOLD_MIN_VISIBLE_MS}.
   */
  minVisibleMs?: number;
}

export interface UseThumbPacedNavigationResult {
  /**
   * Begin ←/→ hold. Steps **once immediately**, then only continues after each
   * landed image has been paintable for {@link minVisibleMs} while still held.
   */
  beginHold(dir: ThumbPaceHoldDir): void;
  /** End hold — cancels the single pending dwell timer; no queued steps. */
  endHold(dir?: ThumbPaceHoldDir): void;
  isHolding(): boolean;
}

/**
 * Hold navigation without a step queue:
 *
 * 1. Key/pointer down → exactly one immediate step.
 * 2. On the new index: wait until paintable (thumb or original), then wait
 *    `minVisibleMs`. If still held → one more step. Repeat.
 * 3. Release → clear the only timer; never drain a backlog of next() calls.
 */
export function useThumbPacedNavigation({
  currentIndex,
  thumbReady,
  prev,
  next,
  minVisibleMs = NAV_HOLD_MIN_VISIBLE_MS,
}: UseThumbPacedNavigationParams): UseThumbPacedNavigationResult {
  const holdRef = useRef<ThumbPaceHoldDir | null>(null);
  const thumbReadyRef = useRef(thumbReady);
  thumbReadyRef.current = thumbReady;
  const currentIndexRef = useRef(currentIndex);
  currentIndexRef.current = currentIndex;

  /** Index we already advanced away from after its min-visible dwell. */
  const advancedFromIndexRef = useRef<number | null>(null);
  /** When the current index first became paintable during this visit. */
  const visibleSinceRef = useRef<number | null>(null);
  const dwellTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const prevRef = useRef(prev);
  prevRef.current = prev;
  const nextRef = useRef(next);
  nextRef.current = next;
  const minVisibleRef = useRef(minVisibleMs);
  minVisibleRef.current = minVisibleMs;

  const clearDwellTimer = useCallback(() => {
    if (dwellTimerRef.current != null) {
      clearTimeout(dwellTimerRef.current);
      dwellTimerRef.current = null;
    }
  }, []);

  const stepNow = useCallback((dir: ThumbPaceHoldDir) => {
    if (dir === 'next') nextRef.current();
    else prevRef.current();
  }, []);

  const armDwellIfNeeded = useCallback(() => {
    const dir = holdRef.current;
    if (!dir) return;
    if (!thumbReadyRef.current) return;
    if (advancedFromIndexRef.current === currentIndexRef.current) return;

    if (visibleSinceRef.current == null) {
      visibleSinceRef.current = performance.now();
    }

    clearDwellTimer();
    const minMs = Math.max(0, minVisibleRef.current);
    const elapsed = performance.now() - visibleSinceRef.current;
    const wait = Math.max(0, minMs - elapsed);

    dwellTimerRef.current = setTimeout(() => {
      dwellTimerRef.current = null;
      if (holdRef.current !== dir) return;
      if (!thumbReadyRef.current) return;
      const idx = currentIndexRef.current;
      if (advancedFromIndexRef.current === idx) return;
      advancedFromIndexRef.current = idx;
      stepNow(dir);
    }, wait);
  }, [clearDwellTimer, stepNow]);

  const beginHold = useCallback(
    (dir: ThumbPaceHoldDir) => {
      clearDwellTimer();
      holdRef.current = dir;
      // Immediate first switch — do not wait for min-visible on the image we leave.
      advancedFromIndexRef.current = currentIndexRef.current;
      visibleSinceRef.current = null;
      stepNow(dir);
      // Continuations are armed by the effect when we land on the next index.
    },
    [clearDwellTimer, stepNow],
  );

  const endHold = useCallback(
    (dir?: ThumbPaceHoldDir) => {
      if (dir != null && holdRef.current !== dir) return;
      clearDwellTimer();
      holdRef.current = null;
      visibleSinceRef.current = null;
    },
    [clearDwellTimer],
  );

  const isHolding = useCallback(() => holdRef.current != null, []);

  // New index while held: reset dwell clock for this visit.
  useEffect(() => {
    if (!holdRef.current) return;
    visibleSinceRef.current = null;
    clearDwellTimer();
    if (
      thumbReadyRef.current &&
      advancedFromIndexRef.current !== currentIndexRef.current
    ) {
      armDwellIfNeeded();
    }
  }, [currentIndex, armDwellIfNeeded, clearDwellTimer]);

  // Became paintable (or lost paint) on the current index.
  useEffect(() => {
    if (!holdRef.current) return;
    if (!thumbReady) {
      clearDwellTimer();
      visibleSinceRef.current = null;
      return;
    }
    if (advancedFromIndexRef.current === currentIndex) return;
    armDwellIfNeeded();
  }, [thumbReady, currentIndex, armDwellIfNeeded, clearDwellTimer]);

  useEffect(() => () => clearDwellTimer(), [clearDwellTimer]);

  return { beginHold, endHold, isHolding };
}
