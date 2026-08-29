import { useEffect, useRef } from 'react';
import type { ShiftArrowAction, ZoomMode } from './types';
import type { ThumbPaceHoldDir } from './useThumbPacedNavigation';

type ArrowKey = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight';

function isArrowKey(key: string): key is ArrowKey {
  return key === 'ArrowUp' || key === 'ArrowDown' || key === 'ArrowLeft' || key === 'ArrowRight';
}

function panFromHeldDirections(
  held: ReadonlySet<ArrowKey>,
  stepPx: number,
  panByDelta: (dx: number, dy: number) => void,
): void {
  const directionX = Number(held.has('ArrowRight')) - Number(held.has('ArrowLeft'));
  const directionY = Number(held.has('ArrowDown')) - Number(held.has('ArrowUp'));
  const magnitude = Math.hypot(directionX, directionY);
  if (magnitude === 0) return;

  // Arrow keys describe the content to reveal, so the image translate moves oppositely.
  // Normalizing keeps diagonal movement at the same total speed as cardinal movement.
  const dx = directionX === 0 ? 0 : -(directionX / magnitude) * stepPx;
  const dy = directionY === 0 ? 0 : -(directionY / magnitude) * stepPx;
  panByDelta(dx, dy);
}

export interface UseImagePreviewKeyboardParams {
  resetHideTimer(): void;
  onClose?: () => void;
  zoomIn(fitEq?: number): void;
  zoomOut(fitEq?: number): void;
  fit(): void;
  setNative(percent: number): void;
  mode: ZoomMode;
  prev(): void;
  next(): void;
  prevGroup(): void;
  nextGroup(): void;
  rotateCW(): void;
  rotateCCW(): void;
  panByDelta(dx: number, dy: number): void;
  keyboardPanStepPx: number;
  shiftArrowAction: ShiftArrowAction;
  fitEquivalentNativePercent: number | undefined;
  /** When set, Delete / Backspace removes the current image. */
  onDeleteImage?: () => void;
  /**
   * When false, ignore all keys (e.g. `presentation="contained"` while focus is outside).
   * Default true.
   */
  keyboardActive?: boolean;
  /**
   * When true (browser fullscreen owned by the preview), Esc exits fullscreen instead of closing.
   */
  isFullscreen?: () => boolean;
  exitFullscreen?: () => void | Promise<void>;
  /**
   * Thumb-paced ←/→ hold (optional). When set, ArrowLeft/Right (without mod/shift)
   * use begin/end hold instead of calling prev/next on every key-repeat.
   */
  beginNavHold?: (dir: ThumbPaceHoldDir) => void;
  endNavHold?: (dir?: ThumbPaceHoldDir) => void;
}

/**
 * Global keydown for the preview dialog (zoom, navigate, pan, close).
 * Skips handling when focus is in an input/textarea (e.g. zoom % field).
 *
 * Listeners are registered once and read the latest params via a ref — so navigating
 * (which recreates `prev`/`next`) must not tear down the effect and call `endNavHold`
 * mid-hold (that bug made long-press ←/→ stop after one step).
 */
export function useImagePreviewKeyboard(p: UseImagePreviewKeyboardParams): void {
  const paramsRef = useRef(p);
  const heldPanDirectionsRef = useRef<Set<ArrowKey>>(new Set());
  const { keyboardActive, endNavHold, shiftArrowAction } = p;

  useEffect(() => {
    paramsRef.current = p;
  }, [p]);

  // Contained: when focus leaves the preview, stop any in-flight hold.
  useEffect(() => {
    if (keyboardActive !== false) return;
    heldPanDirectionsRef.current.clear();
    endNavHold?.();
  }, [keyboardActive, endNavHold]);

  useEffect(() => {
    heldPanDirectionsRef.current.clear();
  }, [shiftArrowAction]);

  useEffect(() => {
    const heldPanDirections = heldPanDirectionsRef.current;

    const onKeyDown = (e: KeyboardEvent) => {
      const {
        keyboardActive = true,
        resetHideTimer,
        onClose,
        zoomIn,
        zoomOut,
        fit,
        setNative,
        mode,
        prev,
        next,
        prevGroup,
        nextGroup,
        rotateCW,
        rotateCCW,
        panByDelta,
        keyboardPanStepPx,
        shiftArrowAction,
        fitEquivalentNativePercent,
        onDeleteImage,
        isFullscreen,
        exitFullscreen,
        beginNavHold,
        endNavHold,
      } = paramsRef.current;

      if (!keyboardActive) return;

      resetHideTimer();

      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      const mod = e.ctrlKey || e.metaKey;

      switch (e.key) {
        case 'Escape':
          if (isFullscreen?.()) {
            e.preventDefault();
            void exitFullscreen?.();
            break;
          }
          onClose?.();
          break;

        case 'Delete':
        case 'Backspace':
          if (onDeleteImage) {
            e.preventDefault();
            onDeleteImage();
          }
          break;

        case '+':
        case '=':
        case 'Add':
          e.preventDefault();
          zoomIn(fitEquivalentNativePercent);
          break;

        case 'ArrowUp':
          e.preventDefault();
          if (mod || (e.shiftKey && shiftArrowAction === 'pan')) {
            endNavHold?.();
            heldPanDirections.add(e.key);
            panFromHeldDirections(heldPanDirections, keyboardPanStepPx, panByDelta);
            break;
          }
          zoomIn(fitEquivalentNativePercent);
          break;

        case '-':
        case 'Subtract':
          e.preventDefault();
          zoomOut(fitEquivalentNativePercent);
          break;

        case 'ArrowDown':
          e.preventDefault();
          if (mod || (e.shiftKey && shiftArrowAction === 'pan')) {
            endNavHold?.();
            heldPanDirections.add(e.key);
            panFromHeldDirections(heldPanDirections, keyboardPanStepPx, panByDelta);
            break;
          }
          zoomOut(fitEquivalentNativePercent);
          break;

        case '0':
          fit();
          break;
        case '1':
          setNative(100);
          break;

        case ' ':
          e.preventDefault();
          if (mode === 'fit') setNative(100);
          else fit();
          break;

        case 'ArrowLeft':
          e.preventDefault();
          if (mod || (e.shiftKey && shiftArrowAction === 'pan')) {
            endNavHold?.();
            heldPanDirections.add(e.key);
            panFromHeldDirections(heldPanDirections, keyboardPanStepPx, panByDelta);
            break;
          }
          if (e.shiftKey) {
            rotateCCW();
            break;
          }
          if (beginNavHold && !e.repeat) {
            // Ignore OS key-repeat — pacing is driven by stage presentation while held.
            beginNavHold('prev');
          } else if (!beginNavHold) {
            prev();
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (mod || (e.shiftKey && shiftArrowAction === 'pan')) {
            endNavHold?.();
            heldPanDirections.add(e.key);
            panFromHeldDirections(heldPanDirections, keyboardPanStepPx, panByDelta);
            break;
          }
          if (e.shiftKey) {
            rotateCW();
            break;
          }
          if (beginNavHold && !e.repeat) {
            beginNavHold('next');
          } else if (!beginNavHold) {
            next();
          }
          break;

        case 'PageUp':
          e.preventDefault();
          prevGroup();
          break;
        case 'PageDown':
          e.preventDefault();
          nextGroup();
          break;
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (isArrowKey(e.key)) heldPanDirections.delete(e.key);
      if (e.key === 'Meta' || e.key === 'Control' || e.key === 'Shift') {
        heldPanDirections.clear();
      }

      // Always end hold on keyup (do not gate on keyboardActive): otherwise a
      // focus flicker with holdMinVisibleMs=0 can leave the paced hold running.
      const { endNavHold } = paramsRef.current;
      if (!endNavHold) return;
      if (e.key === 'ArrowLeft') endNavHold('prev');
      if (e.key === 'ArrowRight') endNavHold('next');
    };

    const onBlur = () => {
      heldPanDirections.clear();
      paramsRef.current.endNavHold?.();
    };

    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', onKeyUp, true);
      window.removeEventListener('blur', onBlur);
      heldPanDirections.clear();
      // True unmount only (empty deps) — safe to clear hold.
      paramsRef.current.endNavHold?.();
    };
  }, []);
}
