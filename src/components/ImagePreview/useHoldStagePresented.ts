import { useEffect, useRef, useState } from 'react';
import {
  isHoldBitmapCandidate,
  pickHoldPresentImg,
  scheduleHoldStagePresented,
  type HoldBitmapCandidateInput,
} from './lib/holdContentVisible';

export interface UseHoldStagePresentedParams extends HoldBitmapCandidateInput {
  /** Changes on every landed image (typically `src` or `index:src`). */
  visitKey: string;
  getUnderlayEl(): HTMLImageElement | null;
  getMainEl(): HTMLImageElement | null;
}

/**
 * True only after the current visit’s stage content is a bitmap candidate **and**
 * has been presented for two animation frames (decode + double-rAF).
 *
 * Stays true for the rest of the visit once confirmed (upgrading underlay→full must
 * not restart the hold dwell clock). Resets synchronously when `visitKey` changes.
 */
export function useHoldStagePresented({
  visitKey,
  getUnderlayEl,
  getMainEl,
  ...candidateInput
}: UseHoldStagePresentedParams): boolean {
  const [presented, setPresented] = useState(false);
  const visitRef = useRef(visitKey);
  const lockedVisitRef = useRef<string | null>(null);

  if (visitRef.current !== visitKey) {
    visitRef.current = visitKey;
    lockedVisitRef.current = null;
    if (presented) setPresented(false);
  }

  useEffect(() => {
    if (lockedVisitRef.current === visitKey) return undefined;

    if (candidateInput.imageLoadError) {
      lockedVisitRef.current = visitKey;
      setPresented(true);
      return undefined;
    }

    if (!isHoldBitmapCandidate(candidateInput)) {
      setPresented(false);
      return undefined;
    }

    const img = pickHoldPresentImg({
      showMinimapUnderlay: candidateInput.showMinimapUnderlay,
      underlayPainted: candidateInput.underlayPainted,
      fullDecoded: candidateInput.fullDecoded,
      pipelineActive: candidateInput.pipelineActive,
      thumbOnly: candidateInput.thumbOnly,
      mainPainted: candidateInput.mainPainted,
      underlayEl: getUnderlayEl(),
      mainEl: getMainEl(),
    });
    if (!img) {
      setPresented(false);
      return undefined;
    }

    return scheduleHoldStagePresented(img, () => {
      if (visitRef.current !== visitKey) return;
      lockedVisitRef.current = visitKey;
      setPresented(true);
    });
  }, [
    visitKey,
    candidateInput.imageLoadError,
    candidateInput.imageShowReady,
    candidateInput.showMinimapUnderlay,
    candidateInput.underlayPainted,
    candidateInput.pipelineActive,
    candidateInput.fullDecoded,
    candidateInput.thumbOnly,
    candidateInput.mainPainted,
    getUnderlayEl,
    getMainEl,
  ]);

  return presented;
}
