import { useCallback, useEffect, useRef } from 'react';
import type { NativePercent, ZoomMode } from './types';

export interface UsePinchZoomOptions {
  /** Container element ref whose pointer events are monitored. */
  containerRef: React.RefObject<HTMLDivElement | null>;
  enabled: boolean;
  mode: ZoomMode;
  /** The current rendered CSS scale — used to compute the new scale from the pinch ratio. */
  currentScale: number;
  /** Sorted ascending zoom stops (native %). Used to clamp the output. */
  stops: NativePercent[];
  fitEquivalentNativePercent: number | undefined;
  /** Switch to Fit mode. */
  fit(): void;
  /**
   * Switch to Native mode at an arbitrary percentage (not clamped to stops).
   * The pinch gesture intentionally uses continuous scaling.
   */
  setNative(percent: NativePercent): void;
  /**
   * Pre-adjust translate to keep the midpoint of the two fingers fixed while
   * scaling.  Call this BEFORE setNative so both land in the same render.
   */
  zoomAnchorTranslate(
    prevScale: number,
    newScale: number,
    anchorX: number,
    anchorY: number,
  ): void;
}

/**
 * Two-finger pinch-to-zoom using Pointer Events (works on touch screens and
 * trackpads that expose multi-touch via pointer events).
 *
 * - In Fit mode, entering pinch immediately switches to Native at the current
 *   fit-equivalent % so the transition feels seamless.
 * - The midpoint between the two fingers is used as the zoom anchor so the
 *   focal area stays under the user's fingers.
 * - Scale is continuous (not snapped to stops) during the gesture; clamped to
 *   [minStop, maxStop * 4] to prevent extreme values.
 */
export function usePinchZoom(options: UsePinchZoomOptions): void {
  const {
    containerRef,
    enabled,
    mode,
    currentScale,
    stops,
    fitEquivalentNativePercent,
    fit,
    setNative,
    zoomAnchorTranslate,
  } = options;

  const pointersRef = useRef<Map<number, PointerEvent>>(new Map());
  const pinchStartDistRef = useRef<number | null>(null);
  const pinchStartScaleRef = useRef<number>(1);
  const pinchStartMidRef = useRef<{ x: number; y: number } | null>(null);

  const minStop = stops[0] ?? 10;
  const maxStop = stops[stops.length - 1] ?? 200;

  const getDistance = (a: PointerEvent, b: PointerEvent): number => {
    const dx = a.clientX - b.clientX;
    const dy = a.clientY - b.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const getMidpoint = (
    a: PointerEvent,
    b: PointerEvent,
    rect: DOMRect,
  ): { x: number; y: number } => ({
    x: (a.clientX + b.clientX) / 2 - rect.left - rect.width / 2,
    y: (a.clientY + b.clientY) / 2 - rect.top - rect.height / 2,
  });

  const onPointerDown = useCallback(
    (e: PointerEvent) => {
      if (!enabled) return;
      pointersRef.current.set(e.pointerId, e);

      if (pointersRef.current.size === 2) {
        const [a, b] = [...pointersRef.current.values()] as [PointerEvent, PointerEvent];
        const dist = getDistance(a, b);
        pinchStartDistRef.current = dist;
        // Capture the effective scale at pinch start so zooming from Fit works seamlessly.
        pinchStartScaleRef.current =
          mode === 'fit'
            ? (fitEquivalentNativePercent ?? (minStop)) / 100
            : currentScale;
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
          pinchStartMidRef.current = getMidpoint(a, b, rect);
        }
      }
    },
    [enabled, mode, currentScale, fitEquivalentNativePercent, minStop, containerRef],
  );

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      if (!enabled) return;
      if (!pointersRef.current.has(e.pointerId)) return;
      pointersRef.current.set(e.pointerId, e);

      if (pointersRef.current.size !== 2 || pinchStartDistRef.current === null) return;

      const [a, b] = [...pointersRef.current.values()] as [PointerEvent, PointerEvent];
      const currentDist = getDistance(a, b);
      if (currentDist === 0) return;

      const ratio = currentDist / pinchStartDistRef.current;
      const baseScale = pinchStartScaleRef.current;
      let newScale = baseScale * ratio;

      // Clamp relative to the pinch start scale: allow zooming beyond max stop
      // (up to 4×) for "wow" factor, and never clamp through the start scale —
      // fit mode can already exceed maxStop (e.g. an SVG upscaled to 950%), so
      // pinching in must not snap the view back down.
      const minScale = Math.min(minStop / 100, baseScale);
      const maxScale = Math.max((maxStop * 4) / 100, baseScale * 4);
      newScale = Math.max(minScale, Math.min(maxScale, newScale));

      const rect = containerRef.current?.getBoundingClientRect();
      const mid = rect ? getMidpoint(a, b, rect) : pinchStartMidRef.current ?? { x: 0, y: 0 };

      const prevScale = mode === 'fit'
        ? (fitEquivalentNativePercent ?? minStop) / 100
        : currentScale;

      zoomAnchorTranslate(prevScale, newScale, mid.x, mid.y);
      setNative(newScale * 100);
    },
    [
      enabled,
      mode,
      currentScale,
      fitEquivalentNativePercent,
      minStop,
      maxStop,
      zoomAnchorTranslate,
      setNative,
      containerRef,
    ],
  );

  const onPointerUp = useCallback(
    (e: PointerEvent) => {
      pointersRef.current.delete(e.pointerId);
      if (pointersRef.current.size < 2) {
        pinchStartDistRef.current = null;
        pinchStartMidRef.current = null;
      }
    },
    [],
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !enabled) return;

    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('pointercancel', onPointerUp);

    return () => {
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointercancel', onPointerUp);
    };
  }, [containerRef, enabled, onPointerDown, onPointerMove, onPointerUp]);

  // When disabled at runtime, reset pinch tracking to avoid stale state.
  useEffect(() => {
    if (!enabled) {
      pointersRef.current.clear();
      pinchStartDistRef.current = null;
    }
  }, [enabled]);

  void fit; // referenced by caller options; not used directly here
}
