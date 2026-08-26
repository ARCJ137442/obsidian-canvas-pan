# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

<!--
## [0.0.0] - YYYY-MM-DD

### Changed

### Fixed

-->

<!-- ## Unreleased -->

## [1.0.10] - 2026-08-26

### Added

- Add opt-in, bounded mobile diagnostics with Canvas capability snapshots, sampled pan effects, error capture, and an ARC diagnostic bridge.
- Add per-window Canvas pointer leases established only by verified Canvas pointer interaction.

### Fixed

- Restore Android external-keyboard panning after opening and leaving Canvas node editing, while preserving editor, input, modal, composition, multi-window, and lifecycle safety boundaries.
- Stop a failed pan interval safely and request Canvas redraws without creating a persistent telemetry loop.

### Changed

- Run tests and production builds on every `main` push and pull request before a release tag is created.
- Publish a versioned plugin ZIP together with `main.js`, `manifest.json`, and `styles.css`.

## [1.0.9] - 2026-08-25

### Fixed

- Drop `isDesktopOnly` from `manifest.json` so the plugin is installable on Obsidian Mobile (iOS / Android).

## [1.0.8] - 2026-08-24

### Fixed

- Extract `src/pan-speed.ts` with `normalizePanSpeed` clamping and replace `isNaN` with `Number.isFinite` in `canvas-viewport.ts`, so non-finite or out-of-range `maxSpeed` values no longer propagate.
- Load `maxSpeed` through `normalizePanSpeed` on settings hydrate; persist the repaired value and only surface a Notice when input was invalid.
- Remove `debugFirstTickLogged` and `DIAGNOSTIC_LOGGING` debug scaffolding; key-binding and speed repairs share one Notice path with per-field wording.
- Record 1.0.8 validation resources in `tests/resource-usage.md`.

## [1.0.7] - 2026-08-21

### Fixed

- Keyboard listeners now attach to each Canvas window's owning document, keeping WASD usable after restart and in popout windows.
- Focus and workspace changes reset only the affected window instead of clearing or invalidating unrelated Canvas windows.
- Keyboard bindings are stored as physical `KeyboardEvent.code` values, with legacy single-letter settings migrated automatically.
- The control-capture listener is now installed once per update session and removed exactly, so one captured key cannot populate all four directions.
- Invalid or duplicate persisted bindings are rejected and restored to default WASD with a notice.
- Focus cleanup no longer runs on every focus event; only blur and hidden-document transitions stop active panning, avoiding cancellation immediately after a Canvas receives focus.
- Viewport mutations now call Canvas `requestFrame()` after `markViewportChanged()`, ensuring the visual Canvas renderer observes keyboard panning.
- Directional WASD propagation is coordinated with the companion whiteboard plugin so node navigation and viewport panning can receive the same event.
- Concrete targets outside a Canvas are no longer guessed as the only Canvas in that window.

## [1.0.6] - 2026-08-21

### Fixed

- Modifier keys (`Ctrl`, `Shift`, `Alt`, and `Meta`) now stop active panning.
- Key combinations such as `Ctrl+S` no longer trigger or continue keyboard panning.

## [1.0.5] - 2026-08-21

### Fixed

- Window blur and document visibility changes now reset active panning without deleting the window registration state.
- Main and popout windows remain usable after focus changes and Vault/plugin reloads.

## [1.0.4] - 2026-08-21

### Fixed

- Main-window and popout-window keyboard events now use the same Canvas context resolution path.
- A window-level keyboard event falls back only to a Canvas in its own window, preserving multi-window isolation.
- Listener cleanup is explicit, preventing stale reload listeners from causing duplicate panning.

## [1.0.3] - 2026-08-21

### Fixed

- Window listener registration is reset during plugin unload, so reloading the plugin restores keyboard panning in every window.
- Repeated reloads no longer leave the registration guard out of sync with the active window states.

## [1.0.2] - 2026-08-21

### Fixed

- Keyboard panning now resolves the Canvas belonging to the active main or popout window.
- Duplicate listener paths no longer process the same keyboard event twice.
- Panning state is cleared when a window loses focus or closes.
- Keyboard panning does not steal input from editable controls or Canvas text editing.

## [1.0.1] - 2024-05-18

### Fixed

- Panning will not trigger while actively focused in an editor
- Panning will stop if the opposite key is pressed, if another file is open, etc.
  - This should help prevent it getting stuck panning forever


## [1.0.0] - 2024-04-28

Initial release.

[1.0.10]: https://github.com/ARCJ137442/obsidian-canvas-pan/compare/1.0.9...1.0.10
[1.0.9]: https://github.com/ARCJ137442/obsidian-canvas-pan/compare/1.0.8...1.0.9
[1.0.8]: https://github.com/ARCJ137442/obsidian-canvas-pan/compare/1.0.7...1.0.8
[1.0.7]: https://github.com/ARCJ137442/obsidian-canvas-pan/compare/1.0.6...1.0.7
[1.0.6]: https://github.com/ARCJ137442/obsidian-canvas-pan/compare/1.0.5...1.0.6
[1.0.5]: https://github.com/ARCJ137442/obsidian-canvas-pan/compare/1.0.4...1.0.5
[1.0.4]: https://github.com/ARCJ137442/obsidian-canvas-pan/compare/1.0.3...1.0.4
[1.0.3]: https://github.com/ARCJ137442/obsidian-canvas-pan/compare/1.0.2...1.0.3
[1.0.2]: https://github.com/ARCJ137442/obsidian-canvas-pan/compare/1.0.1...1.0.2
[1.0.1]: https://github.com/ARCJ137442/obsidian-canvas-pan/compare/1.0.0...1.0.1
[1.0.0]: https://github.com/ARCJ137442/obsidian-canvas-pan/releases/tag/1.0.0
