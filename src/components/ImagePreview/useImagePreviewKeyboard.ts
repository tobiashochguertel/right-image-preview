import { useEffect } from 'react';
import type { FlattenedGroupSlice } from './flattenGroupedImages';
import type { ZoomMode } from './types';

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
  fitEquivalentNativePercent: number | undefined;
  currentIndex: number;
  currentGroup: FlattenedGroupSlice | null;
  currentGroupIdx: number;
  groupSlices: FlattenedGroupSlice[] | undefined;
  imagesLength: number;
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
    fitEquivalentNativePercent,
    currentIndex,
    currentGroup,
    currentGroupIdx,
    groupSlices,
    imagesLength,
  } = p;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      resetHideTimer();

      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      const mod = e.ctrlKey || e.metaKey;

      switch (e.key) {
        case 'Escape':
          onClose?.();
          break;

        case '+':
        case '=':
        case 'ArrowUp':
          e.preventDefault();
          zoomIn(fitEquivalentNativePercent);
          break;

        case '-':
        case 'ArrowDown':
          e.preventDefault();
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
          if (mod) {
            rotateCCW();
          } else {
            const atStart = currentGroup ? currentIndex === currentGroup.start : currentIndex === 0;
            if (atStart && currentGroupIdx > 0) prevGroup();
            else prev();
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (mod) {
            rotateCW();
          } else {
            const atEnd = currentGroup ? currentIndex === currentGroup.end : currentIndex === imagesLength - 1;
            const hasNext = groupSlices ? currentGroupIdx < groupSlices.length - 1 : false;
            if (atEnd && hasNext) nextGroup();
            else next();
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
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
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
    fitEquivalentNativePercent,
    currentIndex,
    currentGroup,
    currentGroupIdx,
    groupSlices,
    imagesLength,
  ]);
}
