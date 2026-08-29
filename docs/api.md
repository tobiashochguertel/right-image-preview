# ImagePreview — Props & Ref API

**English** · [中文](./api.zh-CN.md)

---

## `<ImagePreview>` Props

### Data

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `src` | `string` | — | Single image URL (ignored when `images` or non-empty `groupedImages` is provided) |
| `source` | `MediaSource` | — | Single-media URL / Blob / bytes; takes precedence over `src` for loading |
| `kind` | `MediaKind` | — | Explicit host media kind; wins over sniffing, MIME, and extensions |
| `mimeType` | `string` | — | Optional single-media MIME hint |
| `alt` | `string` | — | Alt text for single image |
| `minimapSrc` | `string` | — | Single-image only: optional minimap image URL (defaults to `src`); ignored when `minimap` is set |
| `minimapSource` | `MediaSource` | — | Single-media progressive/minimap source; takes precedence over `minimapSrc` |
| `minimap` | `React.ReactNode` | — | Single-image only: optional custom minimap content (overrides `minimapSrc`) |
| `images` | `ImageItem[]` | — | Flat list; when provided without non-empty `groupedImages`, `src`/`alt` are ignored; if both `images` and non-empty `groupedImages` are set, `images` is ignored (dev `console.warn`) |
| `groupedImages` | `ImageGroup[]` | — | Folder-style groups; each group’s `images` are concatenated in order; takes precedence over `images` and `src`; ←/→ and hold navigate the **flat** sequence (cross groups); toolbar gains prev/next-group (and PageUp/PageDown) for jumping to a group’s first image |
| `visible` | `boolean` | — | Controlled visibility |
| `defaultGroupedSelection` | `DefaultGroupedSelection` | — | Initial `{ defaultGroupIndex, defaultIndexInGroup }` when using non-empty `groupedImages` (group index counts only non-empty groups); overrides `defaultIndex` |
| `defaultIndex` | `number` | `0` | Initially displayed index in the flattened list; ignored when `defaultGroupedSelection` is set with groups |

### Zoom Configuration

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `stops` | `NativePercent[]` | `[5,10,20,35,50,75,100,125,150,175,200]` | Discrete zoom stop list (ascending, at least 1 item); pass a custom list for a higher max |
| `initialMode` | `'fit' \| 'native'` | `'fit'` | Initial zoom mode |
| `initialNativePercent` | `number` | first stop | Initial percentage when `initialMode='native'` |
| `fitMaxNativePercent` | `NativePercent` | none (uncapped) | Cap for Fit / contain as native %. `100` = never upscale past 1:1; omit to keep CSS-contain upscaling of small images |
| `firstZoomInStrategy` | `'above-fit' \| 'first-stop' \| 'hundred'` | `'above-fit'` | Which stop to land on when zooming in from Fit for the first time |
| `zoomOutBelowMinBehaviour` | `'fit' \| 'noop'` | `'noop'` | What happens when zooming out below the minimum stop |
| `zoomInAtMaxBehaviour` | `'noop' \| 'notify'` | `'noop'` | What happens when zooming in at the maximum stop |
| `initialZoomLocked` | `boolean` | `false` | Start with zoom locked (preserve zoom when switching images) |

### Interaction Behaviour

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `wheelEnabled` | `boolean` | `false` | Enable mouse-wheel zoom |
| `doubleClickEnabled` | `boolean` | `false` | Double-click to toggle Fit ↔ 100 % |
| `switchImageResetZoom` | `boolean` | `true` | Reset zoom when switching images (overridden by zoom lock) |
| `switchImageResetTransform` | `boolean` | `false` | Reset flip/rotation when switching images |
| `fitResetPan` | `boolean` | `true` | Reset pan offset when switching to Fit mode |
| `closeOnMaskClick` | `boolean` | `false` | Close when clicking the dark overlay outside the image/toolbar |
| `overlayClassName` | `string` | — | Extra CSS class applied to the overlay backdrop element |
| `overlayStyle` | `React.CSSProperties` | — | Inline style overrides merged onto the overlay backdrop (merged after defaults, so your values win) |

### UI Configuration

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `arrows` | `'both' \| 'side' \| 'toolbar' \| 'none'` | `'both'` | **Side** arrows only; see table (non-empty `groupedImages` forces toolbar prev/next on) |
| `showFlip` | `boolean` | `false` | Show horizontal/vertical flip buttons in the toolbar |
| `showExif` | `boolean` | `false` | Show the EXIF / metadata toggle in the toolbar |
| `initialExifOpen` | `boolean` | `false` | When `showExif` is true, open the EXIF panel on first mount |
| `showDelete` | `boolean` | `false` | Show the delete control (host must update the list in `onDeleteImage`) |
| `showMinimap` | `boolean` | `true` | When the image overflows the viewport, show the bottom-right navigation minimap (drag the frame to pan) |
| `showThumbnails` | `boolean` | `false` | Bottom horizontal thumbnail strip inside the overlay; hidden when ≤ 1 navigable image |
| `thumbnailsScope` | `'group' \| 'flat'` | `'group'` | Which images appear in the strip when `showThumbnails` is true; see table below |
| `onThumbnailVisibleIndexesChange` | `(indexes: number[]) => void` | — | Reports the flat indexes actually mounted by the strip, including overscan, so desktop hosts can generate only this bounded thumbnail window |
| `fullscreen` | `FullscreenAdapter` | — | Host-owned fullscreen adapter. When present it is the sole fullscreen state source and takes priority over the browser API |
| `onFullscreenError` | `(error: unknown) => void` | — | Called for host-adapter errors and unavailable, rejected, or unconfirmed browser fullscreen actions |
| `presentation` | `'overlay' \| 'contained'` | `'overlay'` | `overlay` fullscreen dialog; `contained` fills a positioned host |
| `shiftArrowAction` | `'pan' \| 'rotate'` | `'pan'` | Behaviour of `Shift + Arrow`: `pan` enables four/eight-direction panning; with `rotate`, Left/Right rotate counter-clockwise/clockwise while Up/Down still zoom. `Ctrl/Command + Arrow` always takes precedence and pans. |
| `preloadRadius` | `number \| 'auto'` | `'auto'` | `'auto'` walks outward by navigation priority and admits textures until the GPU budget is full; a number is a hard flat-index radius; `0` disables |
| `preloadMaxCount` | `number` | `128` | Safety ceiling for auto candidates; actual resident count is decided by uploaded texture bytes and budget |
| `holdRepeatDelayMs` | `number` | `NAV_HOLD_REPEAT_DELAY_MS` (300) | The first ←/→ step remains immediate; the first automatic continuation is allowed only after the press has remained held for this long. Independent from the per-image dwell. |
| `holdMinVisibleMs` | `number` | `NAV_HOLD_MIN_VISIBLE_MS` (200) | During automatic continuation, each image must be reported **presented** by its renderer and then remain visible for this many ms. Layout, download, or decode alone does not start the clock. Release cancels the single timer (no queue); `0` continues on the next event-loop turn after presentation. |
| `fullResolutionSettleMs` | `number` | `300` | Delay after the current Raster zoom demand exceeds its Screen LOD before Full LOD begins. Navigation or an active hold cancels it; `0` promotes immediately after demand appears. Current image only; fit mode does not decode Full merely in the background. |
| `rasterFullDecodeMaxBytes` | `number` | `1 GiB` | Estimated natural RGBA8 byte cap for original Full decode. Larger known images stay on `minimapSource` / `minimapSrc`; without one they fail safely instead of allocating a full bitmap. |
| `preloadMemoryBudgetBytes` | `number` | browser display tier | Logical RGBA8 texture-payload budget, hard-admitted before upload as `width × height × 4`; explicit values always win. It excludes driver copies, framebuffers, and decoder working sets, so it is not process physical-VRAM accounting. Tauri hosts should collect RAM/platform GPU guidance, call `suggestRasterHardwareTextureBudgetBytes`, and pass the result. Browse/Screen counts are independently planned from the live image-stage DIV × DPR and item dimensions. |
| `rasterDecodeWorkers` | `number \| 'auto'` | `'auto'` | Dedicated Worker count for Raster Blob → ImageBitmap decode. Auto mode uses a conservative 1/2/3 workers for ≤4/≤8/>8 logical threads; explicit values remain capped by `rasterDecodeWorkerMax` and the hard limit of 3. |
| `rasterDecodeWorkerMax` | `number` | `3` | Safety cap for automatic and explicit decode concurrency. Sources above 80 million natural pixels still run exclusively regardless of this value. |
| `onPreloadIndexesChange` | `(indexes: number[]) => void` | — | Optional debug hook for planned preload indexes |
| `onPreloadStatusChange` | `(status: NeighborPreloadStatusMap) => void` | — | Reports true original-transfer progress when available and GPU residency; evicted `display-ready` entries downgrade to `warm` |
| `onRasterPreloadPlanChange` | `(snapshot: RasterPreloadPlanSnapshot) => void` | — | Development diagnostics: live image-stage DIV, DPR, backing pixels, budget, directional continuous Screen/Browse indexes, and retained-history Screen indexes/bytes |
| `showThumbnailPreloadStatus` | `boolean` | `false` | Strip edges: **blue** = planned/resident Screen texture; **violet** = planned/resident Browse texture; planned transfers use their true available percentage; **green** = original-only transfer/completion or an evicted texture; **current tile has no bar** |
| `showSwitchLoader` | `boolean` | `true` | Center spinner while the active media awaits `display-ready`; it closes in the display commit. `false` hides it only |
| `chrome` | `'default' \| 'minimal'` | `'default'` | `minimal` fades idle chrome to 0% |
| `index` | `number` | — | Controlled flat index |
| `toolbarExtra` | `ReactNode` | — | Extra content at the end of the toolbar |
| `language` | `string` | `'en'` | UI locale: built-in `en` and `zh` (primary subtag match, e.g. `zh-CN` → `zh`) |

Download-progress semantics: URL originals are consumed through streaming `fetch`. When the response exposes `Content-Length`, `NeighborPreloadEntry.progress` is the real `loadedBytes / totalBytes` ratio. Updates are throttled to roughly each additional 1% or 200 ms, with an unconditional final event. A planned Screen/Browse item keeps a blue/violet progress bar through transfer and decode, using that true ratio; unknown-length transfers use the same target color for their animated indeterminate segment rather than a fabricated one-third fill. Green remains for original-only transfer/completion. `loadedBytes` / `totalBytes` remain available to hosts.

Full green means the original request completed during this Viewer lifetime, so a browser/WebView HTTP-cache hit is likely but not guaranteed. Blue additionally requires a completed upload fence and a texture that is still GPU-resident. GPU eviction or WebGL context loss automatically downgrades blue to full green while retaining the completed-download record.

`NeighborPreloadEntry.textureBytes` / `textureWidth` / `textureHeight` report actual resident cache data for diagnostics; do not estimate a Screen LOD as original `width × height × 4`. `browse-ready` (violet) is immediately drawable medium detail; `display-ready` (blue) covers the current image-stage DIV × DPR. On resize an old Screen may be reused as Browse, while stale queued/in-flight work cannot overwrite the new plan.

Raster Preview/Browse/Screen/Full decode runs in the same main-thread-scheduled Worker pool. Workers own no private queues. Navigation aborts queued/fetch work and hard-preempts an obsolete current decode by terminating/replacing only its Worker; `ImageBitmap` returns by transferable ownership. GPU upload remains a serial main-thread queue because the WebGL context is owned by the persistent Canvas.

#### `arrows` values

| Value | Effect |
|-------|--------|
| `'both'` | Side arrows **and** toolbar prev/next on flat lists (default) |
| `'side'` | Side arrows only; flat lists still get toolbar prev/next with index between them |
| `'toolbar'` | Toolbar prev/next only; no side arrows |
| `'none'` | No side arrows; keyboard ← → always works; flat lists still get toolbar prev/next + index |

When non-empty **`groupedImages`** is provided, **toolbar prev/next are always shown**; only **side** arrows follow this table.

#### `showThumbnails` / `thumbnailsScope`

| `thumbnailsScope` | Effect |
|-------------------|--------|
| `'group'` (default) | Lists images in the **current group** when using `groupedImages`; flat lists show the whole list. Jumping groups replaces the strip. |
| `'flat'` | Lists the **full flattened** navigation sequence (same order as ←/→ / `onIndexChange`). Window-virtualized when `entryCount > visibleCapacity × 3` (`visibleCapacity = max(1, floor(viewportWidth / tileStride))`). |

Tile source priority is explicit `ImageItem.thumbnailSource/thumbnailSrc`, then `minimapSource/minimapSrc`, then the legacy main-source fallback. `thumbnailSource={null}` or `thumbnailSrc={null}` keeps a pending tile empty and explicitly prevents loading the original. Layout: few tiles → centred frosted pill; many tiles → full-width bottom bar with horizontal scroll.

#### Neighbor preload notes

- v0.4 Raster decodes neighbors through a bounded priority queue and warms GPU textures directly. A foreground lane is reserved for the current image.
- The v0.3 DOM slot/decode, outgoing-frame, and 1×1 keep-alive APIs have been removed; Raster no longer depends on offscreen `<img>` retention.
- Browsers expose no “free VRAM” API. The component uses `screen.width × screen.height × devicePixelRatio²` only to select the conservative display tier above; this is not VRAM detection. Hosts such as Tauri may override `preloadMemoryBudgetBytes` with device-aware policy and should ideally provide dimensions. See [rendering architecture](./rendering-architecture.md).

#### `presentation` notes

| Value | Behaviour |
|-------|-----------|
| `'overlay'` (default) | `fixed` fullscreen, `dialog` + `aria-modal`, focus on open, window keyboard |
| `'contained'` | `absolute; inset: 0`; host must be positioned with size; `region`; keyboard only while focused inside; `overlayClassName` / `overlayStyle` still apply to the root |

#### Fullscreen integration

```ts
interface FullscreenAdapter {
  isFullscreen: boolean;
  enter(): void | Promise<void>;
  exit(): void | Promise<void>;
}
```

Pass `fullscreen` to put the host in complete control. Its `isFullscreen` prop is the only state source; toolbar clicks, Esc, and ref methods call `enter` / `exit`, and the component neither reads nor calls any DOM Fullscreen API. Pending actions are de-duplicated and errors reach `onFullscreenError`.

When omitted, the component uses capability detection for standard `HTMLElement.requestFullscreen` and `document.exitFullscreen`. It reports missing APIs, rejections, and a `fullscreenchange` that does not confirm the requested state through `onFullscreenError`; toolbar state changes only after that event confirms it. No runtime-specific environment detection is used.

#### Smart side-arrow behaviour

- An arrow is **hidden** (not grayed-out) when navigation in that direction is impossible.
- At a group boundary where an adjacent group exists, the arrow is replaced by a **double-chevron** group-jump button.

### Callbacks

| Prop | Type | Description |
|------|------|-------------|
| `onClose` | `() => void` | Fired when the preview is closed |
| `onZoomChange` | `(state: ZoomState) => void` | Fired whenever zoom state changes |
| `onIndexChange` | `(index: number) => void` | Fired when the active image index changes |
| `onMaxStopReached` | `() => void` | Fired when zooming in at the max stop (requires `zoomInAtMaxBehaviour='notify'`) |
| `onDeleteImage` | `(index: number, item: ImageItem) => void` | Fired when the user deletes the current image (`showDelete`). Host must update the list. |

---

## Type Definitions

```typescript
interface ImageItem {
  id?: string; // stable key (e.g. file path); prefer over name for identity
  src: string;
  source?: MediaSource;
  kind?: 'raster' | 'svg' | 'animated-image' | 'video' | 'unknown';
  mimeType?: string;
  alt?: string;
  name?: string; // filename shown in the info badge
  minimapSrc?: string; // navigation minimap URL; defaults to src; ignored if minimap is set
  minimapSource?: MediaSource;
  thumbnailSrc?: string | null; // strip only; null = wait for host generation, no original fallback
  thumbnailSource?: MediaSource | null;
  minimap?: React.ReactNode; // custom minimap body; overrides minimapSrc
}

type MediaSource =
  | { type: 'url'; href: string; contentLength?: number }
  | { type: 'blob'; blob: Blob; mimeType?: string }
  | { type: 'bytes'; data: ArrayBuffer; mimeType?: string };

interface ImageGroup {
  id?: string; // optional stable key for the folder / album
  name: string; // group label displayed below the filename
  images: ImageItem[];
}

interface DefaultGroupedSelection {
  /** Index among groups with `images.length > 0` only, in source order */
  defaultGroupIndex: number;
  /** 0-based index within that group’s `images` */
  defaultIndexInGroup: number;
}

type ArrowsConfig = 'both' | 'side' | 'toolbar' | 'none';
type ShiftArrowAction = 'pan' | 'rotate';

interface ZoomState {
  mode: 'fit' | 'native';
  /** Current native zoom percentage (meaningful when mode is 'native') */
  nativePercent: number;
  /** Fit-equivalent native % (toolbar field shows `42%` in Fit mode; preset menu row shows `Fit (42%)` / `适应 (约 42%)`) */
  fitEquivalentNativePercent?: number;
}
```

---

## `ImagePreviewRef` Methods

```typescript
interface ImagePreviewRef {
  // zoom
  zoomIn(): void;
  zoomOut(): void;
  fit(): void;
  setNative(percent: number): void; // any positive number (not clamped); toolbar zoom field clamps to max stop on commit

  // rotation & flip
  rotateCW(): void;        // rotate 90° clockwise
  rotateCCW(): void;       // rotate 90° counter-clockwise
  flipHorizontal(): void;
  flipVertical(): void;

  // image navigation
  next(): void;            // next flat index (crosses groups when using groupedImages)
  prev(): void;            // previous flat index
  nextGroup(): void;       // jump to first image of the next group
  prevGroup(): void;       // jump to first image of the previous group
  goTo(index: number): void; // jump to flat index (clamped)

  // fullscreen: host adapter when provided; browser API fallback otherwise
  requestFullscreen(): Promise<boolean>;
  exitFullscreen(): Promise<void>;
  isFullscreen(): boolean;

  // state inspection
  getState(): ZoomState;
}
```

---

## See also

- [Main display & navigation flow](./main-display-flow.md) — thumb underlay then original, long-dwell fast path, hold pacing.
- [Minimap viewport drag](./minimap.md) — WebView pointer quirks and Jacobian-based 1:1 panning.
- [Media Lens integration](./media-lens-integration.md) — Tauri memory budget and recommended props.
