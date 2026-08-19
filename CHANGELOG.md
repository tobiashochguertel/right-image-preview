# Changelog

All notable changes to this project are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning follows [Semantic Versioning](https://semver.org/) (see `README.md` for pre-1.0 conventions).

---

## [Unreleased]

### Added

- **Copyable Demo 6 GPU diagnostics** — every image-index change emits one delayed JSON console entry containing requested/sampled index, memory totals, live viewport/DPR, planned Screen/Browse indexes, actually resident Screen/Browse indexes, and nearby phases.
- **v0.4 WebGL-first beta foundation** — static Raster main content now renders through a WebGL2 canvas with upload fences, DPR resize, transform quads, progressive preview/full replacement, texture cache eviction, priority neighbor warm-up, `MAX_TEXTURE_SIZE` clamping, and context-loss recovery.
- **Renderer-neutral media inputs** — exported `MediaSource` (`url` / `blob` / `bytes`), `MediaKind`, commands, capabilities, and view-state contracts; `ImageItem` and single-media props accept source/kind/MIME hints.
- **Media dispatcher** — independent `raster-webgl/`, `svg/`, `animated/`, `video/`, and `unknown/` modules keep one Viewer Shell while declaring different capabilities.
- **`npm run pack:local`** — builds into `.local-pack/right-image-preview/` for host `file:` installs (no npm publish needed for Media Lens iteration). Local packs show a top-center badge `local vX.Y.Z · YYYY-MM-DD HH:mm:ss`; npm publish builds have no badge.
- **Adaptive Raster warm window** — `preloadRadius="auto"` walks across mixed media in navigation-priority order and admits GPU textures one at a time until actual uploaded bytes reach the cache budget. `preloadMaxCount` provides a safety ceiling.
- **`holdRepeatDelayMs`** — the first ←/→ step remains immediate; automatic continuation begins only after the press stays held for the configured delay (default 300ms). It is independent from the per-image `holdMinVisibleMs` dwell (now default 200ms).
- **Screen/Full Raster LODs** — neighbors decode to viewport×DPR Screen textures; only the current settled image promotes to Full after `fullResolutionSettleMs` (default 300ms). Hold navigation cancels intermediate Full work, and leaving releases the old Full while retaining its Screen texture.
- **Screen history pins** — recent non-contiguous visits retain their already-resident Screen textures after current plus immediate next/previous capacity is reserved. These pins never schedule a retry after eviction, keeping 4 ↔ 11-style thumbnail toggles fast without adding hidden decode work.
- **Demand-driven Full LOD** — Fit mode remains on its already viewport-sharp Screen texture. Full decode is deferred until user zoom demand actually exceeds Screen, preventing an idle large-local-image decode from blocking interaction.
- **Display-tier GPU budgets** — automatic defaults are 192/256/384/512/768 MiB for HD/FHD/QHD/4K-class/roughly-6K+ physical pixels. Native 4K and the common macOS 5120×2880 high-DPI backing both use 512 MiB. Browsers cannot report free VRAM, so hosts may still override `preloadMemoryBudgetBytes`.

### Changed

- **Browse status uses calm violet** — the filmstrip and Demo 6 use `#c084fc` for immediately drawable medium-detail Browse textures, clearly separating it from blue Screen/Full and green transfer/cache status without the warning connotation of amber/orange.
- Package version is `0.4.0-beta.1`. The existing local `v0.3.12` tag remains the DOM-generation archive; no tag or package was pushed/published.
- **Bundle budget** — size-limit moves from 32 kB to 44 kB gzip; after removing the old DOM Raster engine, the current LOD build measures 39.81 kB versus the 31.93 kB v0.3.12 baseline. The increase is the persistent WebGL renderer/runtime, texture cache/adaptive queue, streamed progress tracking, header-only dimension parsing, Screen/Full scheduling, source sniffing, and dedicated media modules.
- **Persistent Raster runtime** — the WebGL Canvas/context/cache stays mounted while SVG, animated images, or video is active. It becomes draw-dormant, pauses new preload uploads during animation/video playback, and redraws a retained texture when Raster becomes active again.
- **Viewport-adaptive continuous Browse/Screen bands** — auto preload uses actual Screen texture bytes: small stages make every candidate Screen, while high pressure shrinks the contiguous core as far as one item per side before expanding a fixed Browse ring. Browse is not auto-upgraded to Screen.
- **Separate history diagnostics** — `RasterPreloadPlanSnapshot` and Demo 6 report the non-contiguous retained Screen history independently, so a blue history item is not mistaken for a gap in the continuous directional plan.
- **LOD-aware progress bars** — while a planned texture is transferring or decoding, its thumbnail bar is blue for Screen or violet for Browse and uses real available byte progress; the completed bar retains the same color.
- **Thumbnail strip remains DOM-virtualized** — native thumbnail images preserve lazy decode, button/focus/accessibility semantics, and only visible cells plus overscan are mounted; the main-image WebGL context is not reused as a thumbnail atlas.
- **Default zoom stops** — the low end is now `[5, 10, 20, 35, 50, 75]`, followed by the existing `100, 125, 150, 175, 200` stops.
- **Truthful thumbnail transfer progress** — green now follows streamed original bytes when `Content-Length` is exposed (roughly 1% / 200 ms throttling). Unknown-length responses use an animated indeterminate segment instead of a fake one-third fill. Full green records a completed original request; blue is reserved for a texture that is still GPU-resident.
- **Removed v0.3 DOM Raster compatibility surface** — `preloadDisplaySlots`, `preloadDisplaySettleMs`, `preloadDisplayMode`, `estimateDecodedBytes`, progressive DOM timing props, related helpers, retained `<img>` layers, and obsolete tests/docs are gone. `preloadRadius`, the live viewport, and the texture budget are the only neighbor-quality inputs.

### Fixed

- **No-op cache-retention render loop** — `retainOnly()` now publishes runtime state only when it actually removes a texture, and identical resident/cache snapshots preserve React state identity. This prevents the history-retention planner from feeding an unchanged cache snapshot back into itself at 100% CPU.
- **Immediate back-navigation keeps the prior Screen LOD** — Full never replaces/deletes its companion Screen texture. After navigating away, the just-left Screen remains in the protected cache set while its Full is released, so the former active thumbnail stays blue and a quick return does not restart from the green byte-cache state.
- **Readable filmstrip and LOD diagnostics** — inactive thumbnails no longer dim their bitmap or preload bar; the active item uses a neutral-light border with a restrained blue halo. Demo 6 viewport/Screen/Browse diagnostics wrap complete index lists instead of truncating them with ellipses.
- **Raster navigation keeps its GPU cache** — changing images no longer remounts the WebGL stage/context. Preloaded neighbor textures are reused, and budget eviction keeps higher-priority neighbors instead of letting farther work evict the next likely image.
- **WebGL spinner lifecycle** — production loading is driven by media presentation phases rather than the legacy outgoing `<img>` hold; the spinner closes with the `display-ready` commit and cannot remain after the sharp texture appears.
- **Truthful preload status under memory pressure** — an evicted texture is downgraded from blue `display-ready` to session `warm`, and the nearest image in the active navigation direction is favored when the budget cannot hold every requested neighbor.
- **Renderer-neutral hold pacing** — production long-press navigation now waits on the active renderer's presented callback, including the WebGL Canvas path, instead of looking for a main-stage `<img>`. Release cancels the only pending timer, including the 0ms mode, so no repeat backlog can drain afterward.
- **Resize-aware LOD reuse** — stage `ResizeObserver` changes re-plan neighbors from the actual image area. An undersized prior Screen texture is retained as Browse when useful; queued stale work is cancelled and stale in-flight completions cannot overwrite the new plan.
- **Truthful Demo 6 memory** — diagnostics now sum actual resident WebGL texture bytes. The previous original-dimensions estimate incorrectly displayed 8+ GiB for dozens of small Screen textures.

- **Navigate hold keeps zoom/pan** — snapshot the leaving frame in `goTo` *before* `resetPan`/`reset`, and only demote outgoing→1×1 after the incoming `<img>` is laid out at full size (`getBoundingClientRect` ≥ 8px), not merely when decode flags flip (avoids black + one-pixel flash).
- **Cold gallery open tall thin strip** — current layer keeps full geometry once dims exist (do not 1×1 the current img under underlay); seed layout from `exif.width/height` on open; underlay uses `objectFit: contain`.
- **Cold open 100%→fit flash** — in fit mode do not use `scale: 1` before the viewport is measured; gate current-layer opacity on `imageShowReady` and suppress transform easing on first reveal.

## [0.3.12] — 2026-08-14

### Changed

- **Keep-alive reworked from 0.3.9 baseline** — non-sharp neighbors use **1×1 + `opacity: 1`** (no full-frame ~2% plates). **Outgoing stay full-size** (dims or `'auto'`, never forced to 1) until incoming is full-size sharp; then **double rAF** overlap before demoting previous to 1×1. Fixes the 0.3.10 failure mode where demote and 1×1→full expand happened in the same paint and every navigate flashed black + one pixel.

## [0.3.11] — 2026-08-14

### Fixed

- **Navigate “black + one pixel”** — do not shrink the outgoing frame to 1×1 keep-alive until the incoming main layer has painted (`imageShowReady` + dims + paintable `<img>`, then double rAF). Outgoing/`paintFullFrame` layers never collapse to 1×1 when dims are briefly missing. Arm hold from frozen dims when the previous `<img>` node is gone (Media Lens remount).

## [0.3.10] — 2026-08-14

### Changed

- **Keep-alive strategy** — non-sharp stage layers use **1×1 CSS px + `opacity: 1`** instead of full-frame ~2% opacity (avoids dark translucent ghosts; lighter for the compositor). `DISPLAY_LAYER_KEEPALIVE_OPACITY` kept only as a deprecated export.

## [0.3.9] — 2026-08-14

### Fixed

- **Dark translucent “veil” on navigate** — do not demote the outgoing frame to keep-alive opacity (~0.02) until the incoming layer is actually sharp (`imageShowReady` and not hidden pending decode). Clearing hold too early let the frosted overlay show through a ghost of the previous image.
- **Current thumbnail preload bar** — the active strip tile no longer shows green/blue bottom edge; selection border alone marks “here.”

## [0.3.8] — 2026-08-14

### Changed

- **Stage floor stacking** — preview UI is layered as content → hit → chrome → loading (DOM order). Loading stays topmost; close / ←→ / toolbar / filmstrip / minimap live in a chrome floor with `pointer-events: none` on the shell. Removes ad-hoc pan/spinner `z-index` values.
- **Navigate UX: strip now, spinner while holding, sync hide** — on ←/→, filmstrip selection updates with `currentIndex` immediately (instant scroll); L4 spinner shows for the whole outgoing-hold / hide-until-decoded gap (including prefer-fast-reveal); spinner clears in the same frame the previous frame demotes. Floor `z-index` isolates content so outgoing `z-index:5` cannot cover the loader.
- **`showSwitchLoader`** (default `true`) — toggle the center ring spinner while switching images; does not change outgoing-hold / reveal timing.
- **Default `preloadRadius` = `1`** — neighbors current±1 byte-warm by default; pass `0` to disable.
- **Strip preload colors** — **blue** only when a neighbor is in the active slot window **and** decode has settled (instant-switch). Adjacent-but-still-loading stays gray/green progress — never blue just for being a neighbor. **Green** = byte-ready / session-warm outside that ready set (cache hint).
- **Default zoom stops** — add `125` and `175` between 100 and 200 (`[10, 25, 50, 75, 100, 125, 150, 175, 200]`).
- **Default `holdMinVisibleMs`** — `300` (was `500`).
- **Bundle size budget** — gzip limit raised `30 kB` → `32 kB` after stage-layer / navigate UX growth.

### Fixed

- **Outgoing hold (anti-black navigate)** — when stepping ←/→, keep the previous full-`src` frame visible (full size, above the thumb underlay) until the incoming image is paintable, then demote it to neighbor keep-alive. Stops the stage-wide `opacity: 0` blank on every `src` change so hold-scrubbing is not half black frames. Hold pacing still waits for the **incoming** bitmap (not the held previous frame).
- **Outgoing hold no longer squashes into a thin strip** — capture the previous frame as outgoing on the **same render** as the `src` change (avoid one frame as a 1×1 neighbor), and size it with natural pixel dims instead of `width/height: 100%` + `object-fit: fill`.
- **Independent stage layers** — each `src` is its own absolute viewport layer with a **frozen** transform when leaving; navigating no longer moves the previous frame via a shared transform parent (fixes “image jumps so its left edge sits on the viewport center”).

## [0.3.7] — 2026-08-13

### Fixed

- **Long-press ←/→ broken in 0.3.6** — keyboard listeners no longer rebind (and call `endNavHold`) on every `prev`/`next` identity change, which stopped hold after the first step and could flicker the cursor. Keep: `keyup` always ends hold; `stepNow` ignores steps after `endHold` when `holdMinVisibleMs` is 0. Removed aggressive `blur` / `lostpointercapture` stop-hold paths from 0.3.6.

## [0.3.6] — 2026-08-13

### Fixed

- **Hold ←/→ stops on release when `holdMinVisibleMs` is 0** — `keyup` always ends the paced hold (not gated on `keyboardActive`); `stepNow` ignores a `setTimeout(0)` that fires after `endHold`. *(0.3.6 also rebound listeners too aggressively — fixed in 0.3.7.)*

## [0.3.5] — 2026-08-13

### Changed

- **←/→ across groups** — `prev` / `next`, keyboard hold, side arrows, and toolbar arrows navigate the **flat** image list (same order as the bottom strip), so holding → continues into the next folder’s first image. Jump to a group’s first image remains PageUp/PageDown and toolbar ⏮/⏭.

## [0.3.4] — 2026-08-13

### Changed

- **`holdMinVisibleMs`** — sole public knob for hold dwell; numeric library default lives only in `NAV_HOLD_MIN_VISIBLE_MS` (exported).

### Fixed

- **Hold ←/→ min-visible** — dwell starts only after stage content is a bitmap candidate **and** presented (`decode` + two rAFs). Also resets stage opacity on every `src` change even when dims stay known (fixes early dwell during black flash / occasional double-step within one dwell window).

## [0.3.3] — 2026-08-13

### Added

- **`holdMinVisibleMs`** — hold ←/→: first step immediate; each following image must stay paintable (thumb or full) for this prop’s duration before another step, only while still held. Release cancels the pending timer (no step backlog).
- **`preloadDisplaySettleMs`** (default `600`) — debounce neighbor byte + display-ready warm-up after navigation. Rapid ←/→ cancels the pending timer so only the settled image warms neighbors. Current main-image decode is **not** delayed.
- **Thumb-paced ←/→ hold** — short press = one step; continuous advance uses per-image min-visible gating (see `holdMinVisibleMs`) so key-hold cannot queue or skip past undrawn frames.
- **Docs: main display flow** — [`docs/main-display-flow.md`](./docs/main-display-flow.md) / [中文](./docs/main-display-flow.zh-CN.md) describe thumb-underlay → original, long-dwell fast path, hold pacing, and **§9 validated keep-alive / panIdle / fast-probe details**.

### Fixed

- **Neighbor warm-up no longer stuck after pointer activity** — control auto-fade no longer leaves `panIdle` false forever (which skipped display-ready preload and forced ~1s cold navigations). Already-ready neighbor layers stay mounted across settle pauses.
- **Compositor keep-alive opacity** — retained neighbor / covered current layers use ~2% opacity / 1×1 paint instead of `opacity: 0` / `visibility: hidden`, so WKWebView does not discard decoded bitmaps between navigations.
- **Fast reveal after display-ready** — skip the secondary full-`src` `Image()` probe when dimensions are already known, and drain a pending viewport decode that raced ahead of the placeholder stage (avoids ~1s re-decode on green-bar neighbors).

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
