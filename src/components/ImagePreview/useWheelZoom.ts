import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { runFlushSync } from './flushSyncCompat';
import {
  WHEEL_ACCUM_PIXELS_PER_STOP,
  WHEEL_MAX_STEPS_PER_DRAIN,
  WHEEL_PAGE_DELTA_SCALE,
  WHEEL_PIXEL_COALESCE_GAP_MS,
  WHEEL_PIXEL_COALESCE_MIN_DELTA,
  WHEEL_PIXEL_MOUSE_NOTCH_MAX,
  WHEEL_PIXEL_MOUSE_NOTCH_MIN,
} from './imagePreviewTuning';
import type { ZoomMode } from './types';

export interface UseWheelZoomOptions {
  /** Container element ref whose wheel events are listened to. */
  containerRef: React.RefObject<HTMLDivElement | null>;
  enabled: boolean;
  mode: ZoomMode;
  /** Current rendered CSS scale — used for cursor-anchored zoom. Kept current via a ref. */
  currentScale: number;
  fitEquivalentNativePercent: number | undefined;
  zoomIn(fitEquiv?: number): void;
  zoomOut(fitEquiv?: number): void;
  /**
   * Returns what the next zoom-in state would be WITHOUT applying it, or null if at max.
   */
  peekZoomIn(fitEquiv?: number): { mode: ZoomMode; percent: number } | null;
  /**
   * Returns what the next zoom-out state would be WITHOUT applying it, or null if at min.
   */
  peekZoomOut(): { mode: ZoomMode; percent: number } | null;
  /**
   * Pre-adjust translate so the point under the cursor stays fixed during a zoom step.
   * Must be called BEFORE the zoom state update (same render batch via flushSync).
   */
  zoomAnchorTranslate(
    prevScale: number,
    newScale: number,
    anchorX: number,
    anchorY: number,
  ): void;
}

/**
 * Attaches a wheel-zoom handler to `containerRef`.
 *
 * Zoom strategy:
 * - LINE delta: each line → ±1 stop (capped at MAX_STEPS_PER_DRAIN).
 * - PIXEL "notch band" (16-220 px): one stop per event.
 * - PIXEL small-delta + long inter-event gap: one stop (slow click-by-click mice).
 * - Otherwise: accumulate pixel/page deltas until threshold, advance one stop per threshold.
 *
 * A single physical event can zoom in at most one stop from Fit mode to avoid
 * the first-zoom snap jumping all the way through the stops list.
 */
export function useWheelZoom(options: UseWheelZoomOptions): void {
  const {
    containerRef,
    enabled,
    mode,
    currentScale,
    fitEquivalentNativePercent,
    zoomIn,
    zoomOut,
    peekZoomIn,
    peekZoomOut,
    zoomAnchorTranslate,
  } = options;

  // Track the live CSS scale between React renders so fast wheel bursts see
  // the most-recently-applied scale rather than the last-rendered one.
  const pendingScaleRef = useRef(currentScale);
  useLayoutEffect(() => {
    pendingScaleRef.current = currentScale;
  }, [currentScale]);

  const wheelAccumRef = useRef(0);
  const wheelDrainRafRef = useRef<number | null>(null);
  const wheelDrainStepRef = useRef<() => boolean>(() => false);
  const lastWheelClientRef = useRef({ x: 0, y: 0 });
  const lastWheelEventTimeRef = useRef(0);

  useEffect(
    () => () => {
      if (wheelDrainRafRef.current !== null) {
        cancelAnimationFrame(wheelDrainRafRef.current);
        wheelDrainRafRef.current = null;
      }
    },
    [],
  );

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      if (!enabled) return;
      e.preventDefault();

      lastWheelClientRef.current = { x: e.clientX, y: e.clientY };

      const now = performance.now();
      const dtSinceLastWheel = now - lastWheelEventTimeRef.current;
      lastWheelEventTimeRef.current = now;

      const S = WHEEL_ACCUM_PIXELS_PER_STOP;
      const MAX = WHEEL_MAX_STEPS_PER_DRAIN;
      const notchMin = WHEEL_PIXEL_MOUSE_NOTCH_MIN;
      const notchMax = WHEEL_PIXEL_MOUSE_NOTCH_MAX;

      const startedInFit = mode === 'fit';
      let zoomInStepsThisEvent = 0;

      const applyOneWheelStep = (directionIn: boolean): boolean => {
        if (startedInFit && directionIn && zoomInStepsThisEvent >= 1) {
          wheelAccumRef.current = 0;
          return false;
        }

        const peek = directionIn
          ? peekZoomIn(fitEquivalentNativePercent)
          : peekZoomOut();
        if (peek === null) {
          wheelAccumRef.current = 0;
          return false;
        }

        const rect = containerRef.current?.getBoundingClientRect();
        const { x: clientX, y: clientY } = lastWheelClientRef.current;
        const cx = rect ? clientX - rect.left - rect.width / 2 : 0;
        const cy = rect ? clientY - rect.top - rect.height / 2 : 0;

        const s1 = pendingScaleRef.current;
        const s2 =
          peek.mode === 'fit'
            ? (fitEquivalentNativePercent ?? peek.percent) / 100
            : peek.percent / 100;

        runFlushSync(() => {
          zoomAnchorTranslate(s1, s2, cx, cy);
          pendingScaleRef.current = s2;
          if (directionIn) zoomIn(fitEquivalentNativePercent);
          else zoomOut(fitEquivalentNativePercent);
        });
        if (startedInFit && directionIn) zoomInStepsThisEvent++;
        return true;
      };

      // ── Line-based wheels ────────────────────────────────────────────────
      if (e.deltaMode === WheelEvent.DOM_DELTA_LINE && e.deltaY !== 0) {
        const nLines = Math.min(MAX, Math.max(1, Math.round(Math.abs(e.deltaY))));
        const directionIn = e.deltaY < 0;
        for (let i = 0; i < nLines; i++) {
          if (!applyOneWheelStep(directionIn)) break;
        }
        return;
      }

      // ── Pixel mode ───────────────────────────────────────────────────────
      if (e.deltaMode === WheelEvent.DOM_DELTA_PIXEL) {
        const ady = Math.abs(e.deltaY);
        // "Big notch" band: one stop per event
        if (ady >= notchMin && ady <= notchMax && e.deltaY !== 0) {
          wheelAccumRef.current = 0;
          applyOneWheelStep(e.deltaY < 0);
          return;
        }
        // Slow, small-delta mice: coalesce into one stop per physical detent
        if (
          e.deltaY !== 0 &&
          ady >= WHEEL_PIXEL_COALESCE_MIN_DELTA &&
          ady < notchMin &&
          dtSinceLastWheel >= WHEEL_PIXEL_COALESCE_GAP_MS
        ) {
          wheelAccumRef.current = 0;
          applyOneWheelStep(e.deltaY < 0);
          return;
        }
      }

      // ── Accumulate (smooth trackpad) ─────────────────────────────────────
      const deltaY =
        e.deltaMode === WheelEvent.DOM_DELTA_PAGE ? e.deltaY * WHEEL_PAGE_DELTA_SCALE : e.deltaY;
      wheelAccumRef.current += deltaY;

      const drainOnce = (): boolean => {
        const a = wheelAccumRef.current;
        if (Math.abs(a) < S) return false;
        const directionIn = a < 0;
        if (directionIn && a > -S) return false;
        if (!directionIn && a < S) return false;
        if (!applyOneWheelStep(directionIn)) return false;
        wheelAccumRef.current += directionIn ? S : -S;
        return true;
      };

      wheelDrainStepRef.current = drainOnce;

      const runDrain = () => {
        let s = 0;
        while (s < MAX && wheelDrainStepRef.current()) s++;
      };
      runDrain();

      const scheduleMore = () => {
        if (Math.abs(wheelAccumRef.current) < S) return;
        if (wheelDrainRafRef.current !== null) return;
        wheelDrainRafRef.current = requestAnimationFrame(() => {
          wheelDrainRafRef.current = null;
          runDrain();
          scheduleMore();
        });
      };
      scheduleMore();
    },
    [
      enabled,
      mode,
      fitEquivalentNativePercent,
      zoomIn,
      zoomOut,
      peekZoomIn,
      peekZoomOut,
      zoomAnchorTranslate,
      containerRef,
    ],
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [containerRef, handleWheel]);
}
