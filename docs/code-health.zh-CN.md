# 代码健康与可维护性说明

本文记录对 `right-image-preview` 代码库的审阅结论、已落地的改进与仍建议后续考虑的事项（不定期更新）。

---

## 1. 曾发现的问题（审阅摘要）

### 1.1 结构与体量

- **`ImagePreview.tsx` 体量很大**（主对话框单文件承担数据、分组、滚轮、渐进图、布局、工具栏、小地图、侧箭头等），属于典型的「上帝组件」，新人通读成本高，改动牵一发动全身。
- **`Toolbar` / `Minimap` / `useImageTransform`** 同样偏长，与领域复杂度相关，但核心状态与事件仍高度集中在 `ImagePreview`。

### 1.2 可维护性

- **多处 `eslint-disable`**（hooks 依赖、ref 合并、effect 内 setState）：表示与默认规则有意的妥协，维护者需理解原因。
- **`DelayedTooltip` 使用 `cloneElement` + ref 转发**：子节点类型或 ref 形态变化时较脆。
- **Raster LOD 与 GPU cache**：重点检查 viewport generation、texture byte 预算、fence 完成与 context loss 恢复。

### 1.3 重复与 API 认知

- **演示站与组件内视觉 token 不共享**（各写一套颜色），主题微调要改两处。
- **`switchImageResetZoom` 与 `switchImageResetTransform`** 命名接近，依赖文档区分。

### 1.4 行为与边界

- **侧栏箭头 `polyline` 坐标为魔法字符串**：可读性差，难以从代码看出「单箭头 / 双箭头 / 左右」语义。
- **`PageUp` / `PageDown`**：依赖 `prevGroup` / `nextGroup` 在无分组时内部 no-op；读者若不跟实现易误解。
- **焦点**：内层在 `visible` 为 false 时卸载，挂载时 `focus` 一次；若未来改为「隐藏但不卸载」，需重审焦点策略。

### 1.5 其它

- **`flattenGroupedImages` 在 dev 下 `console.warn`**：合理，属唯一库内 warn。
- **Demo 3 资源策略**：大图与渐进用缩略图走 Wikimedia Commons（`Access-Control-Allow-Origin: *`）。著作权与原件说明仍以 Commons 页面为准。WebGL 用 `fetch`，没有 CORS 的图床会出现「网格缩略图能显示、预览一直空白」。
- **自动化测试**：对 Minimap、渐进图、滚轮路径覆盖偏薄，大改时防回归压力较大。

---

## 2. 已落地的改进（本轮）

| 项目 | 说明 |
|------|------|
| **侧箭头 polyline** | 抽取为 `navArrowPolylines.ts` 命名常量，JSX 用括号表达左右/单双，语义自解释。 |
| **键盘逻辑** | 抽取为 `useImagePreviewKeyboard.ts`，缩短 `ImagePreview.tsx`，依赖数组集中在一处。 |
| **焦点 effect** | 补充注释：与外层 `visible` 卸载策略的关系。 |
| **PageUp/PageDown** | 在键盘 hook 内注释说明无分组时由 `prevGroup`/`nextGroup` 内部 guard。 |
| **CI** | 新增 `.github/workflows/ci.yml`：`lint` + `test` + `build:lib`（push/PR 至 main 等）。 |
| **API 去包袱** | 自 `types` 与需求文档移除未实现的 `countRender`，仅保留工具栏内置计数展示。 |

---

## 3. 建议后续考虑（未强制实施）

- **继续拆分 `ImagePreview`**：例如滚轮、`useImperativeHandle`、侧箭头子组件文件化等，需按发布节奏分步做。
- **DelayedTooltip**：评估改为「wrapper + portal」或小型 headless 方案，减少对 `cloneElement` 的依赖。
- **设计 token**：可选 `tokens.ts` 供 Toolbar 与 demo 共用（或明确「demo 不保证与库视觉一致」）。
- **补充测试**：渐进加载、分组键盘边界、滚轮聚合一类场景。
- **Demo 资源**：Demo 3 依赖 Wikimedia 大图（需联网且图床支持 CORS）；Demo 6 默认同一图床的 1280–1920px 图集，本地 `./test-images` 通过页面开关使用。

---

## 4. 相关文件（本轮）

- `src/components/ImagePreview/navArrowPolylines.ts`
- `src/components/ImagePreview/useImagePreviewKeyboard.ts`
- `src/components/ImagePreview/ImagePreview.tsx`（引用上述模块 + 注释）
- `.github/workflows/ci.yml`
- `docs/code-health.zh-CN.md`（本文件）
