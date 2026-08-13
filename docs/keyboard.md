# Keyboard Shortcuts

**English** · [中文](./keyboard.zh-CN.md)

---

When the preview is open, focus is automatically trapped in the overlay and the following shortcuts take effect immediately.

With **`presentation="contained"`**, shortcuts are handled only while focus is inside the preview root (click the preview to activate); sidebar interactions will not swallow arrow keys / Esc.

> When the zoom input field is being edited, arrow keys and Space are handled by the input itself and do not trigger global shortcuts.

## Zoom

| Key | Action |
|-----|--------|
| `+` / `=` / `↑` | Zoom in (jump to the next larger stop) |
| `-` / `↓` | Zoom out (jump to the next smaller stop) |
| `0` | Switch to Fit mode |
| `1` | Switch to native 100 % |
| `Space` | Toggle Fit ↔ 100 % (same as double-click) |

> The zoom input field accepts a positive integer and **clamps to the maximum configured stop** (default max 200 %). Press **Enter** to confirm, **Esc** to cancel.

## Image Navigation

| Key | Action |
|-----|--------|
| `←` | Previous image in the flat list (crosses groups when using `groupedImages`) |
| `→` | Next image in the flat list (crosses groups when using `groupedImages`) |
| `PageUp` | Jump to first image of the previous group (requires non-empty `groupedImages`) |
| `PageDown` | Jump to first image of the next group (requires non-empty `groupedImages`) |

## Rotation

| Key | Action |
|-----|--------|
| `Ctrl / ⌘` + `←` | Rotate 90° counter-clockwise |
| `Ctrl / ⌘` + `→` | Rotate 90° clockwise |

## Close

| Key | Action |
|-----|--------|
| `Esc` | Close the preview |

---

> Any key press resets the auto-fade inactivity timer, immediately restoring all controls to full opacity.
