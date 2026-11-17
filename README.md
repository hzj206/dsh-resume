# dsh-resume · 简历工作台 for DeepSeek Harness

[中文](#功能) | English below

本地简历工作台插件：**Markdown DSL 编辑 + A4 实时渲染 + Agent 工具组**。无登录、纯本地存储、无水印。

A local resume workbench for DeepSeek Harness: Markdown-DSL editing with live A4 rendering and a full agent toolset. No login, fully local, no watermark.

## 功能 / Features

- **双模式编辑**：MD 源码模式（Resume DSL 高亮）+ 富文本所见即所得模式（浮动格式工具栏）
- **A4 实时预览**：794×1123 标准版式，缩放、刷新
- **Agent 驱动**：对话里直接改简历，面板 3 秒内自动刷新；聊天内嵌迷你预览卡片
- **导出**：PDF（系统 Edge/Chrome headless 真排版）、PNG（标准 A4 长图）、HTML、Markdown
- **证件照 / 校徽**：上传后在预览里拖拽定位，导出自动带上
- **智能一页**：内容超页自动缩放至恰好一页 A4
- **模板**：内置 7 套精选模板（通用 / 技术研发 / AI 应用 / 运营 / Java / 研究生复试 / 实习生）+ 可选在线模板源（120+ 套，可在配置中关闭）
- **求职情报工具**：面经检索 / 岗位库搜索（公开招聘与面经数据查询）
- **隐私**：所有数据存本机 `~/.dsh/dsh-resume/`，无账号、无上传、无水印

## 安装 / Install

**方式一（推荐）**：DSH → 插件 → 添加插件 → 填入本仓库地址（GitHub 安装）：

```
github:hzj206/dsh-resume
```

**方式二**：克隆本仓库后，DSH → 插件 → 添加插件 → 选择本地目录。

**方式三**：在会话里让 Agent 执行：`安装插件，目录在 <本仓库克隆路径>`。

## 使用 / Usage

1. 侧栏顶部「全局面板」里点「简历工作台」（或右侧栏 tab）。
2. 「＋新建」选模板，或直接对 Agent 说：*“帮我做一份后端开发的简历”*。
3. Agent 改简历后，工作台实时刷新；导出 PDF 一键发 HR。

## Agent 工具

`resume_list` `resume_new` `resume_read` `resume_write` `resume_import` `resume_set_style` `resume_set_template` `resume_sections` `resume_move_section` `resume_apply_edit` `resume_proofread` `resume_match_jd` `resume_render` `resume_export` `resume_duplicate` `resume_delete` `resume_set_avatar` `resume_set_avatar_position` `resume_set_school_logo` `resume_set_school_logo_position` `resume_set_auto_page` `template_list` `template_get` `mianjing_search` `mianjing_detail` `mianjing_companies` `jobs_search`

## 配置 / Config

| 字段 | 默认 | 说明 |
|---|---|---|
| `storageDir` | `~/.dsh/dsh-resume` | 简历存储目录 |
| `browserPath` | 自动探测 | PDF 打印用的 Edge/Chrome 路径 |
| `onlineTemplates` | `true` | 是否启用在线模板源 |

## DSL 语法速览

```markdown
### !bg[*姓名 - 岗位*](#4A6FA5)          ← 标题底色条
## !c[教育](#d44c47)!c[背景](#448361)     ← 模块标题逐段变色
::: start
**公司** ::: **团队** ::: **职位** ::: **时间**
::: end                                   ← 多栏行
`技能标签` icon:github                     ← 徽章 / 图标
```

## 致谢 / Credits

- Markdown 渲染核心基于开源项目 [markdown-transform-html](https://github.com/Acmenlei/markdown-plus)（MIT License）
- 面板与扩展机制参考 DeepSeek Harness 插件体系及社区示例（[dsh-univer-office](https://github.com/dream-num/dsh-univer-office)）

## License

MIT
