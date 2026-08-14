import type { ReactNode } from 'react';
import {
  DISPLAY_LAYER_KEEPALIVE_SIZE_RATIO_NEXT,
  DISPLAY_LAYER_KEEPALIVE_SIZE_RATIO_PREV,
} from '../imagePreviewTuning';
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
   * has painted full-size sharp. Only then may this layer shrink to keep-alive size.
   */
  isOutgoing?: boolean;
}

export interface DisplayStageLayersProps {
  layers: DisplayLayerEntry[];
  /** Flat gallery index of the current image — used to pick prev vs next keep-alive size. */
  currentIndex: number;
  currentAlt: string;
  /** Live dims / transform for the current image only. */
  liveDims: ImageDimensions | null;
  liveTransform: string;
  /** Per-src frozen presentation; outgoing / kept neighbors must not share the live transform. */
  frozenBySrc: ReadonlyMap<string, LayerPresentation>;
  /** When true, current full-res stays under the minimap underlay until sharp. */
  hideCurrentUntilDecoded: boolean;
  suppressTransformTransition: boolean;
  isPanning: boolean;
  /** Stage opacity-ready (dims + container); applies to current layer reveal only. */
  imageShowReady: boolean;
  bindLayerRef: (src: string, isCurrent: boolean) => (el: HTMLImageElement | null) => void;
  onCurrentLoad: (img: HTMLImageElement) => void;
  onCurrentError: () => void;
  onNeighborLoad: (index: number, el: HTMLImageElement) => void;
  /**
   * When true, promote current above outgoing as soon as dims are ready (display-ready fast path)
   * without waiting for progressive fullDecoded — avoids ~0.2–0.3s with old frame still on top.
   */
  forceCurrentAboveOutgoing?: boolean;
  /** Optional minimap / placeholder underlay rendered under the current sharp img. */
  underlay?: ReactNode;
}

function hasBothDims(dims: ImageDimensions | null | undefined): dims is ImageDimensions {
  return !!(
    dims &&
    dims.naturalWidth > 1 &&
    dims.naturalHeight > 1
  );
}

function keepAlivePx(natural: number, ratio: number): number {
  return Math.max(1, Math.round(natural * ratio));
}

/**
 * Independent absolute layers inside the viewport.
 *
 * Keep-alive **neighbors**: prev / next → 1×1 CSS px + opacity 1.
 * **Current** / **outgoing**: full natural size when dims are known.
 */
export function DisplayStageLayers({
  layers,
  currentIndex,
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
  forceCurrentAboveOutgoing = false,
}: DisplayStageLayersProps) {
  return (
    <>
      {layers.map(({ src, index, isCurrent, isOutgoing }) => {
        const frozen = frozenBySrc.get(src);
        // Prefer live dims; fall back to frozen so the first navigate paint is already
        // full natural size while useImageTransform catches up.
        const dims = isCurrent ? liveDims ?? frozen?.dims ?? null : frozen?.dims ?? null;
        const cssTransform = isCurrent
          ? liveTransform
          : frozen?.cssTransform ?? 'translate(0px, 0px) scale(1)';
        const dimsReady = hasBothDims(dims);

        const keepRatio =
          index < currentIndex
            ? DISPLAY_LAYER_KEEPALIVE_SIZE_RATIO_PREV
            : DISPLAY_LAYER_KEEPALIVE_SIZE_RATIO_NEXT;

        const currentSharp =
          isCurrent && !hideCurrentUntilDecoded && imageShowReady;
        // Current keeps full geometry once dims exist (underlay covers until sharp).
        // Neighbors use keep-alive size (ratio × natural), not full sharp.
        const paintFullImg = !!isOutgoing || currentSharp || (isCurrent && dimsReady);
        const needsStageFillBox = isCurrent && !dimsReady && underlay != null;
        const boxFull = paintFullImg || needsStageFillBox || (isCurrent && underlay != null && dimsReady);
        const keepAliveSized = !paintFullImg && !needsStageFillBox && dimsReady;

        let boxW: number | string = 1;
        let boxH: number | string = 1;
        if (needsStageFillBox) {
          boxW = '100%';
          boxH = '100%';
        } else if (boxFull && dimsReady) {
          boxW = dims.naturalWidth;
          boxH = dims.naturalHeight;
        } else if (keepAliveSized) {
          boxW = keepAlivePx(dims.naturalWidth, keepRatio);
          boxH = keepAlivePx(dims.naturalHeight, keepRatio);
        } else if (boxFull) {
          boxW = 'auto';
          boxH = 'auto';
        }

        const imgW = paintFullImg && dimsReady
          ? dims.naturalWidth
          : paintFullImg
            ? 'auto'
            : keepAliveSized
              ? keepAlivePx(dims.naturalWidth, keepRatio)
              : 1;
        const imgH = paintFullImg && dimsReady
          ? dims.naturalHeight
          : paintFullImg
            ? 'auto'
            : keepAliveSized
              ? keepAlivePx(dims.naturalHeight, keepRatio)
              : 1;

        // When current is sharp (or display-ready force), above outgoing so uncover is instant.
        let zIndex = 1;
        const currentOnTop =
          currentSharp ||
          (forceCurrentAboveOutgoing && isCurrent && dimsReady && imageShowReady);
        if (currentOnTop) zIndex = 6;
        else if (isOutgoing) zIndex = 5;
        else if (isCurrent) zIndex = 3;
        else if (frozen) zIndex = 2;

        const transformTransition =
          isCurrent && !isPanning && !suppressTransformTransition && imageShowReady
            ? 'transform 0.3s ease'
            : 'none';

        const useLiveTransform = (boxFull || keepAliveSized) && !needsStageFillBox;
        // Hide current until fit scale is settled (imageShowReady). Avoids native-100% flash.
        const layerOpacity = isCurrent && !imageShowReady ? 0 : 1;

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
              opacity: layerOpacity,
            }}
          >
            <div
              style={{
                position: 'relative',
                width: boxW,
                height: boxH,
                maxWidth: needsStageFillBox ? '100%' : dimsReady ? 'none' : undefined,
                maxHeight: needsStageFillBox ? '100%' : dimsReady ? 'none' : undefined,
                transform: useLiveTransform ? cssTransform : undefined,
                transformOrigin: 'center center',
                transition: transformTransition,
                willChange: isCurrent ? 'transform' : undefined,
                overflow: paintFullImg || needsStageFillBox || keepAliveSized ? undefined : 'hidden',
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
                  maxWidth: (paintFullImg || keepAliveSized) && dimsReady ? 'none' : undefined,
                  maxHeight: (paintFullImg || keepAliveSized) && dimsReady ? 'none' : undefined,
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
