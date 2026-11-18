/**
 * 外部简历导入解析与安全清洗器（零依赖）
 *
 * 支持：
 * 1. Markdown / 纯文本：去 BOM、统一换行、提取 YAML frontmatter 样式、自动提取文内 `!c`/`!bg` 主色；
 * 2. 本插件导出的自包含 HTML：无损提取 `--markdown-primary-bg-color` 等主题样式 + 正文转回 Resume DSL；
 * 3. 通用外部 HTML：严格剥离 `<script>`/`<style>`/`<iframe>`/`on*`/`javascript:` 后，提取语义排版转为 Resume DSL。
 */
import { normalizeResumeDsl, hexLuminance } from './dsl.js';

const DEFAULT_IMPORT_STYLE = {
  primaryColor: '#333333',
  primaryBGColor: '#2B5B84',
  fontFamily: "Noto Sans SC, 'Microsoft YaHei', sans-serif",
  lineHeight: 20,
  titleStyle: 'color',
  headerAlign: 'left',
};

/** 将 rgb(...) / #hex 归一化为 #rrggbb */
export function normalizeCssColor(raw) {
  const s = String(raw || '').trim();
  const hex = s.match(/#[0-9a-fA-F]{3,8}/);
  if (hex) {
    const h = hex[0];
    if (h.length === 4) return `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`.toLowerCase();
    if (h.length === 7 || h.length === 9) return h.slice(0, 7).toLowerCase();
    return h.toLowerCase();
  }
  const rgb = s.match(/rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i);
  if (rgb) {
    const toHex = (n) => Math.max(0, Math.min(255, Number(n))).toString(16).padStart(2, '0');
    return `#${toHex(rgb[1])}${toHex(rgb[2])}${toHex(rgb[3])}`;
  }
  return '';
}

/** 校验并清洗 URL：只允许安全协议，拦截 javascript:/vbscript:/data:text 等 */
export function sanitizeSafeUrl(raw, { allowDataImage = false } = {}) {
  const s = String(raw ?? '').replace(/[\u0000-\u0020\u007f]/g, '').trim();
  if (!s) return '';
  if (s.startsWith('#') || s.startsWith('/resume/api/')) return s;
  if (s.startsWith('/')) return s;
  if (/^https?:\/\//i.test(s) || /^mailto:/i.test(s)) return s;
  if (allowDataImage && /^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/i.test(s)) return s;
  return '';
}

/** 剥离所有高危脚本/样式/嵌入容器块 */
export function stripDangerousHtmlBlocks(html) {
  return String(html ?? '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|iframe|object|embed|svg|noscript|form|template)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<(script|style|iframe|object|embed|svg|link|meta|base|input|textarea|button)\b[^>]*\/?>/gi, '');
}

/** 解析 HTML 标签属性（轻量安全解析器） */
function parseTagAttrs(attrStr) {
  const attrs = {};
  const re = /([a-zA-Z_:][a-zA-Z0-9_.:-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let m;
  while ((m = re.exec(String(attrStr || ''))) !== null) {
    const key = m[1].toLowerCase();
    if (key.startsWith('on')) continue; // 彻底剥离 on* 事件
    attrs[key] = decodeHtmlEntities(m[2] ?? m[3] ?? m[4] ?? '');
  }
  return attrs;
}

function decodeHtmlEntities(s) {
  return String(s ?? '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&amp;/gi, '&');
}

/**
 * 仅允许安全白名单内联 HTML（用于 render.js 放开基础内联标签时防 XSS）。
 * 返回安全片段，支持保留 <b>/<strong>/<i>/<em>/<u>/<s>/<del>/<br>/<code>/<mark>/<span style="color...">/<a href="...">。
 */
export function sanitizeInlineStyleAttr(styleStr) {
  const out = {};
  for (const decl of String(styleStr || '').split(';')) {
    const colon = decl.indexOf(':');
    if (colon < 0) continue;
    const prop = decl.slice(0, colon).trim().toLowerCase();
    const val = decl.slice(colon + 1).trim();
    if (!val || /url\s*\(|expression\s*\(|javascript:/i.test(val)) continue;
    if (prop === 'color' || prop === 'background-color' || prop === 'background') {
      const hex = normalizeCssColor(val);
      if (hex) out[prop === 'color' ? 'color' : 'background'] = hex;
    } else if (prop === 'font-weight' && (/^(bold|bolder|[6-9]\d\d)$/i.test(val))) {
      out.bold = true;
    } else if (prop === 'font-style' && /^italic$/i.test(val)) {
      out.italic = true;
    } else if (prop === 'text-decoration' || prop === 'text-decoration-line') {
      if (/underline/i.test(val)) out.underline = true;
      if (/line-through/i.test(val)) out.strike = true;
    }
  }
  return out;
}

const VOID_TAGS = new Set(['br', 'hr', 'img', 'meta', 'link', 'input']);
const CONTAINER_TAGS = new Set([
  'html', 'body', 'main', 'article', 'section', 'header', 'footer', 'div', 'p',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'pre',
  'hr', 'br', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'b', 'strong', 'i', 'em', 'u', 's', 'del', 'strike', 'code', 'mark', 'span', 'a',
]);

/** 把安全洗净后的 HTML 解析成轻量 AST（不依赖 jsdom） */
function parseHtmlToAst(rawHtml) {
  const clean = stripDangerousHtmlBlocks(rawHtml);
  const root = { tag: 'root', attrs: {}, children: [] };
  const stack = [root];
  const tokenRe = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>|([^<]+)/g;
  let m;

  while ((m = tokenRe.exec(clean)) !== null) {
    const parent = stack[stack.length - 1];
    if (m[4] !== undefined) {
      const txt = decodeHtmlEntities(m[4]);
      if (txt) parent.children.push({ text: txt });
      continue;
    }
    const isClose = m[1] === '/';
    const tag = m[2].toLowerCase();
    const attrsStr = m[3] || '';
    const selfClose = /\/\s*$/.test(attrsStr) || VOID_TAGS.has(tag);

    if (isClose) {
      for (let k = stack.length - 1; k >= 1; k--) {
        if (stack[k].tag === tag) {
          stack.length = k;
          break;
        }
      }
      continue;
    }

    const attrs = parseTagAttrs(attrsStr);
    // 非容器/非识别标签仅作透明节点处理，防止结构异常
    if (!CONTAINER_TAGS.has(tag)) continue;

    const node = { tag, attrs, children: [] };
    parent.children.push(node);
    if (!selfClose) stack.push(node);
  }
  return root;
}

function hasClass(node, cls) {
  return String(node?.attrs?.class || '').split(/\s+/).includes(cls);
}

function collectAstInline(node) {
  if (!node) return '';
  if (typeof node.text === 'string') return node.text;
  const tag = node.tag;
  if (tag === 'br') return ' ';
  if (tag === 'img') {
    const src = sanitizeSafeUrl(node.attrs?.src || '', { allowDataImage: true });
    if (!src) return '';
    return `![${node.attrs?.alt || ''}](${src})`;
  }
  if (tag === 'i' && hasClass(node, 'iconfont')) {
    const iconCls = String(node.attrs?.class || '').split(/\s+/).find((c) => c.startsWith('icon-'));
    if (iconCls) return `icon:${iconCls.slice(5)} `;
  }
  if (hasClass(node, 'cv-icon')) {
    return `icon:${node.attrs?.['data-icon'] || 'dot'} `;
  }

  const inner = (node.children || []).map(collectAstInline).join('');
  if (tag === 'code') return inner.trim() ? '`' + inner.trim() + '`' : '';
  if (tag === 'b' || tag === 'strong') return inner.trim() ? `**${inner}**` : inner;
  if (tag === 'i' || tag === 'em') return inner.trim() ? `*${inner}*` : inner;
  if (tag === 'u') return inner.trim() ? `++${inner}++` : inner;
  if (tag === 's' || tag === 'del' || tag === 'strike') return inner.trim() ? `~~${inner}~~` : inner;
  if (tag === 'a') {
    const href = sanitizeSafeUrl(node.attrs?.href || '');
    return href ? `[${inner || href}](${href})` : inner;
  }
  if (tag === 'mark' || hasClass(node, 'cv-bg')) {
    const st = sanitizeInlineStyleAttr(node.attrs?.style);
    const bg = st.background || normalizeCssColor(node.attrs?.['data-bg']);
    return bg && inner ? `!bg[${inner}](${bg})` : inner;
  }
  if (tag === 'span') {
    const st = sanitizeInlineStyleAttr(node.attrs?.style);
    const col = st.color || normalizeCssColor(node.attrs?.['data-color']);
    let res = inner;
    if (st.bold && res.trim()) res = `**${res}**`;
    if (st.italic && res.trim()) res = `*${res}*`;
    if (col && res.trim()) res = `!c[${res}](${col})`;
    if (st.background && res.trim()) res = `!bg[${res}](${st.background})`;
    return res;
  }
  return inner;
}

const BLOCK_AST_TAGS = new Set([
  'root', 'html', 'body', 'main', 'article', 'section', 'header', 'footer', 'div', 'p',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'pre', 'table', 'hr',
]);

function astToMarkdown(root) {
  const lines = [];

  const walkList = (listNode, depth = 0) => {
    const marker = listNode.tag === 'ol' ? '1. ' : '- ';
    const pad = '  '.repeat(depth);
    for (const li of listNode.children || []) {
      if (li.tag !== 'li') continue;
      const inlineNodes = [];
      const childLists = [];
      for (const ch of li.children || []) {
        if (ch.tag === 'ul' || ch.tag === 'ol') childLists.push(ch);
        else inlineNodes.push(ch);
      }
      const txt = inlineNodes.map(collectAstInline).join('').replace(/\s+/g, ' ').trim();
      if (txt) lines.push(pad + marker + txt);
      for (const sub of childLists) walkList(sub, depth + 1);
    }
  };

  const walkBlock = (node) => {
    if (!node) return;
    if (typeof node.text === 'string') {
      const t = node.text.replace(/\s+/g, ' ').trim();
      if (t) lines.push('', t, '');
      return;
    }
    const tag = node.tag;
    if (hasClass(node, 'cvr-page-guides') || hasClass(node, 'cv-avatar') || hasClass(node, 'cv-logo')) return;

    if (tag === 'h1' || hasClass(node, 'cv-doctitle')) {
      const t = (node.children || []).map(collectAstInline).join('').trim();
      if (t) lines.push('', `# ${t}`, '');
      return;
    }
    if (tag === 'h2') {
      const t = (node.children || []).map(collectAstInline).join('').trim();
      if (t) lines.push('', `## ${t}`, '');
      return;
    }
    if (/^h[3-6]$/.test(tag)) {
      const level = Number(tag[1]);
      const t = (node.children || []).map(collectAstInline).join('').trim();
      if (t) lines.push('', `${'#'.repeat(level)} ${t}`, '');
      return;
    }
    if (hasClass(node, 'flex-layout') || hasClass(node, 'cv-row')) {
      const cells = (node.children || []).filter((c) => hasClass(c, 'flex-layout-item') || hasClass(c, 'cv-cell'));
      const cellTexts = cells.map((cell) => {
        const subLines = [];
        const walkCell = (cn) => {
          if (typeof cn.text === 'string') {
            const t = cn.text.trim();
            if (t) subLines.push(t);
            return;
          }
          if (cn.tag === 'ul' || cn.tag === 'ol') {
            for (const li of cn.children || []) {
              if (li.tag === 'li') {
                const lt = (li.children || []).map(collectAstInline).join('').trim();
                if (lt) subLines.push((cn.tag === 'ol' ? '1. ' : '- ') + lt);
              }
            }
            return;
          }
          if (/^h[1-6]$/.test(cn.tag) || hasClass(cn, 'cv-cell-h') || hasClass(cn, 'cv-cell-h-big')) {
            const t = (cn.children || []).map(collectAstInline).join('').trim();
            if (t) subLines.push(`### ${t}`);
            return;
          }
          if ((cn.tag === 'div' || cn.tag === 'p') && (cn.children || []).some((ch) => ch.tag && ['div', 'p', 'ul', 'ol', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(ch.tag))) {
            for (const ch of cn.children || []) walkCell(ch);
            return;
          }
          const t = (cn.children || []).map(collectAstInline).join('').replace(/\s+/g, ' ').trim();
          if (t) subLines.push(t);
        };
        for (const ch of cell.children || []) walkCell(ch);
        return subLines.join('\n');
      }).filter(Boolean);
      if (cellTexts.length) {
        lines.push('', '::: start', cellTexts.join('\n:::\n'), '::: end', '');
      }
      return;
    }
    if (tag === 'ul' || tag === 'ol') {
      lines.push('');
      walkList(node, 0);
      lines.push('');
      return;
    }
    if (tag === 'blockquote') {
      const t = (node.children || []).map(collectAstInline).join('').trim();
      if (t) {
        lines.push('');
        t.split('\n').forEach((ln) => lines.push(`> ${ln.trim()}`));
        lines.push('');
      }
      return;
    }
    if (tag === 'hr') { lines.push('', '---', ''); return; }
    if (tag === 'table') {
      const trs = [];
      const findTrs = (n) => {
        for (const c of n.children || []) {
          if (c.tag === 'tr') trs.push(c);
          else if (c.tag) findTrs(c);
        }
      };
      findTrs(node);
      if (trs.length) {
        const rowCells = trs.map((tr) => (tr.children || [])
          .filter((c) => c.tag === 'th' || c.tag === 'td')
          .map((c) => (c.children || []).map(collectAstInline).join('').replace(/\s+/g, ' ').trim().replace(/\|/g, '\\|')));
        const header = rowCells[0] || [];
        if (header.length) {
          lines.push('', '| ' + header.join(' | ') + ' |');
          lines.push('| ' + header.map(() => '---').join(' | ') + ' |');
          for (let r = 1; r < rowCells.length; r++) {
            const cells = rowCells[r];
            while (cells.length < header.length) cells.push('');
            lines.push('| ' + cells.slice(0, header.length).join(' | ') + ' |');
          }
          lines.push('');
        }
      }
      return;
    }
    if (tag === 'p' || hasClass(node, 'cv-p')) {
      const hasNestedBlock = (node.children || []).some((c) => c.tag && ['ul', 'ol', 'div', 'table', 'blockquote'].includes(c.tag));
      if (!hasNestedBlock) {
        const t = (node.children || []).map(collectAstInline).join('').replace(/\s+/g, ' ').trim();
        if (t) lines.push('', t, '');
        return;
      }
    }

    // 容器标签：按子节点顺序混合文本与块级
    let inlineBuf = [];
    const flushBuf = () => {
      if (!inlineBuf.length) return;
      const t = inlineBuf.map(collectAstInline).join('').replace(/\s+/g, ' ').trim();
      inlineBuf = [];
      if (t) lines.push('', t, '');
    };
    for (const ch of node.children || []) {
      if (ch.tag && BLOCK_AST_TAGS.has(ch.tag) && !['b', 'strong', 'i', 'em', 'u', 's', 'del', 'code', 'mark', 'span', 'a'].includes(ch.tag)) {
        flushBuf();
        walkBlock(ch);
      } else {
        inlineBuf.push(ch);
      }
    }
    flushBuf();
  };

  walkBlock(root);
  return normalizeResumeDsl(lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n');
}

/** 从 dsh-resume HTML 中抽取 <style> 主题变量与 <title> */
function extractStyleFromHtml(rawHtml) {
  const style = { ...DEFAULT_IMPORT_STYLE };
  const styles = (String(rawHtml || '').match(/<style[^>]*>[\s\S]*?<\/style>/gi) || []).join('\n');
  const bgMatch = styles.match(/--markdown-primary-bg-color:\s*([^;}\n]+)/i);
  const fgMatch = styles.match(/--markdown-primary-color:\s*([^;}\n]+)/i);
  const lhMatch = styles.match(/\.markdown-transform-html\s*\*\s*\{\s*line-height:\s*(\d+)px/i);
  const fontMatch = styles.match(/\.jufe\s*\*\s*\{\s*font-family:\s*([^;}\n]+)/i);
  const titleAlign = /(?:\.cv-doctitle|\.markdown-transform-html\s+h1)\s*\{[^}]*text-align:\s*center/i.test(styles);

  if (bgMatch) {
    const c = normalizeCssColor(bgMatch[1]);
    if (c) style.primaryBGColor = c;
  }
  if (fgMatch) {
    const c = normalizeCssColor(fgMatch[1]);
    if (c) style.primaryColor = c;
  }
  if (lhMatch) style.lineHeight = Math.max(14, Math.min(36, Number(lhMatch[1]) || 20));
  if (fontMatch && fontMatch[1].trim()) style.fontFamily = fontMatch[1].trim();
  if (titleAlign) style.headerAlign = 'center';

  const titleTag = String(rawHtml || '').match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const htmlTitle = titleTag ? decodeHtmlEntities(titleTag[1]).trim() : '';
  return { style, htmlTitle };
}

/** 从 Markdown YAML frontmatter 中提取元信息与样式 */
function extractFrontmatter(rawText) {
  const s = String(rawText ?? '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const m = s.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) return { meta: {}, body: s };
  const yaml = m[1];
  const body = m[2];
  // 只有看起来像 key: value 的配置才当 frontmatter，避免误杀正文顶部的分隔线
  const lines = yaml.split('\n').filter((l) => l.trim() && !l.trim().startsWith('#'));
  if (!lines.length || !lines.every((l) => /^[a-zA-Z0-9_-]+\s*:/.test(l.trim()))) {
    return { meta: {}, body: s };
  }
  const meta = {};
  for (const l of lines) {
    const idx = l.indexOf(':');
    const k = l.slice(0, idx).trim();
    const v = l.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
    meta[k] = v;
  }
  return { meta, body };
}

/** 从正文中嗅探 !c[...](#hex) 或 !bg[...](#hex) 作为主题主色（跳过极浅背景） */
function inferAccentFromContent(md) {
  const matches = [...String(md || '').matchAll(/!(?:c|bg)\[[^\]]+\]\((#[0-9a-fA-F]{3,8})\)/g)];
  for (const m of matches) {
    const hex = normalizeCssColor(m[1]);
    if (hex && hexLuminance(hex) < 0.72) return hex;
  }
  return '';
}

function findContentRootHtml(rawHtml) {
  const s = String(rawHtml ?? '');
  const openMatch = s.match(/<div\b[^>]*class="[^"]*markdown-transform-html[^"]*"[^>]*>/i);
  if (openMatch && openMatch.index !== undefined) {
    const contentStart = openMatch.index + openMatch[0].length;
    const divRe = /<\/?div\b[^>]*>/gi;
    divRe.lastIndex = contentStart;
    let depth = 1;
    let m;
    while ((m = divRe.exec(s)) !== null) {
      if (m[0].startsWith('</')) depth--;
      else if (!/\/\s*>$/.test(m[0])) depth++;
      if (depth === 0) return s.slice(contentStart, m.index);
    }
  }
  const m2 = s.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (m2) return m2[1];
  return s;
}

/**
 * 统一导入入口：接收外部 .md / .txt / .html / .htm / .json 内容，返回 { content, name?, style }。
 */
export function parseImportedResume({ rawText, filename = '', baseStyle = null, explicitStyle = null } = {}) {
  let text = String(rawText ?? '').replace(/^\uFEFF/, '');
  let derivedName = '';
  let jsonStyle = null;

  // 若是 JSON 导出格式
  const trimmed = text.trim();
  if (trimmed.startsWith('{')) {
    try {
      const j = JSON.parse(trimmed);
      if (j && typeof j.content === 'string') {
        text = j.content;
        if (typeof j.name === 'string' && j.name.trim()) derivedName = j.name.trim();
        if (j.style && typeof j.style === 'object') jsonStyle = j.style;
      }
    } catch { /* 按普通文本处理 */ }
  }

  const lowerName = String(filename || '').toLowerCase();
  const looksHtml = /\.html?$/.test(lowerName)
    || /^\s*(?:<!doctype\s+html|<html[\s>]|<body[\s>]|<div\s+class="(?:markdown-transform-html|cv-page))/i.test(text);

  if (looksHtml) {
    const { style: htmlStyle, htmlTitle } = extractStyleFromHtml(text);
    const bodySlice = findContentRootHtml(text);
    const ast = parseHtmlToAst(bodySlice);
    const md = astToMarkdown(ast);
    const style = {
      ...DEFAULT_IMPORT_STYLE,
      ...htmlStyle,
      ...(baseStyle || {}),
      ...(jsonStyle || {}),
      ...(explicitStyle || {}),
    };
    const accent = inferAccentFromContent(md);
    if (!explicitStyle && !baseStyle && accent && style.primaryBGColor === DEFAULT_IMPORT_STYLE.primaryBGColor) {
      style.primaryBGColor = accent;
    }
    return {
      content: md,
      name: derivedName || htmlTitle || '',
      style,
      detectedFormat: 'html',
    };
  }

  // Markdown / TXT 路径
  const { meta: fm, body } = extractFrontmatter(text);
  const content = normalizeResumeDsl(body);
  const fmStyle = {};
  if (fm.primaryColor) { const c = normalizeCssColor(fm.primaryColor); if (c) fmStyle.primaryColor = c; }
  if (fm.primaryBGColor) { const c = normalizeCssColor(fm.primaryBGColor); if (c) fmStyle.primaryBGColor = c; }
  if (fm.fontFamily) fmStyle.fontFamily = fm.fontFamily;
  if (fm.lineHeight && Number(fm.lineHeight)) fmStyle.lineHeight = Number(fm.lineHeight);
  if (fm.titleStyle) fmStyle.titleStyle = fm.titleStyle;
  if (fm.headerAlign) fmStyle.headerAlign = fm.headerAlign;

  const inferredAccent = inferAccentFromContent(content);
  const style = {
    ...DEFAULT_IMPORT_STYLE,
    ...(inferredAccent ? { primaryBGColor: inferredAccent } : {}),
    ...(baseStyle || {}),
    ...fmStyle,
    ...(jsonStyle || {}),
    ...(explicitStyle || {}),
  };

  return {
    content,
    name: derivedName || fm.name || fm.title || '',
    style,
    detectedFormat: 'markdown',
  };
}
