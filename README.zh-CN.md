# right-image-preview

[English](./README.md) · **中文**

## 在线演示

**👉 [https://zhangjian1713.github.io/right-image-preview/](https://zhangjian1713.github.io/right-image-preview/)**

在浏览器中打开交互式演示（右上角可切换 **EN / 中文**），无需本地安装。

> 无 UI 库依赖的 React 图片预览组件，原生支持固定档位缩放（Lightroom 式）、多图/多组导航、翻转旋转、键盘快捷键与自动渐隐控件。

---

## ✨ 特性

| 能力 | 说明 |
|------|------|
| **Fit / Native 双模式** | `fit` 以 contain 语义完整显示图片；`native` 以原始像素为 100% 基准 |
| **固定档位缩放** | 放大/缩小只在离散档位间跳转（默认 10 %–200 %）；可用 **`stops`** 自定义 |
| **缩放输入** | 可输入正整数 %；**工具栏提交值会限制在最大档位**（`ref` 调用不限制） |
| **多图 / 多组导航** | 支持单组图片列表，也支持按文件夹/分组组织的多组图片 |
| **翻转 & 旋转** | 水平/垂直翻转，90° 顺/逆时针旋转，带 CSS 动画 |
| **缩放锁定** | 切换图片时可选择保留或重置缩放状态 |
| **智能侧边箭头** | 不可导航时箭头完全隐藏；组边界自动变为跳组按钮（双箭头） |
| **控件自动渐隐** | 3 秒无操作后控件渐隐至约 10% 透明度，任意活动立即恢复 |
| **导航小地图** | 主图溢出视口时右下角缩略图 + 可拖视口框；可通过 `showMinimap` 关闭 |
| **缩略图条** | `showThumbnails` 开启底部横向缩略图（默认关）。`thumbnailsScope="group"`（默认）分组时仅当前组；`"flat"` 为整段扁平序列（过长时窗口虚拟化） |
| **嵌入式模式** | `presentation="contained"` 填满宿主容器；仅聚焦时响应键盘 |
| **相邻预加载** | `preloadRadius` 字节预热；`preloadDisplaySlots` 保持离屏 decode 就绪（槽位数由宿主按内存决定）。`display-ready` 切图快开（占位保留到视口可绘制）；仅字节就绪不会快开 |
| **控件密度** | `chrome="minimal"` 空闲时控件完全隐藏 |
| **浏览器全屏** | 工具栏切换 + ref `requestFullscreen` / `exitFullscreen`；Esc 先退出全屏 |
| **受控下标** | `index` + `onIndexChange`；ref `goTo(index)` |
| **小地图独立图源** | 每条 **`ImageItem`**（及单图 **`src`** 模式）可设 **`minimapSrc`** / **`minimap`**，用小缩略图或自定义节点；默认仍用主图 **`src`** |
| **触控双指捏合缩放** | 双指捏合/展开实现连续缩放；缩放锚点跟随双指中点；可用 **`pinchEnabled`** 关闭 |
| **界面语言** | **`language`** 内置 **英文**与**简体中文**（`en`、`zh`、`zh-CN` 等）；可用 **`strings`** 覆盖任意文案 |
| **丰富的键盘快捷键** | Esc / ±方向键 / Space / PageUp-Down / Ctrl+方向键 |
| **可访问性** | Overlay：`role="dialog"` + `aria-modal` 与焦点管理；`presentation="contained"`：`role="region"`（非整页模态），仅预览聚焦时响应键盘。控件带 `aria-label` |
| **TypeScript 一等类型** | 完整类型导出，`forwardRef` 支持命令式 ref API |
| **零生产依赖** | 仅依赖 React，无任何第三方 UI 库 |
| **兼容性：React 17+** | 兼容 `react` / `react-dom` ≥ 17，推荐 18+（滚轮多档时原生 `flushSync` 体验最佳） |

---

## 快速开始

**在业务项目中使用**

```bash
npm install right-image-preview
```

**克隆本仓库**（演示页、测试、参与开发）

```bash
npm install
npm run dev       # 浏览器打开 http://localhost:5173
npm test
npm run build     # 演示站的 Vite 生产构建
```

浏览器访问 `http://localhost:5173`，页面**右上角**可切换 **EN / 中文**：
- **Demo 1**：单组相册，点击遮罩关闭，无翻转按钮
- **Demo 2**：多文件夹分组，侧边箭头，含翻转按钮
- **Demo 3**：先小图占位、再载入全图（渐进加载；滚轮/平移；演示资源走 CDN）
- **Demo 4**：宿主 EXIF + 删除
- **Demo 5**：嵌入式工作区 + 扁平缩略图条 + 相邻预加载 + minimal chrome

---

## 基本用法

```tsx
import { ImagePreview } from 'right-image-preview';

// 单张图片
<ImagePreview
  src="/photo.jpg"
  visible={open}
  onClose={() => setOpen(false)}
/>

// 多图列表
<ImagePreview
  images={[
    { src: '/a.jpg', name: 'a.jpg' },
    { src: '/b.jpg', name: 'b.jpg' },
  ]}
  visible={open}
  onClose={() => setOpen(false)}
  wheelEnabled
  doubleClickEnabled
  closeOnMaskClick
/>

// 多组（文件夹）图片
<ImagePreview
  groupedImages={[
    {
      name: '旅行/',
      images: [
        { id: 'travel/a', src: '/a.jpg', name: 'a.jpg' },
        { src: '/b.jpg', name: 'b.jpg' },
        { src: '/c.jpg', name: 'c.jpg' },
      ],
    },
    {
      name: '活动/',
      images: [
        { src: '/d.jpg', name: 'd.jpg' },
        { src: '/e.jpg', name: 'e.jpg' },
        { src: '/f.jpg', name: 'f.jpg' },
      ],
    },
  ]}
  visible={open}
  onClose={() => setOpen(false)}
  arrows="side"
  showFlip
/>
```

---

## API

> **完整权威说明：** [`docs/api.zh-CN.md`](./docs/api.zh-CN.md)（中文）/ [`docs/api.md`](./docs/api.md)（英文）。切图主流程（先缩略再原图）：[`docs/main-display-flow.zh-CN.md`](./docs/main-display-flow.zh-CN.md)。下表仅为速览，若有出入以 `docs/api` 为准。

### Props

| Prop | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `src` | `string` | — | 单张图片 URL（提供 `images` 或非空 `groupedImages` 时忽略） |
| `minimapSrc` | `string` | — | 仅单图：小地图瓦片 URL（默认同主图 `src`）；设 `minimap` 时忽略 |
| `minimap` | `React.ReactNode` | — | 仅单图：自定义小地图（覆盖 `minimapSrc`） |
| `images` | `ImageItem[]` | — | 扁平多图列表（高于 `src`）；非空 `groupedImages` 时忽略（开发环境若同时传入可能 `console.warn`）；每项可带 `minimapSrc` / `minimap` |
| `groupedImages` | `ImageGroup[]` | — | 文件夹式分组；按顺序拼接各组的 `images`；优先级高于 `images` 与 `src` |
| `visible` | `boolean` | `true` | 控制预览显示/隐藏 |
| `defaultGroupedSelection` | `{ defaultGroupIndex, defaultIndexInGroup }` | — | `groupedImages` 模式下的初始图（组下标只计非空组）；优先于 `defaultIndex` |
| `defaultIndex` | `number` | `0` | 扁平列表中的初始下标；与分组同时传入 `defaultGroupedSelection` 时忽略 |
| `stops` | `number[]` | `[10,25,50,75,100,125,150,175,200]` | Native zoom 档位（%，升序）；需要更高上限请传入更长列表 |
| `initialMode` | `'fit' \| 'native'` | `'fit'` | 初始缩放模式 |
| `initialNativePercent` | `number` | 第一档 | `initialMode='native'` 时的初始比例 |
| `firstZoomInStrategy` | `'above-fit' \| 'first-stop' \| 'hundred'` | `'above-fit'` | 从 Fit 首次放大时的入档策略 |
| `zoomOutBelowMinBehaviour` | `'fit' \| 'noop'` | `'noop'` | 缩小到最小档以下的行为 |
| `zoomInAtMaxBehaviour` | `'noop' \| 'notify'` | `'noop'` | 放大到最大档时的行为 |
| `wheelEnabled` | `boolean` | `true` | 是否启用滚轮缩放 |
| `doubleClickEnabled` | `boolean` | `true` | 双击切换 Fit ↔ 100% |
| `switchImageResetZoom` | `boolean` | `true` | 切图时是否重置缩放（锁定时被覆盖） |
| `switchImageResetTransform` | `boolean` | `true` | 切图时是否重置翻转/旋转 |
| `fitResetPan` | `boolean` | `true` | 切回 Fit 时是否归零平移 |
| `showFlip` | `boolean` | `false` | 是否显示翻转按钮 |
| `showExif` | `boolean` | `false` | 是否在工具栏显示 EXIF / 元数据开关 |
| `initialExifOpen` | `boolean` | `false` | 开启 `showExif` 时是否默认展开 EXIF 面板 |
| `showDelete` | `boolean` | `false` | 是否显示删除按钮；宿主在 `onDeleteImage` 中更新列表 |
| `arrows` | `'both' \| 'side' \| 'toolbar' \| 'none'` | `'both'` | 仅控制**两侧**箭头；非空 `groupedImages` 时工具栏上一张/下一张始终显示 |
| `initialZoomLocked` | `boolean` | `false` | 初始是否锁定缩放 |
| `closeOnMaskClick` | `boolean` | `false` | 点击遮罩区域是否关闭预览 |
| `onClose` | `() => void` | — | 关闭回调 |
| `onZoomChange` | `(state: ZoomState) => void` | — | 缩放状态变化回调 |
| `onIndexChange` | `(index: number) => void` | — | 图片索引变化回调 |
| `onMaxStopReached` | `() => void` | — | 到达最大档位回调（需配合 `'notify'`） |
| `onImageError` | `(index: number, src: string) => void` | — | 当前图片加载失败时的回调，接收图片扁平下标与 `src` URL |
| `errorFallback` | `(index: number, src: string) => ReactNode` | — | 图片加载失败时居中渲染的自定义占位内容；导航到其他图片后错误状态自动重置 |
| `pinchEnabled` | `boolean` | `true` | 是否启用双指捏合缩放（触屏 / 多点触控板） |
| `strings` | `Partial<LocaleStrings>` | — | 覆盖任意 UI 文案字段；叠加在 `language` 所选语言之上；只需提供要改的字段 |

#### `arrows` 取值说明

| 值 | 效果 |
|----|------|
| `'both'` | 两侧箭头 **+** 扁平列表时工具栏上一张/下一张（默认） |
| `'side'` | 仅两侧箭头；扁平列表时工具栏仍有上一张/下一张，序号在中间 |
| `'toolbar'` | 仅工具栏上一张/下一张；无两侧箭头 |
| `'none'` | 无两侧箭头；键盘 ← → 仍可用；扁平列表时工具栏仍有上一张/下一张与序号 |

传入非空 **`groupedImages`** 时，工具栏上一张/下一张**始终显示**；本表只约束**两侧**箭头。

### 类型定义

```ts
interface ImageItem {
  id?: string;   // 稳定主键（如路径）；身份识别请优先于 `name`
  src: string;
  alt?: string;
  name?: string; // 工具栏信息栏显示的文件名
  minimapSrc?: string;
  minimap?: React.ReactNode;
}

interface ImageGroup {
  id?: string;   // 可选稳定主键（如目录路径）
  name: string;  // 组名，显示在文件名下方
  images: ImageItem[];
}

interface DefaultGroupedSelection {
  defaultGroupIndex: number;   // 仅统计非空组，顺序同 `groupedImages`
  defaultIndexInGroup: number; // 在该组 `images` 内的 0-based 下标
}

interface ZoomState {
  mode: 'fit' | 'native';
  nativePercent: number;
  fitEquivalentNativePercent?: number; // 供 UI 显示"适应 ≈ xx%"
}
```

包内还导出 **`resolvePreviewImages`**、**`flattenGroupedImages`**、**`resolveDefaultGroupedFlatIndex`**、**`FlattenedGroupSlice`** 与 **`DefaultGroupedSelection`**，便于在组件外复用相同的扁平列表与组内下标范围。**`resolveStrings`** 与 **`mergeStrings`** 也一并导出，可用于在组件外以编程方式构建自定义 locale 对象。

### Ref API

```ts
const ref = useRef<ImagePreviewRef>(null);

interface ImagePreviewRef {
  // 缩放
  zoomIn(): void;
  zoomOut(): void;
  fit(): void;
  setNative(percent: number): void; // 任意正数（不截断；工具栏输入会限制在最大档位）

  // 变换
  rotateCW(): void;
  rotateCCW(): void;
  flipHorizontal(): void;
  flipVertical(): void;

  // 导航
  next(): void;
  prev(): void;
  nextGroup(): void;
  prevGroup(): void;

  // 状态读取
  getState(): ZoomState;
}
```

---

## 键盘快捷键

| 按键 | 行为 |
|------|------|
| `Esc` | 关闭预览 |
| `+` / `=` / `↑` | 放大一档 |
| `-` / `↓` | 缩小一档 |
| `0` | 适应视口（Fit） |
| `1` | 原图 100% |
| `Space` | 切换 Fit ↔ 100% |
| `←` / `→` | 上一张 / 下一张 |
| `Ctrl/⌘ + ←` | 逆时针旋转 90° |
| `Ctrl/⌘ + →` | 顺时针旋转 90° |
| `PageUp` | 跳到上一组第一张（需非空 `groupedImages`） |
| `PageDown` | 跳到下一组第一张（需非空 `groupedImages`） |

> 任意按键操作均会重置控件自动渐隐计时器。

---

## 项目结构

```
src/
  components/ImagePreview/
    types.ts                   # TypeScript 类型定义
    flattenGroupedImages.ts    # resolvePreviewImages / flattenGroupedImages 辅助函数
    useZoomState.ts            # 缩放状态机 Hook（纯逻辑，无 DOM）
    useImageTransform.ts       # 尺寸测量 + CSS transform 计算 + 拖拽平移
    useWheelZoom.ts            # 滚轮缩放 Hook
    usePinchZoom.ts            # 触控双指捏合缩放 Hook
    injectGlobalStyle.ts       # 单例 CSS 注入工具（SSR 安全）
    locale.ts / localeTypes.ts / locales/  # 国际化字符串
    Toolbar.tsx                # 底部工具栏
    Minimap.tsx                # 导航小地图
    shell/
      ImagePreview.tsx         # 外层 shell（trigger 模式分发）
      ImagePreviewInner.tsx    # 对话框实现
      ImagePreviewTriggerShell.tsx
    parts/
      ImagePreviewCloseButton.tsx
      ImagePreviewNavArrow.tsx
    index.ts                   # 公开导出
  App.tsx                      # 演示页外壳
  demos/                       # 各 Demo 与演示站文案（不打进 npm 包）
docs/
  main-display-flow.zh-CN.md / .md   # 主图显示与切图主流程（先缩略再原图）
  api.md / api.zh-CN.md              # Props & Ref API 参考
  media-lens-integration.zh-CN.md    # Media Lens（Tauri）接入清单
  media-lens-integration.md          # English checklist
  keyboard.md / keyboard.zh-CN.md   # 键盘快捷键说明
  requirements.md                    # 需求迭代记录
tests/
  setup.ts                     # Vitest + jsdom 配置
  useZoomState.test.ts         # 缩放状态机单元测试
  flattenGroupedImages.test.ts
  locale.test.ts               # Locale / mergeStrings 单元测试
  injectGlobalStyle.test.ts
  ImagePreview.test.tsx        # 组件集成测试
```

---

## 缩放算法

```
fitScale   = min(containerW / naturalW, containerH / naturalH)
nativeScale = nativePercent / 100

CSS transform scale（fit）    = fitScale
CSS transform scale（native） = nativeScale × (naturalW / layoutW)
                              ≈ nativePercent / 100

fitEquivalentNativePercent    = fitScale × 100（供 UI 显示"适应 ≈ xx%"）
```

---

## 后续迭代方向

- 旋转 90°/270° 时的严格 1:1 约束（宽高调换）
- 弹簧物理动画（缩放/平移更自然的惯性）

---

## 版本号约定（1.0 之前）

当前为 **0.x** 阶段，版本大致按下面划分：

- **Patch（修订号）** — 仅影响**内置文案**或类型上的扩展（例如在 **`LocaleStrings`** / **`locales/*.ts`** 中新增字段、改 tooltip 措辞）、未导出组件的内部 props 调整、缺陷修复，以及**不改变** **`ImagePreview`** **已文档化的对外契约**（props、ref、按文档使用的导出函数与类型）的改动。
- **Minor（次版本）** — 新增或变更**已文档化**的 props、ref 能力、导出 API，或集成方需要跟进的可见行为变化。

若你在 TypeScript 里**手写整份** **`LocaleStrings`**，升级后可能需要补全新增字段；本项目把这种情形仍算作 **patch**，因为常见用法是 **`language`** + 内置 **`resolveStrings`**。

---

## License

MIT © [ZhangJian](https://github.com/ZhangJian1713)
