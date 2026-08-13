/**
 * Image preview — numeric tuning (pan visibility clamps, minimap Jacobian, etc.).
 * Prefer editing this file over scattering magic numbers across components.
 */

// ── Progressive main image (`minimapSrc` placeholder → full `src`) ───────────

/** Default crossfade (ms) when revealing the full image; `0` = instant (no flash). */
export const PROGRESSIVE_MAIN_DEFAULT_FADE_MS = 0;

/**
 * `HTMLImageElement.decode()` can hang on very large bitmaps; after this timeout we still reveal
 * the main layer (image is already `complete` from `onLoad`).
 */
export const IMAGE_DECODE_TIMEOUT_MS = 60_000;

/**
 * `new Image()` preload for dimensions — if neither `load` nor `error` fires (e.g. extreme
 * payloads), fall back so the visible &lt;img&gt; can still drive layout.
 */
export const PROGRESSIVE_PRELOAD_TIMEOUT_MS = 180_000;

/**
 * Minimum time the minimap thumbnail stays visible before swapping to the full image (progressive
 * pipeline). Avoids skipping the thumbnail when the full image is served from cache and decodes in
 * the same frame as the first open.
 */
export const MIN_PROGRESSIVE_THUMB_VISIBLE_MS = 160;

// ── ←/→ hold navigation (`useThumbPacedNavigation`) ─────────────────────────

/**
 * Time a key/pointer must stay down before continuous advance starts.
 * @deprecated Prefer {@link NAV_HOLD_MIN_VISIBLE_MS} — first step is immediate; further
 * steps wait until each image has been visible for min-visible, then re-check hold.
 */
export const NAV_HOLD_REPEAT_DELAY_MS = 450;

/**
 * Minimum interval between auto-steps while holding (after {@link NAV_HOLD_REPEAT_DELAY_MS}).
 * @deprecated Prefer {@link NAV_HOLD_MIN_VISIBLE_MS}.
 */
export const NAV_HOLD_MIN_STEP_INTERVAL_MS = 220;

/**
 * After the first ←/→ step on key/pointer down, each subsequent image must show
 * **painted** stage content (thumb underlay bitmap or full original) at least this
 * long before another step is allowed — and only if the key/pointer is still held.
 * Default for {@link ImagePreviewProps.holdMinVisibleMs}.
 */
export const NAV_HOLD_MIN_VISIBLE_MS = 300;

/**
 * @deprecated Prefer 1×1 opaque keep-alive (`DisplayStageLayers`). Kept for any host
 * code that still imports the constant; stage layers no longer use translucent full frames.
 */
export const DISPLAY_LAYER_KEEPALIVE_OPACITY = 0.02;

// ── Viewport pan clamp (`useImageTransform`, axis-aligned overlap model) ─────

/** Main image drag: min fraction of viewport **width** and **height** that must show image. */
export const MAIN_DRAG_MIN_VIEWPORT_COVERAGE = 0.5;

/**
 * Minimap viewport drag: max fraction of viewport **width** and **height** that may show frosted
 * background (each axis in the same model). `0.1` → at least 90% coverage when the image allows.
 */
export const MINIMAP_PAN_MAX_VIEWPORT_BACKGROUND_FRACTION = 0.1;

/** Min coverage for minimap-driven `panByDelta`; derived from the background cap above. */
export const MINIMAP_PAN_MIN_VIEWPORT_COVERAGE =
  1 - MINIMAP_PAN_MAX_VIEWPORT_BACKGROUND_FRACTION;

/** Toolbar / wheel zoom translate correction: same as main-image drag. */
export const ZOOM_CLAMP_MIN_VIEWPORT_COVERAGE = MAIN_DRAG_MIN_VIEWPORT_COVERAGE;

/**
 * Keyboard pan step in native mode: each `Shift + Arrow` moves by this fraction of the
 * current viewport's shorter side (width/height).
 */
export const KEYBOARD_PAN_STEP_VIEWPORT_FRACTION = 0.08;

// ── Wheel zoom (`ImagePreview` overlay) ──────────────────────────────────────

/**
 * Accumulated pixel-mode `deltaY` before advancing **one** zoom stop (smooth trackpads).
 * Many mice report **small** `|deltaY|` per detent (e.g. 2–8); keep this low so 1–2 notches
 * cross the threshold. Fast flicks use the notch band or large-delta accumulation instead.
 */
export const WHEEL_ACCUM_PIXELS_PER_STOP = 3;

/**
 * When `deltaMode === DOM_DELTA_PIXEL`, `|deltaY|` in this band ⇒ **one** zoom stop per event
 * (typical “one big notch” reporting, ~40–120px).
 */
export const WHEEL_PIXEL_MOUSE_NOTCH_MIN = 16;
export const WHEEL_PIXEL_MOUSE_NOTCH_MAX = 220;

/**
 * Mice that report **small** pixel deltas per detent: if `|deltaY|` is in
 * `[COALESCE_MIN_DELTA, NOTCH_MIN)` and the previous wheel event was at least **GAP_MS** ago,
 * treat this event as **one physical detent** → one stop (slow click‑by‑click scrolling).
 * Ignores ultra‑tiny deltas so smooth trackpads don’t get one‑stop‑per‑pixel when events are sparse.
 */
export const WHEEL_PIXEL_COALESCE_GAP_MS = 90;
export const WHEEL_PIXEL_COALESCE_MIN_DELTA = 2;

/** Scale `deltaY` when `deltaMode === DOM_DELTA_PAGE` (rare). */
export const WHEEL_PAGE_DELTA_SCALE = 600;

/**
 * Max discrete stops applied per drain pass (one sync handler + one rAF continuation).
 * Avoids blocking the main thread on huge bursts.
 */
export const WHEEL_MAX_STEPS_PER_DRAIN = 10;

// ── Toolbar zoom label (`Toolbar` / `ZoomInput`) ───────────────────────────────

/** Fixed width (px) of the zoom % slot — fits `800%` + padding (tabular digits). */
export const TOOLBAR_ZOOM_LABEL_SLOT_PX_EN = 56;

/** Same as EN: numeric labels use Western digits in zh UI too. */
export const TOOLBAR_ZOOM_LABEL_SLOT_PX_ZH = 56;

/** Resolve slot width from BCP 47 tag (same primary-subtag rule as `resolveStrings`). */
export function toolbarZoomLabelSlotPx(language?: string): number {
  const primary = language?.split(/[-_]/)[0].toLowerCase();
  return primary === 'zh' ? TOOLBAR_ZOOM_LABEL_SLOT_PX_ZH : TOOLBAR_ZOOM_LABEL_SLOT_PX_EN;
}

/** Fixed width (px) of the zoom preset dropdown — wider than the narrow % trigger. */
export const ZOOM_DROPDOWN_WIDTH_PX_EN = 110;

/** Chinese “适应 (约 n%)” row needs a bit more horizontal room. */
export const ZOOM_DROPDOWN_WIDTH_PX_ZH = 136;

export function toolbarZoomDropdownWidthPx(language?: string): number {
  const primary = language?.split(/[-_]/)[0].toLowerCase();
  return primary === 'zh' ? ZOOM_DROPDOWN_WIDTH_PX_ZH : ZOOM_DROPDOWN_WIDTH_PX_EN;
}

/** Zoom dropdown: max width when viewport is narrow (rows use ellipsis). ≥ zh dropdown width. */
export const ZOOM_DROPDOWN_MAX_WIDTH_PX = 160;

/** Min width for the `current / total` counter between prev/next (tabular digits). */
export const TOOLBAR_NAV_COUNTER_MIN_WIDTH_PX = 52;

// ── Classic thumbnail strip (`ThumbnailsStrip`) ─────────────────────────────

/** Thumbnail tile height inside the bottom strip (px). */
export const THUMBNAIL_STRIP_HEIGHT_PX = 56;

/** Horizontal gap between thumbnail tiles (px). */
export const THUMBNAIL_STRIP_GAP_PX = 6;

/** Strip outer horizontal padding (px). */
export const THUMBNAIL_STRIP_PADDING_X_PX = 16;

/** Strip vertical padding above/below tiles inside the glass pill (px). */
export const THUMBNAIL_STRIP_PADDING_Y_PX = 8;

/** Distance from the viewport bottom to the compact (pill) strip (px). */
export const THUMBNAIL_STRIP_BOTTOM_INSET_PX = 12;

/** Gap between the thumbnail strip and the toolbar — matches toolbar badge gap (5px). */
export const THUMBNAIL_STRIP_TOOLBAR_GAP_PX = 5;

/** Corner radius for the compact pill; full-width mode uses top corners only. */
export const THUMBNAIL_STRIP_RADIUS_PX = 10;

/** Active tile border width (px). */
export const THUMBNAIL_STRIP_ACTIVE_BORDER_PX = 2;

/** Opacity for non-active tiles in the strip. */
export const THUMBNAIL_STRIP_INACTIVE_OPACITY = 0.55;

/**
 * Windowed virtualization kicks in when `entryCount > visibleCapacity * multiplier`.
 * `visibleCapacity = max(1, floor(viewportWidth / tileStride))` where tileStride includes
 * tile + gap + border.
 */
export const THUMBNAIL_STRIP_VIRTUALIZE_VIEWPORT_MULTIPLIER = 3;

/** Extra tiles rendered on each side of the visible window. */
export const THUMBNAIL_STRIP_VIRTUAL_OVERSCAN = 8;

/** Stride (px) per thumbnail tile including gap and border. */
export function thumbnailStripTileStridePx(): number {
  return THUMBNAIL_STRIP_HEIGHT_PX + THUMBNAIL_STRIP_ACTIVE_BORDER_PX * 2 + THUMBNAIL_STRIP_GAP_PX;
}

/**
 * Whether the strip should use windowed virtualization for the given entry count and viewport.
 * Returns false until viewport width is known (0) so short lists render all tiles for real.
 */
export function shouldVirtualizeThumbnailStrip(entryCount: number, viewportWidthPx: number): boolean {
  if (entryCount <= 1 || viewportWidthPx <= 0) return false;
  const stride = thumbnailStripTileStridePx();
  const visibleCapacity = Math.max(1, Math.floor(viewportWidthPx / stride));
  return entryCount > visibleCapacity * THUMBNAIL_STRIP_VIRTUALIZE_VIEWPORT_MULTIPLIER;
}

/** Total vertical space reserved at the bottom for the strip (toolbar / minimap lift). */
export function thumbnailStripTotalHeightPx(entryCount: number): number {
  if (entryCount <= 1) return 0;
  return (
    THUMBNAIL_STRIP_BOTTOM_INSET_PX
    + THUMBNAIL_STRIP_PADDING_Y_PX * 2
    + THUMBNAIL_STRIP_HEIGHT_PX
  );
}

// ── Minimap pointer ↔ pan Jacobian (`minimapMath`) ───────────────────────────

/** Step (container px) for ∂m/∂tx, ∂m/∂ty finite differences. */
export const MINIMAP_JACOBIAN_EPS = 0.25;
