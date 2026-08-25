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
  fitMaxNativePercent={100}
  rasterDecodeWorkers="auto"
  rasterDecodeWorkerMax={3}
/>
```

Tauri 可用 `sysinfo` 获取总/可用 RAM；macOS Metal 使用 `recommendedMaxWorkingSetSize`，Windows DXGI 使用 `QueryVideoMemoryInfo`，Vulkan 使用 `VK_EXT_memory_budget`。这些值是规划上限提示。WebGL cache 对 `width × height × 4` 的逻辑 RGBA8 payload 执行上传前硬准入；它不能计量驱动内部副本、帧缓冲或解码工作集，因此不是整个进程的物理显存硬上限。浏览器拿不到剩余显存时，组件使用保守显示器档位。

Raster URL 的 fetch、分块 Blob 组装和解码使用同一套可抢占 Dedicated Worker pool，主线程只负责调度、接收进度/`ImageBitmap` 和串行上传。auto 按逻辑 CPU 并发选择 1–3 个 Worker，超过 8000 万像素的来源独占 pool，以限制 progressive JPEG 的瞬时工作集。Tauri 宿主也可以把逻辑线程数传给 `resolveRasterDecodeWorkerCount({ hardwareConcurrency: logicalThreads })` 后显式设置；没有平台实测前保持最大 3。

发布包使用内联 Blob Worker；Tauri/WebView CSP 需要包含 `worker-src blob:`。若策略阻止 Worker 创建，组件会回退主线程解码，超大 progressive JPEG 可能再次阻塞界面。

为提高首次规划准确度，请在 `ImageItem.exif.width/height` 中提供原图像素尺寸。视口由组件内部图片舞台 DIV 的 `ResizeObserver` 自动测量，宿主不应传屏幕尺寸。看图默认请传 `fitMaxNativePercent={100}`：大图仍然 contain 缩小，小图保持 1:1，不把 320×180 一类素材自适应放大到 300%+。超过 100% 只应来自滚轮/键盘/输入比例或缩放锁。

旧的 `preloadDisplaySlots`、`preloadDisplayMode`、`preloadDisplaySettleMs`、`estimateDecodedBytes`、`suggestPreloadMemoryBudgetBytes` 已删除。
