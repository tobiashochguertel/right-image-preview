import { useEffect, useRef } from 'react';
import type { ZoomMode } from './types';
import type { ThumbPaceHoldDir } from './useThumbPacedNavigation';

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
 * Global keydown for the preview dialog (zoom, navigate, rotate, close).
 * Skips handling when focus is in an input/textarea (e.g. zoom % field).
 *
 * Listeners are registered once and read the latest params via a ref — so navigating
 * (which recreates `prev`/`next`) must not tear down the effect and call `endNavHold`
 * mid-hold (that bug made long-press ←/→ stop after one step).
 */
export function useImagePreviewKeyboard(p: UseImagePreviewKeyboardParams): void {
  const paramsRef = useRef(p);
  paramsRef.current = p;

  // Contained: when focus leaves the preview, stop any in-flight hold.
  useEffect(() => {
    if (p.keyboardActive !== false) return;
    p.endNavHold?.();
  }, [p.keyboardActive, p.endNavHold]);

  useEffect(() => {
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
        fitEquivalentNativePercent,
        onDeleteImage,
        isFullscreen,
        exitFullscreen,
        beginNavHold,
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
        case 'ArrowUp':
          e.preventDefault();
          if (e.shiftKey && !mod) {
            panByDelta(0, keyboardPanStepPx);
            break;
          }
          zoomIn(fitEquivalentNativePercent);
          break;

        case '-':
        case 'Subtract':
        case 'ArrowDown':
          e.preventDefault();
          if (e.shiftKey && !mod) {
            panByDelta(0, -keyboardPanStepPx);
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
          if (e.shiftKey && !mod) {
            panByDelta(keyboardPanStepPx, 0);
            break;
          }
          if (mod) {
            rotateCCW();
          } else if (beginNavHold && !e.repeat) {
            // Ignore OS key-repeat — pacing is driven by stage presentation while held.
            beginNavHold('prev');
          } else if (!beginNavHold) {
            prev();
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (e.shiftKey && !mod) {
            panByDelta(-keyboardPanStepPx, 0);
            break;
          }
          if (mod) {
            rotateCW();
          } else if (beginNavHold && !e.repeat) {
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
      // Always end hold on keyup (do not gate on keyboardActive): otherwise a
      // focus flicker with holdMinVisibleMs=0 can leave the paced hold running.
      const { endNavHold } = paramsRef.current;
      if (!endNavHold) return;
      if (e.key === 'ArrowLeft') endNavHold('prev');
      if (e.key === 'ArrowRight') endNavHold('next');
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      // True unmount only (empty deps) — safe to clear hold.
      paramsRef.current.endNavHold?.();
    };
  }, []);
}
