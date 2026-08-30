/**
 * Strings for the Vite demo page only (titles, descriptions, ref buttons, etc.).
 * This file is not part of the published library bundle.
 *
 * ImagePreview component UI (toolbar, aria-labels, …) lives in
 * `src/components/ImagePreview/locale.ts` and is controlled via the `language` prop.
 */

export type DemoLocale = 'en' | 'zh';

export const DEMO_LANG_STORAGE_KEY = 'right-image-preview-demo-lang';

/** Public site + repo (GitHub Pages, npm). */
export const DEMO_REPO_URL = 'https://github.com/ZhangJian1713/right-image-preview';

export function readInitialLocale(): DemoLocale {
  try {
    const v = localStorage.getItem(DEMO_LANG_STORAGE_KEY);
    if (v === 'en' || v === 'zh') return v;
  } catch {
    /* ignore */
  }
  return 'en';
}

export interface DemoFeature {
  readonly title: string;
  readonly body: string;
}

export interface DemoStrings {
  title: string;
  heroTagline: string;
  heroLead: string;
  heroCtaTry: string;
  heroCtaGitHub: string;
  heroCtaScroll: string;
  featuresTitle: string;
  features: readonly DemoFeature[];
  screenshotsTitle: string;
  screenshotsLead: string;
  screenshotToolbarAlt: string;
  screenshotToolbarCaption: string;
  screenshotToolbarFlatAlt: string;
  screenshotToolbarFlatCaption: string;
  screenshotMinimapAlt: string;
  screenshotMinimapCaption: string;
  opsTitle: string;
  opsRows: [string, string][];
  usageTitle: string;
  usageLead: string;
  usageNpm: string;
  usageDocHint: string;
  liveDemoTitle: string;
  liveDemoSubtitle: string;
  thumbClickHint: string;
  langLabel: string;
  langSwitchHint: string;
  demo0Title: string;
  demo0Desc: string;
  demo0Button: string;
  demo1Title: string;
  demo1Desc: string;
  demo2Title: string;
  demo2Desc: string;
  demo3Title: string;
  demo3Desc: string;
  demo4Title: string;
  demo4Desc: string;
  demo5Title: string;
  demo5Desc: string;
  demo5SidebarTitle: string;
  demo5ShowPreview: string;
  demo5HidePreview: string;
  demo5EmptyWorkspace: string;
  demo5PreloadHint: string;
  demo6Title: string;
  demo6Desc: string;
  demo6SourceRemote: string;
  demo6SourceLocal: string;
  demo6SidebarTitle: string;
  demo6HowTo: string;
  demo6HowToShort: string;
  demo6Missing: string;
  demo6GridHint: string;
  demo6SlotsToggle: string;
  demo6MeterTitle: string;
  demo6MeterIdle: string;
  demo6MeterHint: string;
  demo6HistoryTitle: string;
  demo6PoolTitle: string;
  demo6PoolModeOn: string;
  demo6PoolModeOff: string;
  demo6PoolNow: string;
  demo6PoolIfOff: string;
  demo6PoolCurrent: string;
  demo6PoolNeighbors: string;
  demo6PoolExtra: string;
  demo6PoolCap: string;
  demo6PoolHint: string;
  demo6PoolHintShort: string;
  photosBadge: (n: number) => string;
  thumbAria: (label: string) => string;
}

export const STRINGS: Record<DemoLocale, DemoStrings> = {
  en: {
    title: 'right-image-preview',
    heroTagline: 'Big full-screen photos for the web — zoom, browse, easy keys.',
    heroLead:
      'Photos open over the page. Zoom with the wheel or a double-click. Drag to move when zoomed. Step through many photos or jump between folders. A small corner map when the picture is huge. Lots of keyboard shortcuts. You only need React — no extra UI kits.',
    heroCtaTry: 'Open sample image',
    heroCtaGitHub: 'GitHub',
    heroCtaScroll: 'More to try below',
    featuresTitle: 'What it does',
    features: [
      {
        title: 'Full-screen photos',
        body: 'Pictures fill the screen with a simple bar at the bottom — like a phone or computer photo app.',
      },
      {
        title: 'Zoom and drag',
        body: 'Show the whole picture on screen, or real size. Zoom in steps with the mouse wheel. Double-click to zoom; double-click again to go back. Drag the photo when it is zoomed in.',
      },
      {
        title: 'Browse photos',
        body: 'Use the bar or side arrows. You can also split photos into folders and jump from one folder to the next.',
      },
      {
        title: 'Little corner map',
        body: 'When the photo is larger than the screen, a small map shows where you are. Drag the box on the map to move around.',
      },
      {
        title: 'Keys on the keyboard',
        body: 'Esc, arrows, space, page up/down, + and −, ⌘/Ctrl or Shift + arrows to pan, and more. See the short list below.',
      },
      {
        title: 'Small download',
        body: 'Written for TypeScript. The package is small. You do not need other UI libraries.',
      },
    ],
    screenshotsTitle: 'In the viewer',
    screenshotsLead:
      'Bottom toolbar: flat list vs grouped albums, zoom and transforms; corner minimap when the picture is bigger than the screen.',
    screenshotToolbarAlt:
      'Grouped album: toolbar with folder jump, prev/next, counters, filename badge, flip, rotate, fit, 1:1, zoom and lock',
    screenshotToolbarCaption:
      'Grouped album: step through images, jump folders, see the filename, flip, rotate, fit / 1:1, and zoom.',
    screenshotToolbarFlatAlt:
      'Image viewer toolbar on a flat list: filename badge, image counter, rotate, fit, 1:1, zoom level and lock',
    screenshotToolbarFlatCaption:
      'Flat gallery (no folders): filename badge, prev/next with count, rotate, fit / 1:1, zoom, and lock.',
    screenshotMinimapAlt: 'Corner minimap with a white viewport rectangle over a zoomed-in photo',
    screenshotMinimapCaption:
      'Minimap: overview of the whole image with a frame you can drag to pan when zoomed in.',
    opsTitle: 'How to use it',
    opsRows: [
      ['Click a small picture', 'Opens that photo full screen'],
      ['Esc', 'Closes the viewer'],
      ['← / →', 'Previous photo / next photo'],
      ['⌘ / Ctrl + Arrow', 'Pan when zoomed in (⌘ on Mac, Ctrl on Windows/Linux). Two arrows = diagonal.'],
      ['Shift + Arrow', 'Also pans by default. With `shiftArrowAction="rotate"`, Left/Right rotate 90°; Up/Down still zoom.'],
      ['Mouse wheel', 'Zoom in or out (if wheel zoom is on)'],
      ['Double-click', 'Zoom in; double-click again to undo (if on)'],
      ['Drag', 'Move the photo when you are zoomed in'],
      ['Click the dark area', 'Closes (if click-outside-to-close is on)'],
    ],
    usageTitle: 'Install',
    usageLead: 'In your React project, run:',
    usageNpm: 'npm install right-image-preview',
    usageDocHint: 'All options, the key list, and developer notes are in the README and docs folder on GitHub.',
    liveDemoTitle: 'Try it',
    liveDemoSubtitle:
      'Demo 0 (trigger) first, then the galleries. Click to open the viewer; use zoom, minimap, and keyboard.',
    thumbClickHint: 'Click to open',
    langLabel: 'Language',
    langSwitchHint: 'This page’s language. The viewer uses the same one.',
    demo0Title: 'Demo 0 · Trigger — uncontrolled',
    demo0Desc:
      'Put a single child on `ImagePreview` (e.g. `<img>` or `<button>`). Set `src` / `images` on the component only — the library does not read the trigger. Omit `visible` and `onClose` to use internal open/close state.',
    demo0Button: 'Open preview',
    demo1Title: 'Demo 1 · One set of photos',
    demo1Desc:
      'Five photos: wide ones, tall ones, mixed sizes. The counter shows where you are (like 2 of 5). A thumbnail strip at the bottom lets you jump across the full flat sequence (`showThumbnails`). No folders in this demo.',
    demo2Title: 'Demo 2 · Photos in folders',
    demo2Desc:
      'Ten photos in three folders, like a trip album. The bottom thumbnail strip lists **only the current folder** (default `thumbnailsScope="group"`) — when you jump to another folder (double-chevron or PageUp/Down), the strip swaps to that group’s images. For a cross-folder strip use `thumbnailsScope="flat"` (see Demo 5). The badge’s second line starts with which folder you are in (e.g. (1/3)), then the folder name. The counter between the arrows is only your place inside that folder (e.g. 2/3).',
    demo3Title: 'Demo 3 · Thumbnail first, full image after',
    demo3Desc:
      'Each item uses a small low-res preview (`minimapSrc`) so you see a stretched image right away instead of a long empty wait. When the full file is ready, it replaces the preview. Approximate file size is in each label. Large files come from Wikimedia Commons (`fetch` needs CORS; the overlay stays blank if the host omits `Access-Control-Allow-Origin`). v0.4 uses adaptive neighbor texture preload by default; Demo 5 pins `preloadRadius={1}` for a bounded example.',
    demo4Title: 'Demo 4 · EXIF + delete (host-owned list)',
    demo4Desc:
      'Toolbar “i” toggles EXIF; the trash button (or Delete / Backspace) removes the current image. Metadata is on `ImageItem.exif`. Deleting calls `onDeleteImage(index, item)` — this demo filters by `item.id`, so the count drops and focus moves to the next (or previous) photo. Empty fields are hidden; the third photo starts with no EXIF.',
    demo5Title: 'Demo 5 · Contained workspace + flat strip + preload',
    demo5Desc:
      'Embedded preview (`presentation="contained"`) fills the centre pane while a fake sidebar stays usable. Uses controlled `index`, `showThumbnails` + `thumbnailsScope="flat"`, `preloadRadius={1}`, `showThumbnailPreloadStatus`, and `chrome="minimal"`. **Blue** = decoded texture still GPU-resident; **green** = real original-download progress or a completed original request. Click the preview to focus it before using arrow keys.',
    demo5SidebarTitle: 'Sidebar',
    demo5ShowPreview: 'Show preview',
    demo5HidePreview: 'Hide preview',
    demo5EmptyWorkspace: 'Preview hidden — sidebar still works.',
    demo5PreloadHint: 'Neighbor preload indexes',
    demo6Title: 'Demo 6 · Preload lab (remote or local)',
    demo6Desc:
      'Default: Wikimedia Commons JPEGs (~1280–1920px, CORS-enabled) so GitHub Pages visitors can measure neighbor preload over the network. Switch to **Local** in `npm run dev` to use every JPG/PNG/WebP under gitignored `./test-images` (nested folders OK). Green bar = original transfer; **blue** = GPU-resident texture. Toggle preload off to force cold navigations.',
    demo6SourceRemote: 'Remote (Wikimedia)',
    demo6SourceLocal: 'Local folder',
    demo6SidebarTitle: 'Local large files',
    demo6HowTo:
      'Wait for blue on a ± neighbor, then ←/→. Full green means downloaded/cache-likely, but may still need decode/upload.',
    demo6HowToShort: 'Wait for blue on ±, then ←/→ · hover for detail',
    demo6Missing:
      'Local set is empty. In `npm run dev`, put JPG/PNG/WebP files under `./test-images` (nested folders OK; do not commit that folder) and refresh.',
    demo6GridHint: 'Click a card to open that index · scroll for more',
    demo6SlotsToggle: 'Neighbor preload (display-ready)',
    demo6MeterTitle: 'Last navigation',
    demo6MeterIdle: 'Switch images to measure…',
    demo6MeterHint:
      'fast + sharp≪200ms = retained layer. cold ≈1s = full decode. Wait for next=display-ready before ←/→.',
    demo6HistoryTitle: 'Recent',
    demo6PoolTitle: 'GPU textures',
    demo6PoolModeOn: 'Preload ON',
    demo6PoolModeOff: 'Preload OFF',
    demo6PoolNow: 'Now',
    demo6PoolIfOff: 'If OFF',
    demo6PoolCurrent: 'current',
    demo6PoolNeighbors: 'neighbors',
    demo6PoolExtra: 'Extra (preload cost)',
    demo6PoolCap: 'Auto cache budget',
    demo6PoolHint:
      'Resident WebGL texture bytes reported by the cache. The total is bounded by the automatic display tier (4K: 512 MiB); a host may override preloadMemoryBudgetBytes.',
    demo6PoolHintShort: 'hover: how to read',
    photosBadge: (n) => `${n} photos`,
    thumbAria: (label) => `Open photo: ${label}`,
  },
  zh: {
    title: 'right-image-preview',
    heroTagline: '轻量、功能齐全的全屏网页图片查看器。',
    heroLead:
      '全屏对话框、固定档位缩放、拖动平移、滚轮与双击缩放、多图与分组相册、角落小地图与完整快捷键支持 — 除 React 外无运行时依赖。',
    heroCtaTry: '打开示例图',
    heroCtaGitHub: 'GitHub',
    heroCtaScroll: '更多演示在下方',
    featuresTitle: '核心能力',
    features: [
      {
        title: '沉浸式全屏查看',
        body: '带焦点陷阱与完整工具栏的模态对话框，更接近桌面看图体验，而非简陋 lightbox。',
      },
      {
        title: '顺手的缩放与平移',
        body: '适应视口 / 原始比例（100%）、档位缩放、滚轮缩放、双击放大与还原（可开）、放大后可拖动平移。',
      },
      {
        title: '相册与分组导航',
        body: '工具栏或两侧箭头切换图片；可选分组（文件夹）并在组间跳转。',
      },
      {
        title: '内置导航小地图',
        body: '大图溢出时在角落显示缩略导航，可拖动取景框快速平移。',
      },
      {
        title: '键盘友好',
        body: 'Esc、方向键、空格、翻页、± 缩放、⌘/Ctrl 或 Shift 加方向键平移等 — 详见下方操作说明。',
      },
      {
        title: '体积小、易集成',
        body: 'TypeScript 优先，ESM/CJS 双构建，无需额外 UI 框架。',
      },
    ],
    screenshotsTitle: '界面一瞥',
    screenshotsLead: '底部工具栏：单组列表与分组相册两种布局，以及缩放与变换；放大后可用角落小地图拖动取景。',
    screenshotToolbarAlt: '分组相册：底部工具栏含组间跳转、翻页与计数、文件名、翻转、旋转、适应视口、1:1、缩放与锁定',
    screenshotToolbarCaption: '分组相册：组间跳转与组内翻页、文件名、翻转、旋转、适应 / 1:1 与缩放。',
    screenshotToolbarFlatAlt: '单组列表下的工具栏：文件名、张数、旋转、适应视口、1:1、缩放比例与锁定',
    screenshotToolbarFlatCaption: '无文件夹时的扁平列表：信息条显示文件名，工具栏为翻页计数、旋转、适应 / 1:1、缩放与锁定。',
    screenshotMinimapAlt: '角落导航小地图：半透明压暗全景与可拖动的白色取景框',
    screenshotMinimapCaption: '小地图：缩略全景上的取景框表示当前可见区域，可拖动快速平移。',
    opsTitle: '查看器操作说明',
    opsRows: [
      ['点击缩略图', '全屏打开该图'],
      ['Esc', '关闭查看器'],
      ['← / →', '上一张 / 下一张'],
      ['⌘ / Ctrl + 方向键', '放大后平移（Mac 用 ⌘，Windows / Linux 用 Ctrl）。同时按两个方向键为斜向。'],
      ['Shift + 方向键', '默认同样平移。`shiftArrowAction="rotate"` 时左右键旋转 90°，上下键仍缩放。'],
      ['滚轮', '缩放（开启滚轮缩放时）'],
      ['双击', '放大；再次双击还原（开启双击缩放时）'],
      ['拖动', '放大后可拖动平移画面'],
      ['点击遮罩外', '关闭（开启点击遮罩关闭时）'],
    ],
    usageTitle: '安装',
    usageLead: '在 React 项目中安装：',
    usageNpm: 'npm install right-image-preview',
    usageDocHint: 'Props、ref API 与键盘列表见 GitHub 上 README 与 docs/ 目录。',
    liveDemoTitle: '在线演示',
    liveDemoSubtitle:
      '先看 Demo 0（触发器），再试下方相册。点击查看器，可试缩放、小地图与快捷键。',
    thumbClickHint: '点击打开',
    langLabel: '语言',
    langSwitchHint: '演示页语言（预览组件界面与之同步）',
    demo0Title: 'Demo 0 · 触发器（非受控）',
    demo0Desc:
      '在 `ImagePreview` 上写**单个子节点**（如 `<img>`、`<button>`）。全屏要用的图只在组件 props 里配置 `src` / `images`——**不会**去读子节点里的 `src`。不传 `visible`、`onClose` 时由内部管理开闭。',
    demo0Button: '打开预览',
    demo1Title: 'Demo 1 · 单组图片',
    demo1Desc:
      '适合相册、作品集等场景。5 张图片，比例各不相同（含竖图）。工具栏显示全局序号（如 2/5）；底部缩略图条（`showThumbnails`）可快速跳转整段扁平序列。无文件夹信息。',
    demo2Title: 'Demo 2 · 多文件夹图片',
    demo2Desc:
      '旅行相册场景，共 3 个文件夹 · 10 张图片。底部缩略图条（默认 `thumbnailsScope="group"`）**只展示当前文件夹**内的图片；跳转到下一组（双箭头或 PageUp/Down）后，条带会换成该组的缩略图。跨组全序列请用 `thumbnailsScope="flat"`（见 Demo 5）。信息条第二行先显示当前第几组、共几组（如 (1/3)），再跟文件夹名称。工具栏中间的序号只表示当前文件夹内第几张（如 2/3）。',
    demo3Title: 'Demo 3 · 先缩略占位，再切高清',
    demo3Desc:
      '每张图先用较小的低清预览（`minimapSrc`）铺满画面，减少长时间黑屏等待；完整纹理就绪后立即替换。标签中标注约略文件大小。大图来自 Wikimedia Commons（WebGL 用 `fetch`，需要 CORS；若图床不返回 `Access-Control-Allow-Origin`，网格缩略图能显示但预览会一直空白）。v0.4 默认使用动态邻图 texture 预加载；Demo 5 用 `preloadRadius={1}` 展示固定边界。',
    demo4Title: 'Demo 4 · EXIF + 删除（宿主维护列表）',
    demo4Desc:
      '工具栏「i」开关 EXIF；垃圾桶（或 Delete / Backspace）删除当前图。元数据在 `ImageItem.exif`。删除回调为 `onDeleteImage(index, item)` — 本 Demo 按 `item.id` 更新列表，张数减一并跳到下一张（若已是最后一张则上一张）。空字段不显示；第三张默认无 EXIF。',
    demo5Title: 'Demo 5 · 嵌入工作区 + 扁平缩略图条 + 预加载',
    demo5Desc:
      '嵌入式预览（`presentation="contained"`）填满中央工作区，假侧栏仍可操作。使用受控 `index`、`showThumbnails` + `thumbnailsScope="flat"`、`preloadRadius={1}`、`showThumbnailPreloadStatus` 与 `chrome="minimal"`。**蓝条** = 已解码 texture 仍驻留 GPU；**绿条** = 原图真实下载进度或曾完整下载。请先点击预览再按方向键。',
    demo5SidebarTitle: '侧栏',
    demo5ShowPreview: '显示预览',
    demo5HidePreview: '隐藏预览',
    demo5EmptyWorkspace: '预览已隐藏 — 侧栏仍可用。',
    demo5PreloadHint: '相邻预加载下标',
    demo6Title: 'Demo 6 · 预加载实验室（远程或本地）',
    demo6Desc:
      '默认使用 Wikimedia Commons 的 JPEG（约 1280–1920px，带 CORS），GitHub Pages 访客也能测邻图预热与网络耗时。在 `npm run dev` 下可切到**本地**：递归读取 gitignored 的 `./test-images`（含子目录）。绿条为原图传输；**蓝条**表示 texture 仍在 GPU。关掉预热可强制每次 cold。',
    demo6SourceRemote: '远程（Wikimedia）',
    demo6SourceLocal: '本地目录',
    demo6SidebarTitle: '本地大图',
    demo6HowTo:
      '等 ± 邻居出现蓝条后 ←/→。满绿只表示已下载、很可能走缓存，仍可能需要解码/上传。',
    demo6HowToShort: '等 ± 蓝条后 ←/→ · 悬停看说明',
    demo6Missing:
      '本地图集为空。请用 `npm run dev`，把 JPG/PNG/WebP 放进 `./test-images`（含子目录，勿提交），然后刷新。',
    demo6GridHint: '点卡片打开对应 index · 可滚动',
    demo6SlotsToggle: '邻居预热（display-ready）',
    demo6MeterTitle: '上次切图',
    demo6MeterIdle: '切图后显示耗时…',
    demo6MeterHint:
      'fast 且 sharp≪200ms = 层复用成功。cold ≈1s = 整图解码。先等 next=display-ready 再切。',
    demo6HistoryTitle: '最近几次',
    demo6PoolTitle: 'GPU 纹理实占',
    demo6PoolModeOn: '预热：开',
    demo6PoolModeOff: '预热：关',
    demo6PoolNow: '现在',
    demo6PoolIfOff: '若关闭',
    demo6PoolCurrent: '当前',
    demo6PoolNeighbors: '邻居',
    demo6PoolExtra: '预热多占',
    demo6PoolCap: '自动缓存预算',
    demo6PoolHint:
      '这里读取 WebGL cache 回报的实际驻留 texture 字节数。总量受显示器自动档位限制（4K 为 512 MiB）；宿主仍可用 preloadMemoryBudgetBytes 覆盖。',
    demo6PoolHintShort: '悬停：怎么看',
    photosBadge: (n) => `${n} 张`,
    thumbAria: (label) => `预览图片：${label}`,
  },
};
