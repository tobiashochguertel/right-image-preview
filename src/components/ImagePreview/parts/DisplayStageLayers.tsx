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
  /**
   * Previous frame held **full-size** (above / covering) until the incoming current layer
   * has painted full-size sharp. Only then may this layer shrink to 1×1 keep-alive.
   */
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
  /** When true, current full-res stays under the minimap underlay (1×1 img until sharp). */
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

function fullOrAuto(n: number | undefined): number | 'auto' {
  return n && n > 0 ? n : 'auto';
}

/**
 * Independent absolute layers inside the viewport.
 *
 * Keep-alive (neighbor / non-sharp): **1×1 CSS px + opacity 1** so the compositor retains
 * the bitmap without a full-frame translucent ghost.
 *
 * Contract (do not regress):
 * - `isOutgoing` and sharp current always paint **full-size** (dims, else `'auto'` — never 1).
 * - Shrink previous to 1×1 only after incoming is the visible full-size main (see Inner).
 * - Brief overlap: outgoing stays full while current is already full underneath, then demote.
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

        const currentSharp =
          isCurrent && !hideCurrentUntilDecoded && imageShowReady;
        // Full-size bitmap: outgoing cover, or current after reveal.
        const paintFullImg = currentSharp || !!isOutgoing;
        // Underlay needs a full box even while the full-res <img> stays 1×1.
        const boxFull = paintFullImg || (isCurrent && underlay != null);

        const fullW = dims?.naturalWidth;
        const fullH = dims?.naturalHeight;
        const boxW = boxFull ? fullOrAuto(fullW) : 1;
        const boxH = boxFull ? fullOrAuto(fullH) : 1;
        // Never force outgoing / sharp current to 1×1 when dims are briefly missing.
        const imgW = paintFullImg ? fullOrAuto(fullW) : 1;
        const imgH = paintFullImg ? fullOrAuto(fullH) : 1;

        // Outgoing stays on top until Inner clears hold — current paints full underneath first.
        let zIndex = 1;
        if (isOutgoing) zIndex = 5;
        else if (currentSharp) zIndex = 4;
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
                maxWidth: boxFull && fullW ? 'none' : undefined,
                maxHeight: boxFull && fullH ? 'none' : undefined,
                transform: boxFull ? cssTransform : undefined,
                transformOrigin: 'center center',
                transition: transformTransition,
                willChange: isCurrent ? 'transform' : undefined,
                overflow: paintFullImg ? undefined : 'hidden',
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
                  maxWidth: paintFullImg && fullW ? 'none' : undefined,
                  maxHeight: paintFullImg && fullH ? 'none' : undefined,
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
