# Canvas Keyboard Pan

Pan an Obsidian Canvas with a physical keyboard. The default bindings are W/A/S/D; all four keys and the maximum speed can be configured in the plugin settings.

The plugin supports desktop, split panes, pop-out windows, and Obsidian Mobile with an external keyboard. On Android, a bounded per-window Canvas pointer lease preserves the correct Canvas after the IME leaves focus on `BODY`, without guessing from the active leaf or taking shortcuts away from editors, inputs, menus, or modals.

![Canvas Keyboard Pan demonstration](doc/CanvasPan.gif)

## Usage

1. Open a Canvas and make sure a text field or Canvas node is not being edited.
2. Hold W/A/S/D, or your configured keys, to pan.
3. Release the key, change views, hide the app, or press a modifier key to stop immediately.

Settings let you change the four physical key bindings and the maximum pan speed. Invalid or duplicate stored bindings are repaired to safe defaults.

## Installation

Download the versioned ZIP from [GitHub Releases](https://github.com/ARCJ137442/obsidian-canvas-pan/releases), extract it into `.obsidian/plugins/canvas-keyboard-pan/`, then enable **Canvas Keyboard Pan** in Obsidian. Advanced users can instead place `main.js`, `manifest.json`, and `styles.css` in that folder.

## Development

```bash
npm ci
npm test
npm run build
```

Pushes to `main` and pull requests run the same test-and-build gate. Architecture, validation, and next-step notes live in [`docs/`](docs/).

## Diagnostics and privacy

Mobile diagnostics are opt-in and memory-only. They use a bounded log, omit note content and actual typed text, and are released when the diagnostic session stops or the plugin unloads. The companion ARC plugin can coordinate and export a combined report for troubleshooting.

## License

This project is released under [The Unlicense](LICENSE).
