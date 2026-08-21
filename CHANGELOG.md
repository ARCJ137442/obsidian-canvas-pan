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
