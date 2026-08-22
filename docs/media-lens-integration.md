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
/>
```

Tauri can obtain total/available RAM through `sysinfo`; use Metal `recommendedMaxWorkingSetSize`, DXGI `QueryVideoMemoryInfo`, or Vulkan `VK_EXT_memory_budget` when available. These values guide the ceiling, while the WebGL cache still evicts against actual texture bytes. Browsers fall back to conservative display tiers because they cannot query free VRAM.

Provide original pixel dimensions through `ImageItem.exif.width/height` when possible. The component measures its image-stage DIV through `ResizeObserver`; hosts should not pass screen dimensions. Photo-viewer hosts should pass `fitMaxNativePercent={100}` so large images still downscale to fit, while small images stay 1:1 instead of being upscaled to fill the window. Zoom above 100% should only come from wheel / keyboard / typed percent / zoom lock.

The old `preloadDisplaySlots`, `preloadDisplayMode`, `preloadDisplaySettleMs`, `estimateDecodedBytes`, and `suggestPreloadMemoryBudgetBytes` APIs have been removed.
