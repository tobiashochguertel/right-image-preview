# Media Lens → right-image-preview integration

[中文](./media-lens-integration.zh-CN.md)

Guide for **Media Lens** (Tauri + React) integrating `right-image-preview` **≥ 0.3.x** with display-ready neighbor preload.

Canonical API tables: [`api.md`](./api.md). Main display / navigation flow (thumb then original, long-dwell fast path): [`main-display-flow.md`](./main-display-flow.md). This doc is the product-facing checklist.

---

## 1. Goals

| Goal | How |
|------|-----|
| Preview embedded in the workspace (sidebar stays usable) | `presentation="contained"` |
| Flat filmstrip across the visible sequence | `showThumbnails` + `thumbnailsScope="flat"` |
| Faster ←/→ on large local files | `preloadRadius` + **display-ready** budget (not byte-green alone) |
| Host owns device memory policy | Pass `preloadMemoryBudgetBytes` from Tauri; viewer picks how many neighbors fit |

**Do not** treat strip `ready` / light-green “warm” as “instant sharp.” Only phase **`display-ready`** with default `preloadDisplayMode="slot"` promotes the **same already-decoded DOM `<img>`** into view (no second ~1s decode). Mode `"decode"` warms bytes/decode caches but often still re-decodes on navigate.

---

## 2. Recommended props (Media Lens)

```tsx
import {
  ImagePreview,
  rgbaDecodedBytes,
  suggestPreloadMemoryBudgetBytes,
  type ImageItem,
} from 'right-image-preview';

// Once at app start / when window gains focus (from Tauri invoke):
const availableBytes = await invoke<number>('get_available_memory_bytes');
const preloadMemoryBudgetBytes = suggestPreloadMemoryBudgetBytes(availableBytes);
// optional hard ceiling if you want ±1 even on huge RAM:
const preloadDisplaySlots = 4;

<ImagePreview
  presentation="contained"
  chrome="minimal"
  images={items}
  visible
  index={index}
  onIndexChange={setIndex}
  showThumbnails
  thumbnailsScope="flat"
  preloadRadius={2}
  // Budget-first: slots can be 0 — viewer uses ceiling 6 and fills by budget
  preloadMemoryBudgetBytes={preloadMemoryBudgetBytes}
  preloadDisplaySlots={preloadDisplaySlots}
  estimateDecodedBytes={(item) => {
    const w = Number(item.exif?.width);
    const h = Number(item.exif?.height);
    if (w > 0 && h > 0) return rgbaDecodedBytes(w, h);
    // fall back if you know file megapixels from your indexer
    return rgbaDecodedBytes(6000, 4000); // or library default (~12MP)
  }}
  preloadDisplayMode="slot" // "decode" if WKWebView memory spikes
  showThumbnailPreloadStatus={import.meta.env.DEV} // optional debug
  showFlip={false}
  progressiveMain
  language="en"
  onClose={...}
/>
```

Stable props while browsing are **expected**. Mixed 6K / 9K folders: the viewer re-picks neighbors on each index change using per-item estimates.

---

## 3. Tauri: reading available memory

Component **does not** call OS APIs. Example Rust command (sketch):

```rust
// Cargo: sysinfo
#[tauri::command]
fn get_available_memory_bytes() -> u64 {
  let mut sys = sysinfo::System::new();
  sys.refresh_memory();
  sys.available_memory() // bytes
}
```

```ts
const available = await invoke<number>('get_available_memory_bytes');
const budget = suggestPreloadMemoryBudgetBytes(available);
// default: ~12% of available, capped at 1.5 GiB
```

Refresh on startup and optionally when the main window is focused after long idle.

`navigator.deviceMemory` (Chromium) is a coarse fallback (GiB, privacy-rounded) if you are not ready for a Rust command yet.

---

## 4. Responsibility split

| Media Lens | right-image-preview |
|------------|---------------------|
| Available / total RAM, product aggressiveness | Which neighbors within `preloadRadius` fit the budget |
| Provide `exif.width` / `height` (or custom `estimateDecodedBytes`) | `load` + `decode()` → exact `display-ready` |
| Folder tree, disk cache, stars | Fast reveal on display-ready (no dwell/spinner); underlay until viewport drawable |

Budget applies to the **neighbor pool only**. The current main image is extra RAM on top — size the fraction accordingly (12% of *available* is a starting point).

---

## 5. Memory ballpark (RGBA ≈ w×h×4)

| Size | ~Decoded |
|------|----------|
| 6000×4000 | ~96 MB |
| 7000×4600 | ~123 MB |
| 9000×5000 | ~180 MB |

With current + two neighbors of ~9K: on the order of **0.5 GiB+** decoded before browser overhead. Prefer budget + `preloadDisplaySlots` ≤ 4 on 16 GB machines; be tighter on 8 GB / WKWebView.

---

## 6. Status phases (if you listen or show strip bars)

| Phase | Meaning |
|-------|---------|
| `loading` / `ready` | Byte preload (`Image()`). **Does not** skip progressive. |
| `display-ready` | `decode()` settled in a slot. Navigate → no artificial dwell / spinner; **keep** `minimapSrc` until viewport main is drawable |
| `warm` | Bytes seen earlier this session, outside window. Not display-ready. |

---

## 7. Acceptance checklist

- [ ] `presentation="contained"` — sidebar usable; no full-page modal a11y
- [ ] `preloadRadius={1|2}` + `preloadMemoryBudgetBytes` from Tauri
- [ ] Items carry width/height for estimates when possible
- [ ] Navigate to a neighbor that reached `display-ready` → **no** black wait; with `minimapSrc`, brief underlay then sharp; no long spinner
- [ ] Navigate far outside the window → progressive underlay still OK
- [ ] Large JPGs (~20–30MB) need disk `minimapSrc`; otherwise cold and fast paths both blank while decoding
- [ ] If memory spikes: `preloadDisplayMode="decode"` or lower budget / slots

---

## 8. npm

```bash
npm install right-image-preview@^0.3.2
```

Use **0.3.2+** (display-ready underlay + atomic reveal fixes; exports `suggestPreloadMemoryBudgetBytes`).
