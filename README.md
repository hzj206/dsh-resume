<div align="center">
  <img src="icon.svg" alt="dsh-resume" width="84" height="84" />
  <h1>dsh-resume</h1>
  <p><strong>DeepSeek Harness 本地简历工作台插件</strong></p>
  <p>Markdown DSL 双模式编辑 · A4 实时排版预览 · 27 个 Agent 协作工具 · 纯本地存储无水印</p>

  <p>
    <a href="https://github.com/hzj206/dsh-resume/releases"><img src="https://img.shields.io/badge/release-v1.0.5-10b981?style=flat" alt="Release v1.0.5" /></a>
    <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-3b82f6?style=flat" alt="MIT License" /></a>
    <a href="https://github.com/deepseek-ai/deepseek-harness"><img src="https://img.shields.io/badge/platform-DeepSeek%20Harness-111827?style=flat" alt="DeepSeek Harness" /></a>
    <img src="https://img.shields.io/badge/node-%3E%3D20-339933?style=flat&logo=node.js&logoColor=white" alt="Node.js >= 20" />
    <img src="https://img.shields.io/badge/dependencies-0-0ea5e9?style=flat" alt="Zero Dependencies" />
  </p>

  <p>
    <strong>简体中文</strong> · <a href="README.en.md">English</a>
  </p>
  <p>
    <a href="#quick-start">🚀 快速开始</a> ·
    <a href="#features">✨ 核心能力</a> ·
    <a href="#agent-tools">🤖 Agent 工具</a> ·
    <a href="#dsl">📝 DSL 语法</a> ·
    <a href="#config">⚙️ 配置与存储</a> ·
    <a href="#architecture">📦 项目结构</a>
  </p>
</div>

---

> [!IMPORTANT]
> **安装标识（直接复制填入 DSH 插件安装框或命令行）：**
> ```text
> github:hzj206/dsh-resume
> ```

## <a id="quick-start"></a>🚀 快速开始

### 环境要求

| 项目 | 说明 |
|---|---|
| 宿主环境 | DeepSeek Harness（Web / Desktop 桌面端通用） |
| Node.js | `>= 20` |
| 外部 npm 依赖 | **0 依赖**（安装无需拉取第三方依赖树） |
| 导出引擎（可选） | 系统已安装 **Microsoft Edge** 或 **Google Chrome**（用于无头打印高精度 PDF / PNG，Windows 通常开箱自带） |

### 安装方式

#### 方式一：DSH 图形界面安装（推荐）

1. 打开 DeepSeek Harness，进入侧栏 **「插件」→「添加插件」**。
2. 填入以下任意一种地址并确认安装：
   - GitHub 短格式：`github:hzj206/dsh-resume`
   - Git 完整地址：`https://github.com/hzj206/dsh-resume.git`
3. 安装完成后开启启用开关即可使用（若运行时未启用配置热重载，重启一次 DSH 即可生效）。

#### 方式二：`dsh plugin` 命令行安装

```bash
# 安装到 Web profile
dsh plugin --profile web add github:hzj206/dsh-resume

# 或安装到其他自定义 profile
dsh plugin --profile <profile-name> add github:hzj206/dsh-resume
```

> [!TIP]
> - Windows PowerShell 如遇脚本执行策略限制，请将 `dsh` 替换为 `dsh.cmd`。
> - 如希望离线安装，也可从 [GitHub Releases](https://github.com/hzj206/dsh-resume/releases) 下载 `.tgz` 归档后执行：`dsh plugin --profile web add ./dsh-resume-1.0.5.tgz`。

#### 方式三：让 Agent 自动安装

在 DSH 对话框中直接发送：

> 帮我安装并启用插件：`github:hzj206/dsh-resume`

#### 方式四：克隆源码本地安装

```bash
git clone https://github.com/hzj206/dsh-resume.git
```

然后在 DSH **「插件 → 添加插件」** 选择克隆目录，或执行 `dsh plugin --profile web add ./dsh-resume`。

<details>
<summary><b>升级与卸载命令</b></summary>

```bash
# 重新安装最新版
dsh plugin --profile web add github:hzj206/dsh-resume

# 卸载插件（不会删除 ~/.dsh/dsh-resume/ 下保存的个人简历文件）
dsh plugin --profile web remove dsh-resume
```

</details>

### 上手使用

1. 安装启用后，在侧栏顶部全局面板中点击 **「简历工作台」**（或展开右侧栏工作台标签页）。
2. 点击 **「＋ 新建」** 选择模板，或直接在对话中对 Agent 说：*“帮我做一份后端开发校招简历，突出高并发项目经验”*。
3. Agent 修改并保存后，对话区会弹出带微缩预览的实时工具卡片，工作台也会在 3 秒内自动同步刷新。
4. 调整满意后，点击工具栏 **PDF / PNG / HTML / MD** 一键导出。

---

## <a id="features"></a>✨ 核心能力

| 能力模块 | 说明 |
|---|---|
| **双模式编辑器** | 支持 **Markdown DSL 源码模式** 与 **富文本所见即所得（WYSIWYG）模式**无缝切换；富文本工具栏支持加粗、斜体、下划线、删除线、有序/无序列表、清除格式及撤销重做。 |
| **A4 实时排版预览** | 严格遵循 `794 × 1123 px` 标准 A4 比例实时渲染，支持缩放比例调节、局部/整页同步刷新与防串写保存锁。 |
| **Agent 深度协作** | 向模型注册 **27 个结构化工具**，支持从建档、局部改写、换版式、体检打分、JD 匹配到导出全流程自动化，并在对话流内嵌 A4 微缩预览卡片。 |
| **多格式本地导出** | **PDF**（Edge/Chrome headless 无页眉页脚真实排版打印）、**PNG**（标准 A4 宽度长图）、**HTML**（字体与样式全内联，断网可打开）、**Markdown** 源文。 |
| **视觉定制与拖拽** | 支持一键切换内置 **7 套精选模板** 或可选 **120+ 在线版式模板**（仅换样式不改正文），支持证件照（方/圆）与校徽上传后在预览纸面上直接拖拽定位。 |
| **智能一页** | 内容略微超页时自动计算缩放比例压入单页 A4，工作台预览与导出结果保持一致。 |
| **本地体检与 JD 匹配** | 内置纯本地规则引擎（不联网）：检查联系方式完整性、弱动词、空话、量化指标与标点混用，并可对照岗位 JD 计算关键词覆盖率与缺失词。 |
| **求职情报辅助** | 内置 `mianjing_*` 与 `jobs_search` 工具，辅助调研目标公司近期面经考点与在招岗位 JD。 |
| **隐私与数据安全** | 无账号、无云端上传、无任何导出水印；所有简历、图片与导出文件均保存在本机 `~/.dsh/dsh-resume/`。 |

---

## <a id="agent-tools"></a>🤖 Agent 工具清单（共 27 个）

<details open>
<summary><b>1. 简历 CRUD 与局部精修（11 个）</b></summary>

| 工具名 | 用途 |
|---|---|
| `resume_list` | 列出本地全部简历（`id`、名称、模板、更新时间） |
| `resume_new` | 基于指定内置模板创建新简历 |
| `resume_read` | 读取指定简历的 `meta` 样式配置与 Markdown 正文 |
| `resume_write` | 全量保存简历正文、名称与可选样式补丁 |
| `resume_import` | 导入外部 Markdown 文本为新简历 |
| `resume_duplicate` | 复制简历（同步拷贝头像与校徽资源） |
| `resume_delete` | 永久删除指定简历 |
| `resume_sections` | 列出按 `##` 切分的模块序号与标题 |
| `resume_move_section` | 上移或下移指定模块，调整板块顺序 |
| `resume_apply_edit` | **局部改稿（首选）**：仅替换指定模块正文，其余模块原样保留 |
| `resume_render` | 生成自包含预览 HTML 文件供自查排版 |

</details>

<details>
<summary><b>2. 版式、样式、图片与导出（8 个）</b></summary>

| 工具名 | 用途 |
|---|---|
| `resume_set_template` | 一键切换内置模板或在线模板版式配色，不改动正文 |
| `resume_set_style` | 调整主文字色 `primaryColor`、模块主色 `primaryBGColor`、字体 `fontFamily` 与行高 `lineHeight` |
| `resume_set_auto_page` | 开关「智能一页」自动缩放 |
| `resume_set_avatar` | 上传 Base64 dataURL 证件照/头像 |
| `resume_set_avatar_position` | 设置头像坐标 `(top, left)` 与形状（`square` / `circle`） |
| `resume_set_school_logo` | 上传 Base64 dataURL 校徽/Logo（支持 SVG/PNG） |
| `resume_set_school_logo_position` | 设置校徽坐标 `(top, left)` |
| `resume_export` | 导出为 `md` / `html` / `pdf` / `png` 至本地 `exports/` 目录 |

</details>

<details>
<summary><b>3. 诊断分析、模板与求职情报（8 个）</b></summary>

| 工具名 | 用途 |
|---|---|
| `resume_proofread` | 本地简历体检，输出 0–100 评分与分级改进建议 |
| `resume_match_jd` | 本地 JD 关键词覆盖率分析，输出命中词与缺失词 |
| `template_list` | 列出内置 7 套模板（`general` / `tech` / `ai_agent` / `ops` / `java` / `graduate` / `intern`） |
| `template_get` | 获取指定模板的完整示例正文与样式配置 |
| `mianjing_companies` | 查询面经库支持的公司列表及 `slug` |
| `mianjing_search` | 按公司、岗位、届别、批次检索公开面经 |
| `mianjing_detail` | 查看单条面经的完整题目与流程记录 |
| `jobs_search` | 按公司、岗位、城市、行业检索公开校招/实习岗位 |

</details>

---

## <a id="dsl"></a>📝 Resume DSL 语法速查

```markdown
### !bg[*张三 - 后端开发工程师*](#2F54EB)

138-0000-0000 ｜ career@example.com ｜ icon:github github.com/example

## !c[教育](#2F54EB)!c[背景](#6B7280)

::: start
**示例大学** `985` `211`
:::
**计算机科学与技术 · 本科**
:::
**2022.09 - 2026.06**
::: end

## !c[实习](#2F54EB)!c[经历](#6B7280)

::: start
icon:bytedance **示例公司**
:::
**基础架构组**
:::
**后端开发实习生**
:::
**2025.06 - 2025.09**
::: end

- 主导核心链路缓存重构，接口 P99 延迟从 **120ms 降至 35ms**，支撑 `10万+ QPS`
- 沉淀自动化回归方案，++端到端回归耗时缩短 60%++
```

常用语法说明：
- `!bg[文本](#hex)`：带主色背景条的标题块
- `!c[文本](#hex)`：模块标题局部着色
- `::: start ... ::: ... ::: end`：自适应多栏布局行（支持 2–4 栏）
- `` `标签` ``：技能/荣誉徽章（自动跟随主题主色）
- `icon:<name>`：内置公司/高校/技术图标（如 `icon:github`、`icon:bytedance`、`icon:alibaba`、`icon:tencent`）
- `++文本++`：下划线强调；`~~文本~~`：删除线

---

## <a id="config"></a>⚙️ 配置项与本地存储

### 插件配置

可在 DSH 插件配置中覆盖以下选项：

| 配置项 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `storageDir` | `string` | `~/.dsh/dsh-resume` | 本地简历、头像、校徽与导出目录 |
| `browserPath` | `string` | 自动探测 | 指定用于导出 PDF / PNG 的 Edge / Chrome 可执行文件路径 |
| `onlineTemplates` | `boolean` | `true` | 是否启用在线模板列表；设为 `false` 可完全离线运行（仅使用内置 7 套模板） |

### 本地存储结构

```text
~/.dsh/dsh-resume/
├── .rev                    # 变更版本号（用于工作台 3 秒轮询实时刷新）
├── .cache/tpl-css/         # 已使用在线模板的样式缓存
├── exports/                # 导出的 PDF / PNG / HTML / MD 文件
└── <resume-id>/
    ├── meta.json           # 名称、模板类型、配色/字体、头像/校徽坐标、智能一页开关
    ├── resume.md           # 简历正文（Resume DSL Markdown）
    ├── avatar.*            # 可选证件照
    └── logo.*              # 可选校徽 / Logo
```

---

## <a id="architecture"></a>📦 项目结构

```text
dsh-resume/
├── package.json            # DSH bundle 清单、Client 注入声明与导出入口
├── cordis.patch.yml        # Cordis 插件挂载补丁
├── icon.svg                # 插件图标
├── locale/                 # 中英文元数据（en.json / zh.json）
├── docs/                   # 插件详情页说明（DETAIL.md）
├── skills/resume-studio/   # 自动同步至 ~/.dsh/skills/ 的 Agent 写作技能手册
├── assets/
│   ├── templates.js        # 7 套开箱即用内置模板
│   ├── resume-layout.css   # A4 基础排版与图标配色样式
│   └── vendor/             # markdown-transform-html (MIT) 与 iconfont 字体资源
└── lib/
    ├── index.js            # Host 服务端入口：存储引擎、HTTP API、27 个 Agent 工具
    ├── client.js           # Web / Desktop 前端工作台、双模式编辑器与聊天工具卡片
    ├── fidelity.js         # 高保真 A4 渲染管线
    ├── render.js           # 轻量 DSL 片段渲染引擎（用于所见即所得编辑器）
    ├── features.js         # 模块结构解析、本地简历体检与 JD 匹配引擎
    └── exporter.js         # Edge / Chrome headless PDF/PNG 导出与裁剪
```

---

## 🤝 致谢 / Credits

- Markdown 渲染核心基于开源项目 [markdown-transform-html](https://github.com/Acmenlei/markdown-plus)（[MIT License](assets/vendor/markdown-transform-html.LICENSE)）
- 面板扩展与工具交互参考 DeepSeek Harness 官方文档及社区插件实践（[dsh-univer-office](https://github.com/dream-num/dsh-univer-office)）

## 📄 License

[MIT](LICENSE)
