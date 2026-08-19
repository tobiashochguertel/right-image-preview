# 主显示流程（v0.4）

本文件只描述当前实现。静态位图主舞台不再存在 DOM `<img>` fallback、outgoing 图层、1×1 keep-alive 或 slot decode。

## 位图呈现

```text
MediaSource → fetch/Blob → createImageBitmap → WebGL2 texture → GPU fence → 原子呈现
```

- Canvas 在 Viewer 生命周期内常驻；切到 SVG、动画图或视频时仅隐藏并暂停新预取，已有 texture cache 保留。
- 切图时旧 Canvas 像素保持到新纹理 fence 完成；`display-ready` 后一次性切换，并结束 spinner。
- Preview 可来自 `minimapSource/minimapSrc`；Screen 覆盖实时图片舞台；Full 只升级当前停稳图片。Full 呈现时当前 Screen 仍保留；切到下一项后，刚离开的 Screen 继续作为最高优先级保护项，便于立即返回。
- `onPresented` 在新纹理绘制后的下一帧触发，作为按住连切的计时起点。

## 视口与 DPR

这里的视口是承载图片的舞台 DIV，不是屏幕或整个应用窗口。`ResizeObserver` 读取 DIV 的 CSS 宽高，再乘 `window.devicePixelRatio` 得到所需 backing/source pixels。窗口缩放、侧栏变化、contained 布局和全屏都会自动重算 LOD 计划。

例如舞台宽 100 CSS px、DPR=1.5 时，为避免 1:1 采样损失，Screen 目标宽度需要约 150 个源像素。macOS 的 DPR 由当前显示模式和 WebView 报告，不能用“面板物理 4K ÷ 缩放分辨率”自行推导。

## 动态 LOD

- Preview：可选低清首帧。
- Browse：Screen 线性尺寸的 60%，用于更远邻图的低成本瞬时呈现。
- Screen：覆盖图片舞台 DIV × DPR；正常预算下至少保障前进方向 3 张、后退方向 2 张。
- Full：当前张停稳 `fullResolutionSettleMs` 后才开始，可取消；不为每个经过项完整解码。

前后数量不写死。规划器逐张估算真实 RGBA8 texture bytes：若所有候选 Screen 都能放入预算，则全部直接使用 Screen；否则先建立随压力动态缩放的连续 Screen 核心（压力极高时前后各 1 张，常规条件可达前 3 / 后 2），再由内向外连续扩展固定 Browse 环；Browse 不会被自动升级成 Screen。因此就绪区不会出现绿色空洞夹在蓝/紫条之间。

连续导航走廊外还会维护一组受预算约束的历史 Screen 钉住项：离开某张图时，只要它的 Screen texture 仍驻留，就成为最新历史候选；当前图升级为 Full 后，其 Screen 伴随 texture 也继续保留。cache 会先为当前图以及最近的前/后一张 Screen 预留空间，再按最近访问顺序保留剩余预算能容纳的既有 Screen。历史项**只保留、不补建**：被回收或原本不存在的项绝不会因为历史记录而重新下载、解码或上传。因此缩略图 4 ↔ 11 这类非连续往返可以瞬时显示，同时方向性的连续走廊不会变成有跳洞的计划。Demo 6 会分开显示走廊与历史索引。

## 状态条

- 蓝：Screen/Full texture fence 已完成且仍驻留，可覆盖当前视口。
- 柔和紫罗兰：Browse texture 驻留，可立即绘制的中等细节固定层级。
- 绿：原图下载进度或本次 Viewer 生命周期曾完整下载；它是缓存提示，不保证 GPU 驻留。

详见[渲染架构](./rendering-architecture.zh-CN.md)与 [API](./api.zh-CN.md)。
