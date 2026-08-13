export type ZoomMode = 'fit' | 'native';

/** Native zoom percentage: 100 means 1 CSS pixel = 1 image pixel. */
export type NativePercent = number;

export interface ZoomState {
  mode: ZoomMode;
  /** Only meaningful when mode === 'native'. */
  nativePercent: NativePercent;
  /** Approximate native% equivalent of the current fit scale. Available once image is loaded. */
  fitEquivalentNativePercent?: number;
}

/**
 * EXIF group ids used by the info panel tabs and field ordering.
 * Upstream may assign {@link ImageExifExtraEntry.group}; unknown groups fall into `'other'`.
 */
export type ExifGroupId = 'file' | 'camera' | 'exposure' | 'gps' | 'other';

/** Scalar value for a single EXIF field. Empty / nullish values are hidden in the panel. */
export type ExifValue = string | number | boolean | null | undefined;

/**
 * Optional custom EXIF row from upstream (Node / Python / Rust, etc.).
 * Prefer well-known {@link ImageExif} keys when possible so labels and order stay consistent.
 */
export interface ImageExifExtraEntry {
  /** Machine key (also used as fallback label when {@link label} is omitted). */
  key: string;
  /** Display label; when omitted the panel shows {@link key}. */
  label?: string;
  value: ExifValue;
  /** Target group; defaults to `'other'`. */
  group?: ExifGroupId;
}

/**
 * Host-provided EXIF / image metadata for one picture.
 * The library does **not** parse image bytes; fill this from your desktop/backend pipeline.
 * Empty fields are omitted from the panel; known keys use a fixed order within each group.
 */
export interface ImageExif {
  // ── File / image ──────────────────────────────────────────────────────────
  fileName?: ExifValue;
  /** Prefer a pre-formatted string (e.g. `"2.4 MB"`). */
  fileSize?: ExifValue;
  mimeType?: ExifValue;
  width?: ExifValue;
  height?: ExifValue;
  colorSpace?: ExifValue;
  orientation?: ExifValue;

  // ── Camera ────────────────────────────────────────────────────────────────
  make?: ExifValue;
  model?: ExifValue;
  lens?: ExifValue;
  software?: ExifValue;
  dateTimeOriginal?: ExifValue;
  dateTimeDigitized?: ExifValue;
  createDate?: ExifValue;

  // ── Exposure ──────────────────────────────────────────────────────────────
  /** e.g. `"1/250"`. */
  exposureTime?: ExifValue;
  /** e.g. `"f/2.8"`. */
  fNumber?: ExifValue;
  iso?: ExifValue;
  /** e.g. `"50 mm"`. */
  focalLength?: ExifValue;
  focalLength35mm?: ExifValue;
  exposureProgram?: ExifValue;
  meteringMode?: ExifValue;
  flash?: ExifValue;
  whiteBalance?: ExifValue;
  exposureBias?: ExifValue;

  // ── GPS ───────────────────────────────────────────────────────────────────
  gpsLatitude?: ExifValue;
  gpsLongitude?: ExifValue;
  gpsAltitude?: ExifValue;

  /** Extra rows that do not map to the well-known keys above. */
  extra?: ImageExifExtraEntry[];
}

export interface ImageItem {
  /**
   * Stable unique key for the item (e.g. file path). Prefer this over {@link name} for identity:
   * names can repeat or change when renamed.
   */
  id?: string;
  src: string;
  alt?: string;
  /** Filename displayed in the info bar above the toolbar. */
  name?: string;
  /**
   * Optional URL for the navigation minimap (e.g. external pre-generated thumbnail).
   * Defaults to {@link src}. Ignored when {@link minimap} is set.
   */
  minimapSrc?: string;
  /**
   * Optional custom minimap content (e.g. `<img />`). When set, replaces the default minimap image;
   * layout still follows the main image’s natural aspect ratio, rotation, and flips. Overrides {@link minimapSrc}.
   */
  minimap?: React.ReactNode;
  /**
   * Optional host-parsed EXIF / metadata for this image.
   * Shown in the EXIF panel when {@link ImagePreviewProps.showExif} is enabled.
   */
  exif?: ImageExif;
}

/**
 * A named album/folder segment: its {@link images} are concatenated in order to form the flat list.
 * Prefer this over maintaining manual index ranges.
 */
export interface ImageGroup {
  /** Optional stable id (e.g. directory path). */
  id?: string;
  /** Display name shown in the toolbar (folder / album label). */
  name: string;
  images: ImageItem[];
}

/**
 * Strategy when zooming in from Fit mode.
 * - 'above-fit': snap to the smallest stop strictly greater than the fit-equivalent native%.
 * - 'first-stop': always start from the first (smallest) stop.
 * - 'hundred': always start from 100%.
 */
export type FirstZoomInStrategy = 'above-fit' | 'first-stop' | 'hundred';

/**
 * Behaviour when zooming out below the minimum stop.
 * - 'fit': switch back to Fit mode.
 * - 'noop': do nothing.
 */
export type ZoomOutBelowMinBehaviour = 'fit' | 'noop';

/**
 * Behaviour when zooming in at the maximum stop.
 * - 'noop': do nothing.
 * - 'notify': call onMaxStopReached.
 */
export type ZoomInAtMaxBehaviour = 'noop' | 'notify';

/** Strategy for mouse-wheel zooming. */
export type WheelStrategy =
  /** Each wheel tick moves ±1 stop. */
  | 'stop-by-stop'
  /** Continuous scaling that snaps to the nearest stop on wheel end. */
  | 'snap';

/**
 * Controls **side-of-image** navigation arrows only (left/right of the picture).
 *
 * - `'both'`    — side arrows **and** toolbar prev/next (default).
 * - `'side'`    — side arrows only; toolbar still has prev/next on flat lists (counter sits between them).
 * - `'toolbar'` — toolbar prev/next only; no side arrows.
 * - `'none'`    — no side arrows; keyboard ← → still works.
 *
 * When {@link ImagePreviewProps.groupedImages} is non-empty (**folder / multi-group mode**), toolbar prev/next are **always** shown;
 * this prop no longer hides them — only the side arrows obey the table above.
 */
export type ArrowsConfig = 'both' | 'side' | 'toolbar' | 'none';

/**
 * Which images appear in the bottom thumbnail strip when {@link ImagePreviewProps.showThumbnails} is true.
 *
 * - `'group'` (default) — with {@link groupedImages}, only the current group; flat lists = whole list.
 * - `'flat'` — full flattened navigation sequence (same order as ←/→ / `onIndexChange`).
 */
export type ThumbnailsScope = 'group' | 'flat';

/**
 * How the preview is mounted in the page.
 *
 * - `'overlay'` (default) — fixed fullscreen dialog (`aria-modal`), focus on open, window keyboard.
 * - `'contained'` — fills a positioned host container; not page-modal; keyboard only while focused.
 */
export type PresentationMode = 'overlay' | 'contained';

/**
 * Chrome density for chrome controls (toolbar, side arrows, close, strip).
 *
 * - `'default'` — existing auto-fade to ~10% opacity after idle.
 * - `'minimal'` — same idle timer, but idle chrome fades to fully hidden (0%) for a cleaner view.
 */
export type ChromeDensity = 'default' | 'minimal';

/** Neighbor preload / session-warm phase for thumbnail strip indicators. */
export type NeighborPreloadPhase =
  | 'loading'
  | 'ready'
  | 'warm'
  /**
   * Full `src` loaded **and** `decode()` settled in a display preload slot —
   * navigating here uses fast reveal (no dwell/spinner; underlay until viewport drawable).
   */
  | 'display-ready'
  | 'error';

export interface NeighborPreloadEntry {
  phase: NeighborPreloadPhase;
  /**
   * 0–1 fill when byte progress is known (`loading` / `ready` only).
   * Omitted while loading without % → UI shows a ⅓ green fill until `ready`.
   */
  progress?: number;
}

/**
 * Flat-index → status for the thumbnail strip / host debug.
 * - `loading` / `ready`: byte-level neighbor preload (HTTP cache likely for `ready`).
 * - `display-ready`: neighbor load+decode settled — navigating here uses fast reveal
 *   (no artificial placeholder dwell / spinner; minimap underlay stays until the viewport
 *   main `<img>` is drawable). Slot layers paint **1×1 opaque** so WKWebView does
 *   not discard decoded bitmaps (`opacity: 0` / full-frame translucent ghosts are avoided).
 * - `warm`: bytes succeeded earlier this session, outside the window (not display-ready).
 */
export type NeighborPreloadStatusMap = Readonly<Record<number, NeighborPreloadEntry>>;

/**
 * How neighbor **display** preload keeps decoded bitmaps.
 * - `'slot'` (default): retained stage `<img>` + `decode()` + 1×1 opaque keep-alive.
 * - `'decode'`: `Image()` + `decode()` only, no retained layer (approach B fallback).
 */
export type PreloadDisplayMode = 'slot' | 'decode';

/**
 * Stages for the optional progressive main-image pipeline (`minimapSrc` thumbnail
 * underlay until the full `src` has loaded in the DOM). Used by {@link ImagePreviewProps.onMainImageLoadStageChange}.
 */
export type MainImageLoadStage =
  | 'inactive'
  | 'preloading'
  | 'thumbnail-placeholder'
  /** Full `src` failed to load/decode, but `minimapSrc` succeeded — main area shows thumbnail only. */
  | 'thumb-only'
  | 'full-ready'
  | 'error';

/**
 * Initial picture when using {@link ImagePreviewProps.groupedImages}.
 * `defaultGroupIndex` is the index among groups that have `images.length > 0` only, in array order (skipped empty groups are not counted).
 */
export interface DefaultGroupedSelection {
  defaultGroupIndex: number;
  /** 0-based index within that group's `images` array. */
  defaultIndexInGroup: number;
}

export interface ImagePreviewProps {
  // ── Data ──────────────────────────────────────────────────────────────────
  /** Single image shorthand. Ignored when `images` or non-empty `groupedImages` is provided. */
  src?: string;
  alt?: string;
  /**
   * Single-image minimap URL (only when using `src`, not `images`). Same as {@link ImageItem.minimapSrc}.
   */
  minimapSrc?: string;
  /**
   * Single-image custom minimap node (only when using `src`). Same as {@link ImageItem.minimap}.
   */
  minimap?: React.ReactNode;
  /**
   * Single-image EXIF / metadata (only when using `src`). Same as {@link ImageItem.exif}.
   */
  exif?: ImageExif;
  /**
   * Flat list of images. Ignored when `src` is not used if {@link groupedImages} is non-empty.
   * Ignored when `groupedImages` is provided (see priority there).
   */
  images?: ImageItem[];
  /**
   * Folder-style input: each entry’s `images` are concatenated in order. Left/right arrows stay within
   * the current group; toolbar shows prev/next-group when there are multiple groups.
   * When set (non-empty), it takes precedence over {@link images}.
   */
  groupedImages?: ImageGroup[];
  /**
   * Controlled visibility. Omit together with `onOpenChange` (and usually `onClose`) when using
   * **trigger mode** — pass a single {@link children} element and the preview manages open/close internally.
   */
  visible?: boolean;
  /**
   * Initial image when using non-empty {@link groupedImages}: which group and which item inside that group.
   * Takes precedence over {@link defaultIndex} in that mode.
   */
  defaultGroupedSelection?: DefaultGroupedSelection;
  /**
   * Initial visible index in the **flattened** list (single `src`, flat `images`, or derived from `groupedImages`).
   * When {@link defaultGroupedSelection} is set and groups exist, this prop is ignored.
   */
  defaultIndex?: number;

  // ── Zoom configuration ────────────────────────────────────────────────────
  /**
   * Discrete native-percent zoom stops.
   * Must be sorted ascending and contain at least one value.
   * Default: [10, 25, 50, 75, 100, 125, 150, 175, 200] (max 200 % — higher ratios are usually too soft for preview).
   */
  stops?: NativePercent[];
  /** Initial zoom mode. Default: 'fit'. */
  initialMode?: ZoomMode;
  /** Initial native% when initialMode === 'native'. Default: first stop. */
  initialNativePercent?: NativePercent;

  // ── Behaviour options ──────────────────────────────────────────────────────
  firstZoomInStrategy?: FirstZoomInStrategy;
  zoomOutBelowMinBehaviour?: ZoomOutBelowMinBehaviour;
  zoomInAtMaxBehaviour?: ZoomInAtMaxBehaviour;

  /** Enable mouse-wheel zoom. Default: true. */
  wheelEnabled?: boolean;
  wheelStrategy?: WheelStrategy;

  /** Enable double-click to toggle fit ↔ 100%. Default: true. */
  doubleClickEnabled?: boolean;

  /**
   * Enable two-finger pinch-to-zoom on touch screens and multi-touch trackpads.
   * The gesture uses continuous scaling (not stop-snapped) during the pinch;
   * the midpoint between the two fingers acts as the zoom anchor.
   * Default: `true`.
   */
  pinchEnabled?: boolean;

  /**
   * Reset zoom state when switching images.
   * Default: true.
   */
  switchImageResetZoom?: boolean;

  /**
   * Reset rotation and flip when switching images.
   * Default: true.
   */
  switchImageResetTransform?: boolean;

  /**
   * Reset pan (translate) when calling fit().
   * Default: true.
   */
  fitResetPan?: boolean;

  /**
   * Show the horizontal/vertical flip buttons in the toolbar.
   * Default: false (flip is available but hidden by default to keep the toolbar compact).
   */
  showFlip?: boolean;

  /**
   * Show the EXIF / metadata toggle in the toolbar.
   * When on, the user can open a draggable edge-snapped panel fed by {@link ImageItem.exif}
   * (or the top-level {@link ImagePreviewProps.exif} in single-`src` mode).
   * Default: `false`.
   */
  showExif?: boolean;

  /**
   * When {@link showExif} is true, open the EXIF panel on first mount.
   * Default: `false`.
   */
  initialExifOpen?: boolean;

  /**
   * Show a delete control in the toolbar (useful for desktop / host apps that own the file list).
   * Default: `false`. Deleting does **not** mutate props — the host must remove the item from
   * {@link images} / {@link groupedImages} in {@link onDeleteImage}. The viewer then moves focus
   * to the next image (or previous when deleting the last), and closes when none remain.
   */
  showDelete?: boolean;

  /**
   * Which **side** arrow buttons to render. Toolbar prev/next in multi-group mode (`groupedImages`) are always on.
   * Default: `'both'`. See `ArrowsConfig`.
   */
  arrows?: ArrowsConfig;

  /**
   * Initial zoom-lock state. When true, switching images preserves the current zoom
   * mode and percentage instead of resetting to fit.
   * The user can toggle this in the toolbar via the lock icon.
   * Default: false.
   */
  initialZoomLocked?: boolean;

  /**
   * When true (default), show a bottom-right navigation minimap whenever the image
   * overflows the viewport in Native zoom mode. The dashed frame tracks pan/zoom/rotate;
   * dragging inside the frame pans the main image.
   */
  showMinimap?: boolean;

  /**
   * Show the bottom horizontal thumbnail strip. Default: `false`.
   * Hidden automatically when the navigable set has at most one image.
   */
  showThumbnails?: boolean;

  /**
   * Which images appear in the strip when {@link showThumbnails} is true.
   * Default: `'group'`. See {@link ThumbnailsScope}.
   */
  thumbnailsScope?: ThumbnailsScope;

  /**
   * Mount mode. Default: `'overlay'` (fullscreen modal dialog).
   * Use `'contained'` to fill a positioned host container without page-modal semantics.
   * See {@link PresentationMode}.
   */
  presentation?: PresentationMode;

  /**
   * Preload full `src` for neighbors within this flat-index radius of the current image.
   * Default `1` (current ±1). Pass `0` to disable neighbor byte preload.
   * Byte preload alone does **not** skip {@link progressiveMain}; see {@link preloadDisplaySlots}.
   */
  preloadRadius?: number;

  /**
   * Max number of **neighbor** images to keep display-ready (decoded) at once.
   * `0` (default) — no display-ready pool **unless** {@link preloadMemoryBudgetBytes} is set
   * (then a ceiling of 6 applies and the budget decides how many fill).
   * `2` ≈ keep current±1 when they fall inside {@link preloadRadius}.
   * Ignored when {@link preloadRadius} is `0`.
   */
  preloadDisplaySlots?: number;

  /**
   * Debounce (ms) after navigation before starting **neighbor** display-ready preload.
   * Further ←/→ within this window cancels the pending warm-up so rapid scrubbing does not
   * decode dozens of full originals. Default `600`. Does **not** delay decoding the current
   * main image — after a long stay on N, one click to N+1 still aims for instant sharp when
   * that neighbor was already warmed.
   */
  preloadDisplaySettleMs?: number;

  /**
   * While holding ←/→ (keyboard or side arrows): after the **first** immediate step, each
   * landed image must show **painted** main-stage content (thumb underlay bitmap, or full
   * original when there is no thumb) — not merely layout size / progressive stage — for at
   * least this many ms before another step is allowed, and only if still held. Release cancels
   * the single pending timer (no step queue). When omitted, uses `NAV_HOLD_MIN_VISIBLE_MS`
   * (defined once in `imagePreviewTuning`). Hosts may expose this in settings.
   */
  holdMinVisibleMs?: number;

  /**
   * Decoded-bitmap byte budget for **neighbor** display-ready slots (not including the current
   * main image). With {@link estimateDecodedBytes}, the viewer picks the nearest neighbors that
   * fit. Props can stay fixed while browsing mixed-size folders — slot count adapts per index.
   * When set and {@link preloadDisplaySlots} is `0`, a default ceiling of 6 is used.
   */
  preloadMemoryBudgetBytes?: number;

  /**
   * Estimate decoded size for budget capping. Default: EXIF width×height×4 when present,
   * else a conservative 12 MP RGBA guess.
   */
  estimateDecodedBytes?: (item: ImageItem) => number;

  /**
   * Display-preload strategy. Default: `'slot'` (offscreen imgs). Use `'decode'` to fall back
   * to decode-only short-circuit without keeping compositor layers.
   */
  preloadDisplayMode?: PreloadDisplayMode;

  /**
   * Optional hook listing flat indexes currently targeted by neighbor preload (for tests / debug).
   * Does not include the current index.
   */
  onPreloadIndexesChange?: (indexes: number[]) => void;

  /**
   * Optional hook for neighbor preload phase / progress (byte + display-ready).
   * `display-ready` means decode settled — navigating there uses fast reveal (underlay until
   * the viewport main image is drawable; not a blank stage).
   * Built-in strip bars also need {@link showThumbnailPreloadStatus}.
   */
  onPreloadStatusChange?: (status: NeighborPreloadStatusMap) => void;

  /**
   * When true, thumbnail tiles show bottom-edge indicators for preload status. Default: `false`.
   * **Blue** = neighbor in the active slot window **and** decode settled (instant-switch).
   * Being a neighbor alone is never enough — still-loading neighbors stay gray/green progress.
   * **Green** = byte-ready / session-warm (cache hint only, not guaranteed instant).
   * The **current** thumbnail has no preload bar (active border is enough).
   */
  showThumbnailPreloadStatus?: boolean;

  /**
   * Show the center L4 ring spinner while switching images (outgoing hold / waiting for the
   * next main frame to become drawable). Default: `true`. Set `false` to hide that feedback
   * without changing hold / reveal timing.
   */
  showSwitchLoader?: boolean;

  /**
   * Control chrome density. Default: `'default'`. See {@link ChromeDensity}.
   */
  chrome?: ChromeDensity;

  /**
   * Controlled flat index. When set, the preview mirrors this value; navigation calls
   * {@link onIndexChange} and the host must update `index`. Omit for uncontrolled
   * (`defaultIndex` / `defaultGroupedSelection`) behaviour.
   */
  index?: number;

  /**
   * Extra content rendered at the end of the toolbar (after built-in actions).
   * Useful for host actions such as “Reveal in Finder”.
   */
  toolbarExtra?: React.ReactNode;

  /**
   * When true (default) and the current item has {@link ImageItem.minimapSrc} and no custom
   * {@link ImageItem.minimap}, the main view uses that URL as a stretched placeholder after the
   * full image dimensions are known (background preload), keeps the centre loading spinner until
   * the full `src` has loaded and decoded in the DOM, then reveals the sharp image without
   * changing the corner minimap.
   */
  progressiveMain?: boolean;
  /**
   * Minimum time (ms) the low-res {@link ImageItem.minimapSrc} placeholder stays visible in the
   * main area after the full `src` is ready to show. Lets users see a deliberate “small/blurry
   * first, then sharp” beat even when the full image loads from cache. Default matches internal
   * tuning (~160 ms). Only applies when the progressive pipeline is active.
   */
  progressivePlaceholderMinMs?: number;
  /**
   * Opacity crossfade duration (ms) when revealing the full main image over the thumbnail
   * placeholder. `0` (default) switches instantly to avoid any double-exposure flash.
   */
  progressiveFadeMs?: number;
  /** Optional hook for tests, analytics, or debugging the progressive pipeline. */
  onMainImageLoadStageChange?: (stage: MainImageLoadStage) => void;

  /**
   * Whether clicking the dark overlay backdrop (outside the image, toolbar, and info badge)
   * closes the preview, just like pressing Esc or the close button.
   * Default: `false`.
   */
  closeOnMaskClick?: boolean;

  /**
   * Custom content rendered in place of the image when it fails to load.
   * Receives the zero-based flat index and the `src` URL of the failing image.
   * When omitted, the spinner simply disappears on error and no placeholder is shown.
   *
   * @example
   * ```tsx
   * errorFallback={(index, src) => (
   *   <div style={{ color: '#fff', padding: 24 }}>
   *     Failed to load image {index + 1}
   *   </div>
   * )}
   * ```
   */
  errorFallback?: (index: number, src: string) => React.ReactNode;

  /**
   * Extra CSS class applied to the overlay backdrop element.
   * Use this to override the background, blur, or any other visual property.
   */
  overlayClassName?: string;

  /**
   * Inline style overrides merged onto the overlay backdrop element.
   * Merged after the default styles, so any property you provide takes precedence.
   * Example: `{ background: 'rgba(0,0,0,0.95)' }` to get a fully opaque black backdrop.
   */
  overlayStyle?: React.CSSProperties;

  /**
   * Preferred display language for all user-visible text (button labels,
   * aria-labels, zoom display, etc.).
   *
   * Accepts any BCP 47 language tag such as `"en"`, `"en-US"`, `"zh"`, or
   * `"zh-CN"`. Matching is performed on the primary subtag; unrecognised
   * locales fall back to English.
   *
   * Currently built-in: `"en"` (default) and `"zh"` (Simplified Chinese).
   *
   * Default: `"en"`.
   */
  language?: string;

  /**
   * Override individual strings in the resolved locale (or supply an entirely
   * new locale when all fields are provided).
   *
   * Merged on top of the locale selected by `language` — supply only the keys
   * you want to change, everything else falls back to the built-in text.
   *
   * @example
   * ```tsx
   * // Just change the close button label in an English UI
   * strings={{ close: 'Dismiss', tipClose: 'Dismiss the preview' }}
   * ```
   */
  strings?: Partial<import('./localeTypes').LocaleStrings>;

  /**
   * **Trigger mode (single {@link children})**: optional. When you omit `visible`, the preview is
   * uncontrolled: closed by default, opens on trigger click, closes on Esc / close button / mask (if allowed).
   * The container does not read the trigger’s `src` — set `src` / `images` on `ImagePreview` only.
   */
  children?: React.ReactNode;
  // ── Callbacks ──────────────────────────────────────────────────────────────
  /**
   * Fires whenever the preview should open or close (trigger mode, or controlled sync).
   * **Controlled** + `children`: set `visible` to match `open` (required to open from the trigger if `visible` is set).
   */
  onOpenChange?: (open: boolean) => void;
  onClose?: () => void;
  onZoomChange?: (state: ZoomState) => void;
  /** Active image changed; `index` is always the flattened list position (including when using `groupedImages`). */
  onIndexChange?: (index: number) => void;
  /** Called when attempting to zoom in at the maximum stop (only when zoomInAtMaxBehaviour === 'notify'). */
  onMaxStopReached?: () => void;
  /**
   * Called when the current image fails to load (`<img onError>`).
   * Receives the zero-based flat index and the `src` URL of the failing image.
   */
  onImageError?: (index: number, src: string) => void;
  /**
   * Fired when the user deletes the current image (`showDelete`).
   * Same shape spirit as {@link onImageError}: flat `index` plus the item snapshot.
   * Prefer `item.id` for durable deletes when set; otherwise splice by `index`.
   * Host must update {@link images} / {@link groupedImages} — the viewer does not mutate props.
   */
  onDeleteImage?: (index: number, item: ImageItem) => void;
}

export interface ImagePreviewRef {
  zoomIn(): void;
  zoomOut(): void;
  /** Switch to Fit mode. */
  fit(): void;
  /** Switch to Native mode at the given percentage. */
  setNative(percent: NativePercent): void;
  /** Rotate image 90° clockwise. */
  rotateCW(): void;
  /** Rotate image 90° counter-clockwise. */
  rotateCCW(): void;
  /** Flip image horizontally (left ↔ right). */
  flipHorizontal(): void;
  /** Flip image vertically (top ↔ bottom). */
  flipVertical(): void;
  /** Navigate to the next flat index (crosses groups when using `groupedImages`). */
  next(): void;
  /** Navigate to the previous flat index (crosses groups when using `groupedImages`). */
  prev(): void;
  /** Navigate to the first image of the next group (requires `groupedImages`). */
  nextGroup(): void;
  /** Navigate to the first image of the previous group (requires `groupedImages`). */
  prevGroup(): void;
  /**
   * Jump to a flat list index (clamped). In controlled `index` mode, fires {@link ImagePreviewProps.onIndexChange}
   * so the host can update `index`.
   */
  goTo(index: number): void;
  /**
   * Request browser fullscreen on the preview root. Resolves `true` on success, `false` on
   * denial / unsupported (quiet degrade — never throws).
   */
  requestFullscreen(): Promise<boolean>;
  /** Exit browser fullscreen if this preview owns it. */
  exitFullscreen(): Promise<void>;
  /** Whether the preview root is the current fullscreen element. */
  isFullscreen(): boolean;
  getState(): ZoomState;
}
