# v0.4 渲染架构

## 边界

`ImagePreview` 仍只有一套 Viewer Shell：导航、工具栏、文件名、底片条、EXIF、contained/overlay、键盘与 ref API 都在 Shell。Shell 通过 `ViewerCommand` 驱动当前媒体模块，并依据 `MediaCapabilities` 禁用该模块不支持的按钮。

主舞台按媒体类型分发：

- `raster`：WebGL2 canvas，是 JPEG、静态 PNG/WebP、AVIF、BMP、TIFF 等静态位图的唯一正式主渲染路径；
- `svg`：浏览器原生 `<img>` 解码 SVG，并在自己的目录中处理 CSS transform；
- `animated-image`：原生 `<img>` 保持 GIF/APNG/Animated WebP 播放；
- `video`：独立 `<video>` 分支。v0.4 只提供基础播放元素和受限变换能力；
- `unknown`：明确显示 unsupported，不把未知内容误送进 WebGL。

缩略图和 minimap 可以继续使用 `<img>`。这里的约束只针对静态位图的主舞台。

## MediaSource 与宿主

```ts
type MediaSource =
  | { type: 'url'; href: string }
  | { type: 'blob'; blob: Blob; mimeType?: string }
  | { type: 'bytes'; data: ArrayBuffer; mimeType?: string };
```

普通 Web 应传 http(s)、`blob:` 或 `data:` URL；VS Code Webview 先在扩展侧转换为 Webview 可访问 URI；Tauri 先转换为 asset URL、Blob 或 bytes。组件不调用 `fs`、VS Code API 或 Tauri API。

旧 `src` API 保持可用。`ImageItem.source`/顶层 `source` 存在时负责实际加载，`src` 仍可作为稳定身份、文件名和缩略图兼容值。宿主可通过 `kind` 明确指定类型；否则顺序为字节 sniff、MIME、URL/文件名。PNG/WebP 会读取头部区分静态与动画，不能只凭扩展名猜测。

组件创建的 object URL 会在对应 Viewer 卸载时 revoke；解码后的 `ImageBitmap` 在纹理上传完成后 close。

## Raster WebGL2 管线

```text
MediaSource
  → 中心优先队列
  → Dedicated Worker fetch / 分块收集 / Blob（URL 输入）
  → Dedicated Worker createImageBitmap（Blob 输入不复制）
  → transferable ImageBitmap
  → MAX_TEXTURE_SIZE 与单纹理预算约束下等比缩放
  → 上传前纹理字节预留 / 淘汰
  → texImage2D
  → GPU fence signaled
  → TextureCache
  → 原子切换当前 texture
```

canvas backing store 使用 CSS viewport × DPR。缩放、平移、旋转、翻转由 quad 顶点统一计算；空闲时没有 continuous render loop，仅在纹理、变换、viewport 或 context 状态变化时绘制。

当前 texture 未准备好时不清空 canvas，上一帧保持可见；新 texture 的上传 fence 完成后一次性替换。渐进图、Screen LOD 和 Full LOD 使用 generation 防止乱序覆盖。邻图通过有界优先队列进入同一 texture cache；队列为当前图保留前台通道。`preloadMemoryBudgetBytes` 同时作为逻辑 RGBA8 texture 预算。每次 `texImage2D` 前按 `width × height × 4` 预留字节：后台任务无法腾出未保护空间时直接放弃，前台 Full 可先淘汰受保护的旧 LOD；单张 Full 超过预算时在 Worker decode 阶段等比降采样。驻留加预留字节因此不会先上传再超额，回收会显式调用 `deleteTexture`。

这个硬上限只覆盖组件创建并记账的 RGBA8 texture payload，不等于操作系统可观测的物理显存上限。WebGL 不公开驱动对齐、内部副本、交换链/帧缓冲、解码器工作集或统一内存占用，宿主提供的 GPU/RAM budget 也只能作为规划输入，不能据此承诺整个进程的物理显存绝不越线。

主舞台 entry 只是 cache 纹理的借用引用，绘制前必须同时满足资源身份一致且 cache 仍持有同一句柄。预算淘汰后，stage 只会回退到**同一资源**仍驻留的最清晰 LOD；没有可用 LOD 时保持 Canvas 上一帧，不绑定已删除句柄。邻图上传在 `finally` 中恢复之前的 `TEXTURE_BINDING_2D`，不能把自己的 sampler 状态泄漏给主舞台。这个双重约束防止已淘汰主图在交互重绘时误采样最近上传的邻图。

Raster decode 使用主线程统一调度的 Dedicated Worker pool。URL 输入从 `fetch`、ReadableStream 分块收集、`new Blob(chunks)` 到 `createImageBitmap` 全部留在 Worker；主线程只接收节流进度和 transferable `ImageBitmap`。Worker 不保存自己的长任务队列，每个 Worker 同时只接收一个 URL/Blob → ImageBitmap 任务。主线程另以单并发队列执行 `texImage2D` 与 GPU fence，避免多个 Worker 同时完成后形成上传尖峰。默认按 `navigator.hardwareConcurrency` 自动选择 1–3 个 Worker，显式 `rasterDecodeWorkers` 可覆盖，`rasterDecodeWorkerMax` 限制自动/显式上限。超过 8000 万自然像素的任务视为重任务，独占 decode pool，避免多张超大图同时制造完整像素工作集。

发布包以内联 Worker 构造器生成 Blob URL，避免 ESM/CJS 和不同宿主 public base 解析外部 Worker 资源的差异。宿主 CSP 必须允许 `worker-src blob:`（旧策略可由 `child-src blob:` 回退）；若 Worker 创建失败，组件保留主线程 `createImageBitmap` 兼容路径，但该回退不提供超大图无卡顿保证。

取消按阶段处理：未派发任务直接从中心队列删除；已在 Worker 内 fetch/组装/decode 的旧当前任务通过 terminate 所在 Worker 并立即重建实现硬抢占，因此网络读取和不可取消的 `createImageBitmap` 会一起停止。普通低优先级运行任务可软取消并在返回时 `close()`；等待上传的 bitmap 在取消时关闭。已经进入 `texImage2D` 的上传无法中途停止，完成后仍通过 context/viewport/navigation generation 检查，过期 texture 立即删除。新当前图若已有同目标 Screen 在途则提升并复用，不重复解码。

WebGL Raster stage 在整个 Viewer Shell 生命周期内常驻，包括当前资源切到 SVG、GIF 或 Video 时。非 Raster 激活时 Canvas 使用 `visibility: hidden` 进入休眠，不绘制、不参与交互，但保留 context、pipeline 和 texture cache；切回 Raster 后显式重绘缓存 texture，不依赖 `preserveDrawingBuffer` 的旧帧。Video 播放和动画图片展示期间不启动新的 Raster 解码/上传，已经驻留的 texture 不会因此清空。context loss 仍是唯一需要整体重建 GPU 资源的路径。

Raster 图片之间导航时复用同一个 context 与 cache；资源键变化只触发纹理选择/加载，不能通过 React `key` 卸载 stage。这里的 viewport 严格指承载图片的 stage DIV，而不是屏幕或应用窗口；`ResizeObserver` 读取其 CSS box，再乘 WebView 实际 DPR 得到 Screen backing box。窗口拖动、侧栏伸缩、contained/fullscreen 变化都会重新规划。`preloadRadius="auto"` 按该 backing box 估算每张 Screen bytes：若全部候选都能放下则全部为 Screen；否则使用 P75 Screen 成本确定连续核心，压力高时前后各 1 张，常规条件可达导航方向 3 张、反方向 2 张，核心外才按距离连续准入固定 Browse，形成无空洞的紫罗兰环。两侧数量在相等时优先导航方向，但整体始终近似均衡；不会跳过中间图片，也不会把 Browse 自动升级为 Screen；没有固定总数量。

cache 还维护一组独立的、按最近访问排序的 Screen 历史钉住项，用于非连续的缩略图跳转。当前图的 Screen 会与 Full 共存；导航离开时，该 Screen 成为历史候选。选择历史项之前，先为当前纹理集合和前、后方向各最近一张 Screen 预留空间；然后才根据真实剩余 texture bytes 尽可能保留**已经驻留**的历史 Screen。历史钉住项严格只是保留策略，不会进入预加载任务表；因此即使历史纹理被回收，也不会由历史记录触发重新下载、解码或上传。诊断中这些钉住项会与连续 Screen/Browse 走廊分开报告。

Browse/Screen 请求带 viewport generation。尺寸级别改变时，旧 Screen 若仍达到新 Browse 目标则改为柔和紫罗兰色 Browse 继续复用，否则回收；旧尺寸的排队/fetch/decode 任务会取消，必要时硬抢占对应 Worker，不允许过期结果重新写回 cache。蓝色因此表示“驻留且足以覆盖当前图片 stage DIV × DPR”，紫罗兰表示“驻留且可立即显示的中等细节”。

浏览器不公开可用显存，因此网页环境仍用显示器分档作为回退，这不是硬件探测。Tauri 宿主应以 `sysinfo` 提供总/可用内存，并在可行时补充 Metal `recommendedMaxWorkingSetSize`、DXGI video-memory budget 或 Vulkan memory budget，再通过 `suggestRasterHardwareTextureBudgetBytes` 生成预算。组件内部以纹理尺寸计算逻辑 RGBA8 payload；宿主传入 `preloadMemoryBudgetBytes` 时完全覆盖浏览器回退。

底片条与 Raster 原图管线彼此独立。长列表只挂载可见窗口和 overscan，并通过 `onThumbnailVisibleIndexesChange` 回报这些扁平下标。桌面宿主可对每项传底片专用 `thumbnailSource/thumbnailSrc`；显式 `null` 表示生成中，瓦片保持空白且不会兼容回退到原图，从而允许宿主逐张发布原生后台线程生成的结果。

URL 原图在 Worker 内使用流式 `fetch` 获取：分块数组和最终 `new Blob(chunks)` 都不经过主线程。能读取 `Content-Length` 时按真实接收字节发布进度（约 1% 或 200ms 节流），不能读取总长时发布不确定进度。完整响应记录与 GPU residency 分离保存：下载完成为绿色缓存提示，texture fence 完成且仍驻留才是蓝色；texture 回收或 context loss 会把蓝色降为绿色，但不会抹掉“本 Viewer 生命周期内曾完整下载”的事实。跨域服务若希望显示真实百分比，必须允许 CORS，并通过 `Access-Control-Expose-Headers: Content-Length` 暴露总长。

WebGL context loss 时阻止浏览器默认放弃恢复，清空失效句柄并进入 `restoring`；恢复后重建 shader/buffer、增加 generation 并重新解码上传。超过 `MAX_TEXTURE_SIZE` 的单图在 v0.4 中等比降采样；完整 tile/LOD 留给后续 0.4.x。

## 导航背压与质量升级

键盘和侧边箭头共用无队列的 hold 状态机。按下先立即切一张；第一次自动续播还要满足 `holdRepeatDelayMs`（默认 300ms）。每次落到新媒体后，只有当前 renderer 通过统一 `onPresented` 边界确认内容已经提交到主舞台，才开始 `holdMinVisibleMs`（默认 200ms）计时。持续按住时下一步只会在这两个门槛都满足后发出；松开会取消唯一的定时器，不消费操作系统的 `keydown.repeat`，也不会补跑积压任务。`holdMinVisibleMs=0` 仍经过一个可取消的零延迟事件循环，保证 keyup 可以硬停止。

Raster WebGL 在 incoming texture draw 后的 rAF 回报 presented；SVG、动画图和 Video 由各自 renderer 回报。生产路径不再查找 `<img>`，所以 Canvas 常驻和混合媒体切换不会让长按续播卡死。

LOD 已采用独立的 trailing settle 策略：远邻先按当前 stage box 的 60% 线性尺寸准备 Browse，近邻准备完整 Screen，但都要等当前 Screen texture 已提交。Full 只针对当前图片，并改为按需升级：Fit 状态的 Screen 已覆盖物理视口，只有缩放超过该 Screen 纹理且 `fullResolutionSettleMs`（默认 300ms）内没有继续导航时才启动 Full。hold 期间暂停 Full，松开后只调度最终停留项。Full 就绪后原子替换并保留当前 Screen；离开释放旧 Full。超过 `MAX_TEXTURE_SIZE` 的 Full 仍会等比限制，真正的超大图 tile renderer 留给后续 0.4.x。

## 缩略图条

底部缩略图条继续使用语义化 button + 原生 `<img>`，并按横向视口进行窗口虚拟化，只挂载可见项和两侧 overscan。缩略图尺寸小、交互和无障碍要求高，DOM 虚拟列表能够直接利用浏览器图片缓存、懒加载、焦点和点击语义。条底蓝色表示主图 texture 仍可立即绘制，绿色进度表示原图网络请求；当前激活项仍只显示选中边框。单 Canvas/WebGL atlas 会增加纹理图集管理、命中测试、滚动、焦点与无障碍镜像层，当前不会带来足以抵消复杂度的收益。只有未来出现数千个同时动画、实时特效或需要一张 GPU timeline 合批的缩略图时再单独评估 WebGL thumbnail renderer；它不与主图 Raster context 共用架构。

## v0.3 → v0.4 迁移

- Raster 主图不再依赖 DOM compositor 的 outgoing `<img>`、1×1 keep-alive、双 rAF 揭开和 slot decode；对应性能语义改为 texture 保留、GPU fence 与原子切换。
- `preloadDisplayMode` / `preloadDisplaySlots` 等旧 DOM 实现参数已经删除；Raster 只使用 `preloadRadius`、实时视口与 texture budget。
- WebGL2 不可用时 Raster 会进入明确的 unsupported/error 状态；不会维护 WebGL1 或第二套完整 DOM Raster renderer。
- SVG、动画图和 Video 保持同一 Shell，但按照各自 capability 响应命令。
