# right-image-preview v0.4.0-beta.1：WebGL-first 架构改造任务书 / Codex 完整提示词

> 这是一份可以直接交给 Codex 执行的工程改造提示词。目标不是在现有 DOM Viewer 旁边再增加一个 WebGL Viewer，而是把 **静态位图（raster image）的正式主渲染路径统一改成 WebGL**，同时把 SVG、GIF/动画图片、Video 以及其他媒体按类型拆成各自独立的模块（独立文件夹、独立渲染、独立的缩放/拖拽响应）。工具栏、底片条、文件名、上一张/下一张等 **Viewer Shell 保持同一套 UI**。这是一个要跑在浏览器、VS Code Webview、Tauri 等宿主里的 **React 组件**，不是一个内置磁盘访问的看图 App。避免长期维护两套功能等价的静态图片渲染器。

---

## 0. 任务上下文

你现在要改造的仓库是：

```text
https://github.com/ZhangJian1713/right-image-preview
```

本地 WebGL 高性能实现参考项目位于：

```text
/Users/zj/projects/assets/fast-images-viewer
```

请在开始编码前，**先完整阅读并对比这两个项目的当前实现**，尤其关注：

1. `right-image-preview` 当前的 Viewer Shell、缩放/平移/旋转、渐进加载、邻图预加载、display-ready、outgoing hold、minimap、thumbnail strip、EXIF、keyboard、contained/overlay 等逻辑——其中 **DOM 性能 hack 列为删除项，不是迁移项**；
2. `fast-images-viewer` 当前 WebGL 渲染器的纹理加载、图片切换、缓存、渲染循环、资源释放、性能策略（不要搬它的 zoom 模型）；
3. 哪些逻辑属于共享 Shell，哪些属于某种媒体自己的文件夹，哪些应该删除；
4. 组件如何在只拿到 URL / Blob / bytes 的情况下对接浏览器、VS Code Webview、Tauri 宿主；
5. 不要机械复制 `fast-images-viewer`。它是已经验证性能的参考实现，但最终代码必须适配 `right-image-preview` 的 API、交互语义、测试和包发布方式。

**编码前先完成 Phase 0：确认或创建 `v0.3.12` tag（不 push）。** 然后输出一份简短的代码勘察结果和迁移计划，再实施。不要因为现有代码复杂而绕过核心重构，也不要为了“优雅迁移”把 DOM hack 再包一层。

---

# 1. 背景

`right-image-preview` 当前是一套 React 图片预览组件，现有版本以 DOM `<img>` 为主图渲染底层，并围绕浏览器图片解码与合成行为做了大量性能优化。

当前架构已经不只是简单 `<img>`：它包含类似以下机制：

```text
current image
outgoing hold
incoming image
progressive thumbnail underlay
Image.decode()
new Image() preload
display-ready
neighbor display slots
1×1 / crop keep-alive
双 rAF 揭开
DOM layer / z-index / opacity 管理
```

这些设计解决了 DOM Viewer 中的黑屏、切图延迟、浏览器回收 decoded bitmap、WKWebView/Chromium 合成行为不可控等问题，但也说明当前实现正在越来越深地依赖浏览器 DOM/compositor 的内部行为。

与此同时，本地项目：

```text
/Users/zj/projects/assets/fast-images-viewer
```

已经验证 WebGL 路线在大图连续查看、预加载后切换、稳定性方面有明显优势。

因此新版不再继续把主要研发精力投入到“如何让 `<img>` 更像专业大图 Viewer”，而是把 **静态位图的主渲染引擎切换为 WebGL**。

**这些 DOM 性能 hack 可以而且应当大胆删除。** 它们是为 DOM compositor / decoded-bitmap 保活服务的，不是产品契约本身。WebGL 用「继续画上一张 texture，直到下一张 decode+upload 完成再原子切换」就能覆盖黑屏、切图闪烁、保活等问题。不要把 outgoing hold、1×1 keep-alive、双 rAF、opacity/z-index 图层机翻译成 WebGL。旧实现以 Git tag `v0.3.12` 存档即可。

---

# 2. 核心产品决策

## 2.1 不维护两套功能等价的静态图片 Renderer

这是本次重构最重要的架构约束。

**禁止最终形成：**

```text
DomRasterRenderer
├ zoom
├ pan
├ rotate
├ preload
├ outgoing hold
└ navigation

WebGLRasterRenderer
├ zoom
├ pan
├ rotate
├ preload
├ outgoing hold
└ navigation
```

这样会导致：

- 每个功能开发两遍；
- 每个 bug 修两遍；
- 测试矩阵翻倍；
- DOM 与 WebGL 行为逐渐漂移；
- bundle 同时携带两套逻辑；
- 为了兼容旧 Renderer 限制 WebGL 特有优化；
- Compare / Diff / Pixel Inspector / LOD / Tile 等能力无法自由围绕 GPU 设计。

**新版的原则是：静态位图只有一套正式 Renderer：WebGL。**

---

## 2.2 不是 WebGL-only App，而是 Raster-image WebGL-only

不要把所有媒体格式强行塞进 WebGL。

媒体按照其天然语义选择最合适的展示管线：

```text
App / Viewer Shell
│
├── Static Raster Image
│     └── WebGLRasterViewer
│
├── SVG
│     └── SvgViewer（浏览器 / DOM 原生渲染）
│
├── Animated Image
│     └── AnimatedImageViewer（直接播放 GIF/APNG/Animated WebP 等）
│
└── Video
      └── VideoViewer（HTMLVideoElement / 平台播放器能力）
```

这里的多个 Viewer 是**不同媒体类型的专用播放器**，不是同一种 JPEG/PNG 的两套 renderer。

## 2.3 共享 Shell UI，按媒体类型分文件夹实现交互

切到 SVG、GIF、Video 时，**外壳必须还是同一套**：

```text
上一张 / 下一张
缩放按钮（+ / − / Fit / 百分比）
旋转 / 翻转（若该类型声明支持）
文件名 / 计数
工具栏
底片条（thumbnail strip）
minimap（若该类型声明支持）
contained / overlay
keyboard 路由
```

用户按的是同一套按钮。但 **像素如何响应，由当前媒体类型自己的模块决定**，不能把 SVG / Video 塞进 WebGL 的缩放矩阵里。

例如：

```text
用户点击「放大」
        │
        ▼
Viewer Shell 发出 zoomIn 命令（不知道 WebGL 或 CSS）
        │
        ▼
当前 MediaKind 的模块接收命令
        │
        ├── raster     → WebGL 矩阵 / 纹理坐标（完整 Fit / native% / pan）
        ├── svg        → DOM/CSS transform（浏览器矢量渲染）
        ├── animated   → 通常 CSS transform；播放仍走 <img>
        ├── video      → 自己的缩放/拖拽规则（可限制、可禁用 pan）
        └── unknown    → 明确降级或禁用相关按钮
```

每种类型必须有**自己的文件夹**，里面放该类型的：

```text
如何判定自己能处理这个资源
如何加载 / 解码 / 播放
如何画到舞台上
如何响应 zoom / pan / rotate / flip（或声明不支持）
如何释放资源
```

不要做成「一个万能 DOM Viewer 用 if (kind) 分支处理 SVG/GIF/Video」。也不要把 `next()` / `previous()` 下放到每个 renderer——导航属于 Shell。

## 2.4 这是多宿主组件，媒体来源必须可对接

`right-image-preview` 是 **npm React 组件**，会跑在至少这些场景：

```text
普通浏览器前端项目     → http(s) / blob: / object URL
VS Code 扩展 Webview   → 宿主转成 webview URI 后再交给组件
Tauri 桌面看图         → 宿主把本地路径转成可加载 URL / 字节后再交给组件
```

图片可能来自 **网络** 或 **本地磁盘**。组件 **不得** 直接调用 VS Code API、Tauri `convertFileSrc`、Node `fs` 或任意宿主私有协议。宿主负责把资源变成组件能加载的句柄。

必须抽象媒体来源，让 Raster / SVG / GIF / Video 管线都能对接，而不是写死 `<img src={item.src}>`。至少支持：

```ts
type MediaKind =
  | 'raster'
  | 'svg'
  | 'animated-image'
  | 'video'
  | 'unknown';

/** 宿主已经解析好、组件可以直接加载的资源。 */
type MediaSource =
  | { type: 'url'; href: string }          // http(s)、blob:、data:、webview URI、asset: 等
  | { type: 'blob'; blob: Blob; mimeType?: string }
  | { type: 'bytes'; data: ArrayBuffer; mimeType?: string };
```

兼容策略：现有 `ImageItem.src: string` 继续可用，语义等于 `{ type: 'url', href: src }`。可选增加 `kind`、`source`，避免所有旧用户重写数据模型。

**来源优先级与生命周期：**

- 大图优先 `url` 或 `blob`。`bytes`（ArrayBuffer）只是能力补充，给宿主已经握在手里的小块数据用。
- 实现不得把所有 source 一律 `new Blob([arrayBuffer])` 再复制一遍。
- 由组件创建的 object URL 必须 `URL.revokeObjectURL`；`ImageBitmap` 用完必须 `close()`。
- 不要让同一份像素同时以 ArrayBuffer、Blob、ImageBitmap、GPU texture 四份常驻。

缩略图 / `minimapSrc` 同样走这套来源抽象（URL 或 Blob），不要假设一定能用第二个 `<img>`。

解码、纹理上传、DOM 播放都只依赖 `MediaSource`，不依赖「这是不是本地文件」。

---

## 2.5 Raster 正式路径：WebGL2-only

v0.4 Raster Renderer **只使用 WebGL2**。不要为 WebGL1 再维护一套 GLSL ES 1.00 / VAO / texture format 分支。

```text
WebGL2 available     → Raster Viewer
WebGL2 unavailable   → 明确 unsupported / 极薄 emergency <img>（无完整 zoom/preload）
```

禁止最终形成 `WebGL2Renderer` + `WebGL1Renderer`。目标宿主（现代浏览器、VS Code Webview、Tauri）可以要求 WebGL2。emergency fallback 不得成为第二套 Raster architecture。

---


# 3. 媒体类型策略

## 3.1 Static Raster：统一 WebGL

以下静态像素图应优先进入 WebGL Raster Pipeline：

```text
JPEG / JPG
PNG
WebP（静态）
AVIF（静态）
BMP
以及宿主能够解码成 bitmap 的其他静态像素格式
```

它们共享：

- Fit / native zoom；
- 离散 zoom stops；
- Pan；
- Rotate；
- Flip；
- progressive preview；
- preload；
- texture cache；
- GPU rendering；
- Compare / Diff 的未来扩展点；
- Pixel Inspector 的未来扩展点；
- LOD / Tile 的未来扩展点。

**不要继续保留完整 DOM `<img>` 静态图片主渲染路径。** 为极限切图性能写的 DOM 操作、keep-alive、图层机全部删除，不要为“以防万一”留后门。

每种静态位图相关实现放在 `renderers/raster-webgl/`（或同等独立目录），不要散落在 Shell 里。

---

## 3.2 SVG：独立文件夹 + 浏览器原生渲染

SVG 不需要为了“技术统一”上传成 WebGL texture。

当前产品并不要求 SVG 像专业矢量编辑器一样无限倍率放大，因此优先选择简单、稳定、低维护成本的浏览器原生渲染。

实现必须放在独立目录，例如 `renderers/svg/`，自己负责：

```text
从 MediaSource 加载 SVG
默认用 <img> 或 Blob URL 显示（浏览器仍按矢量 rasterize）
响应 Shell 发来的 zoom / pan / rotate / flip
通过 capabilities + viewState 让 Shell 更新工具栏
```

**不要默认 inline SVG，也不要默认 `<object>`。** 网络文件、用户磁盘、第三方资源若 inline 进当前 document，会带入脚本、外链、事件属性等安全面。除非未来明确需要访问 SVG DOM，否则始终 `<img src="...">` / Blob URL。

上一张 / 下一张、文件名、底片条仍由 **Viewer Shell** 提供，SVG 模块不要复制一套导航 UI。

SVG 不需要拥有：

- texture cache；
- LOD；
- tile；
- WebGL shader；
- raster pixel inspector；
- WebGL diff pipeline。

SVG 的缩放是 **CSS / DOM transform**，不是 WebGL matrix。可以复用 Core 里与渲染无关的数字（scale、translate、rotation），但 **应用方式必须写在 svg 文件夹内**，不能走 raster-webgl 的 shader uniforms。

---

## 3.3 GIF / Animated Image：独立文件夹

GIF 不应被视为“需要逐帧上传 texture 的 JPEG”。

实现放在 `renderers/animated/`（或同等独立目录）。当前阶段优先使用浏览器已有动画图片播放能力（`<img>` 播放 GIF/APNG/Animated WebP，按当前 WebView/浏览器检测）。

它在产品语义上更接近无声短视频。

该模块自己负责播放与 transform 应用；Shell 仍然提供工具栏 / 底片条 / 文件名 / 上一张下一张。不要把导航逻辑写进 animated 文件夹。

不要在 v0.4.0-beta.1 为了统一架构提前实现复杂的 GIF frame decoder、frame scheduler 或 texture upload pipeline。

如果未来需要：

```text
暂停
逐帧
变速
指定帧
导出某一帧
```

再在 **同一个 animated 文件夹** 里升级播放器即可。

---

## 3.4 Video：架构预留，beta.1 不做完整播放器

Video **必须有独立文件夹** `renderers/video/` 和 dispatcher 分支，但 **v0.4.0-beta.1 不要求实现完整 VideoViewer**。当前产品是 Image Preview；本次要验证的是 DOM Raster → WebGL Raster。完整视频播放（codec、seeking、timeline、音画同步）放到后续 0.4.x。

beta.1 最低要求：

```text
目录存在
MediaKind = 'video' 能被判定并分发到该模块
显示明确的「暂不支持预览」或极薄 <video> 占位
capabilities 声明 zoom/pan 等是否可用
不要把 video 误送进 WebGL raster
```

缩放 / 拖拽将来由 video 模块自己实现或显式声明不支持。WebGL 只有在未来需要对视频帧做 GPU 后处理时才作为后处理层，不负责播放器本身。

---

## 3.5 其他 / 未知类型

为后续格式预留 `renderers/unknown/`（或 `other/`）：无法判定或尚未支持的资源应有明确 UI（错误 / 无法预览），而不是误走 WebGL 位图路径。不要在 beta.1 为每种冷门格式写完整播放器，但目录和 dispatcher 分支必须留好。

---

# 4. 总体架构目标

目标架构：

```text
                         ImagePreview / Viewer Shell
                         （工具栏、底片条、文件名、← →、键盘路由）
                                   │
        ┌──────────────────────────┼──────────────────────────┐
        │                          │                          │
   Navigation/UI              Viewer Core                Metadata/UI
 thumbnails                   index / groups             EXIF
 toolbar                      command dispatch           filename
 keyboard                     capabilities query         counters
 grouped images               shared chrome state        loading/error
        │                          │
        └──────────────────────────┼──────────────────────────┘
                                   │
                      Media Dispatcher（按 kind 选模块）
                                   │
     ┌─────────────┬───────────────┼───────────────┬──────────────┐
     │             │               │               │              │
 Raster/WebGL     SVG         Animated         Video         Unknown
  独立文件夹     独立文件夹     独立文件夹       独立文件夹     独立文件夹
     │             │               │               │              │
  渲染+缩放      渲染+缩放       渲染+缩放       渲染+播放      降级 UI
  拖拽+缓存      拖拽(CSS)       播放+transform   缩放能力声明
```

Shell 不知道 WebGL。Raster 模块不知道底片条怎么滚。每种媒体文件夹对外只暴露：加载、绘制、响应命令、capabilities、销毁。

---

# 5. Viewer Core / Shell 的职责

`Viewer Core` 与 Shell 负责**外壳、导航、命令分发**，不负责把像素画出来，也不负责每种媒体如何做缩放。

优先放在 Core / Shell：

```text
当前 media index
分组导航
上一张 / 下一张（命令发出，不画图）
keyboard 路由到当前媒体模块
工具栏 / 底片条 / 文件名 / 计数 UI
controlled / uncontrolled index
presentation mode
container size
向当前模块查询 capabilities **以及 viewState**，据此更新工具栏百分比、enable/disable 按钮
```

不要放在 Core：

```text
WebGL shader / texture
CSS transform 字符串
<video> 播放控制细节
某种格式专有的 decode / upload
```

### 缩放按钮是一份 UI，缩放实现按类型分开

工具栏上的放大 / 缩小 / Fit **始终由 Shell 渲染**。点击后 Shell 只发命令，例如 `zoomIn` / `zoomOut` / `fit` / `pan` / `rotateCW`。

**如何把命令变成画面，写在该媒体自己的文件夹里：**

```text
raster-webgl/   → WebGL 矩阵、zoom stops、pan clamp、anchor zoom
svg/            → CSS/DOM transform
animated/       → 自己的 transform 应用（通常 CSS）
video/          → 自己的规则；不支持则 capabilities.pan = false
```

Raster 作为主产品路径，应保留现有 Fit / native% / 离散档 / zoom anchor 语义，数学可以放在 `core/zoom` 供 raster 使用。SVG / Video **不要假装自己是 JPEG** 去实现完整 native% 档位，除非该模块明确选择复用。

闭环必须是双向的：

```text
Shell  ── command ──→  Media Module
Shell  ←── viewState ──  Media Module
```

`capabilities` = 这个功能能不能做。`viewState` = 当前做到什么程度（是不是 Fit、现在百分之几、还能不能 zoomIn）。**缺 viewState 时，Shell 无法显示 `100%` / `Fit`，也容易把 zoom 状态又拉回 Shell。**

不要让任何模块的 canonical state 依赖 `cssTransform: string`。若模块内部需要 CSS 字符串，只在该 DOM 模块内生成。

---

# 6. Media 模块接口要窄，不要把导航塞进 Renderer

不要设计这种接口：

```ts
interface Renderer {
  next(): void;
  previous(): void;
  preload(): void;
}
```

`next` / `previous` 属于 Shell。也不要做一个「伪抽象」让 SVG 去实现 WebGL preload。

每个媒体文件夹应类似：

```ts
interface MediaCapabilities {
  zoom: boolean;
  pan: boolean;
  rotate: boolean;
  flip: boolean;
  minimap: boolean;
}

/** 给 Shell / Toolbar 用的只读视图；zoom 语义因类型而异。 */
interface MediaViewState {
  zoomMode?: 'fit' | 'native' | 'custom';
  zoomPercent?: number;
  canZoomIn?: boolean;
  canZoomOut?: boolean;
  rotation?: number;
  isPanned?: boolean;
}

interface MediaController {
  execute(command: ViewerCommand): void;
}
```

**不要把 `command?: ViewerCommand` 做成普通 React prop。** 连续三次 `zoomIn` 在 prop 上会撞上相同值、batching、是否已消费、切换媒体时丢命令、StrictMode 双执行等问题。命令传递由实现自选，例如：

- `useImperativeHandle` 暴露 `MediaController.execute`
- 带 monotonically increasing `id` 的 command 对象
- 稳定 dispatcher / ref

示例代码不是硬性 API。原则是：**文件夹边界清晰；Shell 发命令、媒体回 viewState；Shell 不 import 某个 renderer 的内部实现。**

媒体模块状态变化时必须 `onViewStateChange` / `onCapabilities`，否则工具栏无法显示当前百分比或正确 disable 按钮。

---

# 7. WebGL Raster Renderer 设计

## 7.1 以本地 fast-images-viewer 为主要参考

首先阅读：

```text
/Users/zj/projects/assets/fast-images-viewer
```

找出其中已经验证有效的：

- WebGL context 初始化；
- shader / program；
- texture upload；
- resize / DPR；
- matrix transform；
- image switching；
- preload；
- texture caching；
- resource cleanup；
- render invalidation；
- 性能优化。

优先复用其**已经实测有效**的设计，而不是重新从零发明一个未经验证的 WebGL Renderer。

但要将实现整理成 `right-image-preview` 可长期维护的模块边界。**只接 WebGL2**（见 2.5）；参考项目若使用 WebGL2，直接对齐，不要降级出 WebGL1 分支。

---

## 7.2 Frame presentation 必须由 WebGL 控制

新版应**大胆删除** DOM 时代为极限切图性能写的实现，不要翻译、不要兼容保留：

```text
DOM outgoing layer
incoming <img>
1×1 keep alive
crop keepalive
opacity hack
z-index hack
直接操作 DOM 保活 decoded bitmap
双 rAF 等待浏览器 paint
preloadDisplayMode = slot | decode
```

这些在 WebGL 里是伪问题。正确做法：

```text
texture A ready
texture B ready

frame N   → draw A
frame N+1 → draw B
```

如果 B 未 ready：

```text
继续 draw A
或 draw B 的 preview / lower-quality resource
```

直到 B 可展示后再原子切换。

保留的是产品契约：

> 切换时不要长时间黑屏；上一帧可以继续托底，直到 incoming 可展示。

实现方式必须是 WebGL 自己的 frame/resource state machine，不是 DOM 图层机的 GPU 版。

---

## 7.3 重定义 display-ready

当前 DOM 版本的 `display-ready` 很大程度等于：

```text
<img> load
+ decode()
+ retained DOM node
```

新版应把它改造成 renderer-neutral / WebGL 语义，例如：

```text
resource decoded
+ GPU texture uploaded
+ required metadata ready
+ next render can draw it immediately
```

不要再把 public/internal state 与 `HTMLImageElement` 生命周期绑定。Raster 的输入是 `MediaSource`（url / blob / bytes），不是「必须能塞进 `<img src>` 的字符串」。

---

## 7.4 Progressive loading

保留当前优秀的用户体验契约：

```text
冷切图时不长时间空白
有 minimapSrc / thumbnail 时先展示 preview
full image 和 preview 并行准备
full-res ready 后无明显闪烁地替换
```

但实现改为 WebGL-friendly：

```text
preview texture
       ↓
先显示
       ↓
full texture ready
       ↓
同一 viewport / transform 下替换
```

如果 `fast-images-viewer` 已有更合理的 progressive strategy，以实测表现为准。

---

# 8. Texture Cache 与内存管理

这是纯 WebGL 路线必须认真实现的部分。

不要简单把：

```text
current
prev
next
±2
```

全部永久保存成 full-resolution RGBA texture。

例如 60MP RGBA8 理论上约：

```text
60,000,000 × 4 bytes ≈ 240 MB
```

多张完整 texture 会迅速吃掉大量 GPU memory。

新版至少需要：

```text
显式 texture lifecycle
LRU / priority eviction
当前图最高优先级
prev / next 高优先级
其他邻居低优先级
离开窗口后可释放
context destroy 时完整清理
```

建议建立清晰的：

```text
TextureCache / ResourceCache
```

每个资源至少记录：

```text
id / src
width
height
estimatedBytes
lastUsedAt
priority
ready state
texture handle
```

不要依赖浏览器“可能会替我们释放”。

---

# 9. MAX_TEXTURE_SIZE 与超大图

启动 WebGL 后必须查询：

```ts
gl.getParameter(gl.MAX_TEXTURE_SIZE)
```

不要假设所有设备都可以安全上传 16K / 32K 单纹理。

对于超过限制的图片，不能让程序崩溃或只显示黑屏。

## v0.4.0-beta.1 最低要求

至少：

1. 检测是否超过 texture limit；
2. 给出明确的内部状态与错误处理；
3. 架构上不要锁死成“一张图片一定等于一张 texture”；
4. 为 tiled renderer 留出清晰接口。

## 推荐在 v0.4.x 完成

实现真正的：

```text
Tile Renderer
```

例如 512 / 1024 tile，按 viewport 只绘制相关区域。

长期目标：

```text
LOD Pyramid
+ Tiles
+ Viewport priority loading
```

但不要为了 v0.4.0-beta.1 一次性重写所有未来能力而导致核心迁移无法完成。

优先完成稳定 WebGL 主路径，再分阶段增强。

---

# 10. LOD 是长期主线，但不要过度阻塞 beta.1

未来的大图 Viewer 不应默认要求 Fit 模式先准备完整 40MP/60MP/100MP 原图。

目标架构应支持：

```text
thumbnail / low resolution
        ↓
Fit-visible resolution
        ↓
100% / high resolution
        ↓
viewport tiles
```

即：

```text
用户当前看不到的像素，不必立即付出完整 decode/upload 成本。
```

本次重构的接口设计应避免阻碍以后加入：

```text
RasterSource.getLevel(...)
RasterSource.getTile(...)
```

但 beta.1 不要求一次完成完整图像金字塔系统。

---

# 11. WebGL Context Loss

WebGL 是正式主渲染器后，必须处理：

```text
webglcontextlost
webglcontextrestored
```

恢复流程至少包含：

```text
停止 draw / upload
标记 renderer unavailable / restoring
重新创建 program / buffer / texture resources
优先恢复 current image
重新恢复邻居 cache（可延后）
重新 draw current image
```

Context restore 不应要求用户重新打开整个 Viewer。

如果当前运行环境 **WebGL2** context 创建彻底失败，显示明确错误状态（或极薄 emergency `<img>`）。

**不要因此保留一套功能完整 DOM Raster Viewer，也不要再写一套 WebGL1 Raster Renderer。**

如果提供 emergency `<img>` fallback，它：

- 不要求功能等价；
- 不参与正常开发路径；
- 不实现完整 zoom/preload/compare；
- 不能成为第二套 Raster architecture。

v0.4 目标宿主可以要求 WebGL2，这是明确产品取舍，不是待定事项。

---

# 12. Color Management

这是照片 Viewer 的正确性要求。

至少明确：

- 当前 WebGL decode/upload 的 source color behavior；
- drawing buffer color space；
- sRGB 图片的正确显示；
- macOS / P3 显示器下是否出现明显偏色；
- browser/WebView 对 ICC / Display P3 的实际能力边界。

v0.4.0-beta.1 不要求实现完整 Lightroom 级 ICC pipeline，但：

**不得因为切 WebGL 导致普通 sRGB 图片出现明显颜色错误。**

请增加最基本的色彩回归测试说明 / 手工测试样例。

---

# 13. 现有 right-image-preview 功能迁移要求

## P0：beta.1 必须保持

优先保证当前最核心能力在 WebGL Raster Viewer 中可用：

```text
单图显示
images 列表
 groupedImages
上一张 / 下一张
组切换
contained / overlay
Fit
native zoom / zoom stops
mouse wheel zoom
zoom anchor
pan
rotate CW / CCW
flip H / V
reset
keyboard
thumbnail strip
minimap
filename / counter
EXIF panel
progressive minimapSrc / preview
preload current neighbors
稳定连续切图
loading / error
controlled index / callbacks
```

具体以当前 README、API docs、tests 和 requirements 为准。

---

## 不要机械保留 DOM-specific 行为

以下机制是 DOM compositor 极限优化，**直接删除**，不要改写成 WebGL 等价物，也不要留 feature flag：

```text
retained HTMLImageElement slot
1×1 opaque keepalive
crop keepalive
DOM z-index outgoing layer hack
opacity workaround
为避免浏览器回收 bitmap 的 DOM trick
重复 Image() probe 仅为了 DOM layout
直接操作 DOM 的切图保活代码
preloadDisplayMode = 'slot' | 'decode'
```

迁移目标是保持**用户可见行为**（不黑屏、渐进预览、邻居预热），不是保持旧实现细节。0.3.12 的代码以 Git tag 存档。

---

# 14. 新媒体分发层与来源抽象

统一媒体判定，例如：

```ts
type MediaKind =
  | 'raster'
  | 'svg'
  | 'animated-image'
  | 'video'
  | 'unknown';
```

判定优先顺序：

```text
1. 宿主显式 item.kind（最高优先级）
2. 对需要区分 animation 的格式做轻量文件头 / metadata sniff
   （WebP 静态 vs animated、PNG vs APNG；MIME 都可能是 image/webp 或 image/png）
3. MIME / format family
4. extension
5. unknown
```

**MIME 和 extension 只能确定 format family，不能总能确定 media kind。** `normal.webp` 与 `animated.webp` 经常同为 `image/webp` + `.webp`；PNG/APNG 同理。不要只靠后缀把 animated WebP 送进 WebGL raster。宿主若已知道是动画，应显式传 `kind: 'animated-image'`。

`ImageItem.src` 继续表示「可加载 URL」。同时引入 `MediaSource`（见 2.4），让 fetch / `createImageBitmap` / `<img>` / `<video>` 都从同一句柄出发。组件不感知文件是磁盘还是网络。大文件优先 URL/Blob，见 2.4 生命周期要求。

请兼容当前 `ImageItem` API 的演进，不要突然强迫所有旧用户重写数据模型，除非确实必要。

如果有 breaking API：

- 明确列出；
- 给 migration 示例；
- 在 CHANGELOG / docs 中说明。

---

# 15. Public API 策略

原则：

> 底层架构可以彻底变化，但不因为内部改 WebGL 就无意义地破坏上层 API。

尽量保留：

```text
ImagePreview
ImageItem
ImageGroup
index / onIndexChange
zoom-related props
presentationMode
showThumbnails
showMinimap
showExif
keyboard behavior
```

但如果某些 API 明显暴露 DOM-specific 语义，应改造。

例如：

```text
preloadDisplayMode = 'slot' | 'decode'
```

这类如果本质描述的是 DOM `<img>` 保活实现，就不应该为了兼容内部架构永远保留。

可考虑：

1. deprecated compatibility layer；
2. v0.4 beta 直接替换成 renderer-neutral preload policy；
3. 文档给出迁移说明。

请先分析现有 API，再决定，不要盲目删除。

---

# 16. 包体积与代码重复

本次重构的目标之一就是避免：

```text
DOM Raster Viewer
+
WebGL Raster Viewer
```

同时进入用户 bundle。

因此：

- 删除不再使用的 DOM raster engine；
- 不保留隐藏的 legacy renderer；
- SVG / Animated / Video Viewer 保持专用、轻量；
- 公共 Viewer Core 不重复；
- WebGL shader / renderer 模块边界清晰；
- 检查 tree-shaking；
- 更新 size-limit 到一个经过解释的新预算，不必死守旧 32kB，但禁止无意识膨胀。

最终请报告：

```text
旧版 bundle size
新版 bundle size
增长来源
是否存在重复 renderer code
```

---

# 17. 版本与 Git 策略

**动手改代码之前，先固化当前 DOM 世代。**

```text
v0.3.12
= 当前 DOM renderer generation 的最后稳定版本
= 先打 Git tag（若仓库里还没有）
```

新版：

```text
v0.4.0-beta.1
= WebGL-first raster + 按媒体类型分模块 generation
= package.json 改为 0.4.0-beta.1 后在此基础上开发
```

### 打 tag 的要求

1. 先核对 `package.json` 当前是 `0.3.12`，以及要标记的 commit；
2. 若 `v0.3.12` tag **不存在**，在**当前未开始 WebGL 大改的 commit** 上创建 annotated tag `v0.3.12`；
3. 若 tag **已存在**，不要覆盖、不要把错误 commit 标成该 tag；
4. **不要** `git push --tags`、不要创建 GitHub Release、不要 npm publish，除非用户另外明确要求。

### 旧代码怎么留

用 tag 保存历史即可。

**不要为了“存档”长期创建：**

```text
legacy
old
v0.3-old
dom-version
```

这样的分支。

只有未来真的需要继续给 0.3.x 修 bug 并发布 `0.3.13` / `0.3.14`，才从 `v0.3.12` 创建 maintenance branch，例如 `legacy/0.3`。

### 新代码

```text
main = 产品未来
```

WebGL 新架构最终进入 `main`。大改期间可以使用临时 feature branch `feat/webgl-renderer`，稳定后合并 main，再删除 feature branch。

## 发布限制

本任务可以：

- 确认 / 创建 `v0.3.12` tag（仅本地，除非用户要求推送）；
- 更新 package version 到 `0.4.0-beta.1`；
- 更新 CHANGELOG / docs；
- 准备 release-ready 状态。

**不要自动 npm publish、push tag 或创建 GitHub Release，除非用户另外明确要求。**

---

# 18. 建议目录结构

不要为了满足这个示例强行重排全部代码，但长期结构应接近。**每种媒体必须有自己的文件夹**，里面同时包含渲染与该类型对 zoom/pan 的响应，不能把 SVG/GIF/Video 的实现塞进 raster-webgl：

```text
src/components/ImagePreview/
│
├── core/
│   ├── navigation
│   ├── commands          # zoomIn 等命令类型，不含画图
│   ├── zoom              # raster 可复用的档位数学；非强制用于 video
│   ├── media-source      # MediaSource 归一化（url / blob / bytes）
│   ├── media-kind        # 判定 raster | svg | animated | video | unknown
│   └── capabilities
│
├── renderers/
│   ├── raster-webgl/     # JPG/PNG/WebP/AVIF/BMP…
│   │   ├── WebGLRasterViewer.tsx
│   │   ├── WebGLRenderer.ts
│   │   ├── shaders.ts
│   │   ├── TextureCache.ts
│   │   ├── RasterResource.ts
│   │   ├── preload.ts
│   │   ├── zoomPan.ts    # 该类型如何响应缩放/拖拽
│   │   └── webglContext.ts
│   │
│   ├── svg/
│   │   ├── SvgViewer.tsx
│   │   └── zoomPan.ts    # CSS/DOM，不是 WebGL
│   │
│   ├── animated/         # GIF / APNG / animated WebP
│   │   ├── AnimatedImageViewer.tsx
│   │   └── zoomPan.ts
│   │
│   ├── video/
│   │   ├── VideoViewer.tsx
│   │   ├── playback.ts
│   │   └── zoomPan.ts    # 可声明不支持 pan
│   │
│   └── unknown/
│       └── UnknownMediaViewer.tsx
│
├── ui/                   # 与媒体类型无关的外壳
│   ├── Toolbar
│   ├── Minimap
│   ├── ThumbnailsStrip
│   ├── ExifInfoPanel
│   └── ...
│
└── types.ts
```

重点是**职责边界**：Shell 一份 UI；每种媒体一个文件夹，自管渲染与交互响应。

---

# 19. 测试要求

## 19.1 保留现有 unit tests

先跑完整测试，记录 baseline。

重构后：

```text
旧测试能保留的尽量保留
DOM-specific 测试改成 renderer-neutral / WebGL behavior test
不要为了让 CI 绿而直接删除大量测试
```

---

## 19.2 WebGL 测试

至少测试：

```text
context init
program/shader init
texture upload lifecycle
resource release
resize / DPR
transform matrix
Fit
100%
zoom anchor
rotation
flip
current image switch
preloaded switch
cache eviction
context lost / restored
MAX_TEXTURE_SIZE guard
error handling
```

必要时对 WebGL 做 adapter/mock，避免 jsdom 不支持真实 GPU 导致测试无法运行；但关键数学、状态机和缓存策略必须可单测。

---

## 19.3 手工性能测试集

请从本地现有测试素材中选取：

```text
普通 1080p / 4K 图片
20MP 左右图片
40–60MP 相机照片
不同宽高比
PNG / JPEG / WebP / AVIF
带透明 PNG
大尺寸图片
SVG
GIF
视频
```

重点验证：

```text
首次打开
停留后切下一张
连续快速 ← →
按住切图
返回上一张
100% zoom
200% zoom
pan
rotate
窗口 resize
minimap
长时间浏览后的内存
```

---

# 20. 性能验收

不要只看“代码改成 WebGL 了”。

必须与当前 DOM v0.3.12 和 `/Users/zj/projects/assets/fast-images-viewer` 做实际对比。

至少记录：

```text
冷开大图时间
预加载后 next/prev 切换体感
连续切 20–50 张稳定性
是否出现黑帧
是否出现先缩小/闪一下/旧图错位
GPU/内存变化
texture cache 命中
resize/zoom 是否掉帧
```

目标不是追求一个虚假的单一 benchmark，而是确保：

> 新 WebGL 版至少达到 fast-images-viewer 已经验证过的核心流畅度，并明显优于当前 DOM 大图路径。

如果迁移后反而变慢，不要为了架构漂亮接受性能回退，要定位原因。

---

# 21. v0.4.0-beta.1 的明确 Scope

## 必须完成

```text
[ ] 本地确认 / 创建 v0.3.12 tag（不 push，除非用户要求）
[ ] package version → 0.4.0-beta.1
[ ] MediaSource 抽象（url / blob 优先，bytes 补充；及时 revoke/close）
[ ] Static Raster 正式切 **WebGL2**
[ ] 删除 DOM raster 性能 hack（keep-alive / outgoing layer / slot decode…）
[ ] Viewer Shell 与媒体模块解耦（同一套工具栏 / 底片条 / 文件名 / ←→）
[ ] command dispatch 可靠（imperative handle / sequence id，禁止裸 command prop）
[ ] MediaViewState → Shell 更新工具栏百分比与按钮
[ ] raster / svg / animated / unknown 独立文件夹 + 可用实现
[ ] video/ 目录与 dispatcher 分支（完整播放器可延后）
[ ] WebP/APNG 动画判定不只靠 MIME/extension
[ ] 复用 fast-images-viewer 中已经验证的 WebGL2 关键实现
[ ] current image render
[ ] previous/next switching
[ ] progressive preview
[ ] neighbor preload（texture cache 语义，不是 DOM slot）
[ ] texture cache + basic eviction
[ ] context lost / restore
[ ] MAX_TEXTURE_SIZE detection
[ ] 当前核心 API/交互迁移
[ ] tests
[ ] docs
[ ] changelog
```

## 可以延后到后续 0.4.x

```text
[ ] 完整 tiled renderer
[ ] 完整 LOD pyramid
[ ] native backend tile decoder
[ ] advanced ICC pipeline
[ ] Compare / Diff
[ ] Heatmap
[ ] Pixel Inspector
[ ] Loupe
[ ] animated image frame control
[ ] 完整 VideoViewer（播放、seeking、timeline）
[ ] video GPU processing
```

但 v0.4 beta 的架构不能阻碍这些后续能力。

---

# 22. 迁移阶段建议

请分阶段执行，不要一次把整个 Viewer 推倒后长时间不可运行。

## Phase 0：固化 0.3.12

```text
核对当前 commit / package.json
若不存在 v0.3.12 tag：在大改前的 commit 上创建 annotated tag
不 push tag、不 GitHub Release、不 npm publish
然后将工作区 version 改为 0.4.0-beta.1
```

## Phase 1：勘察与边界

```text
阅读两个项目
列出将要删除的 DOM hack（不要列入“迁移”）
确认 public API 与 MediaSource 抽象
确认 tests
确认 fast-images-viewer 可复用模块（仅 GPU 管线，不搬其 zoom 模型）
输出迁移计划
```

## Phase 2：抽 Shell / Core

```text
抽出导航、工具栏、底片条、命令分发
不要把 cssTransform 当作 Core 状态
不要为即将删除的 DOM raster 再写一套完整 adapter
```

## Phase 3：接入 WebGL Raster 模块（独立文件夹）

```text
集成 fast-images-viewer 核心 GPU 实现
MediaSource → decode → texture
完成 texture lifecycle
实现 raster current image
该文件夹内实现 zoom/pan/rotate/flip
迁移切图（画上一张直到下一张 ready）
迁移 progressive / preload/cache
```

## Phase 4：删除完整 DOM Raster Engine

WebGL Raster 达到 P0 parity 后**立刻删除**：

```text
旧 DOM raster display pipeline
1×1 keepalive 等 DOM hacks
slot/decode DOM abstraction
所有直接操作 DOM 保活 bitmap 的代码
```

不要把它留在 main 里“以后可能用到”。Git tag `v0.3.12` 已经保存历史。

## Phase 5：其他媒体独立文件夹

```text
svg/  + 自己的 zoom/pan；默认 <img>，不 inline SVG
animated/ + 自己的播放与 transform；WebP/APNG 要 sniff
video/ 目录 + dispatcher；完整播放器延后
unknown/ 降级
Media Dispatcher
command ↔ viewState 闭环
同一套 Shell UI 切类型时不变
```

## Phase 6：稳定性 / 文档 / beta

```text
完整 tests
性能回归
内存检查
context recovery
README / API / architecture docs（含宿主如何提供 MediaSource）
CHANGELOG
0.4.0-beta.1
```

---

# 23. 文档要求

请同步更新：

```text
README.md
README.zh-CN.md
docs/api.md
docs/api.zh-CN.md
相关 requirements / architecture docs
CHANGELOG.md
```

新增一份架构文档，例如：

```text
docs/rendering-architecture.md
docs/rendering-architecture.zh-CN.md
```

说明：

```text
为什么 raster 改成 WebGL2-only
为什么 DOM 切图 hack 可以删除
为什么 SVG/GIF/Video 不强行走 WebGL
Viewer Shell 与各媒体文件夹的边界（command ↔ viewState）
MediaSource：浏览器 / VS Code Webview / Tauri 宿主如何对接
WebGL texture cache
progressive/preload 状态
MAX_TEXTURE_SIZE
context loss
未来 LOD/tile 扩展点
0.3.x → 0.4.x migration
```

---

# 24. 兼容性原则

1. 不为了内部 WebGL 重构无意义破坏 public API；
2. 允许真正必要的 breaking change，因为这是 `0.4.0-beta.1`；
3. breaking change 必须有 migration note；
4. 不保留一整套 legacy DOM Raster Viewer 只为了兼容；DOM 性能 hack 直接删除；
5. 特殊媒体格式通过各自文件夹解决，Shell UI 保持同一套；
6. 导航（上一张/下一张、底片条、文件名）只维护一份；zoom/pan 的**像素响应**按媒体类型分开；Shell 必须订阅 viewState，不能只有 capabilities；
7. 组件不调用 vscode / tauri / fs；宿主把资源变成 MediaSource；大文件优先 URL/Blob；
8. Raster 只走 WebGL2，不为 WebGL1 开第二套 GPU 路径；
9. renderer-specific 技术细节不能污染 Viewer Shell。

---

# 25. 代码质量要求

- TypeScript strict-safe；
- 不滥用 `any`；
- WebGL resource 必须有明确 dispose；
- React component unmount 时不得泄漏 texture/context listener/timer；
- resize observer / pointer listener 正确 cleanup；
- shader source 独立管理；
- cache policy 有单测；
- transform math 尽量纯函数；
- 不在 React render 中进行昂贵 texture upload；
- 避免不必要 continuous render loop；没有变化时应尽量 idle；
- 不为了追求抽象而制造多层无意义 interface；
- 优先保持现有项目风格和可读性。

---

# 26. 最终交付报告

完成后不要只说“已完成”。请给出结构化报告：

## A. 架构变化

```text
删除了什么（含 DOM hack 清单）
新增了什么
MediaSource 如何对接 web / vscode / tauri
哪些逻辑在 Shell
哪些在 raster-webgl / svg / animated / video / unknown 文件夹
```

## B. Public API

```text
保持兼容的 API
deprecated API
breaking changes
迁移示例
```

## C. 性能

```text
与 v0.3.12 对比
与 fast-images-viewer 对比
大图冷开
预加载后切换
连续切图
内存 / texture cache
```

## D. 测试

```text
unit tests
integration tests
manual cases
未覆盖项
```

## E. 风险 / 后续

```text
MAX_TEXTURE_SIZE
Tile renderer
LOD
Color management
Compare/Diff
Pixel Inspector
```

## F. 发布状态

确认代码已准备为：

```text
0.4.0-beta.1
```

但未经用户明确要求，不执行 npm publish、不 `git push --tags`、不创建 GitHub Release。`v0.3.12` 本地 tag 应在 Phase 0 已打好。

---

# 27. 本次改造的最终原则

请始终用下面几句话判断设计是否跑偏：

> **1. 静态位图只有 WebGL2 一条正式主渲染路径。不要再维护 WebGL1 分支。**
>
> **2. 为 DOM 极限切图写的 keep-alive / outgoing layer / 直接操作 DOM 的代码大胆删除；WebGL 用 texture 切换解决同一产品契约。**
>
> **3. 这是多宿主 React 组件。浏览器、VS Code Webview、Tauri 都能用；组件不访问磁盘/扩展 API，只消费宿主给的 MediaSource。大文件优先 URL/Blob。**
>
> **4. 工具栏、底片条、文件名、上一张/下一张是一份 Shell。切到 SVG/GIF/Video 时 UI 还在。**
>
> **5. 每种媒体一个文件夹：自己渲染，自己响应缩放/拖拽（或声明不支持）。Shell 发 command，媒体回 viewState。不要用裸 `command` prop。**
>
> **6. 不因为 SVG、GIF、Video 而保留第二套完整 DOM Raster Viewer。**
>
> **7. 保留旧版的是 Git tag `v0.3.12`，不是 main 里的 legacy code。先打 tag，再以 `0.4.0-beta.1` 开发。**
>
> **8. main 代表未来；v0.3.12 固化 DOM generation，v0.4.0-beta.1 开始 WebGL-first generation。**
>
> **9. 优先复用 `/Users/zj/projects/assets/fast-images-viewer` 已经实测成功的 WebGL 方案，不要搬它的 zoom 产品模型。**
>
> **10. MIME/extension 不能区分静态 WebP 与 animated WebP（APNG 同理）；宿主 kind 优先，必要时 sniff。SVG 默认 `<img>`，不 inline。**
>
> **11. 新架构必须为 LOD / Tile / Compare / Diff / Pixel Inspector / Video 留出空间，但 beta.1 不要被全部未来需求拖死。完整 VideoViewer 可放到 0.4.x。**
>
> **12. 最终判断标准不是“代码更抽象”，而是：大图更快、切图更稳、内存可控、多宿主可对接、维护成本更低。**

请按上述目标完成重构。
