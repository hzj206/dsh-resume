# 简历工作台

把 简历工作台的核心能力搬进 DeepSeek Harness：**Markdown DSL 编辑 + A4 实时预览 + Agent 工具组**，无登录、纯本地存储。

## 功能

- **简历工作台**（侧栏底部入口 → 右侧栏面板）：左侧编辑区支持 **MD 模式**与**富文本（所见即所得）模式**双模式切换，右侧 794×1123 A4 版式实时预览，可缩放。
- **Agent 改简历**：直接在对话里说"帮我把实习经历改得更量化"，Agent 通过 `resume_read` / `resume_write` 工具修改，工作台与聊天卡片**实时刷新**。
- **DSL 排版语法**（Resume DSL 语法）：`!bg[标题](#色)` 底色标题条、`!c[字](#色)` 模块标题逐字变色、`::: start/end` 多栏行、`icon:name` 图标占位、`` `标签` `` 徽章。
- **模板**：内置通用 / 技术研发 / AI 应用 / 运营 / Java / 研究生复试 / 实习生 七套 + 在线模板源（120+ 套，可开关）。
- **智能辅助**：本地简历体检（`resume_proofread`）、JD 关键词匹配（`resume_match_jd`）、模块排序（`resume_move_section`）、局部改稿（`resume_apply_edit`）、一键换模板（`resume_set_template`）、Markdown 导入（`resume_import`）。
- **导出**：MD / HTML 一键导出；**PDF**（系统 Edge/Chrome headless 真排版打印，A4 精确分页）；**PNG**（794×1123 标准长图，内置浏览器或 headless 截图 + sharp 裁边）。
- **证件照 / 校徽**：工具栏上传，A4 预览里直接拖拽定位（自动回写坐标），方形/圆形头像。
- **智能一页**：内容超页自动缩放至恰好一页（预览与导出一致生效）。
- **求职情报工具**：`mianjing_search` / `mianjing_detail` / `mianjing_companies` / `jobs_search`（公开面经与岗位检索，约 2.7 万条岗位数据）。
- **隐私**：所有数据存本机 `~/.dsh/dsh-resume/`，无账号、无上传、无水印。

## Agent 工具

`resume_list` / `resume_new` / `resume_read` / `resume_write` / `resume_import` / `resume_set_style` / `resume_set_template` / `resume_sections` / `resume_move_section` / `resume_apply_edit` / `resume_proofread` / `resume_match_jd` / `resume_render` / `resume_export` / `resume_duplicate` / `resume_delete` / `resume_set_avatar` / `resume_set_avatar_position` / `resume_set_school_logo` / `resume_set_school_logo_position` / `resume_set_auto_page` / `template_list` / `template_get` / `mianjing_search` / `mianjing_detail` / `mianjing_companies` / `jobs_search`

## 使用

1. 安装后在侧栏顶部「全局面板」中点击「简历工作台」（或右侧栏工作台 tab）打开。
2. 新建一份模板简历，或直接在对话里说"帮我做一份后端开发简历"。
3. Agent 保存后，聊天中出现迷你预览卡片，点「打开工作台」看 A4 大图。

## 限制

- PDF / PNG 导出依赖系统安装的 Edge 或 Chrome（Windows 默认满足；未安装时 PNG 可自动退回内置浏览器截图）。
- 面板与 Agent 的实时同步基于 3 秒轮询；编辑未保存时外部更新会给出提示条。
- 富文本模式的模块级结构（标题/多栏/图标）建议用 MD 模式或让 Agent 调整。
