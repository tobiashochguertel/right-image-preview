import { ReactNode } from 'react';
import { MediaSource } from './core/media-source.js';
import { ZoomMode } from './types.js';
/** Flush to preview corner; bottom ~toolbar baseline (toolbar uses bottom: 20). */
export declare const MINIMAP_RIGHT = 10;
export declare const MINIMAP_BOTTOM = 22;
export interface MinimapProps {
    /**
     * URL for the default minimap `<img>`. Parent should pass `minimapSrc ?? main src`.
     * Unused when {@link thumbnail} is set.
     */
    imageSrc: string;
    /** Renderer-neutral source for the default minimap image. */
    imageSource?: MediaSource;
    /** Custom minimap content; replaces the default `<img>`. */
    thumbnail?: ReactNode;
    imageAlt: string;
    nw: number;
    nh: number;
    cw: number;
    ch: number;
    /** Current CSS scale (same as main `transform.scale`). */
    scale: number;
    mode: ZoomMode;
    tx: number;
    ty: number;
    rotationDeg: number;
    flipH: boolean;
    flipV: boolean;
    controlsVisible: boolean;
    /** Idle opacity when controls are hidden. */
    idleOpacity?: number;
    /** Distance from overlay bottom (px). Raised when a thumbnail strip is shown. */
    bottomPx?: number;
    onPanByDelta: (dx: number, dy: number) => void;
    /**
     * Click-drag on the minimap outside the viewport frame: centre `(nx,ny)` then continue as a drag session.
     * Return clamped `{ tx, ty }` applied, or `undefined` if nothing changed.
     */
    onJumpToNatural?: (nx: number, ny: number) => {
        tx: number;
        ty: number;
    } | undefined;
    onUserActivity?: () => void;
    /** Fires when the user starts / ends dragging the viewport frame (for disabling main-image transition). */
    onDragChange?: (dragging: boolean) => void;
    ariaLabel: string;
    /** Hover help for the minimap control (delayed tooltip). */
    minimapTooltip: string;
}
/**
 * Renders the overflow minimap and handles viewport-frame dragging.
 *
 * **Pointer session:** After `preventDefault()` on `pointerdown`, Chromium may not emit `mouseup`. The drag
 * must end via `pointerup` / `pointercancel` on `window` (capture). See `docs/minimap.md`.
 *
 * **Pan mapping:** Uses `panDeltaFromMinimapPointerDelta` (Jacobian at viewport centre), not quad AABB ratios.
 */
export declare function Minimap({ imageSrc, imageSource, thumbnail, imageAlt, nw, nh, cw, ch, scale, mode, tx, ty, rotationDeg, flipH, flipV, controlsVisible, idleOpacity, bottomPx, onPanByDelta, onJumpToNatural, onUserActivity, onDragChange, ariaLabel, minimapTooltip, }: MinimapProps): import("react/jsx-runtime").JSX.Element | null;
