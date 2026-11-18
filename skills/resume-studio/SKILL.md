---
name: resume-studio
description: 用 dsh-resume 插件制作与修改简历（DSL 语法手册 + 工作流）。当用户要写/改/导出简历、优化实习或项目经历表述、按 JD 定制简历时使用。
---

# 简历工作台制作与修改

用 `resume_*` 工具族与用户协作简历。数据全部在本机，无账号体系。

## 标准工作流

1. **新建/导入**：
   - `resume_new(type, name)`：type 用 `template_list` 确认（内置 7 套：`general` 校招/社招通用、`tech` 后端/技术研发、`ai_agent` AI 应用开发、`ops` 运营/新媒体、`java` Java 开发、`graduate` 研究生复试、`intern` 实习生/校招）。
   - `resume_import(name, content, baseType)`：导入外部 Markdown 为新简历。
2. **读取**：`resume_read(id)` 拿到正文 DSL 与 style 配置；`resume_sections(id)` 列出按 `##` 切分的模块序号与标题；`resume_list()` 列出本地全部简历；`resume_duplicate(id)` 复制；`resume_delete(id)` 删除。
3. **改写与调优**：
   - **局部改稿（首选）**：`resume_apply_edit(id, section, text)` 只替换指定模块正文，其它模块原样不动。
   - **全文写回**：`resume_write(id, content, name?, style?)` 整体保存（先读后改再写回）。
   - **调整结构/版式**：`resume_move_section(id, index, direction)` 上移/下移模块；`resume_set_template(id, type?, onlineType?)` 一键换版式配色而不改正文；`resume_set_style(id, style)` 微调样式；`template_get(type)` 查看模板示例。
   - **体检与匹配**：`resume_proofread(id)` 本地体检打分并输出问题清单；`resume_match_jd(id, jd)` 对照岗位 JD 计算关键词覆盖率与缺失词。
4. **自查**：`resume_render(id)` 生成自包含 HTML 后可用浏览器工具打开目检排版。
5. **导出**：`resume_export(id, format)`，支持 `md` | `html` | `pdf` | `png`。发 HR 优先导出 `pdf`。

## DSL 语法（正文必须严格遵守）

- **主标题（姓名-岗位）**：`### !bg[*姓名 - 岗位*](#主色)`
  - **正例**：`### !bg[*张明（待替换）- Agent 高级开发工程师*](#e8f2fc)`
  - **反例（禁止）**：`### !bg[*[姓名待填] - ...*](#e8f2fc)`（`!bg[...]` / `!c[...]` 内**禁止**再写方括号 `[待填]`，请改用圆括号或真实内容）
  - 浅色背景（如 `#e8f2fc`）自动配深墨色文字，深色背景自动配白色文字。
- **联系行**：普通段落，用 `｜` 分隔；带图标用 `icon:github`
- **模块标题（每个模块开一个新 section）**：
  - 白底/下划线模板可用分色标题：`## !c[教育](#色1)!c[背景](#色2)`
  - **重要兼容规则**：若当前模板（如在线模板 `28` / `72` / `8general` / `36`）二级标题本身自带实心彩色底块或丝带，请写纯文本 `## 核心优势与技术栈`，**切勿**加深色 `!c[...]`，以免深字与模板底块冲突！
- **信息四栏行（公司/团队/职位/时间，必须真实换行、各占一行）**：
  - **正例**：
    ```markdown
    ::: start
    **公司名**
    :::
    **部门 - 团队**
    :::
    **职位**
    :::
    **2024.06 - 2024.09**
    ::: end
    ```
  - **反例（严禁）**：把 `:::` 和下一栏粘在同一行或写成字面量 `:::\\n**智能体平台组**`，或写 `::: start A ::: B ::: end`，或漏写 `::: end`。
- **技能标签**：行内 `` `标签` ``（渲染成徽章；**禁止**写成空颜色 `!c[标签]()`）
- **要点列表**：`- **关键词：**量化描述，指标从 X% 提升至 Y%`
- **样式补丁**：`resume_set_style(id, style)`，字段 primaryColor（正文字色）/ primaryBGColor（模块主色）/ fontFamily / lineHeight
- **证件照与校徽**：`resume_set_avatar(id, imageDataUrl)`，位置 `resume_set_avatar_position(id, top, left, shape)`；校徽：`resume_set_school_logo` / `resume_set_school_logo_position`
- **单页/多页控制**：`resume_set_auto_page(id, enabled)`。制作 2 页及以上长简历时应传 `enabled: false` 关闭自动缩成一页，避免字号被整体压缩。

## 求职情报（写简历前先做功课）

- `jobs_search`：查目标公司在招岗位（JD 关键词提取后对照简历改写）
- `mianjing_search` / `mianjing_companies` / `mianjing_detail`：查该公司最近面经，把高频考点写进技能清单

## 写作要求

- 每条经历 = 负责模块一句 + 背景一句 + 2~4 条量化 bullet（动词开头、含数字、写清前后对比）
- 数字必须有：百分比、倍数、规模、时长；没有真实数字时引导用户提供，不要编造
- 同一模块色系统一：primaryBGColor 用于标题条与徽章，!c 的两个色从主色系派生（一深一浅）
- 中文简历默认不写照片位；用户给了照片再说

## 面板联动

- `resume_write` / `resume_new` 保存后，用户聊天区会出现迷你预览卡片；右侧工作台 3 秒内自动刷新。
- 用户在面板手动编辑时你不要并发写同一份简历；如发生冲突，提醒用户"放弃本地修改刷新"或让其先保存。
