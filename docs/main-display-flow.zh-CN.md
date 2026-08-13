# 主图显示与切图主流程

[English](./main-display-flow.md)

本文是 **right-image-preview** 的产品级主流程说明：任意操作切到下一张时，舞台上**先看到什么、再换成什么**，以及如何用尽手段让「停够久再切」时原图尽可能秒开。

实现细节、props 默认值见 [`api.zh-CN.md`](./api.zh-CN.md)；Media Lens / Tauri 接入清单见 [`media-lens-integration.zh-CN.md`](./media-lens-integration.zh-CN.md)。

---

## 1. 核心目标

| 优先级 | 目标 |
|--------|------|
| **P0** | **绝不优先「空舞台」**：切图瞬间宁可先放缩略占位，也不要长时间黑屏 / 空白等待。 |
| **P0** | **上一帧托底（Outgoing hold）**：有上一张已显示的全图时，切走后仍全尺寸可见，直到下一张可绘制再降为邻居保活——**禁止**用整台 `opacity:0` 填空隙。 |
| **P0** | **切图一律先有可看内容**：有主区域缩略图（`ImageItem.minimapSrc`）则先放大显示占位；没有才直接拉原图。 |
| **P0** | **原图与占位并行**：切到某张的瞬间就开始解码/渲染该张真正的 `src`；原图一旦整图可绘制，立刻撤掉缩略占位。 |
| **P0** | **长停留后的下一张要快**：在前一张上稳定浏览足够久（例如约 3s+）再切到下一张时，若邻居已是 display-ready（条带**蓝条**），应复用已解码层并跳过二次原图探针，使清晰原图接近瞬时出现。 |
| **P1** | **连按 / 按住不刷爆解码**：快速 ←/→ 时按「主区域缩略已展示」节奏推进，不为每一跳都把大原图解完。 |

「主区域缩略占位」指舞台中央的渐进 underlay（`minimapSrc` 放大模糊占位），**不是**右下角导航小地图（`showMinimap`）。

---

## 2. 单次切图：舞台上发生什么

无论入口是键盘 ←/→、侧边箭头、底片条点击、`goTo` / 受控 `index`、组跳转等，**当前主图**的显示契约相同：

```text
切到 index N+1（上一张为 N）
    │
    ├─ Outgoing hold：N 的全尺寸层继续可见（盖住舞台），N+1 在上层准备
    │     └─ N+1 整图可绘制 → 以 N+1 为主可见层；N 降为邻居保活（可秒拉回）
    │
    ├─ 有独立 minimapSrc（且 progressiveMain 开启）
    │     ├─ 缩略 underlay 仍可参与（托底优先用上一张全图，缩略为补充）
    │     └─ 同时开始拉 / 解码 / 布局真正的 src
    │
    └─ 无 minimapSrc → 仍靠 outgoing hold 避免黑屏，直到原图可绘制
```

要点：

1. **先缩略、后原图**是默认主路径；「没有缩略才硬上原图」是降级，不是推荐配置。
2. 切图那一帧**不会**等原图就绪才给用户反馈；**上一帧托底**与占位 / 原图准备并行。
3. 原图揭开要求「整图可绘制」（例如 `createImageBitmap` / `decode` 落稳 + 双 `rAF`），避免渐进 JPEG 只露出左上一条就闪一下。
4. 若邻居已是 **display-ready**，走**快开**：跳过人为占位停留 / 中央转圈；outgoing hold 仍盖住空隙直到视口主图真正可画——**不以去掉占位或整台透明换黑屏**。
5. 比例不同时短时间叠两张、露出一点上一张是可接受的；按住 ←/→ 时尤其依赖本契约，避免「一半时间黑屏」。
6. **Hold 节流「已呈现」只认 incoming**（缩略 underlay 或新主图），不认仍在托底的上一张，以免切太快。
7. **图层隔离**：上一张与下一张是视口内互不干扰的绝对定位层；离开时**冻结**该层的尺寸与 transform，切图不得改动上一层的位置/缩放。就绪后上一层降为保活（仍挂载、肉眼不可见），← 可瞬间拉回。

相关实现入口：`useProgressiveMainImage`、`DisplayStageLayers`（独立层 + `frozenBySrc`）、`ImagePreviewInner` outgoing 状态机、`lib/imagePreviewDecode.ts`。

### 2.1 舞台楼层（DOM 顺序，少用 z-index）

预览内部按「楼层」叠放；同级绝对定位时**后渲染盖前渲染**：

| 楼层 | `data-rip-floor` | 内容 |
|------|------------------|------|
| L1 内容 | `content` | 主图 + 邻居 / outgoing hold（`DisplayStageLayers` 统一外壳；`z-index:0` **隔离**，内部层序不得盖住上层楼） |
| L2 命中 | `hit` | 拖拽 / 双击缩放透明层（`z-index:1`） |
| L3 控件 | `chrome` | 关闭、←/→、工具栏与文件名、小地图、底片条、EXIF（`z-index:2`；外壳 `pointer-events: none`，子控件自开 `auto`） |
| L4 加载 | `loading` | 中央 spinner 与错误回退——**始终最顶**（`z-index:3`） |

切图托底与邻居保活只在 **L1 内部**排层序；不要用临时大数字 z-index 让 spinner 与主图互相抢。

**切图时的三拍同步：**

1. **立刻**：`currentIndex` 推进 → 底片条选中边框（及条带定位）切到新 index；L1 可用上一帧 **outgoing hold** 托底，主图看起来仍可暂留旧图。
2. **等待揭开**：只要 outgoing 仍盖住舞台，且 `showSwitchLoader` 为真（默认），**L4 Loading** 显示中央 spinner。上一帧须保持**全尺寸 opacity 1** 托底；下一张可先在下层铺成全尺寸。**禁止**在下一张全尺寸主图层绘出前把上一张缩成 1×1（否则黑屏只剩一点）。
3. **揭开瞬间**：incoming 已 `imageShowReady`、有 dims、`<img>` 可绘制，再经 **双 rAF**（两帧重叠：下层已是全尺寸新图）后才清 `isOutgoing`；上一张再降为邻居 **1×1 + opacity 1** 保活。spinner 与揭开同拍关掉（无淡出）。

---

## 3. 「停够久再切」：为什么下一张能快

用户在图 N 上稳定停留一段时间后，系统把算力用在**即将可能去的邻居**上，而不是当前已清晰的主图上重复劳动。

### 3.1 两层预热（勿混淆）

| 层级 | 配置 | 含义 | 切过去能否「秒开清晰」 |
|------|------|------|------------------------|
| 字节预热 | `preloadRadius` | `Image()` 拉邻居 `src`，利于 HTTP/磁盘缓存 | **否**（仍可能再解一次） |
| Display-ready | `preloadDisplaySlots` / `preloadMemoryBudgetBytes` | 邻居 load + `decode()`；`slot` 模式保留离屏 `<img>` | **是（接近）**：同 DOM 节点晋升进舞台，避免再解 ~1s |

条带上的 `ready` / `warm` **不等于**可秒开。只有 **`display-ready`** 才对应「解码已落稳、可快揭」契约。

### 3.2 停稳后再热邻居（settle）

- 默认 `preloadDisplaySettleMs = 600`：切图后**防抖**，用户连切时取消未启动的邻居预热，只对**停稳**的那张热左右邻。
- **绝不**用这段防抖推迟**当前**主图的原图解码；当前张仍按 §2 立刻开跑。
- 产品语义上：在图上浏览约数秒（例如 3s+）时，邻居多半已过 settle 并完成 display-ready，再按 → 应尽量直接清晰。

### 3.3 用尽手段加速「下一张原图」

在内存预算允许的前提下，库侧与宿主侧应协同做到：

1. **宿主提供轻量 `minimapSrc`**（本地大 JPG 必做）：冷切也有占位；无缩略时冷路径与快路径都可能空白等解码。
2. **开启 progressiveMain**，且 `minimapSrc !== src`。
3. **传入稳定的 `preloadMemoryBudgetBytes`**（Tauri 读可用内存 + `suggestPreloadMemoryBudgetBytes`），并尽量提供宽高估算（EXIF / 索引），让预算能正确选邻。
4. **`preloadDisplayMode="slot"`（默认）**：保留已解码 DOM，切图晋升同一节点；`"decode"` 仅作内存降级，不能指望同等秒开。
5. **合适的 `preloadRadius`（常见 1～2）+ slots/预算**：停稳后把下一张解进 display-ready 池。
6. **层复用 + 合成保活**：`DisplayStageLayers` 用 `key={src}` 挂住当前 + 邻居全尺寸图；非 sharp 邻居以 **1×1 CSS 像素 + opacity 1** 保活（勿用半透明全图）；被占位盖住的当前 `<img>` 同样 1×1，underlay 仍用全尺寸盒。**outgoing 托底必须全尺寸**，直到下一张全尺寸揭开后再缩 1×1——避免 WKWebView/Chrome 丢位图，也避免切图黑屏只剩一点。
7. **快开路径**：命中 display-ready 时跳过 dwell/spinner，underlay 仅保留到视口可绘制。

---

## 4. 快速连切 / 按住 ←→：节奏与保护

连切时的目标是：**每一张至少完成主区域缩略展示，再进入下一张**；避免「逻辑已切 100 张、画面只跟了几张缩略」。

| 机制 | 行为 |
|------|------|
| **Thumb-paced hold** | 按下立刻切一张；之后每张须 **incoming** 主区域**已呈现**可看位图（有 `minimapSrc` 则缩略 underlay load 完成，否则等原图位图）并停留 `holdMinVisibleMs`，且仍按住才再切。Outgoing 托底的上一张**不算**已呈现。仅有布局尺寸 / progressive stage **不算**（避免黑屏 Loading 吃掉 dwell）。松开取消唯一定时器，**无步进队列**。无缩略等待原图时保留中央转圈。 |
| **忽略 key-repeat** | 键盘 `e.repeat` 不直接狂切；由 hold + thumb 就绪驱动。 |
| **Settle 取消邻居热** | 连切过程中不把每一跳的**新**邻居都 decode 进池；**已 display-ready 的邻居层仍保留挂载**（合成保活）。 |
| **未 settle 不挂「尚未就绪」的邻居全图层** | 减少 scrub 时挂载大量未解码全尺寸 `<img>`；已就绪的按 src 粘性保留。 |

单次点按（非长按）仍是：立刻切到目标 index，再走 §2 的占位 → 原图流程。

---

## 5. 端到端时序（示意）

```text
用户停在 N 上 ≥ settle（及更长浏览）
  → 邻居 N±1… 进入字节预热 / display-ready（受预算与 slots 限制）

用户切到 N+1（任意入口）
  → 立刻：有 minimapSrc 则画 underlay
  → 同时：主图 src 解码（若已 display-ready 则走快开 / 层晋升）
  → 原图整图可绘制：原子替换 underlay
  → 再 settle：为新的邻居预热（为下一次「停够久再切」服务）

用户点一下 →（短按）
  → 只切一张；即使下一张缩略瞬间就绪也不会连跳

用户按住 → 超过长按阈值
  → 之后每张：underlay（或就绪）出现，且不低于最小步进间隔 → 才允许再进一步
  → 松开：停止；无「后台跳完 100 张」
```

---

## 6. 非目标与常见误解

| 误解 | 正确理解 |
|------|----------|
| 关掉缩略占位更快 | 大图上通常只会换来黑屏；P0 是可看内容。 |
| 字节 `ready` = 秒开 | 不够；需要 display-ready（decode 落稳 + 同 DOM 保活晋升）。条带浅绿/中绿常是字节级。 |
| settle 600ms 拖慢当前图 | 只挡**邻居**预热，不挡当前原图。 |
| 连按越快越好 | 连按应按缩略节奏走；性能体验看「停够久再切」的下一张。 |
| 角落小地图 = 主区域占位 | 主流程占位是 `minimapSrc` underlay；`showMinimap` 是导航辅助。 |
| `opacity:0` 的离屏 `<img>` 已够 | **不够**（尤其 WKWebView）：合成器常丢解码位图；必须非零透明度保活（见 §9）。 |
| 任意 UI 活动都应暂停邻居预热 | **不应**：控件渐隐计时若误关 `panIdle` 且不恢复，会永久停掉 display-ready，表现为「等了很久、条带也绿，仍 cold≈1s」。 |

---

## 7. 宿主（如 Media Lens）检查清单（主流程相关）

- [ ] 每张大图有磁盘/缓存 **`minimapSrc`**，且与 `src` 不同  
- [ ] `progressiveMain` 开启  
- [ ] `preloadRadius` + `preloadMemoryBudgetBytes`（及宽高估算）已接  
- [ ] 默认 `preloadDisplayMode="slot"`；仅内存尖峰时降级  
- [ ] 停在一张数秒再 →：应接近清晰快开；冷切仍先缩略再原图  
- [ ] 按住 →：可见「一张缩略接一张」，而非 index 狂奔画面跟不上  

更完整的 Tauri 内存与 props 示例见 [`media-lens-integration.zh-CN.md`](./media-lens-integration.zh-CN.md)。

---

## 8. 相关代码地图

| 主题 | 位置 |
|------|------|
| 渐进占位 → 原图 / 快开竞态 | `useProgressiveMainImage.ts` |
| 整图可绘制 / 原子揭开 / WeakSet 快路径 | `lib/imagePreviewDecode.ts`、`ImagePreviewInner` |
| 邻居层复用 + 1×1 保活 | `parts/DisplayStageLayers.tsx` |
| 保活策略 | 非 sharp：`1×1` + `opacity: 1`；outgoing / 已揭开当前：全尺寸（`DISPLAY_LAYER_KEEPALIVE_OPACITY` 已弃用） |
| Display-ready 挑选、settle、panIdle、粘性 src | `lib/neighborDisplayPreload.ts`、`useNeighborDisplayPreload.ts` |
| 字节预热 settle | `useNeighborPreload.ts` |
| 短按 / 长按节奏 | `useThumbPacedNavigation.ts`、`useImagePreviewKeyboard.ts` |
| 本地大图计时验收（dev） | `demos/Demo6LocalLarge.tsx`（侧栏 `path` / `next` 相位 / sharp ms） |

---

## 9. 已验证的实现细节（长停留 → 秒开）

本节记录在 Demo 6 / 大 JPG 上**实测达到预期**的技术组合：停稳数秒后切到 display-ready 邻居，侧栏可见 `path=fast` 且 `sharp` 远小于冷启动的 ~1s（理想可到数十毫秒级）。

### 9.1 总览：快开需要同时满足的条件

```text
停在 N 上足够久
  → settle 到期且 panIdle（邻居允许预热）
  → 邻居 N±1 的全尺寸 <img> 挂载、load + decode 落稳
  → readySrc 记 sticky；条带 phase = display-ready（**蓝条**）
  → 合成器仍持有该位图（1×1 opaque 保活，且 settle 暂停时不卸已就绪层）

用户切到 N+1
  → outgoing 全尺寸托底；N+1 先全尺寸铺在下层（可 1×1→全尺寸）
  → 双 rAF 重叠后再把上一张缩成 1×1 保活
  → preferFastReveal：跳过二次 new Image() 探针；排空 layout 竞态 pending
  → scheduleRevealAfterDecode 命中 decodeSettled WeakSet → 微任务揭开
  → underlay 撤掉，sharp 接近瞬时
```

任一环断裂都会退回 **cold ≈ 1s**（常见：预热被误停、`opacity:0` 丢位图、快开路径仍等整图探针）。

### 9.2 合成器保活（WebView 不「偷懒」）

**问题：** 邻居层若使用 `opacity: 0` 或 `visibility: hidden`，WKWebView / Chromium 常把已解码位图丢掉。条带虽曾是 display-ready，切过去仍要 `createImageBitmap` 再解约 0.5–1s；两张来回切也会各吃半秒。

**做法（`DisplayStageLayers`：1×1 + opacity 1；勿再对全图用 ~2% 透明度）：**

| 层 | 布局 | 透明度 | 说明 |
|----|------|--------|------|
| 邻居（非当前 / 非 outgoing） | **1×1 CSS 像素** | `1` | 合成器仍绘制 → 保活；肉眼不可见；`key={src}` 不变 |
| 当前且仍被缩略盖住 | 盒全尺寸（给 underlay）；**`<img>` 1×1** | `1` | 不 `visibility:hidden` |
| 当前已揭开 / **outgoing 托底** | **全尺寸**（dims 缺则 `'auto'`，禁止强制 1） | `1` | 托底必须盖住舞台 |
| 缩略 underlay | 铺满 | `1`→`0` | 盖住未揭开的当前全图层 |

晋升：同一 `<img>` 改 style（1×1 → natural）；**必须先全尺寸揭开并与 outgoing 重叠至少约两帧，再把上一张缩 1×1**。0.3.10 曾在同一提交里撤托底+拉大下一张，导致次次黑屏一点。

### 9.3 快开路径：不要二次探针、排空竞态

**问题：** 即使 DOM 已 decode，progressive 管线在 `src` 切换时仍会 `new Image(); img.src = mainSrc` 再探一次尺寸；大 JPG 约 1s。同时 layout 微任务里的 `onMainImgDecoded` 常发生在 stage 仍为 `preloading` 时，只设 `pending`；若随后 known-dims 进入 placeholder 却不排空 pending，揭开会卡到探针结束。

**做法（`useProgressiveMainImage`）：**

1. `preferFastReveal && knownDimensions`（来自 display-ready meta）→ **跳过**主图 `Image()` 探针。
2. known-dims 进入 `thumbnail-placeholder` 时 **排空 pending** 并 `armReveal`（dwell=0）。
3. 若在 `preloading` 阶段收到 decode 完成且已有 known dims → 直接升 placeholder 并揭开（不依赖 effect 时序）。

冷路径仍保留探针 + 占位最小可见时间（如 Demo 6 的 dwell）。

### 9.4 邻居预热闸门：settle 与 panIdle（曾踩坑）

| 闸门 | 作用 | 注意 |
|------|------|------|
| `preloadDisplaySettleMs`（默认 600） | 切图后防抖，连切不热每一跳邻居 | **不**延迟当前主图 |
| `panIdle` / `interactionBusy` | 平移、小地图拖动时暂停邻居 decode | **仅**这两种交互应拉低 panIdle |

**已修缺陷：** 控件自动渐隐的 `resetHideTimer` 曾在每次鼠标/键盘活动时调用 `notifyInteraction()`，把 `panIdle=false` 后不再恢复 → display-ready **永久停摆**。表现：等 5s+、条带也「绿」，侧栏仍是 `path=cold`、`sharp≈1s`。现已：**渐隐计时不再动 panIdle**；`notifyInteraction` 会在短空闲后重新 `armPanIdle`。

**Settle 期间层保留：** 暂停*新*预热时，`slotRenderEntries` 仍挂载 **src 已在 `readySrc` 里** 的邻居，避免一切图就卸掉保活 DOM。

**条带蓝条条件（AND）：** ① 在当前邻居槽位窗口内；② **decode 已完成、可瞬切**。仅是邻居、仍在加载 → 灰/绿进度，**绝不变蓝**。离开窗口后降为绿条 `warm`。`readySrc` 仍按 src 粘性供切回去快开。

### 9.5 短按 vs 长按（hold）

- **按下**：立刻切一张（短按 = 这一次）。
- **仍按住**：新图主区域**真正画出可看位图**之后，再等 `holdMinVisibleMs`；若仍按住才切下一张。全程最多一个等待定时器——**松开即停，不堆积**。
- **计时起点（重要）**：以「用户能看见的一帧」为准，而不是 onLoad / 已知宽高。
  - 候选：舞台可见（`imageShowReady`）且缩略 underlay 或原图主层位图已 load。
  - 确认：对该层 `decode()`（缩略很轻）+ **两帧 rAF** 后才开始 `holdMinVisibleMs`；本张 visit 内确认后不再因 underlay→原图揭开而清零。
  - 切 `src` 时强制舞台先 opacity:0（即使 meta 尺寸一直在），避免黑闪期间误开计时。
  - 仍在黑屏 / Loading：不计时、不切。
- 无缩略、原图未就绪时：停在当前 index，中央转圈，绝不提前切。

### 9.6 验收（Demo 6）

1. 开启 `preloadDisplaySlots`，停稳数秒。
2. 侧栏 **`next` 相位为 `display-ready`**（不要只看当前 `here`）。
3. ←/→：期望 **`path=fast`**，`sharp` 远小于 cold 的 ~1s（成功时常见 ≪200ms，好的时候可到 ~30ms）。
4. 关掉 slots 强制 cold 做 A/B。
5. 两张来回切：保活有效时来回也应明显快于冷启动。
