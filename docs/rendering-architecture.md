# v0.4 Rendering Architecture

## Boundaries

`ImagePreview` keeps one Viewer Shell for navigation, toolbar, filename, filmstrip, EXIF, contained/overlay presentation, keyboard routing, and the imperative ref API. The Shell sends `ViewerCommand`s to the active media module and disables controls through `MediaCapabilities`.

The main stage dispatches by media kind:

- `raster`: WebGL2 canvas, the only production main renderer for static JPEG, PNG/WebP, AVIF, BMP, TIFF, and similar images;
- `svg`: native browser SVG decoding through `<img>` plus module-owned CSS transforms;
- `animated-image`: native `<img>` playback for GIF/APNG/Animated WebP;
- `video`: an independent `<video>` branch with intentionally limited beta transform capabilities;
- `unknown`: an explicit unsupported state instead of guessing and sending arbitrary bytes to WebGL.

Thumbnails and the minimap may still use `<img>`; the WebGL-only rule applies to the static-raster main stage.

## MediaSource and hosts

```ts
type MediaSource =
  | { type: 'url'; href: string }
  | { type: 'blob'; blob: Blob; mimeType?: string }
  | { type: 'bytes'; data: ArrayBuffer; mimeType?: string };
```

Web apps provide an http(s), `blob:`, or `data:` URL. VS Code extensions convert a resource to a Webview-accessible URI first. Tauri hosts provide an asset URL, Blob, or bytes. The component never calls `fs`, VS Code APIs, or Tauri APIs.

The legacy `src` API remains supported. `ImageItem.source`/top-level `source` performs the actual load when present, while `src` can remain the stable identity and thumbnail compatibility value. Hosts may supply `kind`; otherwise detection uses bytes, MIME, URL, and filename hints. PNG/WebP headers are inspected to distinguish static from animated content.

Owned object URLs are revoked on viewer teardown. Every decoded `ImageBitmap` is closed after texture upload.

## Raster WebGL2 pipeline

```text
MediaSource
  → Blob (Blob inputs are not copied)
  → createImageBitmap
  → aspect-preserving MAX_TEXTURE_SIZE clamp
  → texImage2D
  → GPU fence signaled
  → TextureCache
  → atomic current-texture switch
```

The canvas backing store is CSS viewport × DPR. Quad geometry applies zoom, pan, rotate, and flip. There is no continuous idle render loop; rendering is invalidated only by texture, transform, viewport, or context changes.

While a new texture is pending the canvas is not cleared, so the previous frame remains visible. Preview/Screen/Full races are generation-guarded. Neighbor work uses a bounded priority queue with a reserved foreground lane and the same texture cache. `preloadMemoryBudgetBytes` is the GPU cache budget; the current texture is protected and other entries are evicted by priority then approximate LRU with explicit `deleteTexture` calls.

The WebGL Raster stage remains mounted for the full Viewer Shell lifetime, including while SVG, animated images, or video is active. Non-Raster media puts the Canvas into a `visibility: hidden` dormant state: it does not draw or receive interaction, but its context, pipeline, and texture cache remain alive. Returning to Raster explicitly redraws the cached texture and never relies on an old `preserveDrawingBuffer` frame. New Raster decode/upload work is suspended while video is playing or an animated image is displayed; already resident textures remain cached. Context loss is the only path that rebuilds all GPU resources.

Raster-to-raster navigation reuses the same context and cache. Here viewport strictly means the image-stage DIV, not the screen or application window. `ResizeObserver` reads its CSS box and multiplies by the WebView's actual DPR. Window dragging, side-panel changes, contained layout, and fullscreen therefore re-plan automatically. `preloadRadius="auto"` estimates each candidate's Screen bytes from that backing box. When all candidates fit, all are Screen; otherwise P75 Screen cost determines a contiguous core ranging from one item on each side under pressure to the normal three-ahead/two-behind case, with a contiguous fixed Browse ring outside it. The active direction receives the first item at a tie, but both sides remain near-even; a nearer candidate is never skipped and Browse is never automatically promoted to Screen. There is no fixed total count.

Browse/Screen requests carry a viewport generation. On a size-class change an old Screen texture is retained as violet Browse when it still meets that target, otherwise it is released. Queued old-size work is cancelled and an already-running browser decode cannot overwrite the new plan. Blue means resident and sufficient for the current image-stage DIV × DPR; violet means resident immediately drawable medium detail.

Browsers expose no available-VRAM API, so display tiers remain a web fallback rather than hardware detection. Tauri hosts should provide total/available RAM from `sysinfo` and, when available, Metal recommended working set, DXGI video-memory budget, or Vulkan memory budget to `suggestRasterHardwareTextureBudgetBytes`. The component still accounts actual uploaded texture bytes; an explicit `preloadMemoryBudgetBytes` fully overrides the browser fallback.

URL originals are acquired through streaming `fetch`. When `Content-Length` is visible, transfer progress is based on received bytes and throttled to roughly 1% or 200 ms; an unknown total produces an explicit indeterminate state. Completed-download history is separate from GPU residency: green is a browser-cache hint after a complete response, while blue requires a signaled upload fence and a still-resident texture. Texture eviction or context loss downgrades blue to green without forgetting that the response completed. Cross-origin servers must allow CORS and expose `Content-Length` through `Access-Control-Expose-Headers` for a true percentage.

Context loss enters `restoring`, discards invalid handles, rebuilds shaders/buffers after restoration, advances the generation, and reloads the current source. Images beyond `MAX_TEXTURE_SIZE` are downscaled in beta; tiled/LOD rendering remains a future 0.4.x extension.

## Navigation backpressure and quality promotion

Keyboard and side arrows share one queue-free hold state machine. Pressing steps once immediately; the first automatic continuation must also pass `holdRepeatDelayMs` (300ms by default). After landing, the per-image `holdMinVisibleMs` clock (200ms by default) starts only when the active renderer confirms a committed main-stage frame through the shared `onPresented` boundary. The next step is dispatched only after all applicable gates pass. Release cancels the only timer, native `keydown.repeat` is ignored, and no backlog can drain afterward. Even `holdMinVisibleMs=0` yields through a cancellable zero-delay event-loop turn so keyup remains a hard stop.

Raster WebGL reports presentation on the rAF following its incoming texture draw; SVG, animated-image, and Video renderers report from their own commit paths. Production pacing never queries an `<img>`, so persistent Canvas and mixed-media switches do not stall continuation.

LOD uses a separate trailing-settle policy: far neighbors prepare Browse at 60% of the current stage box's linear dimensions and near neighbors use full Screen. Full is current-only and starts after `fullResolutionSettleMs` (300ms by default) without further navigation. Full promotion is suspended during hold and only the final landed item is scheduled after release. Full atomically replaces Screen while retaining the current Screen texture; leaving releases old Full. Full still respects `MAX_TEXTURE_SIZE`; truly tiled rendering remains future 0.4.x work.

## Thumbnail strip

The bottom thumbnail strip remains semantic buttons with native `<img>` elements and horizontal window virtualization; only visible items plus overscan are mounted. Small thumbnails benefit from browser image caching, lazy decode, native focus, and click/accessibility semantics. A blue bottom edge means the main texture is still immediately drawable; green tracks the original request. The active tile still uses only its selection border. A single Canvas/WebGL atlas would require custom atlas allocation, hit testing, scrolling, focus, and an accessibility mirror without enough benefit at the current scale. A separate GPU thumbnail renderer should only be reconsidered for thousands of simultaneously animated/effected timeline cells; it would not share the main Raster renderer architecture.

## v0.3 to v0.4

- Raster no longer relies on outgoing DOM images, 1×1 keep-alive, double-rAF reveal, or slot decode. Their product intent is covered by retained textures, upload fences, and atomic switching.
- Legacy DOM knobs such as `preloadDisplayMode` and `preloadDisplaySlots` have been removed. Raster is driven only by `preloadRadius`, the live viewport, and the texture budget.
- No WebGL1 renderer or second full DOM Raster architecture is maintained. WebGL2 failure is explicit.
- SVG, animated images, and video share the Shell but own their media-specific behavior.
