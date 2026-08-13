# Main display & navigation flow

[中文](./main-display-flow.zh-CN.md)

Product-level description of **right-image-preview**: what appears on stage when navigating to the next image, and how we make “stay long enough, then step” show the original as fast as possible.

Props and defaults: [`api.md`](./api.md). Media Lens / Tauri checklist: [`media-lens-integration.md`](./media-lens-integration.md).

---

## 1. Core goals

| Priority | Goal |
|----------|------|
| **P0** | **Never prefer an empty stage**: a thumbnail placeholder beats a long black/blank wait. |
| **P0** | **Outgoing hold**: if the previous full-`src` frame was already showing, keep it full-size and visible until the incoming image is paintable, then demote it to neighbor keep-alive — **never** fill the gap with stage-wide `opacity: 0`. |
| **P0** | **Always show something paintable first**: if a main-area thumb (`ImageItem.minimapSrc`) exists, show it enlarged as underlay; only without a thumb do we go straight to the original. |
| **P0** | **Original loads in parallel with the placeholder**: the moment we land on an image, start decoding/rendering its real `src`; when the original is fully drawable, drop the thumb underlay immediately. |
| **P0** | **Fast original after a long dwell**: after staying on the previous image long enough (e.g. ~3s+), stepping to a **display-ready** neighbor (**blue** strip bar) should promote the retained decoded layer and skip a second full-`src` probe so sharp appears near-instantly. |
| **P1** | **Rapid hold must not flood decode**: fast ←/→ advances only after the main-area thumb for the current index has painted. |

“Main-area thumbnail placeholder” means the progressive underlay in the center stage (`minimapSrc`), **not** the corner navigation minimap (`showMinimap`).

---

## 2. One navigation step: what the stage does

Keyboard ←/→, side arrows, filmstrip click, `goTo` / controlled `index`, group jumps — all share the same **current main image** contract:

```text
Land on index N+1 (previous was N)
    │
    ├─ Outgoing hold: N stays full-size and visible; N+1 prepares on top
    │     └─ N+1 fully drawable → N+1 is the sole main visible layer; N demotes to neighbor keep-alive
    │
    ├─ Distinct minimapSrc (and progressiveMain on)
    │     ├─ Thumb underlay may still run (full previous frame is preferred anti-black cover)
    │     └─ In parallel: fetch / decode / layout real src
    │
    └─ No minimapSrc → outgoing hold still prevents black until the original is drawable
```

Notes:

1. **Thumb first, then original** is the default path; “no thumb → hard-load original” is a fallback, not the recommended setup.
2. The switch frame does **not** wait for the original before giving visual feedback; **outgoing hold** runs in parallel with placeholder / original prep.
3. Reveal requires a **fully drawable** bitmap (e.g. `createImageBitmap` / settled `decode` + double `rAF`) so a progressive JPEG cannot flash a left/top strip.
4. If the neighbor was already **display-ready**, use **fast reveal**: skip artificial dwell / center spinner; outgoing hold still covers the gap until the viewport main is drawable — never blank solely to look “instant.”
5. Brief overlap with mismatched aspect (a sliver of the previous image) is acceptable; hold-scrubbing especially depends on this contract so half the time is not black.
6. **Hold pacing “presented” tracks the incoming image only** (thumb underlay or new main), not the held previous frame — otherwise steps would advance too fast.

Code entry points: `useProgressiveMainImage`, `DisplayStageLayers` (`isOutgoing`), `ImagePreviewInner` outgoing state, `lib/imagePreviewDecode.ts`.

### 2.1 Stage floors (DOM order; minimize z-index)

Inside the preview, floors stack by **later sibling paints above earlier**:

| Floor | `data-rip-floor` | Contents |
|-------|------------------|----------|
| L1 content | `content` | Main + neighbor / outgoing hold (`DisplayStageLayers` in one shell; `z-index:0` **isolates** so inner stacking cannot cover higher floors) |
| L2 hit | `hit` | Transparent pan / double-click zoom target (`z-index:1`) |
| L3 chrome | `chrome` | Close, ←/→, toolbar + filename, minimap, filmstrip, EXIF (`z-index:2`; shell `pointer-events: none`; children opt into `auto`) |
| L4 loading | `loading` | Center spinner + error fallback — **always topmost** (`z-index:3`) |

Outgoing hold and neighbor keep-alive order only inside **L1**; do not paper over conflicts with large ad-hoc z-index values between spinner and the image stack.

**Three beats on navigate:**

1. **Immediately:** `currentIndex` advances → filmstrip active border (and strip position) move to the new index; L1 may still show the previous frame via **outgoing hold**.
2. **While waiting:** as long as outgoing covers the stage and `showSwitchLoader` is true (default), **L4 loading** shows the center spinner. The previous frame must stay **full-size and opaque**; brief overlap with the next frame is fine. **Never** shrink the previous frame to 1×1 before the incoming full-size main has painted (that is the Media Lens “black + one pixel” regression).
3. **On reveal:** only after incoming is `imageShowReady`, has dims, and its `<img>` is paintable — then **double rAF** so paint can commit — clear `isOutgoing` and demote the previous layer to neighbor **1×1 keep-alive**. Spinner turns **off in the same frame** (no fade).

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
6. **Layer retention + compositor keep-alive**: `DisplayStageLayers` keeps current + neighbor full-`src` imgs under `key={src}`. Non-sharp neighbors paint as **1×1 + opacity 1** (not a full-size translucent plate); current `<img>` while under the thumb underlay is also 1×1 while the underlay uses the full box — so WKWebView/Chrome do not discard decoded bitmaps.
7. **Fast path**: on display-ready, skip dwell/spinner; underlay only until the viewport is drawable.

---

## 4. Rapid scrub / held ←→: pacing

Goal while holding: **each index must show its main-area thumb before advancing** — no “logic skipped 100 indexes while only ~8 thumbs painted.”

| Mechanism | Behavior |
|-----------|----------|
| **Thumb-paced hold** | First step on press is immediate. Then each landed image must show **presented incoming** stage content (thumb underlay bitmap, or full original if no thumb) for `holdMinVisibleMs` before another step, and only if still held. The outgoing held previous frame does **not** count as presented. Layout/meta size alone does **not** start the clock (avoids black+Loading eating the dwell). Release cancels the single timer — **no step queue**. Spinner stays while waiting on a no-thumb original. |
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
| Byte `ready` = instant sharp | Need display-ready (decode settled + same-DOM keep-alive promote). Strip **green** is often byte-level / warm only; **blue** is display-ready. |
| Settle 600ms slows the current image | It only gates **neighbor** warm-up. |
| Faster key-repeat is better UX | Hold should follow thumb pace; the premium path is long-dwell → next. |
| Corner minimap = main placeholder | Main flow uses `minimapSrc` underlay; `showMinimap` is navigation chrome. |
| Offscreen `opacity: 0` `<img>` is enough | **Not** (especially WKWebView): prefer **1×1 opaque** paint (see §9). |
| Any UI activity should pause neighbor warm | **No**: if control auto-fade mistakenly clears `panIdle` and never restores it, display-ready dies forever — “waited 5s, strip blue, still cold ≈1s”. |

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
| Keep-alive strategy | Non-sharp: `1×1` + `opacity: 1` (not full-frame translucent) |
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
  → readySrc sticky; strip phase = display-ready (**blue** bar)
  → compositor still holds the bitmap (1×1 opaque keep-alive;
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

**Approach (`DisplayStageLayers`):**

| Layer | Layout | Opacity | Notes |
|-------|--------|---------|-------|
| Neighbor (not current / not outgoing) | **1×1 CSS px** | `1` | Compositor still paints → keep-alive; invisible; stable `key={src}` |
| Current while under thumb | Full box (for underlay); **`<img>` 1×1** | `1` | Never `visibility:hidden` right before promote |
| Current revealed / outgoing hold | Full size | `1` | Normal |
| Thumb underlay | Cover current box | `1`→`0` | Covers unrevealed main |

On promote, the same `<img>` only changes style (1×1 → natural size) — no `src` reload, no key change. Do **not** keep full frames at ~2% opacity (dark ghost through the frosted overlay).

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

**Sticky strip:** `readySrc` / `isSrcDisplayReady(src)` stay sticky by **src** (fast reveal when returning); strip **blue** bars only mark indexes in the **current neighbor slot window** that are decoded (`radius`/`slots`, often ±1). Outside the window they fall back to **green** `warm` (cache hint) — not instant-sharp.

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
