/**
 * Image preview — numeric tuning (pan visibility clamps, minimap Jacobian, etc.).
 * Prefer editing this file over scattering magic numbers across components.
 */
/**
 * Time a key/pointer must stay down before continuous advance starts.
 * The first step remains immediate; this only gates the first continuation.
 */
export declare const NAV_HOLD_REPEAT_DELAY_MS = 300;
/**
 * Minimum interval between auto-steps while holding (after {@link NAV_HOLD_REPEAT_DELAY_MS}).
 * @deprecated Prefer {@link NAV_HOLD_MIN_VISIBLE_MS}.
 */
export declare const NAV_HOLD_MIN_STEP_INTERVAL_MS = 220;
/**
 * After the first ←/→ step on key/pointer down, each subsequent image must show
 * **painted** stage content (thumb underlay bitmap or full original) at least this
 * long before another step is allowed — and only if the key/pointer is still held.
 * Default for {@link ImagePreviewProps.holdMinVisibleMs}.
 */
export declare const NAV_HOLD_MIN_VISIBLE_MS = 200;
/** Main image drag: min fraction of viewport **width** and **height** that must show image. */
export declare const MAIN_DRAG_MIN_VIEWPORT_COVERAGE = 0.5;
/**
 * Minimap viewport drag: max fraction of viewport **width** and **height** that may show frosted
 * background (each axis in the same model). `0.1` → at least 90% coverage when the image allows.
 */
export declare const MINIMAP_PAN_MAX_VIEWPORT_BACKGROUND_FRACTION = 0.1;
/** Min coverage for minimap-driven `panByDelta`; derived from the background cap above. */
export declare const MINIMAP_PAN_MIN_VIEWPORT_COVERAGE: number;
/** Toolbar / wheel zoom translate correction: same as main-image drag. */
export declare const ZOOM_CLAMP_MIN_VIEWPORT_COVERAGE = 0.5;
/**
 * Keyboard pan step in native mode: each `Ctrl/Command + Arrow` (or legacy
 * `Shift + Arrow`) moves by this fraction of the current viewport's shorter side.
 */
export declare const KEYBOARD_PAN_STEP_VIEWPORT_FRACTION = 0.15;
/**
 * Accumulated pixel-mode `deltaY` before advancing **one** zoom stop (smooth trackpads).
 * Many mice report **small** `|deltaY|` per detent (e.g. 2–8); keep this low so 1–2 notches
 * cross the threshold. Fast flicks use the notch band or large-delta accumulation instead.
 */
export declare const WHEEL_ACCUM_PIXELS_PER_STOP = 3;
/**
 * When `deltaMode === DOM_DELTA_PIXEL`, `|deltaY|` in this band ⇒ **one** zoom stop per event
 * (typical “one big notch” reporting, ~40–120px).
 */
export declare const WHEEL_PIXEL_MOUSE_NOTCH_MIN = 16;
export declare const WHEEL_PIXEL_MOUSE_NOTCH_MAX = 220;
/**
 * Mice that report **small** pixel deltas per detent: if `|deltaY|` is in
 * `[COALESCE_MIN_DELTA, NOTCH_MIN)` and the previous wheel event was at least **GAP_MS** ago,
 * treat this event as **one physical detent** → one stop (slow click‑by‑click scrolling).
 * Ignores ultra‑tiny deltas so smooth trackpads don’t get one‑stop‑per‑pixel when events are sparse.
 */
export declare const WHEEL_PIXEL_COALESCE_GAP_MS = 90;
export declare const WHEEL_PIXEL_COALESCE_MIN_DELTA = 2;
/** Scale `deltaY` when `deltaMode === DOM_DELTA_PAGE` (rare). */
export declare const WHEEL_PAGE_DELTA_SCALE = 600;
/**
 * Max discrete stops applied per drain pass (one sync handler + one rAF continuation).
 * Avoids blocking the main thread on huge bursts.
 */
export declare const WHEEL_MAX_STEPS_PER_DRAIN = 10;
/** Fixed width (px) of the zoom % slot — fits `800%` + padding (tabular digits). */
export declare const TOOLBAR_ZOOM_LABEL_SLOT_PX_EN = 56;
/** Same as EN: numeric labels use Western digits in zh UI too. */
export declare const TOOLBAR_ZOOM_LABEL_SLOT_PX_ZH = 56;
/** Resolve slot width from BCP 47 tag (same primary-subtag rule as `resolveStrings`). */
export declare function toolbarZoomLabelSlotPx(language?: string): number;
/** Fixed width (px) of the zoom preset dropdown — wider than the narrow % trigger. */
export declare const ZOOM_DROPDOWN_WIDTH_PX_EN = 110;
/** Chinese “适应 (约 n%)” row needs a bit more horizontal room. */
export declare const ZOOM_DROPDOWN_WIDTH_PX_ZH = 136;
export declare function toolbarZoomDropdownWidthPx(language?: string): number;
/** Zoom dropdown: max width when viewport is narrow (rows use ellipsis). ≥ zh dropdown width. */
export declare const ZOOM_DROPDOWN_MAX_WIDTH_PX = 160;
/** Min width for the `current / total` counter between prev/next (tabular digits). */
export declare const TOOLBAR_NAV_COUNTER_MIN_WIDTH_PX = 52;
/** Thumbnail tile height inside the bottom strip (px). */
export declare const THUMBNAIL_STRIP_HEIGHT_PX = 56;
/** Horizontal gap between thumbnail tiles (px). */
export declare const THUMBNAIL_STRIP_GAP_PX = 6;
/** Strip outer horizontal padding (px). */
export declare const THUMBNAIL_STRIP_PADDING_X_PX = 16;
/** Strip vertical padding above/below tiles inside the glass pill (px). */
export declare const THUMBNAIL_STRIP_PADDING_Y_PX = 8;
/** Distance from the viewport bottom to the compact (pill) strip (px). */
export declare const THUMBNAIL_STRIP_BOTTOM_INSET_PX = 12;
/** Gap between the thumbnail strip and the toolbar — matches toolbar badge gap (5px). */
export declare const THUMBNAIL_STRIP_TOOLBAR_GAP_PX = 5;
/** Corner radius for the compact pill; full-width mode uses top corners only. */
export declare const THUMBNAIL_STRIP_RADIUS_PX = 10;
/** Active tile border width (px). */
export declare const THUMBNAIL_STRIP_ACTIVE_BORDER_PX = 2;
/**
 * Windowed virtualization kicks in when `entryCount > visibleCapacity * multiplier`.
 * `visibleCapacity = max(1, floor(viewportWidth / tileStride))` where tileStride includes
 * tile + gap + border.
 */
export declare const THUMBNAIL_STRIP_VIRTUALIZE_VIEWPORT_MULTIPLIER = 3;
/** Extra tiles rendered on each side of the visible window. */
export declare const THUMBNAIL_STRIP_VIRTUAL_OVERSCAN = 8;
/** Stride (px) per thumbnail tile including gap and border. */
export declare function thumbnailStripTileStridePx(): number;
/**
 * Whether the strip should use windowed virtualization for the given entry count and viewport.
 * Returns false until viewport width is known (0) so short lists render all tiles for real.
 */
export declare function shouldVirtualizeThumbnailStrip(entryCount: number, viewportWidthPx: number): boolean;
/** Total vertical space reserved at the bottom for the strip (toolbar / minimap lift). */
export declare function thumbnailStripTotalHeightPx(entryCount: number): number;
/** Step (container px) for ∂m/∂tx, ∂m/∂ty finite differences. */
export declare const MINIMAP_JACOBIAN_EPS = 0.25;
