# Main Display Flow (v0.4)

This document describes only the current implementation. The static-raster main stage no longer has a DOM `<img>` fallback, outgoing layers, 1×1 keep-alive, or slot decoding.

## Raster presentation

```text
MediaSource → fetch/Blob → createImageBitmap → WebGL2 texture → GPU fence → atomic presentation
```

- The Canvas persists for the Viewer lifetime. SVG, animated-image, and video temporarily hide it and pause new prefetch while resident textures remain cached.
- Old Canvas pixels remain until the incoming upload fence completes. `display-ready` atomically selects the texture and closes the spinner.
- Preview may come from `minimapSource/minimapSrc`; Screen covers the live image stage; Full upgrades only the settled current item. The current Screen remains resident while Full is drawn, and the just-left Screen stays protected for an immediate return after navigation.
- `onPresented` fires on the frame after the new texture draw and starts hold-navigation dwell timing.

## Viewport and DPR

Viewport means the image-stage DIV, not the screen or application window. `ResizeObserver` reads its CSS box and multiplies it by `window.devicePixelRatio` to obtain backing/source-pixel demand. Window resize, sidebars, contained layouts, and fullscreen all re-plan LOD automatically.

For a 100 CSS-pixel-wide stage at DPR 1.5, Screen needs about 150 source pixels for 1:1 sampling. Use the DPR reported by the WebView for the active macOS display mode; do not derive it from physical-panel resolution divided by the selected scaled resolution.

## Dynamic LOD

- Preview: optional low-resolution first frame.
- Browse: 60% of Screen linear dimensions for lower-cost distant instant navigation.
- Screen: covers image-stage DIV × DPR; under a normal budget the floor is three forward and two backward.
- Full: current-only, delayed by `fullResolutionSettleMs`, and cancellable while navigating.

Counts are not fixed. The planner estimates each RGBA8 texture. If every candidate Screen texture fits, every candidate is Screen; otherwise its contiguous Screen core scales from one item on each side under pressure through the normal three-ahead/two-behind case, then a fixed contiguous Browse ring expands from that core. A green hole therefore cannot appear between ready blue/violet items, and Browse is never automatically promoted to Screen.

The continuous navigation corridor is supplemented by a separate, budget-admitted history pin set. On leaving an image, its already-resident Screen texture becomes the most-recent candidate; the current image keeps its Screen companion even after Full appears. The cache first reserves current plus the nearest forward/backward Screen pair, then retains as many recent existing Screen textures as the remaining budget allows. History is retention-only: an evicted or absent item is never fetched, decoded, or uploaded merely to restore history. This makes non-contiguous thumbnail toggles such as 4 ↔ 11 fast without turning the directional corridor into a holey plan. Demo 6 exposes corridor and history indexes separately.

## Status bars

- Blue: a Screen/Full upload fence completed and its texture is still resident.
- Violet: a Browse texture is resident and immediately drawable but may refine afterward.
- Green: original transfer progress or a completed response in this Viewer session; it is a cache hint, not GPU residency.

See [Rendering Architecture](./rendering-architecture.md) and [API](./api.md).
