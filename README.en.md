<div align="center">
  <img src="icon.svg" alt="dsh-resume" width="84" height="84" />
  <h1>dsh-resume</h1>
  <p><strong>Local Resume Workbench Plugin for DeepSeek Harness</strong></p>
  <p>Dual-mode Markdown DSL Editing · Live A4 Layout Preview · 27 Agent Tools · Fully Local & Watermark-free</p>

  <p>
    <a href="https://github.com/hzj206/dsh-resume/releases"><img src="https://img.shields.io/badge/release-v1.0.5-10b981?style=flat" alt="Release v1.0.5" /></a>
    <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-3b82f6?style=flat" alt="MIT License" /></a>
    <a href="https://github.com/deepseek-ai/deepseek-harness"><img src="https://img.shields.io/badge/platform-DeepSeek%20Harness-111827?style=flat" alt="DeepSeek Harness" /></a>
    <img src="https://img.shields.io/badge/node-%3E%3D20-339933?style=flat&logo=node.js&logoColor=white" alt="Node.js >= 20" />
    <img src="https://img.shields.io/badge/dependencies-0-0ea5e9?style=flat" alt="Zero Dependencies" />
  </p>

  <p>
    <a href="README.md">简体中文</a> · <strong>English</strong>
  </p>
  <p>
    <a href="#quick-start">🚀 Quick Start</a> ·
    <a href="#features">✨ Features</a> ·
    <a href="#agent-tools">🤖 Agent Tools</a> ·
    <a href="#dsl">📝 Resume DSL</a> ·
    <a href="#config">⚙️ Configuration</a> ·
    <a href="#architecture">📦 Project Structure</a>
  </p>
</div>

---

> [!IMPORTANT]
> **Install Spec (copy directly into DSH Plugins or CLI):**
> ```text
> github:hzj206/dsh-resume
> ```

## <a id="quick-start"></a>🚀 Quick Start

### Requirements

| Item | Requirement |
|---|---|
| Host | DeepSeek Harness (Web & Desktop) |
| Node.js | `>= 20` |
| npm dependencies | **0 external dependencies** |
| Export engine (optional) | **Microsoft Edge** or **Google Chrome** installed on the system for headless PDF / PNG export |

### Installation

#### Option 1: DSH GUI (Recommended)

1. Open DeepSeek Harness and navigate to **Plugins → Add plugin** in the sidebar.
2. Enter either of the following specs:
   - GitHub shorthand: `github:hzj206/dsh-resume`
   - Full Git URL: `https://github.com/hzj206/dsh-resume.git`
3. Enable the bundle (restart DSH once if config HMR is disabled).

#### Option 2: `dsh plugin` CLI

```bash
# Install into the Web profile
dsh plugin --profile web add github:hzj206/dsh-resume

# Or into a custom profile
dsh plugin --profile <profile-name> add github:hzj206/dsh-resume
```

> [!TIP]
> - On Windows PowerShell, use `dsh.cmd` if execution policies block `.ps1` wrappers.
> - You can also download the `.tgz` asset from [GitHub Releases](https://github.com/hzj206/dsh-resume/releases) and run `dsh plugin --profile web add ./dsh-resume-1.0.5.tgz`.

#### Option 3: Install via Agent Chat

Send this prompt directly to your DSH Agent:

> Install and enable plugin: `github:hzj206/dsh-resume`

#### Option 4: Local Clone

```bash
git clone https://github.com/hzj206/dsh-resume.git
```

Select the cloned directory in **Plugins → Add plugin**, or run `dsh plugin --profile web add ./dsh-resume`.

<details>
<summary><b>Upgrade & Uninstall</b></summary>

```bash
# Re-install latest from GitHub
dsh plugin --profile web add github:hzj206/dsh-resume

# Remove plugin (keeps your personal resumes in ~/.dsh/dsh-resume/ intact)
dsh plugin --profile web remove dsh-resume
```

</details>

---

## <a id="features"></a>✨ Features

- **Dual-Mode Editor**: Switch seamlessly between **Markdown DSL source** and **WYSIWYG rich-text editing** (bold, italic, underline, strikethrough, ordered/unordered lists, clear formatting, undo/redo).
- **Live A4 Rendering (`794 × 1123 px`)**: Real-time layout preview with zoom controls and revision-synced live refresh (`3s` polling + save lock).
- **27 Agent Tools**: End-to-end AI collaboration with inline miniature A4 preview cards inside the conversation stream.
- **Multi-Format Local Export**:
  - **PDF**: Headless Edge/Chrome A4 print with zero headers/footers.
  - **PNG**: Standard 794px-wide full-page image.
  - **HTML**: Self-contained single file with inlined CSS, icons, and images.
  - **Markdown**: Clean DSL source file.
- **Templates & Visual Customization**: 7 built-in templates + optional 120+ online layout templates (style swap preserves text), draggable photo/logo overlay, and **Smart One-Page** auto-fit scaling.
- **Offline Proofread & JD Match**: Rule-based local health check (contact details, weak verbs, quantification, punctuation) and offline JD keyword coverage analysis.
- **Job Intelligence**: Read-only `mianjing_*` and `jobs_search` tools for interview experience and job posting lookup.
- **100% Local Privacy**: No login, no cloud upload, no watermark. All resumes live in `~/.dsh/dsh-resume/`.

---

## <a id="agent-tools"></a>🤖 Agent Tools (27 Total)

- **Resume CRUD & Section Editing**: `resume_list`, `resume_new`, `resume_read`, `resume_write`, `resume_import`, `resume_duplicate`, `resume_delete`, `resume_sections`, `resume_move_section`, `resume_apply_edit`, `resume_render`
- **Styling, Overlays & Export**: `resume_set_template`, `resume_set_style`, `resume_set_auto_page`, `resume_set_avatar`, `resume_set_avatar_position`, `resume_set_school_logo`, `resume_set_school_logo_position`, `resume_export`
- **Diagnostics, Templates & Job Intel**: `resume_proofread`, `resume_match_jd`, `template_list`, `template_get`, `mianjing_companies`, `mianjing_search`, `mianjing_detail`, `jobs_search`

---

## <a id="dsl"></a>📝 Resume DSL Quick Reference

```markdown
### !bg[*Alex Zhang - Backend Engineer*](#2F54EB)

138-0000-0000 ｜ career@example.com ｜ icon:github github.com/example

## !c[Education](#2F54EB)!c[Background](#6B7280)

::: start
**Example University** `CS` `B.S.`
:::
**2022.09 - 2026.06**
::: end
```

- `!bg[text](#hex)`: Highlighted title bar
- `!c[text](#hex)`: Multi-color section heading segments
- `::: start ... ::: ... ::: end`: Adaptive multi-column layout row
- `` `tag` ``: Theme-colored badge chip
- `icon:<name>`: Built-in iconfont glyph (`icon:github`, `icon:bytedance`, etc.)
- `++text++`: Underline; `~~text~~`: Strikethrough

---

## <a id="config"></a>⚙️ Configuration & Storage

| Key | Type | Default | Description |
|---|---|---|---|
| `storageDir` | `string` | `~/.dsh/dsh-resume` | Local resume & export storage path |
| `browserPath` | `string` | Auto-detected | Custom Edge / Chrome binary path for PDF & PNG export |
| `onlineTemplates` | `boolean` | `true` | Enable/disable online template gallery (`false` for fully offline mode) |

---

## <a id="architecture"></a>📦 Project Structure

```text
dsh-resume/
├── package.json            # Bundle manifest, client injections & exports
├── cordis.patch.yml        # Cordis plugin patch
├── icon.svg                # Plugin icon
├── locale/                 # Localized metadata (en.json / zh.json)
├── docs/                   # Plugin manager detail page (DETAIL.md)
├── skills/resume-studio/   # Agent skill guide synced to ~/.dsh/skills/
├── assets/                 # Built-in templates, A4 CSS, markdown-transform-html (MIT), iconfont
└── lib/                    # Host & Client implementation (index.js, client.js, fidelity.js, render.js, features.js, exporter.js)
```

---

## 🤝 Credits & License

- Markdown rendering powered by [markdown-transform-html](https://github.com/Acmenlei/markdown-plus) ([MIT License](assets/vendor/markdown-transform-html.LICENSE))
- Plugin integration inspired by DeepSeek Harness documentation & [dsh-univer-office](https://github.com/dream-num/dsh-univer-office)
- Licensed under [MIT](LICENSE)
