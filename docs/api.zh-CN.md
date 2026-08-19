# ImagePreview — Props & Ref API

[English](./api.md) · **中文**

---

## `<ImagePreview>` Props

### 数据

| Prop | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `src` | `string` | — | 单张图片 URL（`images` 或非空 `groupedImages` 优先） |
| `source` | `MediaSource` | — | 单媒体 URL / Blob / bytes；存在时优先于 `src` 负责实际加载 |
| `kind` | `MediaKind` | — | 宿主明确指定媒体类型；优先于 sniff / MIME / 扩展名 |
| `mimeType` | `string` | — | 单媒体 MIME 提示 |
| `alt` | `string` | — | 单张图片 alt |
| `minimapSrc` | `string` | — | 仅单图：小地图图片 URL（默认同 `src`）；若设 `minimap` 则忽略 |
| `minimapSource` | `MediaSource` | — | 单媒体渐进预览 / minimap 图源；优先于 `minimapSrc` |
| `minimap` | `React.ReactNode` | — | 仅单图：自定义小地图内容（覆盖 `minimapSrc`） |
| `images` | `ImageItem[]` | — | 扁平多图；无非空 `groupedImages` 时 `src`/`alt` 被忽略；若与非空 `groupedImages` 同时传入则忽略 `images`（开发环境 `console.warn`） |
| `groupedImages` | `ImageGroup[]` | — | 文件夹式分组；各组 `images` 按顺序拼接；优先于 `images`/`src`；←/→ 与按住连切沿**扁平列表跨组**；工具栏上一组/下一组（及 PageUp/PageDown）跳到组首 |
| `visible` | `boolean` | — | 受控可见性 |
| `defaultGroupedSelection` | `DefaultGroupedSelection` | — | 非空 `groupedImages` 时的初始 `{ defaultGroupIndex, defaultIndexInGroup }`（组下标只计非空组）；覆盖 `defaultIndex` |
| `defaultIndex` | `number` | `0` | 扁平列表中的初始下标；与分组同时设置 `defaultGroupedSelection` 时忽略 |

### 缩放配置

| Prop | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `stops` | `NativePercent[]` | `[5,10,20,35,50,75,100,125,150,175,200]` | 离散档位列表（升序，至少 1 项）；需要更高上限请传入自定义列表 |
| `initialMode` | `'fit' \| 'native'` | `'fit'` | 初始缩放模式 |
| `initialNativePercent` | `number` | 第一档 | `initialMode='native'` 时的初始百分比 |
| `firstZoomInStrategy` | `'above-fit' \| 'first-stop' \| 'hundred'` | `'above-fit'` | 从 Fit 首次放大时的落档策略 |
| `zoomOutBelowMinBehaviour` | `'fit' \| 'noop'` | `'noop'` | 缩小到最小档以下的行为 |
| `zoomInAtMaxBehaviour` | `'noop' \| 'notify'` | `'noop'` | 放大到最大档以上的行为 |
| `initialZoomLocked` | `boolean` | `false` | 初始锁定缩放（切图时保持当前缩放模式和比例） |

### 交互行为

| Prop | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `wheelEnabled` | `boolean` | `false` | 滚轮缩放 |
| `doubleClickEnabled` | `boolean` | `false` | 双击鼠标在适应与 100% 间切换 |
| `switchImageResetZoom` | `boolean` | `true` | 切图时重置缩放（锁定状态下此项被覆盖） |
| `switchImageResetTransform` | `boolean` | `false` | 切图时重置旋转和翻转 |
| `fitResetPan` | `boolean` | `true` | 调用适应时重置平移 |
| `closeOnMaskClick` | `boolean` | `false` | 点击图片/工具栏以外的暗色遮罩是否关闭预览 |
| `overlayClassName` | `string` | — | 附加到遮罩元素的 CSS 类名 |
| `overlayStyle` | `React.CSSProperties` | — | 合并到遮罩元素的内联样式（在默认样式之后合并，优先级更高） |

### UI 配置

| Prop | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `arrows` | `'both' \| 'side' \| 'toolbar' \| 'none'` | `'both'` | 仅控制**图片两侧**箭头；见下表（非空 `groupedImages` 时工具栏上一张/下一张始终显示） |
| `showFlip` | `boolean` | `false` | 是否显示水平/垂直翻转按钮 |
| `showExif` | `boolean` | `false` | 是否在工具栏显示 EXIF / 元数据开关 |
| `initialExifOpen` | `boolean` | `false` | 开启 `showExif` 时是否默认展开 EXIF 面板 |
| `showDelete` | `boolean` | `false` | 是否显示删除按钮；宿主须在 `onDeleteImage` 中更新列表 |
| `showMinimap` | `boolean` | `true` | 主图超出视口时是否显示右下角导航小地图（拖动虚线框平移） |
| `showThumbnails` | `boolean` | `false` | 预览层内底部横向缩略图条；可导航图片 ≤ 1 时自动隐藏 |
| `thumbnailsScope` | `'group' \| 'flat'` | `'group'` | `showThumbnails` 为 true 时条带展示范围；见下表 |
| `presentation` | `'overlay' \| 'contained'` | `'overlay'` | `overlay` 全屏对话框；`contained` 填满已定位宿主 |
| `preloadRadius` | `number \| 'auto'` | `'auto'` | `'auto'` 按导航优先级向外逐张准入，直到 GPU 预算满；数字为扁平下标硬半径；`0` 关闭 |
| `preloadMaxCount` | `number` | `128` | auto 候选安全上限；实际驻留数量由上传后的 texture 字节数与预算决定 |
| `holdRepeatDelayMs` | `number` | `NAV_HOLD_REPEAT_DELAY_MS`（300） | ←/→ 按下时第一张仍立即切换；只有持续按住达到此时长后，才允许第一次自动续播。它与每张图片的最短展示时长互相独立。 |
| `holdMinVisibleMs` | `number` | `NAV_HOLD_MIN_VISIBLE_MS`（200） | 自动续播时，每张需由当前 renderer 回报主区域**已呈现**，再实际展示满此时长，且仍按住才切下一张。仅有布局尺寸、下载完成或 decode 完成都不计时。松开取消唯一的定时器，**不堆积**步进；`0` 表示呈现后下一事件循环即可继续。 |
| `fullResolutionSettleMs` | `number` | `300` | 当前 Raster 的 Screen LOD 呈现后，停稳多久才开始 Full LOD。继续导航或仍在长按会取消；`0` 表示 Screen 就绪后立即后台升级。只升级当前张。 |
| `preloadMemoryBudgetBytes` | `number` | 浏览器按显示器分档 | Raster GPU texture cache 预算；显式值始终优先。Tauri 宿主应以 `sysinfo`/平台 GPU budget 调用 `suggestRasterHardwareTextureBudgetBytes` 后传入。Screen/Browse 数量另按实时图片舞台 DIV × DPR 和单图尺寸动态计算。 |
| `onPreloadIndexesChange` | `(indexes: number[]) => void` | — | 可选：当前计划预加载的扁平下标 |
| `onPreloadStatusChange` | `(status: NeighborPreloadStatusMap) => void` | — | 回报可获得的原图真实下载进度与 GPU 驻留状态；texture 被回收后由 `display-ready` 降为 `warm` |
| `onRasterPreloadPlanChange` | `(snapshot: RasterPreloadPlanSnapshot) => void` | — | 开发诊断：实时回报图片舞台 DIV、DPR、backing pixels、预算、连续 Screen/Browse 各方向索引，以及仅保留既有纹理的历史 Screen 索引/字节数 |
| `showThumbnailPreloadStatus` | `boolean` | `false` | 缩略图条：**蓝** = Screen 计划/驻留；**柔和紫罗兰** = Browse 计划/驻留；计划中的条按真实下载百分比填充；**绿** = 仅原图下载历史或 texture 已回收；**当前张无底条** |
| `showSwitchLoader` | `boolean` | `true` | 当前媒体等待 `display-ready` 时显示中央圆环，并在完整纹理提交时关闭；`false` 只隐藏转圈 |
| `chrome` | `'default' \| 'minimal'` | `'default'` | `minimal` 空闲时控件完全隐藏 |
| `index` | `number` | — | 受控扁平下标 |
| `toolbarExtra` | `ReactNode` | — | 工具栏末尾自定义内容 |
| `language` | `string` | `'en'` | 界面语言：内置 `en`、`zh`（按主语言子标签匹配，如 `zh-CN` → `zh`） |

下载进度语义：URL 原图通过流式 `fetch` 接收。响应暴露 `Content-Length` 时，`NeighborPreloadEntry.progress` 是 `loadedBytes / totalBytes` 的真实 0–1 比例；约每增加 1% 或间隔 200ms 回报一次，完成事件必达。已被规划为 Screen/Browse 的项目在下载与解码期间分别显示蓝/紫条，且使用这项真实比例；未知总长时显示相同目标颜色的流动不确定进度，而不是虚构的 1/3。没有 GPU LOD 计划的纯原图请求才使用绿条。`loadedBytes` / `totalBytes` 可供宿主展示详细字节数。

满绿只表示本次 Viewer 生命周期内原图请求曾完整完成，后续大概率命中浏览器/WebView HTTP 缓存，但不是强保证；蓝色必须同时满足 texture 上传 fence 完成且仍驻留 GPU cache。GPU 回收或 WebGL context loss 后蓝色自动降为满绿，完整下载记录仍保留。

`NeighborPreloadEntry.textureBytes` / `textureWidth` / `textureHeight` 是 cache 回报的真实驻留纹理数据，可用于诊断；不要再用原图 `width × height × 4` 估算 Screen LOD。`browse-ready`（柔和紫罗兰）表示可瞬时绘制的中等细节纹理，`display-ready`（蓝）表示足够覆盖当前图片舞台 DIV × DPR。视口改变时旧 Screen 可降级复用为 Browse；旧尺寸任务不会重新覆盖新计划。

#### `arrows` 取值说明

| 值 | 效果 |
|----|------|
| `'both'` | 图片两侧箭头 **+** 扁平列表时工具栏上一张/下一张（默认） |
| `'side'` | 仅两侧箭头；扁平列表时工具栏仍有上一张/下一张，**序号在二者之间** |
| `'toolbar'` | 仅工具栏上一张/下一张；无两侧箭头 |
| `'none'` | 无两侧箭头；键盘 ← → 仍可用；扁平列表时工具栏仍有上一张/下一张与序号 |

当提供了非空 **`groupedImages`** 时，**工具栏上一张/下一张始终显示**；`arrows` 只控制**两侧**箭头。

#### `showThumbnails` / `thumbnailsScope`

| `thumbnailsScope` | 效果 |
|-------------------|------|
| `'group'`（默认） | 分组时仅**当前组**；扁平列表为整表。跳组后条带随之切换。 |
| `'flat'` | **整段扁平导航序列**（与 ←/→ / `onIndexChange` 一致）。当 `entryCount > visibleCapacity × 3` 时窗口虚拟化（`visibleCapacity = max(1, floor(viewportWidth / tileStride))`）。 |

瓦片图：`ImageItem.minimapSrc` 优先，否则 `src`。少量瓦片居中胶囊；较多时全宽底栏横向滚动。

#### 相邻预加载说明

- v0.4 Raster 使用有界优先队列解码相邻图并直接预热 GPU texture；当前图有保留通道，不会排在邻图之后。
- v0.3 的 DOM slot/decode、outgoing 与 1×1 keep-alive API 已删除；Raster 不再依赖离屏 `<img>` 保活。
- 浏览器没有“剩余显存”API。组件以 `screen.width × screen.height × devicePixelRatio²` 估算物理像素并选择上述保守档位；这不是显存检测。Tauri 等能获得设备信息的宿主可显式传入 `preloadMemoryBudgetBytes` 覆盖，并尽量提供原图宽高。详见[渲染架构](./rendering-architecture.zh-CN.md)。

#### `presentation` 说明

| 值 | 行为 |
|----|------|
| `'overlay'`（默认） | `fixed` 全屏、`dialog` + `aria-modal`、打开时聚焦、窗口级键盘 |
| `'contained'` | `absolute; inset: 0`；宿主须定位并设尺寸；`region`；仅聚焦在预览内时响应键盘 |

#### 侧边箭头智能行为

- 当该方向无法导航时，箭头**完全隐藏**（而非置灰）。
- 处于组边界且存在相邻组时，箭头自动替换为**双箭头**跳组按钮。

### 回调

| Prop | 类型 | 说明 |
|------|------|------|
| `onClose` | `() => void` | 关闭预览时触发 |
| `onZoomChange` | `(state: ZoomState) => void` | 缩放状态变化时触发 |
| `onIndexChange` | `(index: number) => void` | 切图时触发 |
| `onMaxStopReached` | `() => void` | 放大到最大档且 `zoomInAtMaxBehaviour='notify'` 时触发 |
| `onDeleteImage` | `(index: number, item: ImageItem) => void` | 用户删除当前图时触发（需 `showDelete`）。宿主必须更新列表。 |

---

## 类型定义

```typescript
interface ImageItem {
  id?: string; // 稳定主键（如路径）；身份请优先于 name
  src: string;
  source?: MediaSource;
  kind?: 'raster' | 'svg' | 'animated-image' | 'video' | 'unknown';
  mimeType?: string;
  alt?: string;
  name?: string; // 工具栏信息栏显示的文件名
  minimapSrc?: string; // 导航小地图 URL；默认 src；若设 minimap 则忽略
  minimapSource?: MediaSource;
  minimap?: React.ReactNode; // 自定义小地图；覆盖 minimapSrc
}

type MediaSource =
  | { type: 'url'; href: string; contentLength?: number }
  | { type: 'blob'; blob: Blob; mimeType?: string }
  | { type: 'bytes'; data: ArrayBuffer; mimeType?: string };

interface ImageGroup {
  id?: string; // 可选稳定主键（目录/相册）
  name: string; // 文件夹名，显示在文件名下方
  images: ImageItem[];
}

interface DefaultGroupedSelection {
  /** 仅统计 `images.length > 0` 的组，顺序同 `groupedImages` */
  defaultGroupIndex: number;
  /** 在该组 `images` 内的从 0 开始的下标 */
  defaultIndexInGroup: number;
}

type ArrowsConfig = 'both' | 'side' | 'toolbar' | 'none';

interface ZoomState {
  mode: 'fit' | 'native';
  /** 当前 Native 百分比（mode=native 时有效） */
  nativePercent: number;
  /** Fit 等效 Native%（适应模式下工具栏数字区显示 `xx%`；档位菜单中 Fit 行显示「适应 (约 xx%)」） */
  fitEquivalentNativePercent?: number;
}
```

---

## `ImagePreviewRef` 方法

```typescript
interface ImagePreviewRef {
  // 缩放
  zoomIn(): void;
  zoomOut(): void;
  fit(): void;
  setNative(percent: number): void; // 任意正数（不截断）；工具栏缩放输入框提交时会限制在最大档位

  // 旋转与翻转
  rotateCW(): void;       // 顺时针 90°
  rotateCCW(): void;      // 逆时针 90°
  flipHorizontal(): void;
  flipVertical(): void;

  // 图片导航
  next(): void;            // 扁平列表下一张（有 groupedImages 时会跨组）
  prev(): void;            // 扁平列表上一张
  nextGroup(): void;       // 跳到下一组第一张
  prevGroup(): void;       // 跳到上一组第一张
  goTo(index: number): void; // 跳到扁平下标（截断）

  // 浏览器全屏
  requestFullscreen(): Promise<boolean>;
  exitFullscreen(): Promise<void>;
  isFullscreen(): boolean;

  // 状态读取
  getState(): ZoomState;
}
```

---

## 另见

- [主图显示与切图主流程](./main-display-flow.zh-CN.md) — 先缩略占位再揭开原图、长停留后快开、连按节奏。
- [小地图视口拖动](./minimap.zh-CN.md) — WebView 指针行为与基于雅可比的 1:1 平移。
- [Media Lens 接入清单](./media-lens-integration.zh-CN.md) — Tauri 内存预算与推荐 props。
