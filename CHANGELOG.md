# Changelog

All notable changes to `dsh-resume` will be documented in this file.

## [1.0.5] - 2026-11-18

### Added
- **Scriptorium Workbench UI & Theme Sync**: Redesigned studio UI with Daylight Parchment & Nocturne dark themes (`body[data-ds-dark-theme]`, `ctx.theme`, `theme/change`), GSAP micro-animations, live streaming tool cards, and an interactive A4 high-resolution lightbox (`ResumeQuickPreviewModal`).
- **Modular DSL & Multi-Format Importer (`lib/dsl.js`, `lib/importer.js`)**: Balanced `!bg`/`!c` parser with automatic contrast calculation, literal `:::\n` fence normalization, multi-format external import (`.md`, `.txt`, `.html`, `.json`) preserving nested lists, `<hr>`, `<img>`, and multi-column blocks while sanitizing dangerous HTML/XSS.
- **27 Agent Tools & Skill Sync**: Full lifecycle support including `resume_import`, `resume_sections`, `resume_move_section`, `resume_apply_edit`, `resume_set_template`, `resume_proofread`, `resume_match_jd`, and automatic `SKILL.md` sync to `~/.dsh/skills/resume-studio/`.
- **Real UI Screenshots & Bilingual Docs**: Added 10 real feature screenshots under `docs/images/` and expanded `README.md`, `README.en.md`, and `docs/DETAIL.md`.

### Fixed
- **Data-Loss & Race Prevention**: Added `fragReadyRef` guard in WYSIWYG mode to prevent uninitialized DOM from overwriting Markdown content during fast mode switches; ensured `ensureSaved()` runs before export, checkup, auto-page toggle, and avatar/logo uploads, with `.rev` synchronized across all HTTP mutation endpoints.
- **XSS Hardening & Export Portability**: Stripped dangerous HTML blocks/event handlers outside code blocks in `fidelity.js`, locked `--force-device-scale-factor=1` in Edge/Chrome headless PNG exports for high-DPI Windows displays, removed machine-specific paths in `exporter.js`, and added multi-page PDF/PNG export support when `autoOnePage` is disabled.
- **Self-Contained Exports & Cleanup**: Inlined fonts/icons for offline HTML/PDF/PNG export without external Google Fonts blocking, cleaned up old avatar/logo files across format changes, and copied overlay assets during `resume_duplicate`.
