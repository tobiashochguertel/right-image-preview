# Requirements Log

**English** · [中文](./requirements.md)

> All feature requirements recorded in chronological order with implementation status.  
> **New requirements must be synced to this file.**

---

## Phase 1 — Initial Core Requirements

**Goal:** Build a standalone, UI-library-free React image preview component supporting "fit-to-viewport" and "fixed zoom stop" modes.

### Zoom Modes
- [x] **Fit mode**: image fully visible in container (contain semantics), not tied to any fixed native percentage
- [x] **Native mode**: fixed percentage with `naturalWidth/naturalHeight` as the 100% baseline
- [x] **Discrete stop zoom**: zoom only jumps between configured stops; stops are configurable
- [x] **First-zoom-in-from-Fit strategy**: configurable (`above-fit` / `first-stop` / `hundred`)
- [x] **Zoom-out-below-min behaviour**: configurable (`fit` returns to Fit / `noop` stays at min stop)
- [x] **Zoom-in-at-max behaviour**: configurable (`noop` / `notify` callback)

### Operations
- [x] Toolbar, keyboard, and external `ref` calls share a single state machine
- [x] Mouse-wheel zoom (optional), ±1 stop per tick
- [x] Double-click to toggle Fit ↔ 100% (optional)
- [x] "Fit" shortcut (keyboard `0`, toolbar button)
- [x] "1:1 / 100%" shortcut (keyboard `1`, toolbar button)

### Exposed State
- [x] Export `mode`, `nativePercent`, `fitEquivalentNativePercent`
- [x] Toolbar displays "Fit (≈ xx%)" label

### Multi-image Support
- [x] `images` array with `prev` / `next` navigation
- [x] Reset zoom on image switch (`switchImageResetZoom`, configurable)
- [x] Reset flip/rotation on image switch (`switchImageResetTransform`, configurable)

### Accessibility
- [x] Keyboard close (Esc)
- [x] Focus management (`tabIndex=-1` + auto-focus on open)
- [x] Button `aria-label`
- [x] `role="dialog"` + `aria-modal`

### Tech
- [x] TypeScript first-class types (`ZoomMode`, `NativePercent`, callback and ref signatures)
- [x] Vite + React project, Vitest unit tests

---

## Phase 2 — Bug Fixes & Feature Extensions

### Bug Fixes
- [x] **Zoom buttons unresponsive**: fixed `+`/`-`/Fit/100% buttons having no effect
- [x] **Infinite re-render**: `img` ref callback causing `Maximum update depth exceeded`; fixed by stabilising ref with `useCallback`
- [x] **Wrong rotation direction**: every 4th click rotated 270° instead of 90°; fixed by accumulating raw degrees instead of applying `% 360`
- [x] **Ghost drag**: image continued to follow the pointer after releasing the mouse button outside the viewport; fixed by checking `e.buttons === 0` in `onPanMove`
- [x] **Wheel zoom switches to Fit at min stop**: changed `zoomOutBelowMinBehaviour` default to `'noop'`

### Stop Adjustments
- [x] Added 5%, 10%, 800%, 1600% stops (historical)
- [x] Removed 5% and 1600%; default set later spanned up to 800%
- [x] **v0.0.8**: default max stop is **200%**; higher ratios via custom **`stops`**
- [x] **v0.0.9**: peer **React / React DOM ≥ 17**; `flushSync` compatibility shim
- [x] **v0.0.10**: minimap dim uses `evenodd` path instead of SVG `mask` over `<img>` (fixes black tile in some WebViews)
- [x] **v0.0.11**: axis-aligned minimap viewport uses **four `<rect>`** dim strips; rotated viewports keep `evenodd` path
- [x] **v0.0.12**: minimap `<img>` uses **width/height × thumbS**, not **transform: scale** on full natural pixels (fixes black tile in some WebViews)
- [x] **v0.0.13**: `ImageItem.minimapSrc` / `minimap` (+ same props for single-`src` mode): optional thumbnail URL or custom React node; default remains main `src`

### Flip & Rotate
- [x] Horizontal flip, vertical flip
- [x] 90° CW/CCW rotation with CSS transition animation

### Filename Display
- [x] `ImageItem.name` field displayed in the toolbar info badge
- [x] Toolbar shows the default current/total counter (including `groupedImages` ordinals); no custom counter render prop

---

## Phase 3 — Toolbar UI Overhaul

### Zoom Input Dropdown
- [x] Clicking the zoom label enters edit mode; accepts any positive integer (not limited to stops)
- [x] Upward dropdown lists all preset stops + "Fit" option
- [x] Current value is highlighted in the dropdown when it matches a stop

### Icon Redesign
- [x] "Fit" icon: four outward L-shaped corner brackets
- [x] "1:1" icon: crosshair / reticle (replacing the previous numeral "1")

### Close Button
- [x] Moved from toolbar to top-right corner of the overlay; circular semi-transparent button

---

## Phase 4 — Multi-folder Support

### `groupedImages` Group Navigation
- [x] `ImageGroup`: optional `id`, `name`, and `images: ImageItem[]` (no `start` / `end` ranges)
- [x] Side arrows navigate within group; disabled at boundaries
- [x] Toolbar gains "prev group" (⏮) / "next group" (⏭) buttons
- [x] Toolbar counter shows within-group index (e.g. `2/3`), not global index
- [x] Info badge second line: `(i/n)` group position (same styling as in-group counter), small gap, then folder name (may differ slightly)

### Demo Improvements
- [x] Demo 1: 5 images, single group, no folder info
- [x] Demo 2: 10 images in 3 folders, using `groupedImages`

---

## Phase 5 — Zoom Lock & Arrow Configuration

### Zoom Lock
- [x] Lock toggle button (padlock icon) added to the right of the "+" button
- [x] When locked, switching images preserves zoom mode and percentage; Fit stays Fit (percentage adapts to image dimensions)
- [x] `initialZoomLocked` prop controls initial state

### Arrow Configuration
- [x] `arrows: 'both' | 'side' | 'toolbar' | 'none'` prop
- [x] Demo 1 uses `'both'`, Demo 2 uses `'side'`

### Flip Button Visibility
- [x] `showFlip` prop, default `false`; enabled in Demo 2

### Colour Softening
- [x] Toolbar colours changed to a soft blue-grey (`#cdd5e0`) to reduce harsh contrast against the black overlay
- [x] Unified colour tokens (`C` object)

---

## Phase 6 — Keyboard Extensions & Input Improvements

### New Keyboard Shortcuts
- [x] `↑` zoom in, `↓` zoom out
- [x] `Space` toggles Fit ↔ 100%
- [x] `PageUp` prev group, `PageDown` next group
- [x] `Ctrl/⌘ + ←` rotate CCW, `Ctrl/⌘ + →` rotate CW
- [x] Arrow keys and Space do not fire global shortcuts when the zoom input field is focused

### Zoom Input
- [x] `setNative` (ref) accepts any positive integer; not snapped to stops
- [x] Toolbar zoom field **clamps** to the max configured stop on commit (matches the default 200% cap)

### Info Badge Wrap Fix
- [x] Counter (e.g. `3/3`) given `whiteSpace: nowrap` to prevent line breaks

---

## Phase 7 — Info Display & Documentation

### Counter Position
- [x] Counter moved before the filename with a small gap; colour dimmer than filename

### Close-on-mask-click
- [x] `closeOnMaskClick` prop: controls whether clicking the dark overlay closes the preview
- [x] Demo 1 explicitly sets it to `true`

### Transparency Improvements
- [x] Info badge and toolbar action-row backgrounds reduced to `0.58` / `0.68` opacity to reduce image occlusion
- [x] Info badge refactored from full-width bar to a text-width floating badge

### Documentation
- [x] Created `docs/` directory
- [x] `docs/api.md` / `docs/api.zh-CN.md` — Props & Ref API reference (bilingual)
- [x] `docs/keyboard.md` / `docs/keyboard.zh-CN.md` — keyboard shortcuts (bilingual)
- [x] `docs/requirements.md` / `docs/requirements.en.md` — this file (bilingual)
- [x] GitHub Pages demo: **EN / 中文** toggle (top-right, `App.tsx`)

---

## Phase 8 — Nav Button Visibility & Toolbar Layout

### Side Arrow & Close Button Visibility
- [x] NavArrow uses dark semi-transparent background + white border + drop shadow for visibility on any image background
- [x] Hover darkens background; close button (top-right) uses matching style

### Deduplicating the Counter
- [x] With `imageName`: counter only shown in the info badge; without `imageName`: counter shown in toolbar action row

### Zoom Button Reorder
- [x] New order: `[Nav] | [Flip?] [CCW] [CW] | [Fit] [1:1] | [−] [zoom input] [+] [🔒]`
- [x] Left-to-right: coarse preset jumps → fine-grained adjustment → lock behaviour

---

## Phase 9 — Close Button Size & 1:1 Icon

### Close Button
- [x] Diameter increased ~30% from 36px to 46px; inner X icon scaled to 18px

### 1:1 Icon Iterations
- [x] Version 3: 2×2 pixel grid (four equal rounded squares)
- [x] Version 4: **"1:1" text-style SVG** (two serif numeral "1"s with a colon) — unambiguous semantic

---

## Phase 10 — Controls Auto-fade (Inactivity-based)

### Requirements
- [x] Any mouse movement, click, or key press resets the inactivity timer and instantly restores controls
- [x] After **3 s** of inactivity, all controls **smoothly fade over 1.6 s** to ~10% opacity (still perceivable and interactive)
- [x] Restore transition: 0.12 s (feels instant)
- [x] Scope: side arrows, close button, toolbar (including filename badge)

### Implementation
- `ImagePreviewInner` adds `controlsVisible` state + `hideTimerRef`
- `resetHideTimer`: `setControlsVisible(true)` → clear old timer → `setTimeout(3000)` triggers fade
- Overlay binds `onMouseMove` / `onMouseDown` → `resetHideTimer`
- `keydown` handler calls `resetHideTimer` as its first action
- `CloseButton` & `NavArrow`: `visible` prop → `opacity: visible ? 1 : 0.10` + asymmetric transition
- `Toolbar`: `controlsVisible?: boolean` prop → outer container opacity + transition

---

## Phase 11 — Side Arrow Redesign & closeOnMaskClick Fix

### New Side Arrow Rules
- [x] **No more greyed-out arrows**: when navigation is impossible the arrow is completely hidden
- [x] **Group boundary in multi-group mode**: at the last image of a group with a next group available, the right arrow is replaced by a double-chevron "next group" button; symmetrically for the left
- [x] Single-group mode: no left arrow on first image, no right arrow on last image
- [x] `NavArrow` removes `disabled` prop; adds `isGroupJump?: boolean`

### closeOnMaskClick Fix
- [x] **Root cause**: the viewport div (`width/height: 100%`) covers the entire overlay, so clicks on the dark mask land on the viewport div — `e.target !== e.currentTarget` on the overlay, so the handler never fired
- [x] **Fix**: added the same `onClick` + `e.target === e.currentTarget` check on the viewport div
- [x] `closeOnMaskClick` default changed from `true` to `false` (opt-in is safer)

---

## Phase 13 — Image-Switch Animation Fix + Overlay Customization

- [x] **Bug fix**: When switching images a "zoom-out shrink" animation was visible. Root cause: when `ready` flipped `false→true`, `transform` (fit-scale jump) and `opacity` (0→1) both triggered CSS transitions in the same render frame, making the image shrink while fading in. Fix: introduced `imageShowReady` state — first frame applies the correct transform while `opacity` is still 0 (no animation), next frame (RAF) transitions `opacity` to 1 when transform is already settled.
- [x] **New prop**: `overlayClassName?: string` — extra CSS class on the overlay backdrop.
- [x] **New prop**: `overlayStyle?: React.CSSProperties` — inline style overrides merged onto the overlay (higher priority than defaults).
- [x] **Default overlay style**: updated to macOS frosted-glass look (`rgba(10,12,20,0.70)` + `backdrop-filter: blur(24px) saturate(160%)`), background outlines are faintly visible while keeping focus on the image.

## Phase 12 — Open-source Preparation

- [x] `README.md` (English) + `README.zh-CN.md` (Chinese) with mutual language-switch links
- [x] All `docs/` files bilingual
- [x] `LICENSE` (MIT)
- [x] `CONTRIBUTING.md` (English) + `CONTRIBUTING.zh-CN.md` (Chinese)
- [x] `.github/ISSUE_TEMPLATE/` — bug report and feature request templates
- [x] `package.json` filled with description, keywords, license, repository, etc.

---

## Phase 14 — Bottom Thumbnail Strip

### Requirements
- [x] `showThumbnails?: boolean` (default `false`)
- [x] `thumbnailsScope?: 'group' | 'flat'` (default `'group'`)
- [x] When on: horizontal scrollable strip at the bottom of the overlay; active tile has a bright border
- [x] `thumbnailsScope="flat"` lists the full flat navigation sequence (Media Lens); `group` = current group only when grouped
- [x] Virtualization: measure strip viewport width; `visibleCapacity = max(1, floor(viewportWidth / tileStride))`; window virtualization when `entryCount > visibleCapacity × 3`, else render all tiles
- [x] Thumbnail URL prefers `minimapSrc`, falls back to `src`
- [x] Auto-hidden when ≤ 1 navigable image
- [x] Toolbar and minimap shift up when the strip is visible; strip participates in auto-fade

## Phase 15 — Media Lens P0

- [x] `presentation?: 'overlay' | 'contained'`
- [x] `preloadRadius` + `onPreloadIndexesChange`
- [x] `showThumbnailPreloadStatus` (default `false`; light/dark green strip edges when on)
- [x] `chrome?: 'default' | 'minimal'`
- [x] Toolbar browser fullscreen + ref `requestFullscreen` / `exitFullscreen` / `isFullscreen`; Esc exits FS first
- [x] Controlled `index` + `toolbarExtra` + ref `goTo`
- [x] Demo 5: `showThumbnails` + `thumbnailsScope="flat"`
