# 主图显示与切图主流程

[English](./main-display-flow.md)

本文是 **right-image-preview** 的产品级主流程说明：任意操作切到下一张时，舞台上**先看到什么、再换成什么**，以及如何用尽手段让「停够久再切」时原图尽可能秒开。

实现细节、props 默认值见 [`api.zh-CN.md`](./api.zh-CN.md)；Media Lens / Tauri 接入清单见 [`media-lens-integration.zh-CN.md`](./media-lens-integration.zh-CN.md)。

---

## 1. 核心目标

| 优先级 | 目标 |
|--------|------|
| **P0** | **绝不优先「空舞台」**：切图瞬间宁可先放缩略占位，也不要长时间黑屏 / 空白等待。 |
| **P0** | **切图一律先有可看内容**：有主区域缩略图（`ImageItem.minimapSrc`）则先放大显示占位；没有才直接拉原图。 |
| **P0** | **原图与占位并行**：切到某张的瞬间就开始解码/渲染该张真正的 `src`；原图一旦整图可绘制，立刻撤掉缩略占位。 |
| **P0** | **长停留后的下一张要快**：在前一张上稳定浏览足够久（例如约 3s+）再切到下一张时，若邻居已是 display-ready（条带最深绿），应复用已解码层并跳过二次原图探针，使清晰原图接近瞬时出现。 |
| **P1** | **连按 / 按住不刷爆解码**：快速 ←/→ 时按「主区域缩略已展示」节奏推进，不为每一跳都把大原图解完。 |

「主区域缩略占位」指舞台中央的渐进 underlay（`minimapSrc` 放大模糊占位），**不是**右下角导航小地图（`showMinimap`）。

---

## 2. 单次切图：舞台上发生什么

无论入口是键盘 ←/→、侧边箭头、底片条点击、`goTo` / 受控 `index`、组跳转等，**当前主图**的显示契约相同：

```text
切到 index N
    │
    ├─ 有独立 minimapSrc（且 progressiveMain 开启）
    │     ├─ 立刻尝试画出缩略 underlay（可看内容优先）
    │     └─ 同时开始拉 / 解码 / 布局真正的 src
    │           └─ 原图整图可绘制 → 原子揭开原图层，撤掉 underlay
    │
    └─ 无 minimapSrc（或 progressive 关闭 / 自定义 minimap 节点）
          └─ 直接走原图路径（可能短暂无占位；宿主应尽量为本地大图提供磁盘缩略）
```

要点：

1. **先缩略、后原图**是默认主路径；「没有缩略才硬上原图」是降级，不是推荐配置。
2. 切图那一帧**不会**等原图就绪才给用户反馈；占位与原图准备是并行的。
3. 原图揭开要求「整图可绘制」（例如 `createImageBitmap` / `decode` 落稳 + 双 `rAF`），避免渐进 JPEG 只露出左上一条就闪一下。
4. 若邻居已是 **display-ready**，走**快开**：跳过人为占位停留 / 中央转圈，但仍可短暂保留 underlay，直到视口主图真正可画——**不以去掉占位换黑屏**。

相关实现入口：`useProgressiveMainImage`、`DisplayStageLayers`、`lib/imagePreviewDecode.ts`。

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
6. **层复用 + 合成保活**：`DisplayStageLayers` 用 `key={src}` 挂住当前 + 邻居全尺寸图；邻居以 **1×1 像素 + 极低非零透明度** 保活，被占位盖住的当前层用全尺寸同样保活——避免 WKWebView/Chrome 丢弃 `opacity:0` 图层的解码位图后切图再解 ~0.5–1s。缩略 underlay 盖在上面，用户看不到保活层。
7. **快开路径**：命中 display-ready 时跳过 dwell/spinner，underlay 仅保留到视口可绘制。

---

## 4. 快速连切 / 按住 ←→：节奏与保护

连切时的目标是：**每一张至少完成主区域缩略展示，再进入下一张**；避免「逻辑已切 100 张、画面只跟了几张缩略」。

| 机制 | 行为 |
|------|------|
| **Thumb-paced hold** | 按下立刻切一张；之后每张须主区域**已呈现**可看位图（有 `minimapSrc` 则缩略 underlay load 完成，否则等原图位图）并停留 `holdMinVisibleMs`，且仍按住才再切。仅有布局尺寸 / progressive stage **不算**（避免黑屏 Loading 吃掉 dwell）。松开取消唯一定时器，**无步进队列**。无缩略等待原图时保留中央转圈。 |
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
| 保活透明度常量 | `imagePreviewTuning.ts` → `DISPLAY_LAYER_KEEPALIVE_OPACITY` |
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
  → readySrc 记 sticky；条带 phase = display-ready（最深绿）
  → 合成器仍持有该位图（非零透明度保活，且 settle 暂停时不卸已就绪层）

用户切到 N+1
  → React 以 key={src} 复用同一 DOM 节点（1×1 → 全尺寸布局）
  → preferFastReveal：跳过二次 new Image() 探针；排空 layout 竞态 pending
  → scheduleRevealAfterDecode 命中 decodeSettled WeakSet → 微任务揭开
  → underlay 撤掉，sharp 接近瞬时
```

任一环断裂都会退回 **cold ≈ 1s**（常见：预热被误停、`opacity:0` 丢位图、快开路径仍等整图探针）。

### 9.2 合成器保活（WebView 不「偷懒」）

**问题：** 邻居层若使用 `opacity: 0` 或 `visibility: hidden`，WKWebView / Chromium 常把已解码位图丢掉。条带虽曾是 display-ready，切过去仍要 `createImageBitmap` 再解约 0.5–1s；两张来回切也会各吃半秒。

**做法（`DisplayStageLayers` + `DISPLAY_LAYER_KEEPALIVE_OPACITY ≈ 0.02`）：**

| 层 | 布局 | 透明度 | 说明 |
|----|------|--------|------|
| 邻居（非当前） | **1×1 CSS 像素** | 保活非零 | 「骗」合成器这张图需要绘制；肉眼不可见；`key={src}` 不变 |
| 当前且仍被缩略盖住 | **全尺寸** | 保活非零 | 不 `visibility:hidden`，避免晋升前一刻丢位图 |
| 当前已揭开 | 全尺寸 | `1` | 正常显示 |
| 缩略 underlay | 铺满 | `1`→`0` | **更高 z-index** 盖住保活层，避免残影 |

晋升时同一 `<img>` 仅改 style（1×1 → natural 宽高、opacity → 1），不重新 `src`、不换 key。

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

**条带粘性：** `display-ready` 按 **src** 粘性标记 flat index（离开邻居窗口仍显示最深绿），与 `isSrcDisplayReady(src)` 一致；勿把中绿字节 `ready` 当成可秒开。

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
