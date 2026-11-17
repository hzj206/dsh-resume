# Changelog

All notable changes to `dsh-resume` will be documented in this file.

## [1.0.5] - 2026-11-17

### Added
- **Desktop & Cross-Environment Compatibility**: Silent headless Edge/Chrome fallback for PNG export, `%LOCALAPPDATA%` browser binary detection, and `process.resourcesPath` resolution for `sharp` inside Desktop Electron builds.
- **27 Agent Tools**: Full lifecycle support including `resume_import`, `resume_sections`, `resume_move_section`, `resume_apply_edit`, `resume_set_template`, `resume_proofread`, `resume_match_jd`, and automatic `SKILL.md` sync to `~/.dsh/skills/resume-studio/`.
- **Inline Chat Cards**: Scaled A4 miniature preview cards (`?print=1&thumb=1`) with quick workbench jump, PDF export, and Markdown download actions.
- **WYSIWYG Toolbar & Sync**: Reliable selection tracking (`selectionchange` + `execCommand` sync), inline CSS style round-tripping, and `<del>` tag cleanup.

### Fixed
- Host dark theme synchronization via `body[data-ds-dark-theme]` and `ctx.get('theme')` (`theme/change` event).
- Self-contained HTML rendering for offline HTML/PDF/PNG export without external Google Fonts blocking.
- Cleanup of old avatar/logo files across image format changes and asset copying during `resume_duplicate`.
