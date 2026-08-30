# 贡献指南

[English](./CONTRIBUTING.md) · **中文**

感谢你花时间参与贡献！本指南说明如何参与项目开发。

---

## 目录

- [行为准则](#行为准则)
- [快速开始](#快速开始)
- [开发工作流](#开发工作流)
- [提交变更](#提交变更)
- [编码规范](#编码规范)
- [报告 Bug](#报告-bug)
- [建议新功能](#建议新功能)

---

## 行为准则

请在所有交流中保持尊重与建设性态度。遵循开源社区通行准则：友善待人、善意理解他人、讨论聚焦于问题本身。

---

## 快速开始

1. **Fork** 本仓库并在本地 clone 你的副本。
2. 安装依赖：
   ```bash
   npm install
   ```
3. 启动开发服务器：
   ```bash
   npm run dev
   ```
   打开 `http://localhost:5173/right-image-preview/`。**Demo 6** 默认用 Wikimedia 图；切到**本地**后把 JPG/PNG/WebP 放进 gitignored 的 `./test-images`（含子目录）。
4. 运行测试，确认一切正常：
   ```bash
   npm test
   ```

---

## 开发工作流

```
src/components/ImagePreview/
  types.ts                  ← 共享 TypeScript 类型
  useZoomState.ts           ← 缩放状态机（纯逻辑，无 DOM）
  useImageTransform.ts      ← DOM 测量 + CSS transform + 拖拽平移
  useWheelZoom.ts           ← 滚轮缩放 Hook（已从主组件提取）
  usePinchZoom.ts           ← 触控双指捏合缩放 Hook
  injectGlobalStyle.ts      ← 单例 CSS 注入工具（SSR 安全）
  locale.ts / localeTypes.ts / locales/  ← 国际化字符串
  Toolbar.tsx               ← 底部工具栏 UI
  Minimap.tsx               ← 导航小地图
  shell/
    ImagePreview.tsx        ← 外层 shell（trigger 模式分发）
    ImagePreviewInner.tsx   ← 对话框实现
    ImagePreviewTriggerShell.tsx
  parts/                    ← 小型子组件（关闭按钮、导航箭头）
  index.ts                  ← 公开导出
```

- **状态逻辑**：在 `useZoomState.ts` 中维护，不依赖 DOM 和渲染逻辑。
- **DOM/变换逻辑**：在 `useImageTransform.ts` 中维护。
- **交互 Hook**（`useWheelZoom`、`usePinchZoom`）每个只负责一种输入方式，保持单一职责。
- **所有公开类型**：必须从 `index.ts` 导出。

---

## 提交变更

1. 从 `main` 创建功能分支：
   ```bash
   git checkout -b feat/my-feature
   # 或
   git checkout -b fix/my-bug-fix
   ```
2. 进行修改，保持每个 commit 聚焦且描述清晰。
3. 确保测试通过，非琐碎的改动需补充测试用例：
   ```bash
   npm test                  # 快速运行（不含覆盖率）
   npm run test:coverage     # 含覆盖率报告（强制 50% 阈值）
   ```
4. 检查是否有 TypeScript 类型错误：
   ```bash
   npx tsc --noEmit
   ```
5. 向 `main` 分支提交 Pull Request，填写 PR 模板并描述：
   - 解决了什么问题？
   - 如何测试？
   - 是否有破坏性变更？

---

## 编码规范

- **TypeScript**：使用明确的类型注解，避免 `any`。
- **React**：优先使用 hooks 和函数组件；在涉及渲染性能的地方使用 `useCallback`/`useMemo`。
- **CSS**：仅使用内联样式（无 CSS 文件或 CSS-in-JS 库）；颜色使用 `Toolbar.tsx` 中的 `C` 色彩 token。
- **注释**：解释"为什么"而非"做什么"，避免对代码的简单复述。
- **不引入新生产依赖**：组件必须保持无第三方依赖（仅依赖 React）。

---

## 报告 Bug

使用 [Bug Report](./.github/ISSUE_TEMPLATE/bug_report.md) issue 模板，并包含：

- 清晰描述非预期的行为
- 复现步骤
- 预期结果 vs 实际结果
- 浏览器 / 操作系统 / React 版本

---

## 建议新功能

使用 [Feature Request](./.github/ISSUE_TEMPLATE/feature_request.md) issue 模板，并包含：

- 你想解决的问题
- 你提议的解决方案
- 你考虑过的备选方案
