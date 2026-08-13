# Main display & navigation flow

[中文](./main-display-flow.zh-CN.md)

Product-level description of **right-image-preview**: what appears on stage when navigating to the next image, and how we make “stay long enough, then step” show the original as fast as possible.

Props and defaults: [`api.md`](./api.md). Media Lens / Tauri checklist: [`media-lens-integration.md`](./media-lens-integration.md).

---

## 1. Core goals

| Priority | Goal |
|----------|------|
| **P0** | **Never prefer an empty stage**: a thumbnail placeholder beats a long black/blank wait. |
| **P0** | **Always show something paintable first**: if a main-area thumb (`ImageItem.minimapSrc`) exists, show it enlarged as underlay; only without a thumb do we go straight to the original. |
| **P0** | **Original loads in parallel with the placeholder**: the moment we land on an image, start decoding/rendering its real `src`; when the original is fully drawable, drop the thumb underlay immediately. |
| **P0** | **Fast original after a long dwell**: after staying on the previous image long enough (e.g. ~3s+), stepping to a **display-ready** neighbor (brightest strip green) should promote the retained decoded layer and skip a second full-`src` probe so sharp appears near-instantly. |
| **P1** | **Rapid hold must not flood decode**: fast ←/→ advances only after the main-area thumb for the current index has painted. |

“Main-area thumbnail placeholder” means the progressive underlay in the center stage (`minimapSrc`), **not** the corner navigation minimap (`showMinimap`).

---

## 2. One navigation step: what the stage does

Keyboard ←/→, side arrows, filmstrip click, `goTo` / controlled `index`, group jumps — all share the same **current main image** contract:

```text
Land on index N
    │
    ├─ Distinct minimapSrc (and progressiveMain on)
    │     ├─ Paint thumb underlay ASAP (content first)
    │     └─ In parallel: fetch / decode / layout real src
    │           └─ Original fully drawable → atomic reveal; remove underlay
    │
    └─ No minimapSrc (or progressive off / custom minimap node)
          └─ Original-only path (may briefly lack a placeholder; hosts should
             supply on-disk thumbs for large local files)
```

Notes:

1. **Thumb first, then original** is the default path; “no thumb → hard-load original” is a fallback, not the recommended setup.
2. The switch frame does **not** wait for the original before giving visual feedback; placeholder and original prep run together.
3. Reveal requires a **fully drawable** bitmap (e.g. `createImageBitmap` / settled `decode` + double `rAF`) so a progressive JPEG cannot flash a left/top strip.
4. If the neighbor was already **display-ready**, use **fast reveal**: skip artificial dwell / center spinner, but **keep** the underlay until the viewport main image is drawable — never blank solely to look “instant.”

Code entry points: `useProgressiveMainImage`, `DisplayStageLayers`, `lib/imagePreviewDecode.ts`.

---

## 3. After a long dwell: why the next image can be fast

While the user stays on image N, work goes into **neighbors they are likely to open next**, not into redoing the already-sharp current main.

### 3.1 Two preload layers (do not confuse them)

| Layer | Config | Meaning | Instant sharp on navigate? |
|-------|--------|---------|----------------------------|
| Byte warm | `preloadRadius` | `Image()` fetch of neighbor `src` (HTTP/disk cache) | **No** (often still re-decodes) |
| Display-ready | `preloadDisplaySlots` / `preloadMemoryBudgetBytes` | load + `decode()`; `slot` mode keeps offscreen `<img>` | **Nearly yes**: promote the same DOM node into the stage |

Strip phases `ready` / `warm` are **not** “instant sharp.” Only **`display-ready`** means decode settled and fast-reveal is allowed.

### 3.2 Settle before warming neighbors

- Default `preloadDisplaySettleMs = 600`: debounce after navigation; rapid scrubbing cancels pending neighbor warm-up so only the **settled** index heats left/right.
- This delay **never** postpones **current** main-image decode; the current item still follows §2 immediately.
- Product-wise: after ~a few seconds on one image (e.g. 3s+), neighbors are usually past settle and display-ready — the next → should feel sharp.

### 3.3 Measures that make “next original” fast

Within memory budget, library + host should:

1. **Host supplies light `minimapSrc`** (required for large local JPGs): cold navigations still have a placeholder.
2. **Enable `progressiveMain`** with `minimapSrc !== src`.
3. **Pass a stable `preloadMemoryBudgetBytes`** (Tauri available RAM + `suggestPreloadMemoryBudgetBytes`) and width/height estimates so the budget can pick neighbors correctly.
4. **Keep `preloadDisplayMode="slot"` (default)** for same-DOM promotion; `"decode"` is a memory fallback, not equal “instant.”
5. **Sensible `preloadRadius` (often 1–2) + slots/budget** so after settle the next image is already display-ready.
6. **Layer retention + compositor keep-alive**: `DisplayStageLayers` keeps current + neighbor full-`src` imgs under `key={src}`. Neighbors paint as **1×1 + tiny non-zero opacity**; current while under the thumb underlay keeps full layout size at the same opacity — so WKWebView/Chrome do not discard decoded bitmaps (`opacity: 0` often forces a ~0.5–1s re-decode on promote). The minimap underlay covers them so keep-alive is not visible.
7. **Fast path**: on display-ready, skip dwell/spinner; underlay only until the viewport is drawable.

---

## 4. Rapid scrub / held ←→: pacing

Goal while holding: **each index must show its main-area thumb before advancing** — no “logic skipped 100 indexes while only ~8 thumbs painted.”

| Mechanism | Behavior |
|-----------|----------|
| **Thumb-paced hold** | First step on press is immediate. Then each landed image must show **presented** stage content (thumb underlay bitmap, or full original if no thumb) for `holdMinVisibleMs` before another step, and only if still held. Layout/meta size alone does **not** start the clock (avoids black+Loading eating the dwell). Release cancels the single timer — **no step queue**. Spinner stays while waiting on a no-thumb original. |
| **Ignore key-repeat** | `e.repeat` does not spam steps; hold + thumb readiness drives pacing. |
| **Settle cancels neighbor heat** | Scrubbing does not start **new** neighbor decodes every hop; **already display-ready neighbor layers stay mounted** (compositor keep-alive). |
| **No not-yet-ready full layers until settled** | Avoids mounting many undecoded full-size `<img>`s while scrubbing; ready srcs are retained stickily. |

A single click (not a hold) still jumps to the target index, then follows §2.

---

## 5. End-to-end timeline (sketch)

```text
User dwells on N ≥ settle (and longer browsing)
  → Neighbors N±1… enter byte warm / display-ready (budget + slots)

User navigates to N+1 (any entry)
  → Immediately: paint underlay if minimapSrc exists
  → In parallel: decode main src (fast reveal / layer promote if display-ready)
  → Original fully drawable: atomic replace underlay
  → After settle: warm new neighbors (for the next long-dwell step)

User taps → (short press)
  → Exactly one step; a instantly-ready next thumb does not chain

User holds → past repeat delay
  → Per image: underlay (or ready) + min step interval → then one more step
  → Release: stop; no silent jump of 100 indexes
```

---

## 6. Non-goals & misconceptions

| Misconception | Correct reading |
|---------------|-----------------|
| Dropping the thumb makes it faster | On large files this usually means a black stage; P0 is paintable content. |
| Byte `ready` = instant sharp | Need display-ready (decode settled + same-DOM keep-alive promote). Mid/light strip green is often byte-level only. |
| Settle 600ms slows the current image | It only gates **neighbor** warm-up. |
| Faster key-repeat is better UX | Hold should follow thumb pace; the premium path is long-dwell → next. |
| Corner minimap = main placeholder | Main flow uses `minimapSrc` underlay; `showMinimap` is navigation chrome. |
| Offscreen `opacity: 0` `<img>` is enough | **Not** (especially WKWebView): the compositor often drops decoded bitmaps; keep-alive needs non-zero opacity (see §9). |
| Any UI activity should pause neighbor warm | **No**: if control auto-fade mistakenly clears `panIdle` and never restores it, display-ready dies forever — “waited 5s, strip green, still cold ≈1s”. |

---

## 7. Host checklist (flow-related)

- [ ] Large images have on-disk/cached **`minimapSrc`** distinct from `src`
- [ ] `progressiveMain` enabled
- [ ] `preloadRadius` + `preloadMemoryBudgetBytes` (and size estimates) wired
- [ ] Default `preloadDisplayMode="slot"`; degrade only under memory pressure
- [ ] Dwell a few seconds then → → near-instant sharp; cold nav still thumb then original
- [ ] Hold → → visible one-thumb-after-another, not index racing ahead of paint

Full Tauri memory / props examples: [`media-lens-integration.md`](./media-lens-integration.md).

---

## 8. Code map

| Topic | Location |
|-------|----------|
| Progressive underlay → original / fast-path races | `useProgressiveMainImage.ts` |
| Fully drawable / atomic reveal / WeakSet fast path | `lib/imagePreviewDecode.ts`, `ImagePreviewInner` |
| Neighbor layer reuse + 1×1 keep-alive | `parts/DisplayStageLayers.tsx` |
| Keep-alive opacity constant | `imagePreviewTuning.ts` → `DISPLAY_LAYER_KEEPALIVE_OPACITY` |
| Display-ready pick, settle, panIdle, sticky src | `lib/neighborDisplayPreload.ts`, `useNeighborDisplayPreload.ts` |
| Byte warm settle | `useNeighborPreload.ts` |
| Short-press / long-press pacing | `useThumbPacedNavigation.ts`, `useImagePreviewKeyboard.ts` |
| Local large-JPG timing (dev) | `demos/Demo6LocalLarge.tsx` (sidebar `path` / `next` phase / sharp ms) |

---

## 9. Validated implementation details (long dwell → near-instant)

What actually worked on Demo 6 / large JPGs: after dwelling a few seconds on a **display-ready** neighbor, sidebar shows `path=fast` and `sharp` far below cold ~1s (often ≪200ms; good runs ~30ms).

### 9.1 Overview: conditions for fast reveal

```text
Dwell on N long enough
  → settle elapsed and panIdle (neighbor warm allowed)
  → neighbor N±1 full-src <img> mounted; load + decode settled
  → readySrc sticky; strip phase = display-ready (brightest green)
  → compositor still holds the bitmap (non-zero opacity keep-alive;
     ready layers not unmounted during settle pause)

Navigate to N+1
  → React reuses the same DOM node via key={src} (1×1 → full layout)
  → preferFastReveal: skip secondary new Image() probe; drain layout pending race
  → scheduleRevealAfterDecode hits decodeSettled WeakSet → microtask reveal
  → underlay drops; sharp near-instant
```

Break any link and you fall back to **cold ≈ 1s** (typical: warm paused by mistake, `opacity:0` bitmap eviction, or fast path still waiting on a full-src probe).

### 9.2 Compositor keep-alive (don’t let the WebView “lazy out”)

**Problem:** Neighbor layers at `opacity: 0` / `visibility: hidden` often lose decoded bitmaps in WKWebView/Chromium. Strip may have been display-ready, but promote still costs ~0.5–1s `createImageBitmap`; A↔B thrashing pays that each way.

**Approach (`DisplayStageLayers` + `DISPLAY_LAYER_KEEPALIVE_OPACITY ≈ 0.02`):**

| Layer | Layout | Opacity | Notes |
|-------|--------|---------|-------|
| Neighbor (not current) | **1×1 CSS px** | keep-alive > 0 | Convince the compositor the image must paint; invisible in practice; stable `key={src}` |
| Current while under thumb | **Full size** | keep-alive > 0 | Never `visibility:hidden` right before promote |
| Current revealed | Full size | `1` | Normal |
| Thumb underlay | Cover | `1`→`0` | **Higher z-index** so keep-alive never ghosts through |

On promote, the same `<img>` only changes style (1×1 → natural size, opacity → 1) — no `src` reload, no key change.

### 9.3 Fast path: no second probe, drain races

**Problem:** Even with a decoded DOM node, progressive still did `new Image(); img.src = mainSrc` for layout — ~1s on large JPGs. Layout microtask `onMainImgDecoded` often ran while stage was still `preloading` (pending only); promoting to placeholder without draining pending waited on that probe.

**Approach (`useProgressiveMainImage`):**

1. `preferFastReveal && knownDimensions` (from display-ready meta) → **skip** the main `Image()` probe.
2. Entering `thumbnail-placeholder` via known dims **drains pending** and `armReveal` (dwell=0).
3. If decode completes during `preloading` with known dims → promote + reveal immediately (no effect ordering dependency).

Cold path keeps the probe + placeholder min visible time (e.g. Demo 6 dwell).

### 9.4 Neighbor warm gates: settle & panIdle (pitfall fixed)

| Gate | Role | Caution |
|------|------|---------|
| `preloadDisplaySettleMs` (default 600) | Debounce neighbor warm after nav | Does **not** delay current main |
| `panIdle` / `interactionBusy` | Pause neighbor decode while panning / minimap-dragging | **Only** those interactions should clear panIdle |

**Fixed bug:** Control auto-fade `resetHideTimer` called `notifyInteraction()` on every mouse/key activity, leaving `panIdle=false` forever → display-ready **never ran**. Symptom: wait 5s+, strip “green”, still `path=cold` / `sharp≈1s`. Now: **fade timer does not touch panIdle**; `notifyInteraction` re-`armPanIdle` after a short idle.

**Retain layers during settle:** While *new* warm-up is paused, `slotRenderEntries` still mounts neighbors whose src is already in `readySrc` so keep-alive DOM is not torn down on every hop.

**Sticky strip:** `display-ready` is sticky by **src** across flat indexes (matches `isSrcDisplayReady`); do not treat mid-green byte `ready` as instant-sharp.

### 9.5 Short press vs long press (hold)

- **Press**: one immediate step (a short tap is just that step).
- **Still held**: after the new image has **painted** main-stage content, wait `holdMinVisibleMs`; step again only if still held. At most one dwell timer — **release stops; no queue**.
- **Clock start (important)**: “a presented frame”, not raw `onLoad` / known dimensions.
  - Candidate: stage opacity-ready (`imageShowReady`) and underlay or main bitmap loaded.
  - Confirm: `decode()` on that layer (cheap for thumbs) + **two rAFs**, then start `holdMinVisibleMs`. Once confirmed for a visit, underlay→full reveal does not reset the clock.
  - On every `src` change, force stage opacity 0 first (even when meta dims stay set) so the black flash cannot start the dwell.
  - Still black + Loading: **do not** count time or advance.
- No thumb and original not ready: stay on the index with the centre spinner; never skip ahead.

### 9.6 Acceptance (Demo 6)

1. Enable `preloadDisplaySlots`; dwell a few seconds.
2. Sidebar **`next` phase = `display-ready`** (do not only watch `here`).
3. ←/→: expect **`path=fast`**, `sharp` ≪ cold ~1s (success often ≪200ms; good runs ~30ms).
4. Toggle slots off for cold A/B.
5. A↔B thrash: with keep-alive, round-trips stay much faster than cold.
