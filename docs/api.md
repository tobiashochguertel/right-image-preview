# ImagePreview — Props & Ref API

**English** · [中文](./api.zh-CN.md)

---

## `<ImagePreview>` Props

### Data

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `src` | `string` | — | Single image URL (ignored when `images` or non-empty `groupedImages` is provided) |
| `alt` | `string` | — | Alt text for single image |
| `minimapSrc` | `string` | — | Single-image only: optional minimap image URL (defaults to `src`); ignored when `minimap` is set |
| `minimap` | `React.ReactNode` | — | Single-image only: optional custom minimap content (overrides `minimapSrc`) |
| `images` | `ImageItem[]` | — | Flat list; when provided without non-empty `groupedImages`, `src`/`alt` are ignored; if both `images` and non-empty `groupedImages` are set, `images` is ignored (dev `console.warn`) |
| `groupedImages` | `ImageGroup[]` | — | Folder-style groups; each group’s `images` are concatenated in order; takes precedence over `images` and `src`; ←/→ and hold navigate the **flat** sequence (cross groups); toolbar gains prev/next-group (and PageUp/PageDown) for jumping to a group’s first image |
| `visible` | `boolean` | — | Controlled visibility |
| `defaultGroupedSelection` | `DefaultGroupedSelection` | — | Initial `{ defaultGroupIndex, defaultIndexInGroup }` when using non-empty `groupedImages` (group index counts only non-empty groups); overrides `defaultIndex` |
| `defaultIndex` | `number` | `0` | Initially displayed index in the flattened list; ignored when `defaultGroupedSelection` is set with groups |

### Zoom Configuration

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `stops` | `NativePercent[]` | `[10,25,50,75,100,125,150,175,200]` | Discrete zoom stop list (ascending, at least 1 item); pass a custom list for a higher max |
| `initialMode` | `'fit' \| 'native'` | `'fit'` | Initial zoom mode |
| `initialNativePercent` | `number` | first stop | Initial percentage when `initialMode='native'` |
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
| `presentation` | `'overlay' \| 'contained'` | `'overlay'` | `overlay` fullscreen dialog; `contained` fills a positioned host |
| `preloadRadius` | `number` | `1` | Neighbor full-`src` byte preload radius; `0` = off. Does **not** alone skip progressive |
| `preloadDisplaySlots` | `number` | `0` | Max neighbors kept **display-ready**. `0` + budget → ceiling 6; budget decides fill count |
| `preloadDisplaySettleMs` | `number` | `600` | Debounce after navigation before warming **neighbors** (rapid ←/→ cancels). Does not delay current main decode |
| `holdMinVisibleMs` | `number` | `NAV_HOLD_MIN_VISIBLE_MS` | Hold ←/→: after the first immediate step, each image must show **presented** stage content (thumb underlay or full original) for this many ms before another step, and only if still held. Layout/meta alone does not start the clock. Release cancels the pending timer (no queue). Omit to use the library default. |
| `preloadMemoryBudgetBytes` | `number` | — | Neighbor decoded-byte budget (excludes current main). Prefer this from Tauri; props stay fixed while browsing |
| `estimateDecodedBytes` | `(item) => number` | EXIF w×h×4 or 12MP guess | Size estimate for budget |
| `preloadDisplayMode` | `'slot' \| 'decode'` | `'slot'` | `'slot'` = offscreen imgs (C); `'decode'` = decode-only fallback (B) |
| `onPreloadIndexesChange` | `(indexes: number[]) => void` | — | Optional debug hook for planned preload indexes |
| `onPreloadStatusChange` | `(status: NeighborPreloadStatusMap) => void` | — | Phases include `display-ready` (exact: decode settled — fast reveal; underlay until viewport drawable). Byte `ready` ≠ instant reveal |
| `showThumbnailPreloadStatus` | `boolean` | `false` | Strip edges: **blue** = neighbor slot **and** decode settled (instant-switch); still loading stays gray/green progress; **green** = byte ready / session-warm |
| `showSwitchLoader` | `boolean` | `true` | Center ring spinner while switching images (outgoing hold / waiting for next drawable main). `false` hides it only |
| `chrome` | `'default' \| 'minimal'` | `'default'` | `minimal` fades idle chrome to 0% |
| `index` | `number` | — | Controlled flat index |
| `toolbarExtra` | `ReactNode` | — | Extra content at the end of the toolbar |
| `language` | `string` | `'en'` | UI locale: built-in `en` and `zh` (primary subtag match, e.g. `zh-CN` → `zh`) |

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

Tile image: `ImageItem.minimapSrc` if set, otherwise `src`. Layout: few tiles → centred frosted pill; many tiles → full-width bottom bar with horizontal scroll.

#### Neighbor preload notes

- **Byte preload** (`preloadRadius`): `Image()` fetch only. Strip phase `ready` / `warm` means bytes likely cached — **not** enough to skip {@link progressiveMain}.
- **Display-ready** (`preloadDisplaySlots` > 0): load + `decode()` (and offscreen `<img>` when `preloadDisplayMode="slot"`). Phase `display-ready` is exact; navigating there uses fast reveal (no artificial dwell / centre spinner) while **keeping** the `minimapSrc` underlay until the viewport main image is drawable. Neighbor warm-up is debounced by {@link preloadDisplaySettleMs} (default 600ms) so rapid scrubbing does not decode every hop.
- **Memory**: the library does not read device RAM. Hosts (e.g. Tauri) should pass `preloadMemoryBudgetBytes` (see `suggestPreloadMemoryBudgetBytes`) and ideally width/height estimates. **Media Lens checklist:** [`media-lens-integration.md`](./media-lens-integration.md).
- **Fallback**: `preloadDisplayMode="decode"` keeps the same short-circuit contract without retaining compositor layers.

#### `presentation` notes

| Value | Behaviour |
|-------|-----------|
| `'overlay'` (default) | `fixed` fullscreen, `dialog` + `aria-modal`, focus on open, window keyboard |
| `'contained'` | `absolute; inset: 0`; host must be positioned with size; `region`; keyboard only while focused inside; `overlayClassName` / `overlayStyle` still apply to the root |

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
  alt?: string;
  name?: string; // filename shown in the info badge
  minimapSrc?: string; // navigation minimap URL; defaults to src; ignored if minimap is set
  minimap?: React.ReactNode; // custom minimap body; overrides minimapSrc
}

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

  // browser fullscreen
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
