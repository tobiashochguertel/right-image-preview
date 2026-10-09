import type { MediaKind } from './core/media-kind';
import type { MediaSource } from './core/media-source';
import type { RasterPreloadPlanSnapshot } from './renderers/raster-webgl/rasterPreloadPlan';
import type { RasterRendererState } from './renderers/raster-webgl/rasterRendererState';

export type ZoomMode = 'fit' | 'native';

/** Native zoom percentage: 100 means 1 CSS pixel = 1 image pixel. */
export type NativePercent = number;
export type RasterDecodeWorkerSetting = number | 'auto';

/**
 * Fullscreen implementation supplied by the embedding host.
 *
 * When provided as {@link ImagePreviewProps.fullscreen}, this is the sole source of
 * fullscreen state and the component never calls the browser Fullscreen API.
 */
export interface FullscreenAdapter {
  isFullscreen: boolean;
  enter: () => void | Promise<void>;
  exit: () => void | Promise<void>;
}

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
  /**
   * Renderer-neutral media input. When present it is used for decode/playback while
   * `src` remains the legacy display/cache identity and DOM-thumbnail fallback.
   */
  source?: MediaSource;
  /** Host-provided kind wins over MIME, extension, and byte sniffing. */
  kind?: MediaKind;
  /** Optional content type hint, for example `image/jpeg` or `video/mp4`. */
  mimeType?: string;
  alt?: string;
  /** Filename displayed in the info bar above the toolbar. */
  name?: string;
  /**
   * Optional URL for the navigation minimap (e.g. external pre-generated thumbnail).
   * Defaults to {@link src}. Ignored when {@link minimap} is set.
   */
  minimapSrc?: string;
  /** Renderer-neutral progressive/minimap source. Takes precedence over `minimapSrc`. */
  minimapSource?: MediaSource;
  /**
   * Optional source used only by the bottom thumbnail strip. When omitted, the strip falls
   * back to the minimap/main source for backwards compatibility. Pass `null` to keep the tile
   * empty while a host generates a real thumbnail instead of loading the original image.
   */
  thumbnailSource?: MediaSource | null;
  /** URL shorthand for {@link thumbnailSource}. An explicit `null` keeps the tile empty. */
  thumbnailSrc?: string | null;
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
 * Zoom-in is never blocked: past the top stop the ladder continues
 * geometrically (each step = top stop ratio). This option only controls the
 * notification fired on the step that crosses `maxStop`.
 * - 'noop': zoom continues silently.
 * - 'notify': zoom continues and calls onMaxStopReached.
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

/** Behaviour of Shift + Arrow keyboard shortcuts. Default: `'pan'`. */
export type ShiftArrowAction = 'pan' | 'rotate';

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
  /** Browse LOD is decoded, uploaded, fence-ready, and immediately drawable. */
  | 'browse-ready'
  /**
   * Raster Screen LOD decoded for the current image-stage DIV × DPR, uploaded,
   * GPU-fence ready, and still retained in the texture cache.
   */
  | 'display-ready'
  | 'error';

export interface NeighborPreloadEntry {
  phase: NeighborPreloadPhase;
  /** Planned texture tier while the original is transferring/decoding. */
  targetLod?: 'browse' | 'screen';
  /**
   * True 0–1 transfer fill when the server exposes Content-Length.
   * Omitted for an indeterminate transfer (for example, no exposed Content-Length).
   */
  progress?: number;
  /** Bytes received by the full-original request when known. */
  loadedBytes?: number;
  /** Full response bytes when Content-Length is exposed. */
  totalBytes?: number;
  /** Actual resident GPU texture bytes for this resource when display-ready. */
  textureBytes?: number;
  /** Largest resident texture dimensions, useful for diagnostics. */
  textureWidth?: number;
  textureHeight?: number;
}

/**
 * Flat-index → status for the thumbnail strip / host debug.
 * - `loading` / `ready`: byte-level original request (HTTP cache likely for `ready`).
 * - `browse-ready`: a lower-cost immediately drawable neighbor texture is resident.
 * - `display-ready`: current-viewport Screen texture is fence-ready and resident.
 * - `warm`: bytes or a texture succeeded earlier but the GPU texture is not currently
 *   guaranteed resident; navigation may need another decode/upload.
 */
export type NeighborPreloadStatusMap = Readonly<Record<number, NeighborPreloadEntry>>;

/**
 * Renderer-neutral presentation stages exposed by
 * {@link ImagePreviewProps.onMainImageLoadStageChange}.
 */
export type MainImageLoadStage =
  | 'inactive'
  | 'preloading'
  | 'thumbnail-placeholder'
  /**
   * Main area is the thumbnail only: Full `src` failed, or known original RGBA exceeds
   * {@link ImagePreviewProps.rasterFullDecodeMaxBytes} so decode stays on `minimapSrc`.
   */
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
  /** Renderer-neutral single-media source. Takes precedence over `src` for loading. */
  source?: MediaSource;
  /** Explicit single-media kind. Takes precedence over sniffing. */
  kind?: MediaKind;
  /** Optional MIME hint for the single-media source. */
  mimeType?: string;
  alt?: string;
  /**
   * Single-image minimap URL (only when using `src`, not `images`). Same as {@link ImageItem.minimapSrc}.
   */
  minimapSrc?: string;
  /** Renderer-neutral single-media preview/minimap source. */
  minimapSource?: MediaSource;
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
   * Default: [5, 10, 20, 35, 50, 75, 100, 125, 150, 175, 200]
   * Above the top stop, wheel/keyboard zoom continues geometrically (× top-gap
   * ratio) — required because Fit can already exceed it (e.g. SVG upscaled to
   * 950%), and snapping back to maxStop on the first zoom-in feels broken.
   */
  stops?: NativePercent[];
  /** Initial zoom mode. Default: 'fit'. */
  initialMode?: ZoomMode;
  /** Initial native% when initialMode === 'native'. Default: first stop. */
  initialNativePercent?: NativePercent;
  /**
   * Cap for Fit / contain scale, expressed as native percent.
   * `100` means Fit never upscales past 1:1 (small images stay actual size, centred).
   * Omit or pass a non-positive / non-finite value to keep classic CSS-contain upscaling.
   */
  fitMaxNativePercent?: NativePercent;

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
   * Optional host-owned fullscreen adapter. When present, its `isFullscreen` value is the
   * only fullscreen state used by the toolbar, keyboard, and ref API; `enter` / `exit`
   * receive all fullscreen requests. When omitted, the component falls back to the
   * standard browser Fullscreen API when it is available.
   */
  fullscreen?: FullscreenAdapter;

  /**
   * Receives fullscreen capability, API, state-confirmation, or host-adapter failures.
   * Fullscreen errors are never silently ignored.
   */
  onFullscreenError?: (error: unknown) => void;

  /**
   * Reports the flat indexes currently mounted by the virtualized bottom strip, including
   * overscan. Desktop hosts can use this bounded window to generate thumbnails on demand.
   */
  onThumbnailVisibleIndexesChange?: (indexes: number[]) => void;

  /**
   * Mount mode. Default: `'overlay'` (fullscreen modal dialog).
   * Use `'contained'` to fill a positioned host container without page-modal semantics.
   * See {@link PresentationMode}.
   */
  presentation?: PresentationMode;

  /**
   * Behaviour of Shift + Arrow shortcuts. Default: `'pan'`.
   * - `'pan'`: all four arrows pan toward that part of the image.
   * - `'rotate'`: Shift + Left/Right rotate 90° counter-clockwise/clockwise;
   *   Shift + Up/Down keep their normal zoom behaviour.
   * Ctrl/Command + Arrow always pans and takes precedence when both modifiers are held.
   */
  shiftArrowAction?: ShiftArrowAction;

  /**
   * Raster texture warm-up range. `'auto'` walks outward in navigation-priority order and
   * admits textures one at a time until the GPU budget is reached. A number is a hard
   * flat-index radius; `0` disables GPU neighbor preload. Default: `'auto'`.
   */
  preloadRadius?: number | 'auto';

  /**
   * Safety ceiling for `'auto'` preload candidates. Actual retained count is usually lower
   * and is decided by uploaded texture bytes plus {@link preloadMemoryBudgetBytes}.
   * Default: `128`.
   */
  preloadMaxCount?: number;

  /**
   * Time the initial ←/→ key/pointer press must remain held before automatic continuation
   * may start. The first step is always immediate. Default: `300`.
   */
  holdRepeatDelayMs?: number;

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
   * Delay before the current Raster image upgrades from viewport-sized Screen LOD to
   * Full LOD. Navigation or an active ←/→ hold cancels the pending upgrade so rapidly
   * skipped images are never fully decoded. Default: `300`.
   */
  fullResolutionSettleMs?: number;

  /**
   * Maximum estimated natural RGBA8 bytes allowed for an original Full decode.
   * Larger known images stay on `minimapSource`/`minimapSrc` and show a persistent
   * notice; without a preview they fail safely instead of probing memory with a
   * bitmap allocation. Default: `1 GiB`. Hosts should pass original
   * `exif.width` / `exif.height` so the cap can be applied before decode.
   * Override or hide the banner with `strings.originalTooLargeNotice`.
   */
  rasterFullDecodeMaxBytes?: number;

  /**
   * GPU texture-cache byte budget. The current Raster texture is protected; neighbors are
   * evicted by preload priority and then approximate LRU. When omitted, a physical-display
   * heuristic uses 192/256/384/512/768 MiB tiers (4K = 512 MiB).
   */
  preloadMemoryBudgetBytes?: number;

  /**
   * Dedicated Worker count for Raster Blob → ImageBitmap decode. `'auto'` derives a
   * conservative 1–3 workers from logical CPU concurrency. Default: `'auto'`.
   */
  rasterDecodeWorkers?: RasterDecodeWorkerSetting;

  /**
   * Safety cap applied to automatic and explicit Raster decode concurrency.
   * Values are clamped to the implementation hard maximum of 3. Default: `3`.
   */
  rasterDecodeWorkerMax?: number;

  /**
   * Optional hook listing flat indexes currently targeted by neighbor preload (for tests / debug).
   * Does not include the current index.
   */
  onPreloadIndexesChange?: (indexes: number[]) => void;

  /**
   * Optional hook for neighbor preload phase / progress.
   * `display-ready` means the upload fence completed and the texture remains GPU-resident;
   * navigating there atomically selects the sharp texture without a loading spinner.
   * Built-in strip bars also need {@link showThumbnailPreloadStatus}.
   */
  onPreloadStatusChange?: (status: NeighborPreloadStatusMap) => void;

  /** Development/diagnostic snapshot of the viewport-driven Raster LOD planner. */
  onRasterPreloadPlanChange?: (snapshot: RasterPreloadPlanSnapshot) => void;

  /**
   * Reports the current static Raster renderer route and WebGL capability snapshot.
   * Fires for the WebGL2 fast path, every fallback reason, context loss/restoration,
   * and a successful return to WebGL2. Hosts must not inspect private DOM to infer it.
   */
  onRasterRendererStateChange?: (state: RasterRendererState) => void;

  /**
   * When true, thumbnail tiles show bottom-edge indicators for preload status. Default: `false`.
   * **Blue** = neighbor texture is GPU-resident and display-ready (instant switch).
   * **Green** = byte/session warm or an evicted texture (not guaranteed instant).
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
   * full image is ready, uploads it as a WebGL Preview texture, and then replaces it atomically
   * with the Screen texture. It does not mount a main-stage `<img>`.
   */
  progressiveMain?: boolean;
  /** Optional renderer-neutral hook for tests, analytics, or debugging presentation readiness. */
  onMainImageLoadStageChange?: (stage: MainImageLoadStage) => void;

  /**
   * Whether clicking the dark overlay backdrop (outside the image, toolbar, and info badge)
   * closes the preview, just like pressing Esc or the close button.
   * Default: `false`.
   */
  closeOnMaskClick?: boolean;

  /**
   * Custom content rendered in place of current media when it fails to load/decode
   * or cannot be resolved to a supported media kind.
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
   * Called when current media fails to load/decode or resolves to an unsupported kind.
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
   * Request fullscreen. Delegates to `fullscreen.enter()` when a host adapter is supplied;
   * otherwise uses the browser Fullscreen API. Resolves `true` only after a successful request.
   */
  requestFullscreen(): Promise<boolean>;
  /** Exit fullscreen through the host adapter or browser Fullscreen API. */
  exitFullscreen(): Promise<void>;
  /** Host-adapter state when supplied; otherwise whether the preview root is fullscreen. */
  isFullscreen(): boolean;
  getState(): ZoomState;
}
