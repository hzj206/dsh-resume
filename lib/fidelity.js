/**
 * A4 高保真排版渲染管线 v2
 *
 * 渲染流程：createMarkdownRenderer({xss:false})
 *   + applyResumeDialectPlugins（引擎内置）
 *   + 图片尺寸规则（![alt (WxH)](url) / ![alt (N%)](url)）
 *   + data-md-line 行标记注入（core ruler，考虑 head/main 容器偏移）
 *   + svgMap（用户自定义 svg logo）
 *   → render → br/空白清理 → resume-module 模块包裹（main-layout 容器内）
 *   → 外层 .markdown-transform-html.jufe.reference-dom + 排版 CSS + iconfont + 运行时字体/行高/配色变量
 */
import nodeFs from 'node:fs';
import nodePath from 'node:path';
import { fileURLToPath } from 'node:url';

// 内置渲染引擎：markdown-transform-html v2（MIT License，自包含 ESM）
const ENGINE_URL = new URL('../assets/vendor/markdown-transform-html.esm.js', import.meta.url).href;
const ASSETS_DIR = nodePath.resolve(nodePath.dirname(fileURLToPath(import.meta.url)), '..', 'assets');

let enginePromise = null;
async function getEngine() {
  if (!enginePromise) {
    // xss:false：允许 !bg / !c / ++ 前处理生成的内联标记透传
    enginePromise = import(ENGINE_URL).then((m) => {
      const md = m.createMarkdownRenderer({ xss: false });
      applySitePlugins(md);
      return md;
    });
  }
  return enginePromise;
}

/** DSL 行内语法前处理：!bg → mark、!c → colored span、++text++ → 下划线 */
export function preProcessDsl(content) {
  return String(content ?? '')
    // 容错：历史版本曾把 chip 误写成 !c[985]()（空颜色），这里降级为纯文本而不是原样露出
    .replace(/!c\[([^\]]*)\]\(\s*\)/g, '$1')
    .replace(/!bg\[([^\]]*)\]\(\s*\)/g, '$1')
    .replace(/!bg\[([^\]]*)\]\((#[0-9a-fA-F]{3,8})\)/g, '<mark style="background-color:$2">$1</mark>')
    .replace(/!c\[([^\]]*)\]\((#[0-9a-fA-F]{3,8})\)/g, '<span style="color:$2">$1</span>')
    .replace(/\+\+([^\s+](?:(?!\+\+)[^\n])*?[^\s+]|[^\s+])\+\+/g, '<u>$1</u>');
}

/** 自定义 markdown-it 扩展插件（图片尺寸语法与标题行号标记） */
function applySitePlugins(md) {
  // E：图片尺寸 ![alt (WxH)](url) / ![alt (N%)](url) → width/height 内联样式
  md.renderer.rules.image = function (tokens, idx, options, env, self) {
    const token = tokens[idx];
    const alt = self.renderInlineAsText(token.children || [], options, env);
    token.attrSet('alt', alt);
    const dim = /\((\d+)x(\d+)\)/.exec(alt);
    const pct = /\((\d+)%\)/.exec(alt);
    if (dim) {
      const w = Number(dim[1]);
      const h = Number(dim[2]);
      if (w > 0 && h > 0) token.attrSet('style', `width: ${w}px; height: ${h}px;`);
    } else if (pct) {
      const w = Number(pct[1]);
      if (w > 0 && w <= 100) token.attrSet('style', `width: ${w}%; height: auto;`);
    }
    return self.renderToken(tokens, idx, options);
  };

  // L：data-md-line 注入（考虑 head/main 布局容器的行偏移）
  const opens = new Set(['main_layout_open', 'head_layout_open']);
  const closes = new Set(['main_layout_close', 'head_layout_close']);
  md.core.ruler.push('inject-heading-line', (state) => {
    const stack = [0];
    for (const token of state.tokens) {
      if (opens.has(token.type) && token.map) stack.push(token.map[0] + 1 + stack[stack.length - 1]);
      else if (closes.has(token.type)) { if (stack.length > 1) stack.pop(); }
      else if (token.type === 'heading_open' && token.tag === 'h2' && token.map) {
        token.attrSet('data-md-line', String(token.map[0] + 1 + stack[stack.length - 1]));
      }
    }
  });
}

/** C 等价：resume-module 模块包裹（字符串态，处理 main-layout 容器） */
function wrapResumeModules(html) {
  const MAIN_OPEN = '<div class="main-layout">';
  const mainIdx = html.indexOf(MAIN_OPEN);
  if (mainIdx >= 0) {
    // mainStart 模板：模块包裹发生在 main-layout 容器内部，外层类名保持 main-layout
    const headPart = html.slice(0, mainIdx);
    const closeIdx = html.lastIndexOf('</div>');
    const inner = html.slice(mainIdx + MAIN_OPEN.length, closeIdx);
    const tail = html.slice(closeIdx);
    const wrappedInner = wrapModulesInFragment(inner);
    return headPart + MAIN_OPEN + wrappedInner + '</div>' + tail;
  }
  return wrapModulesInFragment(html);
}

function wrapModulesInFragment(fragment) {
  const parts = fragment.split(/(?=<h2)/);
  const out = [];
  let moduleOpen = false;
  for (const part of parts) {
    if (/^<h2/.test(part)) {
      if (moduleOpen) out.push('</div>');
      // 从 h2 标签上搬运 data-md-line 到包裹容器
      const lineMatch = part.match(/data-md-line="(\d+)"/);
      out.push(`<div class="resume-module"${lineMatch ? ` data-md-line="${lineMatch[1]}"` : ''}>`);
      out.push(part);
      moduleOpen = true;
    } else {
      out.push(part);
    }
  }
  if (moduleOpen) out.push('</div>');
  return out.join('');
}

/** 渲染管线 M 等价（供实时预览复用，保证与整页预览同一套引擎） */
export async function renderLiveBody(content) {
  return renderPipeline(content, {});
}

async function renderPipeline(content, svgMap = {}) {
  const md = await getEngine();
  let html = md.render(preProcessDsl(content) ?? '');
  // 后处理：清理 <br> 后多余换行与标签间空白
  html = html.replace(/(<br[^>]*>)\n+/g, '$1').replace(/>\n+(?=<)/g, '>');
  return wrapResumeModules(html);
}

/* ------------------------------ 文档组装 ------------------------------ */

const ICONFONT_URL = '/resume/api/resume-icons/iconfont.css';
const TCB_BASE = 'https://636f-codecv-8gf1cv0db1056941-1300408620.tcb.qcloud.la';
const GOOGLE_FONTS_URL = 'https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@100;300;400;500;700;900&family=Noto+Serif+SC:wght@200;300;400;500;600;700;900&family=Nunito:ital,wght@0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap';

/**
 * 在线模板主题 CSS 地址。
 * 走本地代理路由（宿主首次拉取后落盘缓存），避免每次预览都跨域请求 TCB，
 * 国内弱网时这一跳能把预览首帧拖慢数秒。
 */
export function themeCssUrlFor(type) {
  return `/resume/api/tpl-css/${type}`;
}

/** 远程原始地址（仅宿主代理层使用） */
export function themeCssRemoteFor(type) {
  return `${TCB_BASE}/templates/modules/${type}/style.css`;
}

let layoutCssCache = null;
function loadLayoutCss(name) {
  if (!layoutCssCache) layoutCssCache = {};
  if (!layoutCssCache[name]) {
    try { layoutCssCache[name] = nodeFs.readFileSync(nodePath.join(ASSETS_DIR, name), 'utf8'); }
    catch { layoutCssCache[name] = ''; }
  }
  return layoutCssCache[name];
}

/** 主题运行时样式：字体 / 行高 / 字号基准 / 排版间距 / 配色变量 */
function themeStyle(style = {}) {
  const font = style.fontFamily || "'Noto Sans SC', sans-serif, serif";
  const primary = style.primaryColor || '#333333';
  const bg = style.primaryBGColor || '#4A6FA5';
  return `.jufe {
  font-size: 13px;
  color: ${primary};
  padding: 30px 40px;
}
.jufe * { font-family: ${font}; }
.markdown-transform-html * { line-height: ${style.lineHeight || 20}px; }
.markdown-transform-html {
  --markdown-primary-bg-color: ${bg};
  --markdown-primary-color: ${primary};
}
.jufe p { margin: 0; }
.jufe ul { margin: 0 0 5px; padding: 0 0 0 16.9px; list-style: disc; }
.jufe li { margin: 5px 0 0; }
.jufe h1 { font-size: 21px; font-weight: 700; margin: 0; }
.jufe h2 { font-size: 14px; font-weight: 700; margin: 10px 0 6px; padding: 0; border-bottom: 1px solid ${bg}; }
.jufe h3 { font-size: 17px; font-weight: 700; margin: 5px 0 0; }
.jufe .flex-layout { display: flex; justify-content: space-between; }`;
}

function overlayHtml(opts = {}) {
  let html = '';
  const { avatar, schoolLogo } = opts;
  if (avatar && avatar.src) {
    const cls = avatar.type === 'circle' ? 'circle' : 'square';
    html += `<img class="cv-avatar ${cls}" src="${avatar.src}" style="top:${avatar.top ?? 14}px;left:${avatar.left ?? 666}px;width:${avatar.w || 96}px;height:${avatar.h || 120}px" draggable="false"/>`;
  }
  if (schoolLogo && schoolLogo.src) {
    html += `<img class="cv-logo" src="${schoolLogo.src}" style="top:${schoolLogo.top ?? 46}px;left:${schoolLogo.left ?? 52}px;width:${schoolLogo.w || 44}px;height:${schoolLogo.h || 44}px" draggable="false"/>`;
  }
  return html;
}

function dragScript(hasOverlay) {
  if (!hasOverlay) return '';
  return `
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
</script>`;
}

function livePreviewScript() {
  return `
<script>
(function () {
  window.__cvrFit = function () {
    var page = document.querySelector('.cv-page');
    if (!page || !window.__cvrAutoFit) return;
    page.style.zoom = '';
    page.classList.remove('fit-done');
    var h = page.scrollHeight;
    if (h > 1123) { page.style.zoom = (1123 / h); page.classList.add('fit-done'); }
  };
  window.addEventListener('message', function (e) {
    var d = e.data;
    if (!d || d.type !== 'cvr-preview-set') return;
    var root = document.querySelector('.markdown-transform-html');
    if (!root) return;
    root.innerHTML = d.html;
    if (window.__cvrFit) window.__cvrFit();
  });
})();
</script>`;
}

function autoFitScript() {
  return `
<script>
(function () {
  window.__cvrAutoFit = true;
  function fit() {
    var page = document.querySelector('.cv-page');
    if (!page) return;
    var h = page.scrollHeight;
    if (h > 1123) {
      var s = 1123 / h;
      page.style.zoom = s;
      page.classList.add('fit-done');
    }
  }
  if (document.readyState === 'complete') fit();
  else window.addEventListener('load', fit);
})();
</script>`;
}

function escHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * 高保真 A4 文档渲染入口。
 * opts: { avatar, schoolLogo, autoFit, printMode, interactive, themeCssUrl, svgMap }
 */
export async function renderFidelityDocument(content, style = {}, title = '简历', opts = {}) {
  const bodyHtml = await renderPipeline(content, opts.svgMap || {});
  const printMode = !!opts.printMode;
  const thumbMode = !!opts.thumbMode;
  const baseCss = loadLayoutCss('resume-layout.css');
  const themeLinks = [
    `<link rel="stylesheet" href="${ICONFONT_URL}">`,
    opts.themeCssUrl ? `<link rel="stylesheet" href="${opts.themeCssUrl}">` : '',
    // Google Fonts 在国内会长时间超时，且 <link rel=stylesheet> 阻塞首屏渲染；
    // printMode 下完全跳过以免阻塞 PDF/PNG 打印；预览态用 media="not all" + onload 异步加载
    !printMode && opts.themeCssUrl ? `<link rel="stylesheet" href="${GOOGLE_FONTS_URL}" media="not all" onload="this.media='all'">` : '',
  ].filter(Boolean).join('\n');
  // 独立渲染时确保 .reference-dom 保持常规文档流定位与全宽可见
  // 内边距由 .jufe 容器承担（30px 40px），.cv-page 仅作 A4 纸张外框
  const rootFix = `
.markdown-transform-html.reference-dom {
  position: static !important;
  top: auto !important;
  left: auto !important;
  right: auto !important;
  bottom: auto !important;
  width: 100% !important;
  min-height: 1063px !important;
  visibility: visible !important;
  opacity: 1 !important;
  clip: auto !important;
}`;

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8"/>
<title>${escHtml(title)}</title>
${themeLinks}
<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body { margin: 0; padding: 0; background: ${printMode ? '#fff' : '#e8eaed'}; ${printMode ? 'width: 794px;' : ''} ${thumbMode ? 'height: 1123px; overflow: hidden;' : ''} }
body { display: flex; justify-content: center; padding: ${printMode ? '0' : '24px 0 48px'}; }
.cv-page {
  width: 794px; ${thumbMode ? 'height: 1123px;' : 'min-height: 1123px;'} background: #fff; position: relative;
  box-shadow: ${printMode ? 'none' : '0 2px 16px rgba(0,0,0,.12)'};
  padding: 0; overflow: hidden;
}
.cv-avatar { position: absolute; object-fit: cover; z-index: 3; }
.cv-avatar.square { border-radius: 6px; }
.cv-avatar.circle { border-radius: 50%; }
.cv-logo { position: absolute; object-fit: contain; opacity: .92; z-index: 3; }
@media print { body { padding: 0; } .cv-page { box-shadow: none; min-height: auto; } }
@page { size: A4; margin: 0; }
</style>
<style>${baseCss}</style>
<style>${themeStyle(style)}${rootFix}</style>
</head>
<body>
<div class="cv-page">
<div class="markdown-transform-html jufe reference-dom" data-v-44ad144e="" style="width: 100%;">
${bodyHtml}
</div>
${overlayHtml(opts)}
</div>
${opts.interactive ? dragScript(!!(opts.avatar || opts.schoolLogo)) : ''}
${opts.interactive ? livePreviewScript() : ''}
${opts.autoFit ? autoFitScript() : ''}
</body>
</html>`;
}
