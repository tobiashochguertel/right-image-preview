# 需求记录

[English](./requirements.en.md) · **中文**

> 按时间顺序记录所有功能需求，每条标注实现状态。  
> **后续新增需求须同步更新本文件。**

---

## 阶段 1 — 初始核心需求

**目标：** 实现一个独立的、无 UI 库耦合的通用 React 图片预览组件，支持"适应视口"与"固定档位"两种缩放模式。

### 缩放模式
- [x] **Fit 模式**：图片在容器内完整显示（`contain` 语义），不等于 Native 某固定百分比
- [x] **Native 模式**：以 `naturalWidth/naturalHeight` 为 100% 基准的固定百分比
- [x] **档位缩放**：仅在离散档位间跳转，默认档位可配置
- [x] **从 Fit 首次放大策略**：可配置（`above-fit` / `first-stop` / `hundred`）
- [x] **缩小到最小档以下的行为**：可配置（`fit` 切回适应 / `noop` 停在最小档）
- [x] **放大到最大档以上的行为**：可配置（`noop` / `notify` 回调）

### 操作
- [x] 工具栏、键盘、外部 ref 调用共用同一状态机
- [x] 滚轮缩放（可选），每格 ±1 档
- [x] 双击在适应与 100% 间切换（可选）
- [x] "适应"快捷操作（键盘 `0`，工具栏按钮）
- [x] "1:1 / 100%"快捷操作（键盘 `1`，工具栏按钮）

### 对外状态
- [x] 导出 `mode`、`nativePercent`、`fitEquivalentNativePercent`
- [x] 工具栏显示"适应（约 xx%）"文案

### 多图支持
- [x] `images` 数组，`prev` / `next` 导航
- [x] 切图时重置缩放（`switchImageResetZoom`，可配置）
- [x] 切图时重置旋转翻转（`switchImageResetTransform`，可配置）

### 可访问性
- [x] 键盘关闭（Esc）
- [x] 焦点管理（`tabIndex=-1` + 自动聚焦）
- [x] 按钮 `aria-label`
- [x] `role="dialog"` + `aria-modal`

### 技术
- [x] TypeScript 强类型（`ZoomMode`、`NativePercent`、回调与 Ref 签名）
- [x] Vite + React 项目，Vitest 单元测试

---

## 阶段 2 — Bug 修复与功能扩展

### Bug 修复
- [x] **缩放按钮无效**：修复 `+`/`-`/适应/100% 按钮不响应的问题
- [x] **无限循环渲染**：`img` ref callback 引发的 `Maximum update depth exceeded`，改用 `useCallback` 稳定引用
- [x] **旋转方向错误**：第 4 次旋转方向反转（旋转 270° 而非 90°）；改为不用 `% 360`，累加原始角度值
- [x] **鬼影拖拽**：松开鼠标后图片仍跟随指针移动；在 `onPanMove` 中检测 `e.buttons === 0`
- [x] **滚轮缩到最小档后切 Fit**：改 `zoomOutBelowMinBehaviour` 默认值为 `'noop'`

### 档位调整
- [x] 增加 5%、10%、800%、1600% 档位（历史迭代）
- [x] 删除 5% 和 1600%；默认档位曾上至 800%
- [x] **v0.0.8**：默认最高档位改为 **200%**；更高比例通过自定义 **`stops`** 提供
- [x] **v0.0.9**：对等依赖 **React / React DOM ≥ 17**；`flushSync` 兼容层
- [x] **v0.0.10**：小地图压暗改为 `evenodd` path，避免 WebView 下 `mask`+`<img>` 纯黑
- [x] **v0.0.11**：轴对齐视口用小地图 **4 条 rect** 压暗；旋转时仍用 evenodd path
- [x] **v0.0.12**：小地图 `<img>` 用 **width/height × thumbS**，不用 **transform scale** 压自然像素（避免 WebView 黑块）
- [x] **v0.0.13**：`ImageItem.minimapSrc` / `minimap`（及单图同名 props）：可选小图 URL 或自定义 React 节点；未传仍用原图

### 翻转与旋转
- [x] 水平翻转、垂直翻转
- [x] 顺/逆时针旋转 90°，带过渡动画

### 文件名显示
- [x] `ImageItem.name` 字段，显示在工具栏信息栏
- [x] 工具栏默认显示当前张 / 总张数（含 `groupedImages` 分组序号）；不提供自定义计数渲染 API

---

## 阶段 3 — 工具栏 UI 重构

### 缩放输入下拉框
- [x] 点击缩放比例文字进入编辑状态，可输入任意正整数（不限于档位）
- [x] 弹出向上的下拉菜单，列出所有预设档位 + "适应"选项
- [x] 当前值与某档位匹配时在下拉中高亮显示

### 图标重设计
- [x] "适应视口"图标：四个角向外的 L 形边框
- [x] "原始比例 (100%)"图标：准心/十字瞄准线（代替之前的数字"1"）

### 关闭按钮
- [x] 从工具栏移至遮罩右上角，圆形半透明按钮

---

## 阶段 4 — 多文件夹支持

### `groupedImages` 分组导航
- [x] `ImageGroup`：`id?`、`name`、`images: ImageItem[]`（不再使用 `start` / `end` 区间）
- [x] 左右箭头沿扁平列表导航（跨组连续）；到达全局首/末时禁用
- [x] 工具栏新增"上一组"（⏮）/ "下一组"（⏭）按钮
- [x] 工具栏序号显示组内序号（如 `2/3`），不显示全局序号
- [x] 信息栏第二行：先显示当前第几组/共几组（如 `(1/3)`，样式与组内序号一致），略间距后接文件夹名称（可略作区分）

### Demo 改进
- [x] Demo 1：5 张单组图片，无文件夹信息
- [x] Demo 2：3 个文件夹共 10 张图片，使用 `groupedImages` 分组导航

---

## 阶段 5 — 锁定缩放、箭头配置

### 锁定缩放
- [x] 工具栏"+"右边增加锁图标按钮（开锁/闭锁）
- [x] 锁定状态下切图时保持缩放模式与比例；适应模式仍为适应（比例随图片宽高变化）
- [x] `initialZoomLocked` prop 控制初始状态

### 箭头配置
- [x] `arrows: 'both' | 'side' | 'toolbar' | 'none'` prop
- [x] Demo 1 设为 `'both'`，Demo 2 设为 `'side'`（工具栏只显示分组按钮+序号）

### 翻转按钮显隐
- [x] `showFlip` prop，默认 `false`；Demo 2 开启

### 色调柔化
- [x] 工具栏颜色改为柔和蓝灰调（`#cdd5e0`），减弱与黑背景的对比刺眼感
- [x] 统一色彩 token（`C` 对象）

---

## 阶段 6 — 键盘扩展 & 输入改进

### 新增键盘快捷键
- [x] `↑` 放大，`↓` 缩小
- [x] `Space` 在适应 ↔ 100% 间切换
- [x] `PageUp` 上一组，`PageDown` 下一组
- [x] `Ctrl/⌘ + ←` 逆时针旋转，`Ctrl/⌘ + →` 顺时针旋转
- [x] 当焦点在输入框时，方向键和空格不触发全局快捷键

### 缩放输入
- [x] `setNative`（ref）接受任意正整数，不强制贴合档位
- [x] 工具栏缩放输入框提交时限制在 **最大档位**（与默认 200% 上限一致）

### 信息栏折行修复
- [x] 计数器（如 `3/3`）加 `whiteSpace: nowrap`，不再折行

---

## 阶段 7 — 信息显示优化 & 文档

### 序号位置
- [x] 序号移到文件名前面，间隔约一空格，颜色比文件名更暗淡

### 遮罩点击关闭
- [x] `closeOnMaskClick` prop：控制点击暗色遮罩是否关闭预览
- [x] Demo 1 显式设置为 `true`

### 透明度优化
- [x] 信息徽章与工具栏操作行背景降低不透明度（`0.58` / `0.68`），减少对图片的遮挡感
- [x] 信息徽章从"全宽行"重构为"文字自适应宽度的独立浮动徽章"，背景仅覆盖文字区域

### 文档
- [x] 创建 `docs/` 目录
- [x] `docs/api.md` / `docs/api.zh-CN.md` — Props 与 Ref API 参考（双语）
- [x] `docs/keyboard.md` / `docs/keyboard.zh-CN.md` — 键盘快捷键（双语）
- [x] `docs/requirements.md` / `docs/requirements.en.md` — 需求时间线（双语）
- [x] GitHub Pages 演示页：右上角 **EN / 中文** 切换（`App.tsx`）

---

## 阶段 8 — 导航按钮可见性 & 工具栏布局优化

### 侧边箭头与关闭按钮可见性
- [x] NavArrow 改为深色半透明底 + 白色描边 + 投影，在浅色/深色/复杂背景上均清晰可见
- [x] 悬浮时加深背景，关闭按钮（右上角）同步采用深色底方案

### 工具栏序号去重
- [x] 有 `imageName` → 序号仅在信息徽章中显示；无 `imageName` → 序号在工具栏操作行显示

### 缩放按钮排列重设计
- [x] 新顺序：`[导航] | [翻转?] [逆转] [顺转] | [适应] [1:1] | [-] [缩放值] [+] [🔒]`
- [x] 设计逻辑：左→右 = 粗粒度预设跳转 → 精细调节 → 锁定行为

---

## 阶段 9 — 关闭按钮尺寸 & 1:1 图标

### 关闭按钮
- [x] 直径从 36px 放大约 30% 至 46px，内部 X 图标同步放大至 18px

### 1:1 图标迭代
- [x] 第三版：2×2 像素网格（四个等大圆角方块）
- [x] 第四版：改用 **"1:1" 文字型 SVG**（两个带衬线数字"1"加冒号），语义直接，无歧义

---

## 阶段 10 — 控件自动渐隐（惰性检测）

### 需求
- [x] 任何鼠标移动、点击、键盘按键均重置不活跃计时器，并立即恢复控件可见性
- [x] **3 秒**无任何操作后，所有控件在 **1.6 秒内平滑渐隐**至约 10% 透明度（隐约可见，仍可交互）
- [x] 恢复时 0.12 秒快速过渡（"立刻亮起"）
- [x] 影响范围：侧边导航箭头、关闭按钮、工具栏（含文件名徽章）

### 实现
- `ImagePreviewInner` 新增 `controlsVisible` state + `hideTimerRef`
- `resetHideTimer`：`setControlsVisible(true)` → 清除旧 timer → `setTimeout(3000)` 触发 fade
- overlay 绑定 `onMouseMove` / `onMouseDown` → `resetHideTimer`
- `keydown` 处理函数首行调用 `resetHideTimer`
- `CloseButton` & `NavArrow`：`visible` prop → `opacity: visible ? 1 : 0.10` + 非对称 transition
- `Toolbar`：`controlsVisible?: boolean` prop → 外层容器 opacity + transition

---

## 阶段 11 — 侧边箭头行为重设计 & closeOnMaskClick 修复

### 侧边箭头新规则
- [x] **不再出现置灰箭头**：没有可导航目标时箭头完全隐藏
- [x] **多组模式**：←/→ 与侧边箭头沿扁平列表跨组连续浏览（与底片条顺序一致）；跳到组首用工具栏 ⏮/⏭ 或 PageUp/PageDown
- [x] 单组模式：第一张无左箭头，最后一张无右箭头
- [x] `NavArrow` 移除 `disabled` prop，新增 `isGroupJump?: boolean`

### closeOnMaskClick 修复
- [x] **根本原因**：viewport div（`width/height: 100%`）完整覆盖 overlay，点击黑色区域时 `e.target` 是 viewport div 而非 overlay，原检测永远失败
- [x] **修复**：在 viewport div 上也加 `onClick` + `e.target === e.currentTarget` 检测
- [x] `closeOnMaskClick` 默认值改为 `false`（opt-in 更安全）

---

## 阶段 13 — 切图动画修复 + 遮罩定制

- [x] **Bug 修复**：切换图片时出现"从大缩小到适应尺寸"的动画。根本原因：`ready` 从 `false` 变 `true` 时 `transform`（fit-scale 跳变）和 `opacity`（0→1）在同一帧触发了 CSS transition，导致图片淡入的同时也在缩小。修复方案：引入 `imageShowReady` 状态，先让 transform 在 `opacity:0` 状态下静默到位，下一帧（RAF）再让 opacity 过渡显现，此时 transform 已无变化，缩放动画消除。
- [x] **新增 prop**：`overlayClassName?: string` — 附加到遮罩元素的 CSS 类名。
- [x] **新增 prop**：`overlayStyle?: React.CSSProperties` — 合并到遮罩元素的内联样式（优先级高于默认值）。
- [x] **默认遮罩样式**：改为 macOS 磨砂玻璃风格 (`rgba(10,12,20,0.70)` + `backdrop-filter: blur(24px) saturate(160%)`)，能隐约看出背景轮廓，减少突兀感，同时仍能专注于图片。

## 阶段 12 — 开源准备

- [x] `README.md`（英文）+ `README.zh-CN.md`（中文），顶部互相切换链接
- [x] `docs/` 目录下所有文档双语化
- [x] `LICENSE`（MIT）
- [x] `CONTRIBUTING.md`（英文）+ `CONTRIBUTING.zh-CN.md`（中文）
- [x] `.github/ISSUE_TEMPLATE/` — bug report 与 feature request 模板
- [x] `package.json` 补全 description、keywords、license、repository 等开源字段

---

## 阶段 14 — 底部缩略图条

### 需求
- [x] `showThumbnails?: boolean`（默认 `false`）
- [x] `thumbnailsScope?: 'group' | 'flat'`（默认 `'group'`）
- [x] 开启时在预览层底部显示横向可滚动缩略图条；激活项高亮边框
- [x] `thumbnailsScope="flat"` 展示整段扁平导航序列（Media Lens）；`group` 时分组仅当前组
- [x] 虚拟化：测量条带视口宽度；`visibleCapacity = max(1, floor(viewportWidth / tileStride))`；当 `entryCount > visibleCapacity × 3` 时窗口虚拟化，否则全量渲染
- [x] 缩略图 URL 优先 `minimapSrc`，否则 `src`
- [x] 可导航图片 ≤ 1 时自动隐藏
- [x] 条带显示时工具栏与小地图上移；参与控件自动渐隐

## 阶段 15 — Media Lens P0

- [x] `presentation?: 'overlay' | 'contained'`
- [x] `preloadRadius` + `onPreloadIndexesChange`
- [x] `showThumbnailPreloadStatus`（默认 `false`；开启后缩略图底边浅绿/深绿指示）
- [x] `chrome?: 'default' | 'minimal'`
- [x] 工具栏浏览器全屏 + ref `requestFullscreen` / `exitFullscreen` / `isFullscreen`；Esc 先退全屏
- [x] 受控 `index` + `toolbarExtra` + ref `goTo`
- [x] Demo 5：`showThumbnails` + `thumbnailsScope="flat"`

## 阶段 16 — Display-ready 邻居预热

- [x] `preloadDisplaySlots` / `preloadMemoryBudgetBytes` / `estimateDecodedBytes` / `preloadDisplayMode`
- [x] `display-ready` 确切判定（load + `decode`）；命中则快开（无 dwell/转圈；占位保留到视口可绘制）
- [x] 默认 `'slot'`（离屏层）；`'decode'` 为 B 降级
- [x] 文档：字节 `ready` ≠ 可秒切；槽位/内存由宿主决定
