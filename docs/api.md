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
| `groupedImages` | `ImageGroup[]` | — | Folder-style groups; each group’s `images` are concatenated in order; takes precedence over `images` and `src`; arrows navigate within a group, toolbar gains prev/next-group when multiple groups exist |
| `visible` | `boolean` | — | Controlled visibility |
| `defaultGroupedSelection` | `DefaultGroupedSelection` | — | Initial `{ defaultGroupIndex, defaultIndexInGroup }` when using non-empty `groupedImages` (group index counts only non-empty groups); overrides `defaultIndex` |
| `defaultIndex` | `number` | `0` | Initially displayed index in the flattened list; ignored when `defaultGroupedSelection` is set with groups |

### Zoom Configuration

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `stops` | `NativePercent[]` | `[10,25,50,75,100,150,200]` | Discrete zoom stop list (ascending, at least 1 item); pass a custom list for a higher max |
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
| `thumbnails` | `'none' \| 'classic'` | `'none'` | In-overlay thumbnail strip; `'classic'` = bottom horizontal scroll list (current group only when grouped); hidden when ≤ 1 image |
| `language` | `string` | `'en'` | UI locale: built-in `en` and `zh` (primary subtag match, e.g. `zh-CN` → `zh`) |

#### `arrows` values

| Value | Effect |
|-------|--------|
| `'both'` | Side arrows **and** toolbar prev/next on flat lists (default) |
| `'side'` | Side arrows only; flat lists still get toolbar prev/next with index between them |
| `'toolbar'` | Toolbar prev/next only; no side arrows |
| `'none'` | No side arrows; keyboard ← → always works; flat lists still get toolbar prev/next + index |

When non-empty **`groupedImages`** is provided, **toolbar prev/next are always shown**; only **side** arrows follow this table.

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
  next(): void;            // next image within group (or globally if no groupedImages)
  prev(): void;            // previous image within group
  nextGroup(): void;       // jump to first image of the next group
  prevGroup(): void;       // jump to first image of the previous group

  // state inspection
  getState(): ZoomState;
}
```

---

## See also

- [Minimap viewport drag](./minimap.md) — WebView pointer quirks and Jacobian-based 1:1 panning.
