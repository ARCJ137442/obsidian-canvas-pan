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

[1.0.1]: https://github.com/nathonius/obsidian-github-link/compare/1.0.0...1.0.1
[1.0.0]: https://github.com/nathonius/obsidian-github-link/releases/tag/1.0.0
