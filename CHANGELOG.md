# Changelog

All notable changes to this project are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning follows [Semantic Versioning](https://semver.org/) (see `README.md` for pre-1.0 conventions).

---

## [0.3.2] — 2026-08-12

### Fixed

- **Display-ready no longer blanks the stage** — keep `minimapSrc` underlay until the viewport main image is drawable; do not blank solely on sticky `display-ready`.
- **Progressive reveal after ←/→** — reset reveal flags synchronously on `src` change so a cached neighbor’s `onLoad` is not swallowed.
- **Slot-mode layer retention** — keep neighbor full-`src` `<img>` nodes mounted (`key={src}`) so navigate can reuse a decoded DOM node when possible.
- **Atomic main-image reveal** — wait for `createImageBitmap` (full decode, not first progressive JPEG scan) + double `rAF` before showing the main layer; snap opacity so a left/top strip cannot flash.
- **Image switch transform pop** — suppress CSS `transform` easing across `src` changes.

### Added

- **Demo 6 (dev only)** — local gitignored `./test-images` via Vite middleware for large-JPG progressive / display-ready checks.

## [0.3.1] — 2026-08-12

### Added

- **Display-ready neighbor preload** — `preloadDisplaySlots`, `preloadMemoryBudgetBytes`, `estimateDecodedBytes`, `preloadDisplayMode` (`slot` \| `decode`). Hosts pass a stable memory budget (e.g. Tauri); the viewer picks how many neighbors fit per index. Exports `suggestPreloadMemoryBudgetBytes`, `rgbaDecodedBytes`, and related helpers. Budget-only (`slots=0`) uses a ceiling of 6. Navigating to `display-ready` skips progressive placeholder/spinner; byte `ready` alone does not. See [`docs/media-lens-integration.md`](./docs/media-lens-integration.md) / [中文](./docs/media-lens-integration.zh-CN.md).

## [0.3.0] — 2026-08-12

### Added

- **Media Lens P0** — `presentation` (`overlay` | `contained`), `preloadRadius` + `onPreloadIndexesChange` / `onPreloadStatusChange`, optional `showThumbnailPreloadStatus` (off by default) for strip light/dark green edges, `chrome` (`default` | `minimal`), browser fullscreen toolbar + ref methods, controlled `index`, `toolbarExtra`, ref `goTo`.
- **Thumbnail strip API** — `showThumbnails` + `thumbnailsScope` (`group` | `flat`). Window virtualization when `entryCount > visibleCapacity × 3`.
- **Demo 5** — contained workspace + flat strip + neighbor preload + minimal chrome.
- **EXIF / metadata panel** — host-provided data via `ImageItem.exif` (or top-level `exif` in single-`src` mode). Enable with `showExif`; optional `initialExifOpen`.
- **Delete current image** — `showDelete` + `onDeleteImage(index, item)`.

### Changed

- Removed unreleased `thumbnails` / `filmstrip` enum in favour of `showThumbnails` + `thumbnailsScope`.


## [0.2.0] — 2025

### Added

- **`ImagePreviewTriggerShell`** — "trigger mode": pass a single child element (e.g. `<img>`) and the component manages open/close internally (`visible` / `onOpenChange` are optional).
- **`onOpenChange` prop** — controlled sync for trigger mode.
- **`overlayClassName` / `overlayStyle` props** — customise the backdrop element's class and inline styles.
- **`progressiveMain` pipeline** — use `ImageItem.minimapSrc` as a blurred placeholder in the main viewport while the full `src` loads; `progressivePlaceholderMinMs` and `progressiveFadeMs` control timing.
- **`onMainImageLoadStageChange` prop** — hook into progressive load stages for analytics / debugging.
- **`showMinimap` prop** — toggle the navigation minimap (`true` by default).
- **`minimapSrc` / `minimap` on `ImageItem`** — per-image minimap customisation (thumbnail URL or custom React node).
- **`DefaultGroupedSelection`** export and `defaultGroupedSelection` prop for initial position in grouped mode.
- **Multi-group toolbar**: when `groupedImages` is used, toolbar shows group name, ordinal, and prev/next-group buttons.

### Changed

- Default `switchImageResetTransform` changed to `true` (was `false`).

---

## [0.1.0] — 2025

### Added

- **`groupedImages` prop** — folder-style image grouping; left/right arrows stay within the current group; `PageUp` / `PageDown` jump between groups.
- **Side-arrow group-jump** — at a group boundary the side arrow becomes a double-chevron "jump to next/prev group" button.
- **`arrows` config** (`'both' | 'side' | 'toolbar' | 'none'`) — control which arrow controls are rendered.
- **`initialZoomLocked` prop** and lock-zoom toolbar button — preserve zoom/position across image switches.
- **`showFlip` prop** — show horizontal/vertical flip buttons in the toolbar.
- **Navigation minimap** — thumbnail + draggable viewport frame in the bottom-right corner while the image overflows the viewport in Native mode.
- **`language` prop** — built-in `en` and `zh` (Simplified Chinese) locales; BCP 47 primary-subtag matching with English fallback.
- **`closeOnMaskClick` prop** — close the preview by clicking the backdrop.
- **`onIndexChange` callback** — notified on every image navigation.
- **`zoomInAtMaxBehaviour: 'notify'`** + `onMaxStopReached` — optional callback when zooming past the top stop.
- **`wheelStrategy` prop** (stub; `'stop-by-stop'` is the effective behaviour).

### Changed

- Wheel zoom rewritten to handle LINE / PIXEL / PAGE delta modes correctly, with trackpad smooth-scroll accumulation and per-notch coalescing for slow mechanical mice.

---

## [0.0.x] — 2024–2025 (initial development)

### Added

- Core `ImagePreview` component: `fit` / `native` zoom modes, discrete zoom stops, toolbar, keyboard shortcuts, pan, rotate, flip.
- `useZoomState` hook (pure logic, no DOM).
- `useImageTransform` hook (ResizeObserver, CSS transform, drag-pan, `zoomAnchorTranslate`, `panByDelta`, `panJumpToNatural`).
- `images` prop (flat multi-image list), `prev` / `next` navigation.
- `switchImageResetZoom` / `switchImageResetTransform` props.
- Accessibility: `role="dialog"`, `aria-modal`, `aria-label` on all buttons, focus management.
- Vitest unit tests for `useZoomState` and `flattenGroupedImages`.
- Vite library build (`vite.lib.config.ts`), dual ESM/CJS output, `vite-plugin-dts` declarations.
- GitHub Actions CI and GitHub Pages demo deployment.
