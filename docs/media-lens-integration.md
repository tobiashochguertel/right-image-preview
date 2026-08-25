# Media Lens Integration (v0.4)

The static-raster main stage is WebGL2-only. Hosts provide resources and an optional hardware-derived budget; DOM slot/decode modes no longer exist.

```tsx
import {
  ImagePreview,
  suggestRasterHardwareTextureBudgetBytes,
} from 'right-image-preview';

const textureBudget = suggestRasterHardwareTextureBudgetBytes({
  totalMemoryBytes,
  availableMemoryBytes,
  gpuBudgetBytes, // when Metal/DXGI/Vulkan can provide one
});

<ImagePreview
  images={images}
  preloadRadius="auto"
  preloadMemoryBudgetBytes={textureBudget}
  fullResolutionSettleMs={300}
  showThumbnails
  showThumbnailPreloadStatus
  fitMaxNativePercent={100}
  rasterDecodeWorkers="auto"
  rasterDecodeWorkerMax={3}
/>
```

Tauri can obtain total/available RAM through `sysinfo`; use Metal `recommendedMaxWorkingSetSize`, DXGI `QueryVideoMemoryInfo`, or Vulkan `VK_EXT_memory_budget` when available. These values guide the ceiling. The WebGL cache hard-admits the logical `width × height × 4` RGBA8 payload before upload; it cannot account for driver copies, framebuffers, or decoder working sets, so this is not a process-wide physical-VRAM ceiling. Browsers fall back to conservative display tiers because they cannot query free VRAM.

Raster URL fetch, Blob chunk assembly, and decode use the same preemptible Dedicated Worker pool; the main thread only schedules work, receives progress/`ImageBitmap`, and performs serial upload. Auto mode uses 1–3 workers from logical CPU concurrency, while >80MP sources run exclusively to bound progressive-JPEG working sets. Tauri hosts may pass an explicit result from `resolveRasterDecodeWorkerCount({ hardwareConcurrency: logicalThreads })`; keep the maximum at 3 unless platform benchmarks justify a different future policy.

The published package uses an inline Blob Worker, so Tauri/WebView CSP must include `worker-src blob:`. If policy blocks Worker construction, decoding falls back to the main thread and ultra-large progressive JPEGs may block UI again.

Provide original pixel dimensions through `ImageItem.exif.width/height` when possible. The component measures its image-stage DIV through `ResizeObserver`; hosts should not pass screen dimensions. Photo-viewer hosts should pass `fitMaxNativePercent={100}` so large images still downscale to fit, while small images stay 1:1 instead of being upscaled to fill the window. Zoom above 100% should only come from wheel / keyboard / typed percent / zoom lock.

The old `preloadDisplaySlots`, `preloadDisplayMode`, `preloadDisplaySettleMs`, `estimateDecodedBytes`, and `suggestPreloadMemoryBudgetBytes` APIs have been removed.
