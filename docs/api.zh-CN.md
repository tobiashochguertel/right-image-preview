# ImagePreview — Props & Ref API

[English](./api.md) · **中文**

---

## `<ImagePreview>` Props

### 数据

| Prop | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `src` | `string` | — | 单张图片 URL（`images` 或非空 `groupedImages` 优先） |
| `alt` | `string` | — | 单张图片 alt |
| `minimapSrc` | `string` | — | 仅单图：小地图图片 URL（默认同 `src`）；若设 `minimap` 则忽略 |
| `minimap` | `React.ReactNode` | — | 仅单图：自定义小地图内容（覆盖 `minimapSrc`） |
| `images` | `ImageItem[]` | — | 扁平多图；无非空 `groupedImages` 时 `src`/`alt` 被忽略；若与非空 `groupedImages` 同时传入则忽略 `images`（开发环境 `console.warn`） |
| `groupedImages` | `ImageGroup[]` | — | 文件夹式分组；各组 `images` 按顺序拼接；优先于 `images`/`src`；多组时左右箭头组内导航，工具栏出现上一组/下一组 |
| `visible` | `boolean` | — | 受控可见性 |
| `defaultGroupedSelection` | `DefaultGroupedSelection` | — | 非空 `groupedImages` 时的初始 `{ defaultGroupIndex, defaultIndexInGroup }`（组下标只计非空组）；覆盖 `defaultIndex` |
| `defaultIndex` | `number` | `0` | 扁平列表中的初始下标；与分组同时设置 `defaultGroupedSelection` 时忽略 |

### 缩放配置

| Prop | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `stops` | `NativePercent[]` | `[10,25,50,75,100,150,200]` | 离散档位列表（升序，至少 1 项）；需要更高上限请传入自定义列表 |
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
| `thumbnails` | `'none' \| 'classic'` | `'none'` | 预览层内缩略图条；`'classic'` = 底部横向列表（分组时仅当前组）；可导航图片 ≤ 1 时自动隐藏 |
| `language` | `string` | `'en'` | 界面语言：内置 `en`、`zh`（按主语言子标签匹配，如 `zh-CN` → `zh`） |

#### `arrows` 取值说明

| 值 | 效果 |
|----|------|
| `'both'` | 图片两侧箭头 **+** 扁平列表时工具栏上一张/下一张（默认） |
| `'side'` | 仅两侧箭头；扁平列表时工具栏仍有上一张/下一张，**序号在二者之间** |
| `'toolbar'` | 仅工具栏上一张/下一张；无两侧箭头 |
| `'none'` | 无两侧箭头；键盘 ← → 仍可用；扁平列表时工具栏仍有上一张/下一张与序号 |

当提供了非空 **`groupedImages`** 时，**工具栏上一张/下一张始终显示**；`arrows` 只控制**两侧**箭头。

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
  alt?: string;
  name?: string; // 工具栏信息栏显示的文件名
  minimapSrc?: string; // 导航小地图 URL；默认 src；若设 minimap 则忽略
  minimap?: React.ReactNode; // 自定义小地图；覆盖 minimapSrc
}

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
  next(): void;            // 组内下一张（无 groupedImages 则全局）
  prev(): void;            // 组内上一张
  nextGroup(): void;       // 跳到下一组第一张
  prevGroup(): void;       // 跳到上一组第一张

  // 状态读取
  getState(): ZoomState;
}
```

---

## 另见

- [小地图视口拖动](./minimap.zh-CN.md) — WebView 指针行为与基于雅可比的 1:1 平移。
