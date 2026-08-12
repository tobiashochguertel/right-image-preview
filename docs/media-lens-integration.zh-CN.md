# Media Lens → right-image-preview 接入说明

[English](./media-lens-integration.md)

面向 **Media Lens**（Tauri + React）接入 `right-image-preview` **≥ 0.3.x**（含 display-ready 邻居预热）的清单。

完整 API 表见 [`api.zh-CN.md`](./api.zh-CN.md)。

---

## 1. 目标

| 目标 | 做法 |
|------|------|
| 预览嵌在工作区（侧栏仍可用） | `presentation="contained"` |
| 整段扁平底片条 | `showThumbnails` + `thumbnailsScope="flat"` |
| 本地大图 ←/→ 更快 | `preloadRadius` + **display-ready 预算**（不是只看字节绿条） |
| 内存策略由宿主决定 | Tauri 传入 `preloadMemoryBudgetBytes`；组件按邻图估算决定预热几张 |

**不要**把条带上的 `ready` / 浅绿 `warm` 当成「可秒开清晰」。只有 **`display-ready`**（或已对该 `src` 完成 decode）才会跳过渐进占位和转圈。

---

## 2. 推荐 props

```tsx
import {
  ImagePreview,
  rgbaDecodedBytes,
  suggestPreloadMemoryBudgetBytes,
  type ImageItem,
} from 'right-image-preview';

const availableBytes = await invoke<number>('get_available_memory_bytes');
const preloadMemoryBudgetBytes = suggestPreloadMemoryBudgetBytes(availableBytes);
const preloadDisplaySlots = 4; // 可选硬顶

<ImagePreview
  presentation="contained"
  chrome="minimal"
  images={items}
  visible
  index={index}
  onIndexChange={setIndex}
  showThumbnails
  thumbnailsScope="flat"
  preloadRadius={2}
  preloadMemoryBudgetBytes={preloadMemoryBudgetBytes}
  preloadDisplaySlots={preloadDisplaySlots}
  estimateDecodedBytes={(item) => {
    const w = Number(item.exif?.width);
    const h = Number(item.exif?.height);
    if (w > 0 && h > 0) return rgbaDecodedBytes(w, h);
    return rgbaDecodedBytes(6000, 4000);
  }}
  preloadDisplayMode="slot" // 内存尖峰时可改 "decode"
  showThumbnailPreloadStatus={import.meta.env.DEV}
  showFlip={false}
  progressiveMain
  language="zh-CN"
  onClose={...}
/>
```

浏览过程中 **props 保持不变是正常的**。同一文件夹里 6K/9K 混排时，组件会在每次切图时按单张估算重新挑选邻居。

只传预算、不传 slots（`preloadDisplaySlots={0}`）也可以：组件用默认上限 6，再由预算决定实际填几张。

---

## 3. Tauri 读取可用内存

组件**不会**自己调 OS。Rust 示例：

```rust
#[tauri::command]
fn get_available_memory_bytes() -> u64 {
  let mut sys = sysinfo::System::new();
  sys.refresh_memory();
  sys.available_memory()
}
```

```ts
const available = await invoke<number>('get_available_memory_bytes');
const budget = suggestPreloadMemoryBudgetBytes(available);
// 默认：约可用内存的 12%，上限 1.5 GiB
```

启动时算一次；也可在窗口重新聚焦时刷新。尚未接 Rust 时，可用 `navigator.deviceMemory`（粗粒度 GiB）顶一下。

---

## 4. 职责划分

| Media Lens | right-image-preview |
|------------|---------------------|
| 可用/总内存、产品激进程度 | 在 `preloadRadius` 内按预算挑选邻居 |
| 提供宽高（EXIF 或索引） | load + `decode()` → 确切 `display-ready` |
| 文件夹树、磁盘缓存、星级等 | 切到 display-ready 时跳过渐进 |

预算只覆盖**邻居池**，不含当前主图。请按「可用内存」留余量（12% 只是起点）。

---

## 5. 内存粗算（RGBA ≈ 宽×高×4）

| 规格 | 约解码占用 |
|------|------------|
| 6000×4000 | ~96 MB |
| 7000×4600 | ~123 MB |
| 9000×5000 | ~180 MB |

当前 + 两张约 9K 邻居：解码量级常到 **0.5 GiB+**（未计浏览器额外开销）。16 GB 机器建议预算 + `preloadDisplaySlots` ≤ 4；8 GB / WKWebView 更保守。

---

## 6. 状态相位

| 相位 | 含义 |
|------|------|
| `loading` / `ready` | 字节预热。**不会**跳过渐进 |
| `display-ready` | decode 完成。切过去 → 无长模糊占位 / 等待转圈 |
| `warm` | 本会话曾加载、已离开窗口。不是 display-ready |

---

## 7. 验收清单

- [ ] `presentation="contained"`，侧栏可操作
- [ ] `preloadRadius` + 来自 Tauri 的 `preloadMemoryBudgetBytes`
- [ ] 尽量带上宽高估算
- [ ] 切到已 `display-ready` 的邻居 → **没有**长时间缩略图模糊 + 转圈
- [ ] 跳到窗口外远处 → 仍走渐进亦可
- [ ] 内存压力大：`preloadDisplayMode="decode"` 或减小预算 / slots

---

## 8. 安装

```bash
npm install right-image-preview@^0.3.1
```

请使用已导出 `suggestPreloadMemoryBudgetBytes` 的 **0.3.1+**。
