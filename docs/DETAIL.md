# 简历工作台 · dsh-resume

DeepSeek Harness 本地简历工作台：**Markdown DSL 双模式编辑 + A4 实时排版预览 + 27 个 Agent 工具**，无账号、纯本地存储、无水印。

## 核心能力

- **双模式工作台**（侧栏顶部全局面板 →「简历工作台」/ 右侧栏工作台标签页）：左侧支持 **Markdown DSL 源码模式** 与 **富文本（所见即所得）模式** 切换，右侧 `794×1123` A4 实时预览与缩放。
- **Agent 实时协作**：在对话中直接提出修改需求（如"帮我把实习经历改得更量化"），Agent 通过 `resume_*` 工具落盘后，聊天区弹出迷你 A4 预览卡片，工作台 3 秒内自动同步刷新。
- **Resume DSL 排版语法**：支持 `!bg[标题](#色)` 底色条、`!c[字](#色)` 模块分段着色、`::: start / end` 多栏行、`icon:name` 图标、`` `标签` `` 徽章与 `++下划线++`。
- **丰富模板**：内置通用 / 技术研发 / AI 应用 / 运营 / Java / 研究生复试 / 实习生 7 套模板 + 可选在线模板库（120+ 套，支持只换版式不改动正文）。
- **体检与 JD 匹配**：内置纯本地简历体检（`resume_proofread`）与 JD 关键词覆盖分析（`resume_match_jd`），配合 `resume_move_section` / `resume_apply_edit` 精确迭代。
- **多格式导出**：一键导出 **PDF**（系统 Edge/Chrome headless 排版打印）、**PNG**（794px 标准 A4 长图）、**HTML**（字体样式全内联）与 **Markdown** 源文。
- **证件照 / 校徽与智能一页**：上传后可在 A4 预览中直接拖拽定位，支持方形/圆形头像及超页自动缩放至一页。
- **求职情报工具**：内置 `mianjing_search` / `mianjing_detail` / `mianjing_companies` / `jobs_search` 公开面经与岗位检索。
- **纯本地隐私**：所有数据存放在 `~/.dsh/dsh-resume/`，不上传个人简历内容。

## 环境说明

- **PDF / PNG 导出**优先调用本机已安装的 Microsoft Edge 或 Google Chrome（Windows 通常开箱自带；未检测到系统浏览器时 PNG 可自动退回内置浏览器截图）。
- 面板与 Agent 变更通过修订号轮询同步；若存在未保存的手动编辑，顶部会提示避免覆盖。
