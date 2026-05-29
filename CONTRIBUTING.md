# Contributing to right-image-preview

**English** · [中文](./CONTRIBUTING.zh-CN.md)

Thank you for taking the time to contribute! This guide explains how to get involved.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Submitting Changes](#submitting-changes)
- [Coding Conventions](#coding-conventions)
- [Reporting Bugs](#reporting-bugs)
- [Suggesting Features](#suggesting-features)

---

## Code of Conduct

Please be respectful and constructive in all interactions. We follow the standard open-source community norms: be kind, assume good intent, and keep discussions focused.

---

## Getting Started

1. **Fork** the repository and clone your fork locally.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
4. Run the test suite to confirm everything is working:
   ```bash
   npm test
   ```

---

## Development Workflow

```
src/components/ImagePreview/
  types.ts                  ← shared TypeScript types
  useZoomState.ts           ← zoom state machine (pure logic, no DOM)
  useImageTransform.ts      ← DOM measurements + CSS transforms + drag-to-pan
  useWheelZoom.ts           ← mouse-wheel zoom (extracted hook)
  usePinchZoom.ts           ← touch pinch-to-zoom
  injectGlobalStyle.ts      ← one-shot CSS injection utility (SSR-safe)
  locale.ts / localeTypes.ts / locales/  ← i18n strings
  Toolbar.tsx               ← bottom toolbar UI
  Minimap.tsx               ← navigation minimap
  shell/
    ImagePreview.tsx        ← outer shell (trigger-mode dispatch)
    ImagePreviewInner.tsx   ← dialog implementation
    ImagePreviewTriggerShell.tsx
  parts/                    ← small sub-components (close button, nav arrows)
  index.ts                  ← public exports
```

- **State logic** lives in `useZoomState.ts` — keep it free of DOM and React rendering concerns.
- **DOM/transform logic** lives in `useImageTransform.ts`.
- **Interaction hooks** (`useWheelZoom`, `usePinchZoom`) handle one input modality each — keep them single-concern.
- **All public types** must be exported from `index.ts`.

---

## Submitting Changes

1. Create a branch from `main`:
   ```bash
   git checkout -b feat/my-feature
   # or
   git checkout -b fix/my-bug-fix
   ```
2. Make your changes, keeping commits focused and descriptive.
3. Ensure tests pass and add new tests for non-trivial changes:
   ```bash
   npm test                  # fast run (no coverage)
   npm run test:coverage     # run with coverage report (enforces 50% threshold)
   ```
4. Run the TypeScript compiler to confirm no type errors:
   ```bash
   npx tsc --noEmit
   ```
5. Open a Pull Request against `main`. Fill in the PR template and describe:
   - What problem does this solve?
   - How was it tested?
   - Any breaking changes?

---

## Coding Conventions

- **TypeScript**: use explicit types; avoid `any`.
- **React**: prefer hooks and functional components; use `useCallback`/`useMemo` where re-renders matter.
- **CSS**: inline styles only (no CSS files or CSS-in-JS libraries); use the `C` colour-token object in `Toolbar.tsx` for consistent colours.
- **Comments**: explain *why*, not *what*. Avoid restating the code in prose.
- **No new production dependencies**: the component must remain dependency-free (React only).

---

## Reporting Bugs

Use the [Bug Report](./.github/ISSUE_TEMPLATE/bug_report.md) issue template and include:

- A clear description of the unexpected behaviour
- Steps to reproduce
- Expected vs actual result
- Browser / OS / React version

---

## Suggesting Features

Use the [Feature Request](./.github/ISSUE_TEMPLATE/feature_request.md) issue template and include:

- The problem you are trying to solve
- Your proposed solution
- Alternatives you considered
