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

## Pan

| Key | Action |
|-----|--------|
| `Ctrl / ⌘` + `Arrow key` | Pan toward that part of the image by 15% of the viewport's shorter side |
| `Shift` + `Arrow key` | Controlled by `shiftArrowAction`; pans by default |

> Arrow keys indicate the area to reveal. For example, `Ctrl / ⌘` + `→` reveals content to the right. Direction state strictly follows the keys that are actually held: perpendicular arrows combine into normalized 45° diagonal panning, releasing either one immediately restores the remaining cardinal direction, and opposite directions cancel on their axis. Panning is available only in Native mode and stops at the image boundary.

> **macOS limitation:** Some browsers may omit arrow `keyup` events while Command remains held, so a web page cannot reliably observe the true released state. Keep the default `shiftArrowAction="pan"` and use right-side `Shift + Arrow key` when strict, continuous game-style eight-direction input is required. `Ctrl + Arrow key` on Windows/Linux is not affected by this macOS limitation.

With `shiftArrowAction="rotate"`, `Shift + ←` rotates 90° counter-clockwise and `Shift + →` rotates 90° clockwise; `Shift + ↑/↓` retain their normal zoom actions. Toolbar rotation remains available in either mode.

## Close

| Key | Action |
|-----|--------|
| `Esc` | Close the preview |

---

> Any key press resets the auto-fade inactivity timer, immediately restoring all controls to full opacity.
