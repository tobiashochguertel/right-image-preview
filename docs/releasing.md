# Release Guide

[中文](./releasing.zh-CN.md)

This document describes the end-to-end process for releasing a new version of `right-image-preview` to npm and pushing the changes to GitHub.

---

## Prerequisites

| Tool | Notes |
|---|---|
| Node.js ≥ 18 | Required by Vite and the build pipeline |
| npm account | Must be a collaborator on the `right-image-preview` package |
| npm auth token | Stored in `~/.npmrc` (see [Authentication](#authentication)) |
| Git write access | To the `ZhangJian1713/right-image-preview` repository |

---

## Authentication

### npm

The auth token is stored in `~/.npmrc` so `npm publish` can authenticate without prompting. Prefer an environment variable so the secret is not stored as plain text in the file:

```
//registry.npmjs.org/:_authToken=${NPM_TOKEN}
```

Then set `NPM_TOKEN` in your shell (or CI secrets) to the token value. Alternatively, you may put the raw token after `=` instead of `${NPM_TOKEN}` if the file stays on your machine only and never enters version control.

To create or rotate a token:

1. Go to [https://www.npmjs.com/settings/tokens](https://www.npmjs.com/settings/tokens)
2. Click **Generate New Token → Classic Token**
3. Choose type **Automation** (allows publishing from CI without 2FA prompt)
4. Copy the token into your environment or `~/.npmrc` as described above

> **Security note**: Never commit your token to source control. The `~/.npmrc` file is on your local machine and is not tracked by this repository.

If your npm account has **"Require 2FA for write actions"** enabled, `npm publish` will require an OTP every time. To avoid this:
- Either use an **Automation** token (bypasses 2FA for machine publishing), or
- Disable that setting in your [account security settings](https://www.npmjs.com/settings/account) — only do this if you understand the implications.

---

## Local pack (no publish)

While iterating against Media Lens, skip `npm publish`:

```bash
npm run pack:local
```

Output: `.local-pack/right-image-preview/` (gitignored). Point the host at it with a `file:` dependency — see [`media-lens-integration.md`](./media-lens-integration.md) §8.2. Local packs show a top `local v…` badge with a second-precision build time.

Official releases still follow the checklist below (local `npm publish` → tag).

---

## Release Checklist

**Preferred order: local `npm publish` first, then push the tag.**  
Hosts (e.g. Media Lens) can `npm update` immediately. CI still runs tests / size / GitHub Release, and **skips publish** if that version is already on npm.

### 1. Finish development & smoke-check

```bash
git status          # only this release’s changes
npx tsc --noEmit
npm test
npm run build:lib
npm run size
```

### 2. Bump version + CHANGELOG

Edit `package.json` (SemVer) and fold `[Unreleased]` into `[x.y.z] — YYYY-MM-DD` in `CHANGELOG.md`.

| Change type | Example |
|---|---|
| Bug fix | e.g. `0.3.8` → `0.3.9` |
| Backward-compatible feature | `0.3.9` → `0.4.0` |
| Breaking API change | `0.4.0` → `1.0.0` |

### 3. Update documentation

If the release includes new props, behaviours, or keyboard shortcuts, update:

- `docs/api.md` / `docs/api.zh-CN.md`
- `docs/keyboard.md` / `docs/keyboard.zh-CN.md`
- `docs/requirements.md` / `docs/requirements.en.md`
- `README.md` / `README.zh-CN.md` (if install / feature summary changes)

### 4. Publish to npm locally (do this first)

```bash
npm publish
```

`prepublishOnly` runs `build:lib` again. Success looks like:

```
+ right-image-preview@x.y.z
```

Verify immediately:

```bash
npm view right-image-preview version
```

Hosts can install this version right away — no need to wait for CI.

### 5. Commit, tag, push

```bash
git add -A   # do not commit secrets / accidental pnpm workspace files
git commit -m "chore: release vX.Y.Z"
git tag vX.Y.Z
git push origin main
git push origin vX.Y.Z
```

Pushing a `v*` tag runs [Release to npm](../.github/workflows/release.yml):

- typecheck / test / build / size
- **skip npm publish if the version is already on the registry**
- create the GitHub Release

Demo Pages still deploy from the `main` push via the other workflow:  
[https://zhangjian1713.github.io/right-image-preview/](https://zhangjian1713.github.io/right-image-preview/)

---

## Build Configuration Reference

| Config file | Purpose |
|---|---|
| `vite.config.ts` | Dev server and test runner (Vitest) |
| `vite.lib.config.ts` | Library build (Rollup via Vite, `publicDir: false`) |
| `tsconfig.json` | Shared TypeScript settings |
| `tsconfig.lib.json` | Stricter settings used by `vite-plugin-dts` for declaration output |

### Why two Vite configs?

The demo app and the library have different needs:

- **Demo** (`vite.config.ts`): includes `public/` assets, sets `base: '/right-image-preview/'` for GitHub Pages, enables Vitest.
- **Library** (`vite.lib.config.ts`): externalises `react`/`react-dom`, disables `publicDir`, generates `.d.ts` declarations via `vite-plugin-dts`.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `npm error code E403` | Not logged in or wrong token | Re-paste token in `~/.npmrc` |
| `npm error code EOTP` | 2FA required | Use an Automation token (see [Authentication](#authentication)) |
| `vite-plugin-dts` warns about TypeScript version | TypeScript in devDeps is newer than bundled API Extractor | Safe to ignore; declarations still generate correctly |
| GitHub Actions deploy fails | Pages source not set to **GitHub Actions** | Repository → Settings → Pages → Source → GitHub Actions |
| Pages deploy blocked by environment | `github-pages` environment branch restriction | Settings → Environments → github-pages → Deployment branches → No restriction |
