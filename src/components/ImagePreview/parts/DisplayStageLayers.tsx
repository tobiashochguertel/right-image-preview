import { DISPLAY_LAYER_KEEPALIVE_OPACITY } from '../imagePreviewTuning';
import type { ImageDimensions } from '../useImageTransform';

export interface DisplayLayerEntry {
  index: number;
  src: string;
  isCurrent: boolean;
}

export interface DisplayStageLayersProps {
  layers: DisplayLayerEntry[];
  currentAlt: string;
  imageDims: ImageDimensions | null;
  /** When true, current full-res stays under the minimap underlay (keep-alive opacity, not hidden). */
  hideCurrentUntilDecoded: boolean;
  /** @deprecated Main layer always snaps; kept for call-site compatibility. */
  opacityTransition?: string;
  bindLayerRef: (src: string, isCurrent: boolean) => (el: HTMLImageElement | null) => void;
  onCurrentLoad: (img: HTMLImageElement) => void;
  onCurrentError: () => void;
  onNeighborLoad: (index: number, el: HTMLImageElement) => void;
}

/**
 * Keeps current + neighbor full-`src` images mounted under stable `key={src}`.
 *
 * WebViews often discard decoded bitmaps for `opacity: 0` / `visibility: hidden` images.
 * Neighbors stay mounted as a **1×1** paint with keep-alive opacity; current while covered by
 * the thumb underlay keeps full layout size at the same opacity — both remain “visible” to the
 * compositor so promote-on-navigate can skip a ~0.5–1s re-decode.
 */
export function DisplayStageLayers({
  layers,
  currentAlt,
  imageDims,
  hideCurrentUntilDecoded,
  opacityTransition: _opacityTransition,
  bindLayerRef,
  onCurrentLoad,
  onCurrentError,
  onNeighborLoad,
}: DisplayStageLayersProps) {
  return (
    <>
      {layers.map(({ src, index, isCurrent }) => {
        const showSharp = isCurrent && !hideCurrentUntilDecoded;
        // Neighbors: 1×1 paint (invisible in practice). Covered current: full size under underlay.
        const layoutW = !isCurrent
          ? 1
          : imageDims
            ? imageDims.naturalWidth
            : 'auto';
        const layoutH = !isCurrent
          ? 1
          : imageDims
            ? imageDims.naturalHeight
            : 'auto';
        return (
          <img
            key={src}
            src={src}
            alt={isCurrent ? currentAlt : ''}
            aria-hidden={isCurrent ? undefined : true}
            draggable={false}
            decoding={isCurrent ? 'sync' : 'async'}
            ref={bindLayerRef(src, isCurrent)}
            onLoad={(e) => {
              const el = e.currentTarget;
              if (isCurrent) onCurrentLoad(el);
              else onNeighborLoad(index, el);
            }}
            onError={isCurrent ? onCurrentError : undefined}
            style={{
              position: isCurrent ? 'relative' : 'absolute',
              left: isCurrent ? undefined : 0,
              top: isCurrent ? undefined : 0,
              display: 'block',
              width: layoutW,
              height: layoutH,
              maxWidth: isCurrent ? (imageDims ? 'none' : '100%') : 'none',
              maxHeight: isCurrent ? (imageDims ? 'none' : '100%') : 'none',
              pointerEvents: 'none',
              visibility: 'visible',
              opacity: showSharp ? 1 : DISPLAY_LAYER_KEEPALIVE_OPACITY,
              transition: 'none',
              zIndex: showSharp ? 1 : 0,
            }}
          />
        );
      })}
    </>
  );
}
