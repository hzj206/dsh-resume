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

import { normalizeResumeDsl, replaceBalancedDslTag, contrastTextForHex } from './dsl.js';
import { stripDangerousHtmlBlocks, sanitizeSafeUrl, sanitizeInlineStyleAttr, normalizeCssColor } from './importer.js';

/** HTML 转义 */
function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** 行内解析（含安全 HTML 白名单 + 代码片段保护 + !bg / !c 平衡括号 + 严格 XSS 清洗） */
export function renderInline(raw) {
  const placeholders = [];
  const stash = (html) => {
    const token = `\uE000CVR${placeholders.length}\uE001`;
    placeholders.push(html);
    return token;
  };

  let s = String(raw ?? '');

  // 1. 优先保护行内反引号 `code`，防止代码里的 <script> / 符号被清洗器或 Markdown 误删
  s = s.replace(/`([^`\n]+)`/g, (_, codeText) => stash(`<code class="cv-chip">${esc(codeText)}</code>`));

  // 2. 彻底剥离高危脚本/嵌入块（<script>/<iframe>/<svg>/<style>/<object> 等）
  s = stripDangerousHtmlBlocks(s);

  // 2. 白名单过滤安全内联 HTML 标签（剥离全部 on* 与危险协议，其余未知标签转义为纯文本）
  const SAFE_SIMPLE_TAGS = new Set(['b', 'strong', 'i', 'em', 'u', 's', 'del', 'strike']);
  s = s.replace(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g, (full, slash, rawTag, attrsStr) => {
    const tag = rawTag.toLowerCase();
    const isClose = slash === '/';
    if (tag === 'br' && !isClose) return stash('<br/>');
    if (tag === 'code') return stash(isClose ? '</code>' : '<code class="cv-chip">');
    if (SAFE_SIMPLE_TAGS.has(tag)) {
      const norm = tag === 'b' ? 'strong' : tag === 'i' ? 'em' : tag === 'strike' ? 'del' : tag;
      return stash(isClose ? `</${norm}>` : `<${norm}>`);
    }
    if (tag === 'a') {
      if (isClose) return stash('</a>');
      const hm = attrsStr.match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>]+))/i);
      const href = sanitizeSafeUrl(hm ? (hm[1] ?? hm[2] ?? hm[3] ?? '') : '');
      return href ? stash(`<a href="${esc(href)}" target="_blank" rel="noreferrer">`) : '';
    }
    if (tag === 'mark' || tag === 'span') {
      if (isClose) return stash(tag === 'mark' ? '</mark>' : '</span>');
      const sm = attrsStr.match(/\bstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
      const st = sanitizeInlineStyleAttr(sm ? sm[1] : '');
      if (tag === 'mark') {
        const bg = st.background || '';
        const fg = st.color || (bg ? contrastTextForHex(bg) : '');
        const css = [bg ? `background-color:${bg}` : '', fg ? `color:${fg}` : ''].filter(Boolean).join(';');
        return stash(css ? `<span class="cv-bg" style="${css}">` : '<span class="cv-bg">');
      }
      const css = [st.color ? `color:${st.color}` : '', st.background ? `background:${st.background}` : ''].filter(Boolean).join(';');
      if (st.color) return stash(`<span class="cv-c" style="${css}">`);
      if (css) return stash(`<span style="${css}">`);
      return stash('<span>');
    }
    // 危险媒体/事件属性标签直接剥离；其余泛化尖括号文本仅单次转义输出（不直出 DOM）
    if (/\bon[a-z]+\s*=|^(?:img|form|input|button|textarea|select|meta|link|base)$/i.test(tag + ' ' + attrsStr)) {
      return '';
    }
    return stash(esc(full));
  });

  // 3. 转义剩余文本中的 HTML 特殊字符
  s = esc(s);

  // 4. ![alt](url) 内嵌图片（校对安全协议，移除内联 onerror 属性）
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, alt, src) => {
    const fixed = (src.startsWith('/') && !src.startsWith('/resume/api/')) ? 'https://www.codecvcv.com' + src : src;
    const safeSrc = sanitizeSafeUrl(fixed, { allowDataImage: true });
    if (!safeSrc) return alt;
    return stash(`<img class="cv-img" src="${safeSrc}" alt="${alt}"/>`);
  });

  // 5. !bg 与 !c 平衡括号语法
  s = replaceBalancedDslTag(s, '!bg', (t, c) => {
    if (!c) return t;
    const fg = contrastTextForHex(c);
    return `<span class="cv-bg" style="background:${c};color:${fg}">${t}</span>`;
  });
  s = replaceBalancedDslTag(s, '!c', (t, c) => (c ? `<span class="cv-c" style="color:${c}">${t}</span>` : t));

  // 6. icon:name
  s = s.replace(/icon:([a-zA-Z0-9_-]+)/g, (_, n) => stash(`<span class="cv-icon" data-icon="${n}"><i></i></span>`));

  // 7. [text](url) 链接校验安全协议（支持 URL 内含一层括号）
  s = s.replace(/\[([^\]]+)\]\(([^()\s]*(?:\([^()\s]*\)[^()\s]*)*)\)/g, (_, t, u) => {
    const safeHref = sanitizeSafeUrl(u);
    return safeHref ? `<a href="${safeHref}" target="_blank" rel="noreferrer">${t}</a>` : t;
  });

  // 8. 粗体 / 斜体 / 删除线 / 下划线（含 _em_ 与 __strong__）
  s = s.replace(/\*\*\*([^*\n]+)\*\*\*/g, '<strong><em>$1</em></strong>');
  s = s.replace(/\*\*((?:(?!\*\*).)+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/__((?:(?!__).)+?)__/g, '<strong>$1</strong>');
  s = s.replace(/~~([^~\n]+)~~/g, '<del>$1</del>');
  s = s.replace(/\+\+([^\s+](?:(?!\+\+)[^\n])*?[^\s+]|[^\s+])\+\+/g, '<u>$1</u>');
  s = s.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
  s = s.replace(/(^|[^_\w])_([^_\n]+)_(?![_\w])/g, '$1<em>$2</em>');

  // 9. 还原安全占位符（多轮还原以支持嵌套引用）
  for (let pass = 0; pass < 3 && s.includes('\uE000CVR'); pass++) {
    s = s.replace(/\uE000CVR(\d+)\uE001/g, (_, idx) => placeholders[Number(idx)] ?? '');
  }
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
  const norm = isRoot ? normalizeResumeDsl(markdown) : String(markdown ?? '');
  const lines = norm.split(/\r?\n/);
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

    // 围栏代码块 ```
    if (/^\s*`{3,}/.test(line)) {
      closeList();
      const codeLines = [];
      i++;
      while (i < lines.length && !/^\s*`{3,}/.test(lines[i])) { codeLines.push(esc(lines[i])); i++; }
      out.push(`<pre class="cv-pre"><code>${codeLines.join('\n')}</code></pre>`);
      i++;
      continue;
    }

    // 引用块 > ...
    if (/^\s*>\s?/.test(line)) {
      closeList();
      const qLines = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        qLines.push(renderInline(lines[i].replace(/^\s*>\s?/, '')));
        i++;
      }
      out.push(`<blockquote class="cv-quote">${qLines.join('<br/>')}</blockquote>`);
      continue;
    }

    // 缩进感知嵌套列表（支持 2/4 空格或 Tab 多级嵌套 ul/ol）
    const lm = line.match(/^([ \t]*)(?:([-*])|(\d+)[.、])\s+(.*)$/);
    if (lm) {
      closeList();
      const listStack = []; // [{ indent, tag, hasOpenLi }]
      const closeLevel = () => {
        const top = listStack.pop();
        if (!top) return;
        if (top.hasOpenLi) out.push('</li>');
        out.push(`</${top.tag}>`);
      };
      while (i < lines.length) {
        const mItem = lines[i].match(/^([ \t]*)(?:([-*])|(\d+)[.、])\s+(.*)$/);
        if (!mItem) break;
        const indent = mItem[1].replace(/\t/g, '  ').length;
        const tag = mItem[2] ? 'ul' : 'ol';
        const text = mItem[4];
        if (!listStack.length) {
          out.push(`<${tag} class="cv-list">`);
          listStack.push({ indent, tag, hasOpenLi: false });
        } else {
          let top = listStack[listStack.length - 1];
          if (indent > top.indent) {
            if (!top.hasOpenLi) { out.push('<li>'); top.hasOpenLi = true; }
            out.push(`<${tag} class="cv-list">`);
            listStack.push({ indent, tag, hasOpenLi: false });
          } else {
            while (listStack.length > 1 && indent < listStack[listStack.length - 1].indent) {
              closeLevel();
            }
            top = listStack[listStack.length - 1];
            if (top.tag !== tag) {
              closeLevel();
              if (listStack.length && !listStack[listStack.length - 1].hasOpenLi) {
                out.push('<li>');
                listStack[listStack.length - 1].hasOpenLi = true;
              }
              out.push(`<${tag} class="cv-list">`);
              listStack.push({ indent, tag, hasOpenLi: false });
            } else if (top.hasOpenLi) {
              out.push('</li>');
              top.hasOpenLi = false;
            }
          }
        }
        const curTop = listStack[listStack.length - 1];
        out.push(`<li>${renderInline(text)}`);
        curTop.hasOpenLi = true;
        i++;
      }
      while (listStack.length) closeLevel();
      continue;
    }

    // 普通段落（连续非空行合并）
    closeList();
    const para = [line];
    i++;
    while (i < lines.length && !blank(lines[i]) && !/^\s*(#{1,6}\s|[-*]\s|\d+[.、]\s|:::|>\s?|`{3,}|-{3,}\s*$)/.test(lines[i])) {
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
  background: ${bg}; color: ${contrastTextForHex(bg)};
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
.cv-list .cv-list { margin: 3px 0 3px 1.3em; }
.cv-list .cv-list li { list-style: circle; }
.cv-quote { border-left: 3px solid ${bg}; padding: 4px 10px; margin: 8px 0; background: ${bg}0D; }
.cv-pre { background: rgba(127,127,127,.08); padding: 8px 10px; border-radius: 4px; font-size: 11.5px; overflow-x: auto; margin: 6px 0; }
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
  .cv-row, .cv-list li, .cv-table tr, .cv-quote { break-inside: avoid; page-break-inside: avoid; }
  h2, h3, h4 { break-after: avoid; page-break-after: avoid; }
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
