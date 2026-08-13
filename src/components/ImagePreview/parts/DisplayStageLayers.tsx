import type { ReactNode } from 'react';
import type { ImageDimensions } from '../useImageTransform';

export interface LayerPresentation {
  dims: ImageDimensions;
  /** Frozen CSS transform string (`translate … rotate … scale …`). */
  cssTransform: string;
}

export interface DisplayLayerEntry {
  index: number;
  src: string;
  isCurrent: boolean;
  /** Previous image held full-size under the incoming layer until it is paintable. */
  isOutgoing?: boolean;
}

export interface DisplayStageLayersProps {
  layers: DisplayLayerEntry[];
  currentAlt: string;
  /** Live dims / transform for the current image only. */
  liveDims: ImageDimensions | null;
  liveTransform: string;
  /** Per-src frozen presentation; outgoing / kept neighbors must not share the live transform. */
  frozenBySrc: ReadonlyMap<string, LayerPresentation>;
  /** When true, current full-res stays under the minimap underlay (1×1 keep-alive until sharp). */
  hideCurrentUntilDecoded: boolean;
  suppressTransformTransition: boolean;
  isPanning: boolean;
  /** Stage opacity-ready (dims + container); applies to current layer reveal only. */
  imageShowReady: boolean;
  bindLayerRef: (src: string, isCurrent: boolean) => (el: HTMLImageElement | null) => void;
  onCurrentLoad: (img: HTMLImageElement) => void;
  onCurrentError: () => void;
  onNeighborLoad: (index: number, el: HTMLImageElement) => void;
  /** Progressive underlay — only mounted on the current layer, inside its transformed box. */
  underlay?: ReactNode;
}

/**
 * Independent absolute layers inside the viewport.
 *
 * Each `src` is a full-viewport stack slot with its **own** centered box + transform.
 * Navigating away freezes that presentation; the live transform for the new image never
 * moves the previous frame (shared-parent transform was causing the “jump to center”).
 *
 * Keep-alive (non-sharp layers): **1×1 CSS px + opacity 1** — compositor still paints so
 * WebViews retain the decoded bitmap, without a full-size translucent ghost.
 */
export function DisplayStageLayers({
  layers,
  currentAlt,
  liveDims,
  liveTransform,
  frozenBySrc,
  hideCurrentUntilDecoded,
  suppressTransformTransition,
  isPanning,
  imageShowReady,
  bindLayerRef,
  onCurrentLoad,
  onCurrentError,
  onNeighborLoad,
  underlay = null,
}: DisplayStageLayersProps) {
  return (
    <>
      {layers.map(({ src, index, isCurrent, isOutgoing }) => {
        const frozen = frozenBySrc.get(src);
        const dims = isCurrent ? liveDims : frozen?.dims ?? null;
        const cssTransform = isCurrent
          ? liveTransform
          : frozen?.cssTransform ?? 'translate(0px, 0px) scale(1)';
        const showSharp =
          (isCurrent && !hideCurrentUntilDecoded && imageShowReady) || !!isOutgoing;
        // Underlay needs a full-size box; the <img> itself stays 1×1 until sharp.
        const boxFull = showSharp || (isCurrent && underlay != null);
        const boxW = boxFull && dims ? dims.naturalWidth : 1;
        const boxH = boxFull && dims ? dims.naturalHeight : 1;
        const imgW = showSharp && dims ? dims.naturalWidth : 1;
        const imgH = showSharp && dims ? dims.naturalHeight : 1;

        let zIndex = 1;
        if (isOutgoing) zIndex = 5;
        else if (isCurrent && showSharp) zIndex = 4;
        else if (isCurrent) zIndex = 3;
        else if (frozen) zIndex = 2;

        const transformTransition =
          isCurrent && !isPanning && !suppressTransformTransition && imageShowReady
            ? 'transform 0.3s ease'
            : 'none';

        return (
          <div
            key={src}
            aria-hidden={isCurrent ? undefined : true}
            data-rip-stage-layer={isCurrent ? 'current' : isOutgoing ? 'outgoing' : 'keep'}
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex,
              pointerEvents: 'none',
            }}
          >
            <div
              style={{
                position: 'relative',
                width: boxW,
                height: boxH,
                maxWidth: boxFull && dims ? 'none' : undefined,
                maxHeight: boxFull && dims ? 'none' : undefined,
                transform: boxFull ? cssTransform : undefined,
                transformOrigin: 'center center',
                transition: transformTransition,
                willChange: isCurrent ? 'transform' : undefined,
                overflow: showSharp ? undefined : 'hidden',
              }}
            >
              {isCurrent ? underlay : null}
              <img
                src={src}
                alt={isCurrent ? currentAlt : ''}
                draggable={false}
                decoding={isCurrent || isOutgoing ? 'sync' : 'async'}
                ref={bindLayerRef(src, isCurrent)}
                onLoad={(e) => {
                  const el = e.currentTarget;
                  if (isCurrent) onCurrentLoad(el);
                  else onNeighborLoad(index, el);
                }}
                onError={isCurrent ? onCurrentError : undefined}
                style={{
                  display: 'block',
                  width: imgW,
                  height: imgH,
                  maxWidth: showSharp && dims ? 'none' : undefined,
                  maxHeight: showSharp && dims ? 'none' : undefined,
                  opacity: 1,
                  pointerEvents: 'none',
                  transition: 'none',
                }}
              />
            </div>
          </div>
        );
      })}
    </>
  );
}
