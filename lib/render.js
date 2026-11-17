/**
 * 简历 DSL 渲染引擎（零依赖）。
 * Resume DSL 语法：
 *   ### !bg[*标题*](#e7f3f8)          → 带底色条的主标题
 *   ## !c[教育](#d44c47)!c[背景](#448361) → 模块标题（逐段变色）+ 开启 resume-module
 *   ::: start  A  :::  B  :::  C  ::: end → 多栏行（几栏自适应）
 *   icon:bytedance                     → 图标占位（小圆形标记）
 *   `标签`                              → 徽章 chip
 *   标准 Markdown：**加粗** / *斜体* / - 列表 / [链接](url) / --- 分隔线
 */

/** HTML 转义 */
function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** 行内解析：!bg / !c / icon: / `code` / **bold** / *em* / ~~del~~ / [link](url) / ![img](url) */
export function renderInline(raw) {
  let s = esc(raw ?? '');
  // 容错：历史版本写坏的 !c[x]() / !bg[x]() 空颜色，降级为纯文本（与 fidelity 预处理保持一致）
  s = s.replace(/!c\[([^\]]*)\]\(\s*\)/g, '$1');
  s = s.replace(/!bg\[([^\]]*)\]\(\s*\)/g, '$1');
  // ![alt](url) 内嵌图片（非本地 /resume/api/ 的相对路径补全在线资源域名）
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, alt, src) => {
    const fixed = (src.startsWith('/') && !src.startsWith('/resume/api/')) ? 'https://www.codecvcv.com' + src : src;
    return `<img class="cv-img" src="${fixed}" alt="${alt}" onerror="this.style.display='none'"/>`;
  });
  // !bg[*text*](#color) 或 !bg[text](#color)
  s = s.replace(/!bg\[([^\]]+)\]\((#[0-9a-fA-F]{3,8})\)/g, (_, t, c) => `<span class="cv-bg" style="background:${c}">${t}</span>`);
  // !c[text](#color)
  s = s.replace(/!c\[([^\]]+)\]\((#[0-9a-fA-F]{3,8})\)/g, (_, t, c) => `<span class="cv-c" style="color:${c}">${t}</span>`);
  // icon:name（图标占位：彩色圆点 + 名称）
  s = s.replace(/icon:([a-zA-Z0-9_-]+)/g, (_, n) => `<span class="cv-icon" data-icon="${n}"><i></i></span>`);
  // `code` → badge chip
  s = s.replace(/`([^`]+)`/g, (_, t) => `<code class="cv-chip">${t}</code>`);
  // [text](url)
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => `<a href="${u}" target="_blank" rel="noreferrer">${t}</a>`);
  // ***bold+em*** & **bold**
  s = s.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
  s = s.replace(/\*\*((?:(?!\*\*).)+?)\*\*/g, '<strong>$1</strong>');
  // ~~del~~
  s = s.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  // ++underline++
  s = s.replace(/\+\+([^\s+](?:(?!\+\+)[^\n])*?[^\s+]|[^\s+])\+\+/g, '<u>$1</u>');
  // *em*（不吞加粗后的星号）
  s = s.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
  return s;
}

/** 解析一行是否为空 */
const blank = (line) => /^\s*$/.test(line);

/**
 * 渲染正文 Markdown（不含文档外壳），返回 HTML 片段。
 * style: { primaryColor, primaryBGColor } 由外壳 CSS 消费。
 * isRoot: 文档根调用时，首个标题块识别为文档大标题（cv-doctitle，不吃模块样式）。
 */
export function renderBody(markdown, isRoot = true) {
  const lines = String(markdown ?? '').split(/\r?\n/);
  const out = [];
  let i = 0;
  let listOpen = null; // 'ul' | 'ol'
  let firstHeadingSeen = false;

  const closeList = () => { if (listOpen) { out.push(`</${listOpen}>`); listOpen = null; } };

  while (i < lines.length) {
    const line = lines[i];

    if (blank(line)) { closeList(); i++; continue; }

    // ::: 多栏块
    if (/^\s*:::\s*start\s*$/.test(line)) {
      closeList();
      const cells = [];
      let cur = [];
      i++;
      while (i < lines.length && !/^\s*:::\s*end\s*$/.test(lines[i])) {
        if (/^\s*:::\s*$/.test(lines[i])) { cells.push(cur); cur = []; i++; continue; }
        cur.push(lines[i]); i++;
      }
      cells.push(cur.filter((c) => !blank(c)));
      const valid = cells.filter((c) => c.length > 0);
      if (valid.length > 0) {
        out.push(`<div class="cv-row cols-${valid.length}">`);
        for (const cell of valid) {
          const cellHtml = cell.map((l) => {
            const t = l.trim();
            // 单元格内支持标题语法（真实模板的头像行/名字行常用）
            const hm = t.match(/^(#{1,6})\s+(.*)$/);
            if (hm) {
              const cls = hm[1].length <= 3 ? 'cv-cell-h cv-cell-h-big' : 'cv-cell-h';
              return `<div class="${cls}">${renderInline(hm[2])}</div>`;
            }
            return `<div class="cv-cell-line">${renderInline(t)}</div>`;
          }).join('');
          out.push(`<div class="cv-cell">${cellHtml}</div>`);
        }
        out.push('</div>');
      }
      i++; // skip ::: end
      continue;
    }

    // 标题
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      closeList();
      const level = h[1].length;
      const inner = renderInline(h[2]);
      if (level <= 2) {
        // 文档首个 h1/h2 = 大标题（姓名/文档名），套 cv-doctitle 而非模块样式
        if (isRoot && !firstHeadingSeen) {
          firstHeadingSeen = true;
          out.push(`<h2 class="cv-doctitle">${inner}</h2>`);
          i++;
          continue;
        }
        // h1/h2 开启新模块
        out.push(`<section class="cv-module"><h2 class="cv-module-title">${inner}</h2>`);
        // 找到下一个同级模块边界：简单策略——模块持续到下一个 h1/h2 或文末
        const rest = [];
        let j = i + 1;
        while (j < lines.length) {
          const m2 = lines[j].match(/^(#{1,2})\s+/);
          if (m2) break;
          rest.push(lines[j]); j++;
        }
        out.push(renderBody(rest.join('\n'), false));
        out.push('</section>');
        i = j;
        continue;
      }
      if (isRoot && !firstHeadingSeen) firstHeadingSeen = true;
      if (level === 3) out.push(`<h3 class="cv-title">${inner}</h3>`);
      else out.push(`<h4 class="cv-subtitle">${inner}</h4>`);
      i++;
      continue;
    }

    // 表格（GFM）：| a | b |  +  | --- | :---: |  +  数据行
    if (/^\s*\|.*\|\s*$/.test(line)) {
      const rows = [];
      let j = i;
      while (j < lines.length && /^\s*\|.*\|\s*$/.test(lines[j])) { rows.push(lines[j]); j++; }
      const isSep = (r) => /^\s*\|[\s:|-]+\|\s*$/.test(r) && /-/.test(r);
      if (rows.length >= 2 && isSep(rows[1])) {
        closeList();
        const splitRow = (r) => r.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
        const alignOf = (c) => {
          const l = c.startsWith(':'), rt = c.endsWith(':');
          return l && rt ? 'center' : rt ? 'right' : l ? 'left' : '';
        };
        const header = splitRow(rows[0]);
        const aligns = splitRow(rows[1]).map(alignOf);
        const attr = (k) => (aligns[k] ? ` style="text-align:${aligns[k]}"` : '');
        const html = ['<table class="cv-table"><thead><tr>'];
        header.forEach((c, k) => html.push(`<th${attr(k)}>${renderInline(c)}</th>`));
        html.push('</tr></thead><tbody>');
        for (let k = 2; k < rows.length; k++) {
          const cells = splitRow(rows[k]);
          html.push('<tr>');
          for (let x = 0; x < header.length; x++) html.push(`<td${attr(x)}>${renderInline(cells[x] || '')}</td>`);
          html.push('</tr>');
        }
        html.push('</tbody></table>');
        out.push(html.join(''));
        i = j;
        continue;
      }
    }

    // 分隔线：--- / *** / ___
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { closeList(); out.push('<hr class="cv-hr"/>'); i++; continue; }

    // 列表
    const ul = line.match(/^\s*[-*]\s+(.*)$/);
    const ol = line.match(/^\s*\d+[.、]\s+(.*)$/);
    if (ul || ol) {
      const want = ul ? 'ul' : 'ol';
      if (listOpen !== want) { closeList(); out.push(`<${want} class="cv-list">`); listOpen = want; }
      out.push(`<li>${renderInline((ul || ol)[1])}</li>`);
      i++;
      continue;
    }

    // 普通段落（连续非空行合并）
    closeList();
    const para = [line];
    i++;
    while (i < lines.length && !blank(lines[i]) && !/^\s*(#{1,6}\s|[-*]\s|\d+[.、]\s|:::|-{3,}\s*$)/.test(lines[i])) {
      para.push(lines[i]); i++;
    }
    out.push(`<p class="cv-p">${renderInline(para.join(' ').trim())}</p>`);
  }
  closeList();
  return out.join('\n');
}

/** 外壳 CSS：A4 版式（794px），主题色与视觉主题变体由 style 注入 */
export function shellCss(style = {}) {
  const primary = style.primaryColor || '#333333';
  const bg = style.primaryBGColor || '#545454';
  const font = style.fontFamily || "'Noto Sans SC', 'Microsoft YaHei', sans-serif";
  const titleStyle = style.titleStyle || 'color';
  const headerAlign = style.headerAlign || 'left';

  // 模块标题三种视觉变体
  let titleCss = `.cv-module-title { border-bottom: 2px solid ${bg}; }`;
  if (titleStyle === 'plain') {
    titleCss = `.cv-module-title { color: inherit; border-bottom: 1px solid rgba(127,127,127,.4); }`;
  } else if (titleStyle === 'band') {
    titleCss = `.cv-module-title { background: ${bg}; color: #fff; padding: 4px 12px; border-radius: 3px; border: none; display: inline-block; }`;
  }

  // 头部布局：居中模板（45 等）大标题与联系行居中
  const headerCss = headerAlign === 'center'
    ? `.cv-doctitle { text-align: center; } .cv-doctitle + .cv-p { text-align: center; }`
    : '';

  return `
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: ${font};
  color: ${primary};
  background: #e8eaed;
  display: flex; justify-content: center;
  padding: 24px 0 48px;
  -webkit-font-smoothing: antialiased;
}
.cv-page {
  width: 794px; min-height: 1123px;
  background: #fff;
  box-shadow: 0 2px 16px rgba(0,0,0,.12);
  padding: 46px 52px;
  font-size: 13px;
  line-height: ${style.lineHeight || 20}px;
  position: relative;
}
.cv-avatar { position: absolute; object-fit: cover; }
.cv-avatar.square { border-radius: 6px; }
.cv-avatar.circle { border-radius: 50%; }
.cv-logo { position: absolute; object-fit: contain; opacity: .92; }
.cv-page.fit-done { overflow: hidden; }
.cv-doctitle { font-size: 21px; font-weight: 700; margin-bottom: 8px; letter-spacing: .5px; }
${headerCss}
.cv-title-band { font-size: 19px; font-weight: 700; margin-bottom: 6px; }
.cv-bg {
  background: ${bg}; color: #fff;
  padding: 5px 16px; display: inline-block;
  border-radius: 3px;
}
.cv-page h3.cv-title {
  font-size: 19px; font-weight: 700; margin-bottom: 6px;
}
.cv-page h3.cv-title .cv-bg em { font-style: normal; }
h4.cv-subtitle { font-size: 14px; font-weight: 700; margin: 10px 0 4px; }
.cv-img { max-width: 100px; max-height: 130px; vertical-align: middle; border-radius: 4px; }
.cv-module { margin-top: 18px; }
.cv-module-title {
  font-size: 16px; font-weight: 800; letter-spacing: 1px;
  padding-bottom: 6px; margin-bottom: 10px;
}
${titleCss}
.cv-c { font-weight: 800; }
.cv-row { display: flex; gap: 12px; align-items: baseline; margin: 8px 0 4px; }
.cv-row.cols-2 .cv-cell { flex: 1; }
.cv-row.cols-3 .cv-cell { flex: 1; }
.cv-row.cols-4 .cv-cell { flex: 1; }
.cv-cell-line { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cv-cell-h { font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cv-cell-h-big { font-size: 17px; }
.cv-chip {
  display: inline-block; font-size: 11px; line-height: 1;
  padding: 3px 8px; margin: 0 2px;
  background: ${bg}14; color: ${bg};
  border: 1px solid ${bg}55; border-radius: 4px;
  font-family: inherit; font-style: normal;
}
.cv-icon { display: inline-block; width: 16px; height: 16px; vertical-align: -3px; margin-right: 5px; position: relative; }
.cv-icon i {
  position: absolute; inset: 1px;
  background: ${bg}; border-radius: 50%;
  display: inline-block;
}
.cv-list { margin: 6px 0 6px 1.4em; }
.cv-list li { margin: 4px 0; list-style: disc; }
ol.cv-list li { list-style: decimal; }
.cv-p { margin: 6px 0; }
.cv-hr { border: none; border-top: 1px dashed #ccc; margin: 12px 0; }
.cv-table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 12px; }
.cv-table th, .cv-table td { border: 1px solid rgba(127,127,127,.35); padding: 4px 8px; }
.cv-table th { font-weight: 700; background: ${bg}14; }
a { color: ${bg}; text-decoration: none; }
strong { font-weight: 700; }
@media print {
  body { padding: 0; background: #fff; display: block; width: 794px; margin: 0; }
  .cv-page { box-shadow: none; width: 794px; min-height: auto; }
}
@page { size: A4; margin: 0; }
`;
}

/** 净版模式（导出/截图用）的附加 CSS：去边距、锁定 794、左对齐 */
export const PRINT_MODE_CSS = `
html, body { width: 794px !important; margin: 0 !important; padding: 0 !important; display: block !important; background: #fff !important; }
.cv-page { box-shadow: none !important; margin: 0 !important; }
`;

/** 渲染完整可预览 HTML 文档。
 * opts:
 *   avatarSrc  头像图片地址（已有头像文件时由 /preview 路由传入）
 *   interactive 允许在预览里拖拽头像（postMessage 回报坐标），导出时不启用
 *   printMode   导出/截图模式：去掉页边距与阴影，输出纯净 A4
 */
export function renderDocument(markdown, style = {}, title = '简历', opts = {}) {
  // opts.avatar:      { top, left, type, w?, h?, src }
  // opts.schoolLogo:  { top, left, w?, h?, src }
  // opts.autoFit:     智能一页：内容超出一页时自动缩放至 1123px 高
  // opts.printMode / opts.interactive
  const avatar = opts.avatar;
  let avatarHtml = '';
  if (avatar && avatar.src) {
    const cls = avatar.type === 'circle' ? 'circle' : 'square';
    avatarHtml = `<img class="cv-avatar ${cls}" src="${avatar.src}" style="top:${avatar.top ?? 14}px;left:${avatar.left ?? 666}px;width:${avatar.w || 96}px;height:${avatar.h || 120}px" draggable="false"/>`;
  }
  const logo = opts.schoolLogo;
  let logoHtml = '';
  if (logo && logo.src) {
    logoHtml = `<img class="cv-logo" src="${logo.src}" style="top:${logo.top ?? 46}px;left:${logo.left ?? 52}px;width:${logo.w || 44}px;height:${logo.h || 44}px" draggable="false"/>`;
  }
  const bodyStyle = opts.printMode ? ' style="padding:0;background:#fff"' : '';
  const pageCss = opts.printMode
    ? `\nbody { padding: 0 !important; background: #fff !important; display: block !important; width: 794px !important; margin: 0 !important; }\n.cv-page { box-shadow: none !important; margin: 0 !important; }\n`
    : '';
  const interactiveScript = (opts.interactive && (avatarHtml || logoHtml)) ? `
<script>
(function () {
  function dragEl(sel, topic, maxX, maxY) {
    var img = document.querySelector(sel);
    if (!img) return;
    img.style.cursor = 'move';
    var dragging = false, sx = 0, sy = 0, ox = 0, oy = 0;
    img.addEventListener('mousedown', function (e) {
      dragging = true; sx = e.clientX; sy = e.clientY;
      ox = parseInt(img.style.left, 10); oy = parseInt(img.style.top, 10);
      e.preventDefault();
    });
    window.addEventListener('mousemove', function (e) {
      if (!dragging) return;
      img.style.left = Math.max(0, Math.min(maxX, ox + e.clientX - sx)) + 'px';
      img.style.top = Math.max(0, Math.min(maxY, oy + e.clientY - sy)) + 'px';
    });
    window.addEventListener('mouseup', function () {
      if (!dragging) return;
      dragging = false;
      window.parent.postMessage({ type: topic, top: parseInt(img.style.top, 10), left: parseInt(img.style.left, 10) }, '*');
    });
  }
  dragEl('.cv-avatar', 'cvr-avatar-move', 760, 1050);
  dragEl('.cv-logo', 'cvr-logo-move', 700, 1060);
})();
</script>` : '';
  const autoFitScript = opts.autoFit ? `
<script>
(function () {
  function fit() {
    var page = document.querySelector('.cv-page');
    if (!page) return;
    var h = page.scrollHeight;
    if (h > 1123) {
      var s = 1123 / h;
      page.style.zoom = s;
      page.style.width = (794 / s) + 'px';
      page.classList.add('fit-done');
    }
  }
  if (document.readyState === 'complete') fit();
  else window.addEventListener('load', fit);
})();
</script>` : '';
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8"/>
<title>${esc(title)}</title>
<style>${shellCss(style)}${pageCss}</style>
</head>
<body${bodyStyle}>
<div class="cv-page">
${avatarHtml}
${logoHtml}
${renderBody(markdown)}
</div>
${interactiveScript}
${autoFitScript}
</body>
</html>`;
}
