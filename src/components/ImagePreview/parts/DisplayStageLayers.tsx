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
  /** When true, current full-res layer stays opacity 0 (progressive underlay showing). */
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
 * Navigating to a pre-decoded neighbor reuses the same DOM node → no second ~1s decode.
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
      {layers.map(({ src, index, isCurrent }) => (
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
            width: isCurrent && imageDims ? imageDims.naturalWidth : 'auto',
            height: isCurrent && imageDims ? imageDims.naturalHeight : 'auto',
            maxWidth: isCurrent ? (imageDims ? 'none' : '100%') : 'none',
            maxHeight: isCurrent ? (imageDims ? 'none' : '100%') : 'none',
            pointerEvents: 'none',
            // Keep invisible until fully decoded — opacity alone can still flash progressive JPEG strips.
            visibility: isCurrent && hideCurrentUntilDecoded ? 'hidden' : 'visible',
            opacity: isCurrent ? (hideCurrentUntilDecoded ? 0 : 1) : 0,
            // Snap on: fading in a huge JPG can still show a left/top scan strip mid-transition.
            transition: 'none',
            zIndex: isCurrent ? 1 : 0,
          }}
        />
      ))}
    </>
  );
}
