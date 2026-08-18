# Media Lens 集成（v0.4）

静态位图主舞台现在只使用 WebGL2。宿主传资源与可选硬件预算，不再配置 DOM slot/decode 模式。

```tsx
import {
  ImagePreview,
  suggestRasterHardwareTextureBudgetBytes,
} from 'right-image-preview';

const textureBudget = suggestRasterHardwareTextureBudgetBytes({
  totalMemoryBytes,
  availableMemoryBytes,
  gpuBudgetBytes, // Metal/DXGI/Vulkan 能取得时传入
});

<ImagePreview
  images={images}
  preloadRadius="auto"
  preloadMemoryBudgetBytes={textureBudget}
  fullResolutionSettleMs={300}
  showThumbnails
  showThumbnailPreloadStatus
/>
```

Tauri 可用 `sysinfo` 获取总/可用 RAM；macOS Metal 使用 `recommendedMaxWorkingSetSize`，Windows DXGI 使用 `QueryVideoMemoryInfo`，Vulkan 使用 `VK_EXT_memory_budget`。这些值是规划上限提示，WebGL cache 仍按实际 texture bytes 执行回收。浏览器拿不到剩余显存时，组件使用保守显示器档位。

为提高首次规划准确度，请在 `ImageItem.exif.width/height` 中提供原图像素尺寸。视口由组件内部图片舞台 DIV 的 `ResizeObserver` 自动测量，宿主不应传屏幕尺寸。

旧的 `preloadDisplaySlots`、`preloadDisplayMode`、`preloadDisplaySettleMs`、`estimateDecodedBytes`、`suggestPreloadMemoryBudgetBytes` 已删除。
