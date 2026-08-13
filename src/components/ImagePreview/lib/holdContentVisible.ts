import { afterDoubleAnimationFrame } from './imagePreviewDecode';

/**
 * Bitmap *candidate* for ←/→ hold pacing (DOM reports load/complete + stage opacity-ready).
 * Not enough alone: cached `onLoad` / stale `imageShowReady` can fire before the user
 * actually sees a frame — confirm with {@link scheduleHoldStagePresented}.
 */
export interface HoldBitmapCandidateInput {
  imageLoadError: boolean;
  /** Stage transform wrapper is opacity-visible (dims + container ready, after rAF). */
  imageShowReady: boolean;
  /** Progressive pipeline is using a main-area minimap underlay. */
  showMinimapUnderlay: boolean;
  /** Underlay `<img>` has loaded a paintable bitmap (`complete` / `onLoad`). */
  underlayPainted: boolean;
  /** Progressive main pipeline active for this item. */
  pipelineActive: boolean;
  /** Full `src` has been revealed (underlay may fade). */
  fullDecoded: boolean;
  /** Fallback stage when only the thumb remains. */
  thumbOnly: boolean;
  /** Current full-`src` layer has a paintable bitmap. */
  mainPainted: boolean;
}

/** @deprecated Alias — prefer {@link isHoldBitmapCandidate}. */
export type HoldContentVisibleInput = HoldBitmapCandidateInput;

export function isHoldBitmapCandidate(input: HoldBitmapCandidateInput): boolean {
  if (input.imageLoadError) return true;
  if (!input.imageShowReady) return false;

  // Thumb underlay on screen counts (product: pace on main-area thumb, not full decode).
  if (input.showMinimapUnderlay && input.underlayPainted) return true;

  // No thumb / thumb-only / full reveal: need the real main bitmap path.
  const mainPath =
    !input.pipelineActive || input.fullDecoded || input.thumbOnly;
  return mainPath && input.mainPainted;
}

/** @deprecated Use {@link isHoldBitmapCandidate}. */
export const isHoldContentVisible = isHoldBitmapCandidate;

/**
 * Light confirmation that `img` has been presented: `decode()` (thumbs are small;
 * avoid createImageBitmap on full JPGs) + two rAFs so the compositor has painted.
 * Returns a cancel function.
 */
export function scheduleHoldStagePresented(
  img: HTMLImageElement,
  onPresented: () => void,
): () => void {
  let cancelled = false;

  void (async () => {
    if (!img.complete || img.naturalWidth <= 0) return;
    if (typeof img.decode === 'function') {
      try {
        await img.decode();
      } catch {
        /* still wait for frames */
      }
    }
    await afterDoubleAnimationFrame();
    if (cancelled) return;
    if (!img.complete || img.naturalWidth <= 0) return;
    onPresented();
  })();

  return () => {
    cancelled = true;
  };
}

/** Pick which layer the user is actually looking at for this candidate. */
export function pickHoldPresentImg(args: {
  showMinimapUnderlay: boolean;
  underlayPainted: boolean;
  fullDecoded: boolean;
  pipelineActive: boolean;
  thumbOnly: boolean;
  mainPainted: boolean;
  underlayEl: HTMLImageElement | null;
  mainEl: HTMLImageElement | null;
}): HTMLImageElement | null {
  const {
    showMinimapUnderlay,
    underlayPainted,
    fullDecoded,
    pipelineActive,
    thumbOnly,
    mainPainted,
    underlayEl,
    mainEl,
  } = args;

  // Prefer underlay while it is the visible cover (not yet faded for full reveal).
  if (showMinimapUnderlay && underlayPainted && !fullDecoded && underlayEl) {
    return underlayEl;
  }
  const mainVisible = !pipelineActive || fullDecoded || thumbOnly;
  if (mainVisible && mainPainted && mainEl) return mainEl;
  // Underlay still mounted after full decode (opacity 0) — only if main missing.
  if (showMinimapUnderlay && underlayPainted && underlayEl) return underlayEl;
  return null;
}
