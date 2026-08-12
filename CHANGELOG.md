# Changelog

All notable changes to this project are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning follows [Semantic Versioning](https://semver.org/) (see `README.md` for pre-1.0 conventions).

---

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

## [Unreleased]

### Added

- **`pinchEnabled` prop** (`boolean`, default `true`) — two-finger pinch-to-zoom using Pointer Events; works on touch screens and multi-touch trackpads. The zoom anchor is the midpoint between the two fingers; entering a pinch from Fit mode uses `fitEquivalentNativePercent` as the base scale for a seamless transition.
- **`onImageError` prop** (`(index: number, src: string) => void`) — fires when the current `<img>` raises an error event, giving callers the flat image index and failing URL.
- **`errorFallback` prop** (`(index: number, src: string) => React.ReactNode`) — render custom placeholder content centred over the image viewport on load failure; navigating away resets the error state so adjacent images display normally.
- **`strings` prop** (`Partial<LocaleStrings>`) — override individual UI strings without replacing the whole locale. Merged on top of the locale selected by the `language` prop. Only supply the keys you want to change.
- **`mergeStrings(base, overrides)` export** — new public helper that merges a `Partial<LocaleStrings>` onto a base locale object; useful for building locale objects programmatically outside the component.

### Changed

- **CI: independent type-check step** — `npx tsc --noEmit` now runs as a dedicated step before lint, so TypeScript errors surface independently of the build.
- **CI: bundle-size guard** — `size-limit` added with a 15 kB gzip cap on the ESM bundle; CI fails if the limit is exceeded. Run `npm run size` locally to check.
- **CI: `npm run test:coverage`** — the CI verify job now runs coverage instead of plain `vitest run`; a 50 % lines/functions threshold is enforced.

### Fixed

- **Spinner `@keyframes` injection** — replaced the per-render inline `<style>` tag with a singleton `injectGlobalStyle()` utility that inserts the rule into `<head>` exactly once per browser session (Set-based guard, SSR-safe).

### Internal

- Extracted `useWheelZoom` hook (~175 lines) from `ImagePreviewInner`, reducing the component file from ~827 to ~680 lines and enabling isolated testing of wheel-zoom logic.
- Added `injectGlobalStyle.ts` utility for one-shot CSS injection.

---

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
