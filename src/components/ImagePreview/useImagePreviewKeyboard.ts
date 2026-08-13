import { useEffect } from 'react';
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
 */
export function useImagePreviewKeyboard(p: UseImagePreviewKeyboardParams): void {
  const {
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
    keyboardActive = true,
    isFullscreen,
    exitFullscreen,
    beginNavHold,
    endNavHold,
  } = p;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
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
            // Flat ←/→ (crosses groups); PageUp/PageDown jump groups.
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

        // Jump group (no-op when not grouped — prevGroup/nextGroup guard internally).
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
      if (!keyboardActive || !endNavHold) return;
      if (e.key === 'ArrowLeft') endNavHold('prev');
      if (e.key === 'ArrowRight') endNavHold('next');
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [
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
    keyboardActive,
    isFullscreen,
    exitFullscreen,
    beginNavHold,
    endNavHold,
  ]);
}
