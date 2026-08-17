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

function keepAliveCropPx(natural: number, ratio: number): number {
  return Math.max(1, Math.round(natural * ratio));
}

/**
 * Independent absolute layers inside the viewport.
 *
 * Keep-alive **neighbors**: full-natural `<img>` clipped to a small crop window (no CSS
 * scale, **no fit transform** — avoids a viewport-tall “strip” of 1:1 pixels).
 * **Current** / **outgoing**: full natural size + transform when dims are known.
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
}: DisplayStageLayersProps) {
  const hasOutgoing = layers.some((l) => l.isOutgoing);

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
        const paintFullImg = !!isOutgoing || currentSharp || (isCurrent && dimsReady);
        const needsStageFillBox = isCurrent && !dimsReady && underlay != null;
        const boxFull = paintFullImg || needsStageFillBox || (isCurrent && underlay != null && dimsReady);
        // Neighbor keep-alive: clip window only — bitmap stays natural size.
        const keepAliveCropped = !paintFullImg && !needsStageFillBox && dimsReady;

        let boxW: number | string = 1;
        let boxH: number | string = 1;
        if (needsStageFillBox) {
          boxW = '100%';
          boxH = '100%';
        } else if (boxFull && dimsReady) {
          boxW = dims.naturalWidth;
          boxH = dims.naturalHeight;
        } else if (keepAliveCropped) {
          // Square-ish clip from ratio; with ratio 0 → 1×1. Do not use a tall natural-height
          // window or the stage will show a vertical strip of 1:1 pixels.
          boxW = keepAliveCropPx(dims.naturalWidth, keepRatio);
          boxH = keepAliveCropPx(dims.naturalHeight, keepRatio);
        } else if (boxFull) {
          boxW = 'auto';
          boxH = 'auto';
        }

        // Keep-alive: never shrink the img — only the overflow box crops it.
        const imgW = (paintFullImg || keepAliveCropped) && dimsReady
          ? dims.naturalWidth
          : paintFullImg
            ? 'auto'
            : 1;
        const imgH = (paintFullImg || keepAliveCropped) && dimsReady
          ? dims.naturalHeight
          : paintFullImg
            ? 'auto'
            : 1;

        // While outgoing holds, it stays on top — current prepares underneath.
        let zIndex = 1;
        if (isOutgoing) zIndex = 5;
        else if (currentSharp && !hasOutgoing) zIndex = 6;
        else if (isCurrent) zIndex = 3;
        else if (frozen) zIndex = 2;

        const transformTransition =
          isCurrent && !isPanning && !suppressTransformTransition && imageShowReady
            ? 'transform 0.3s ease'
            : 'none';

        // Critical: keep-alive must NOT reuse the fit/pan transform. Applying fit-scale (or
        // worse, scale(1)) to a natural-size bitmap makes the viewport clip a tall “strip”
        // (~window width) of the previous photo after demote.
        const useLiveTransform = boxFull && !needsStageFillBox && !keepAliveCropped;
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
                overflow: keepAliveCropped ? 'hidden' : undefined,
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
                  maxWidth: (paintFullImg || keepAliveCropped) && dimsReady ? 'none' : undefined,
                  maxHeight: (paintFullImg || keepAliveCropped) && dimsReady ? 'none' : undefined,
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
