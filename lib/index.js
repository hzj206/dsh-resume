/**
 * dsh-resume · Host half
 *
 * - ResumeStore: 简历本地存储（无登录，纯本地文件夹）
 * - 渲染引擎: lib/render.js（Resume DSL → A4 HTML）
 * - Agent 工具: resume_* / template_* （ctx.tools）
 * - 面板 HTTP API: /resume/api/*（ctx.webServer prefix 路由，供浏览器侧工作台读写）
 */
import nodePath from 'node:path';
import nodeFs from 'node:fs';
import nodeOs from 'node:os';
import nodeCrypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { renderBody, renderDocument } from './render.js';
import { templates, getTemplate } from '../assets/templates.js';
import { findBrowserBinary, printToPdf, printToPng, previewUrl, cropPngToPageWidth } from './exporter.js';
import { renderFidelityDocument, renderLiveBody, themeCssUrlFor, themeCssRemoteFor } from './fidelity.js';
import {
  listSections, moveSection, applyEdit, removeSection, proofread, matchJd,
} from './features.js';

export const name = 'dsh-resume';
export const inject = ['webServer', 'tools'];

const API_PREFIX = '/resume/api';

/* --------------------- iconfont 本地资源（vendor 直读，零外部依赖） --------------------- */

const PLUGIN_ROOT = nodePath.resolve(nodePath.dirname(fileURLToPath(import.meta.url)), '..');
const ICONFONT_DIR = nodePath.join(PLUGIN_ROOT, 'assets', 'vendor', 'resume-icons');

/** Best-effort 同步内置 SKILL.md 到 ~/.dsh/skills/resume-studio/SKILL.md，确保新装插件立即可被发现 */
function syncSkillToUserHome() {
  try {
    const srcSkill = nodePath.join(PLUGIN_ROOT, 'skills', 'resume-studio', 'SKILL.md');
    if (!nodeFs.existsSync(srcSkill)) return;
    const srcText = nodeFs.readFileSync(srcSkill, 'utf8');
    const dstDir = nodePath.join(nodeOs.homedir(), '.dsh', 'skills', 'resume-studio');
    const dstSkill = nodePath.join(dstDir, 'SKILL.md');
    let same = false;
    try { same = nodeFs.readFileSync(dstSkill, 'utf8') === srcText; } catch { /* ignore */ }
    if (!same) {
      nodeFs.mkdirSync(dstDir, { recursive: true });
      nodeFs.writeFileSync(dstSkill, srcText, 'utf8');
    }
  } catch { /* best effort */ }
}
const ICONFONT_TYPES = {
  'iconfont.css': 'text/css; charset=utf-8',
  'iconfont.woff2': 'font/woff2',
  'iconfont.woff': 'font/woff',
  'iconfont.ttf': 'font/ttf',
};

/** iconfont 本地路由：/resume/api/resume-icons/*（磁盘直读，随插件分发） */
function registerIconfontProxy(ctx) {
  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: `${API_PREFIX}/resume-icons`,
    handler: async (req, res) => {
      const name = (new URL(req.url, 'http://local').pathname.split('/').pop() || '').replace(/\?.*$/, '');
      try {
        const type = ICONFONT_TYPES[name];
        if (!type) return sendJson(res, 404, { ok: false, error: '未知资源' });
        const file = nodePath.join(ICONFONT_DIR, name);
        if (!nodeFs.existsSync(file)) return sendJson(res, 404, { ok: false, error: '资源不存在' });
        const buf = nodeFs.readFileSync(file);
        res.writeHead(200, {
          'Content-Type': type,
          'Cache-Control': 'public, max-age=604800',
          'Access-Control-Allow-Origin': '*',
          'Content-Length': buf.length,
        });
        return res.end(buf);
      } catch (error) {
        return sendJson(res, 500, { ok: false, error: String(error?.message || error) });
      }
    },
  }), 'dsh-resume-iconfont');
}

/** 带超时的 fetch：避免弱网/断网时外部请求在桌面端长期挂起 */
async function fetchWithTimeout(url, opts = {}, timeoutMs = 12000) {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
  try {
    return await fetch(url, ctrl ? { ...opts, signal: ctrl.signal } : opts);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** 读模板主题 CSS 文本：磁盘缓存优先，缺失则实时拉取（导出内联用） */
async function readTemplateCssText(store, type) {
  try {
    const f = nodePath.join(store.dir, '.cache', 'tpl-css', `${type}.css`);
    if (nodeFs.existsSync(f)) return nodeFs.readFileSync(f, 'utf8');
  } catch { /* ignore */ }
  try {
    const r = await fetchWithTimeout(themeCssRemoteFor(type), {}, 8000);
    if (!r.ok) return '';
    const css = await r.text();
    try {
      const dir = nodePath.join(store.dir, '.cache', 'tpl-css');
      nodeFs.mkdirSync(dir, { recursive: true });
      nodeFs.writeFileSync(nodePath.join(dir, `${type}.css`), css, 'utf8');
    } catch { /* ignore */ }
    return css;
  } catch { return ''; }
}

/** 把导出 HTML 里的本地 <link> 换成内联 <style>，保证离线打开也有样式 */
async function inlineLocalCss(html, store, onlineType) {
  let out = html;
  // iconfont：CSS + 字体文件一起内联成 data URI
  const iconCssFile = nodePath.join(ICONFONT_DIR, 'iconfont.css');
  if (nodeFs.existsSync(iconCssFile)) {
    let iconCss = nodeFs.readFileSync(iconCssFile, 'utf8');
    const fontMap = { 'iconfont.woff2': 'font/woff2', 'iconfont.woff': 'font/woff', 'iconfont.ttf': 'font/ttf' };
    for (const [name, mime] of Object.entries(fontMap)) {
      const fp = nodePath.join(ICONFONT_DIR, name);
      if (!nodeFs.existsSync(fp)) continue;
      const b64 = nodeFs.readFileSync(fp).toString('base64');
      const re = new RegExp("url\\(['\"]?" + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "(\\?[^)'\"]*)?['\"]?\\)", 'g');
      iconCss = iconCss.replace(re, `url("data:${mime};base64,${b64}")`);
    }
    out = out.replace(/<link[^>]*href="\/resume\/api\/resume-icons\/iconfont\.css"[^>]*>/g, () => `<style>\n${iconCss}\n</style>`);
  }
  // 在线模板主题 CSS
  if (onlineType) {
    const css = await readTemplateCssText(store, onlineType);
    if (css) {
      const escapedType = String(onlineType).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      out = out.replace(
        new RegExp(`<link[^>]*href="\\/resume\\/api\\/tpl-css\\/${escapedType}"[^>]*>`),
        () => `<style>\n${css}\n</style>`);
    }
  }
  return out;
}

/** 在线模板主题 CSS 本地代理：首次拉取后落盘缓存，之后零外网依赖 */
function registerTemplateCssProxy(ctx, store) {
  const mem = new Map(); // type -> css 文本
  const cacheDir = () => {
    const dir = nodePath.join(store.dir, '.cache', 'tpl-css');
    try { nodeFs.mkdirSync(dir, { recursive: true }); } catch { /* ignore */ }
    return dir;
  };
  const readDisk = (type) => {
    try {
      const f = nodePath.join(cacheDir(), `${type}.css`);
      if (nodeFs.existsSync(f)) return nodeFs.readFileSync(f, 'utf8');
    } catch { /* ignore */ }
    return null;
  };
  const writeDisk = (type, css) => {
    try { nodeFs.writeFileSync(nodePath.join(cacheDir(), `${type}.css`), css, 'utf8'); } catch { /* ignore */ }
  };

  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: `${API_PREFIX}/tpl-css`,
    handler: async (req, res) => {
      const raw = (new URL(req.url, 'http://local').pathname.split('/').pop() || '').replace(/\.css$/, '').replace(/\?.*$/, '');
      const type = raw.replace(/[^0-9A-Za-z_-]/g, '');
      const sendCss = (css) => {
        const buf = Buffer.from(css, 'utf8');
        res.writeHead(200, {
          'Content-Type': 'text/css; charset=utf-8',
          'Cache-Control': 'public, max-age=604800',
          'Access-Control-Allow-Origin': '*',
          'Content-Length': buf.length,
        });
        return res.end(buf);
      };
      if (!type) return sendCss('/* invalid type */');
      if (mem.has(type)) return sendCss(mem.get(type));
      const disk = readDisk(type);
      if (disk !== null) { mem.set(type, disk); return sendCss(disk); }
      try {
        const r = await fetchWithTimeout(themeCssRemoteFor(type), {}, 8000);
        const css = r.ok ? await r.text() : '';
        if (css) { mem.set(type, css); writeDisk(type, css); }
        return sendCss(css || '/* theme css unavailable */');
      } catch {
        // 拉不到就给空样式：宁可主题简化，也绝不让预览卡住
        mem.set(type, '');
        return sendCss('/* theme css unavailable */');
      }
    },
  }), 'dsh-resume-tpl-css');
}

/* --------------------- 在线模板源（可选公开模板接口） --------------------- */

const onlineTplFullCache = new Map(); // type → {tpl, at}

async function fetchOnlineTemplate(type) {
  const now = Date.now();
  const hit = onlineTplFullCache.get(type);
  if (hit && now - hit.at < 10 * 60 * 1000) return hit.tpl;
  const res = await fetchWithTimeout('https://www.codecvcv.com/api/cv/public/get', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type }),
  }, 12000);
  const data = await res.json();
  if (data.code !== 200 || !data.data) throw new Error('在线模板不存在');
  onlineTplFullCache.set(type, { tpl: data.data, at: now });
  return data.data;
}

/** 在线模板 style → 本地渲染 style（视觉主题：默认彩色标题；45 型为居中+深色标题例外） */
function mapOnlineStyle(tpl) {
  const type = String(tpl.type || '');
  const isCenterPlain = type === '45';
  return {
    primaryColor: tpl.primaryColor || '#333333',
    primaryBGColor: tpl.primaryBgColor || '#4A6FA5',
    fontFamily: (tpl.font || 'Noto Sans SC') + ", 'Microsoft YaHei', sans-serif",
    lineHeight: tpl.lineHeight || 20,
    titleStyle: isCenterPlain ? 'plain' : 'color',
    headerAlign: isCenterPlain ? 'center' : 'left',
  };
}

/* ---------------------------------- store --------------------------------- */

function defaultStorageDir() {
  return nodePath.join(nodeOs.homedir(), '.dsh', 'dsh-resume');
}

class ResumeStore {
  constructor(dir, opts = {}) {
    this.dir = dir;
    this.opts = opts;
    nodeFs.mkdirSync(dir, { recursive: true });
    this.rev = this.readRev();
  }

  get revFile() { return nodePath.join(this.dir, '.rev'); }

  readRev() {
    try { return Number(nodeFs.readFileSync(this.revFile, 'utf8').trim()) || 1; }
    catch { return 1; }
  }

  bumpRev() {
    this.rev += 1;
    try { nodeFs.writeFileSync(this.revFile, String(this.rev)); } catch { /* best effort */ }
    return this.rev;
  }

  resumeDir(id) {
    // id 必须是安全短标识，防路径穿越
    if (!/^[A-Za-z0-9_-]{4,32}$/.test(id)) throw new Error(`非法简历 id: ${id}`);
    return nodePath.join(this.dir, id);
  }

  newId() {
    return nodeCrypto.randomBytes(9).toString('base64url').replace(/[-_]/g, 'a').slice(0, 16);
  }

  readMeta(id) {
    const metaPath = nodePath.join(this.resumeDir(id), 'meta.json');
    return JSON.parse(nodeFs.readFileSync(metaPath, 'utf8'));
  }

  writeMeta(id, meta) {
    nodeFs.writeFileSync(nodePath.join(this.resumeDir(id), 'meta.json'), JSON.stringify(meta, null, 2));
  }

  readContent(id) {
    return nodeFs.readFileSync(nodePath.join(this.resumeDir(id), 'resume.md'), 'utf8');
  }

  writeContent(id, content) {
    nodeFs.writeFileSync(nodePath.join(this.resumeDir(id), 'resume.md'), String(content ?? ''));
  }

  list() {
    const items = [];
    for (const name of nodeFs.readdirSync(this.dir)) {
      const p = nodePath.join(this.dir, name);
      try {
        if (!nodeFs.statSync(p).isDirectory()) continue;
        const meta = JSON.parse(nodeFs.readFileSync(nodePath.join(p, 'meta.json'), 'utf8'));
        items.push({ id: meta.id, name: meta.name, type: meta.type, style: meta.style, createdAt: meta.createdAt, updatedAt: meta.updatedAt });
      } catch { /* 跳过坏目录 */ }
    }
    items.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    return items;
  }

  create(type, name) {
    const tpl = getTemplate(type);
    if (!tpl) throw new Error(`未知模板 type: ${type}（用 template_list 查看可用模板）`);
    const id = this.newId();
    const now = new Date().toISOString();
    const dir = this.resumeDir(id);
    nodeFs.mkdirSync(dir, { recursive: true });
    const meta = {
      id,
      name: name || `${tpl.name} - 未命名`,
      type: tpl.type,
      style: { ...tpl.style },
      templateName: tpl.name,
      createdAt: now,
      updatedAt: now,
    };
    this.writeMeta(id, meta);
    this.writeContent(id, tpl.content);
    this.bumpRev();
    return meta;
  }

  save(id, { content, style, name } = {}) {
    const meta = this.readMeta(id);
    if (typeof content === 'string') this.writeContent(id, content);
    if (style && typeof style === 'object') meta.style = { ...meta.style, ...style };
    if (typeof name === 'string' && name.trim()) meta.name = name.trim();
    meta.updatedAt = new Date().toISOString();
    this.writeMeta(id, meta);
    this.bumpRev();
    return meta;
  }

  remove(id) {
    nodeFs.rmSync(this.resumeDir(id), { recursive: true, force: true });
    this.bumpRev();
    return { ok: true };
  }

  duplicate(id) {
    const meta = this.readMeta(id);
    const content = this.readContent(id);
    const newId = this.newId();
    const now = new Date().toISOString();
    const dir = this.resumeDir(newId);
    nodeFs.mkdirSync(dir, { recursive: true });
    const copy = { ...meta, id: newId, name: `${meta.name} 副本`, createdAt: now, updatedAt: now };
    const av = this.avatarFile(id);
    if (av) {
      const avName = nodePath.basename(av);
      nodeFs.copyFileSync(av, nodePath.join(dir, avName));
      if (copy.avatar) copy.avatar = { ...copy.avatar, url: avName };
    }
    const lg = this.schoolLogoFile(id);
    if (lg) {
      const lgName = nodePath.basename(lg);
      nodeFs.copyFileSync(lg, nodePath.join(dir, lgName));
      if (copy.schoolLogo) copy.schoolLogo = { ...copy.schoolLogo, url: lgName };
    }
    this.writeMeta(newId, copy);
    this.writeContent(newId, content);
    this.bumpRev();
    return copy;
  }

  /** 头像文件路径（无头像返回 null） */
  avatarFile(id) {
    const dir = this.resumeDir(id);
    for (const ext of ['jpg', 'jpeg', 'png', 'webp']) {
      const p = nodePath.join(dir, `avatar.${ext}`);
      if (nodeFs.existsSync(p)) return p;
    }
    return null;
  }

  saveAvatar(id, dataUrl) {
    const m = String(dataUrl).trim().match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/is);
    if (!m) throw new Error('需要 dataURL 图片（data:image/png|jpeg|webp;base64,...）');
    const rawExt = m[1].toLowerCase();
    const ext = rawExt === 'jpg' ? 'jpeg' : rawExt;
    const dir = this.resumeDir(id);
    for (const oldExt of ['jpg', 'jpeg', 'png', 'webp']) {
      nodeFs.rmSync(nodePath.join(dir, `avatar.${oldExt}`), { force: true });
    }
    const file = nodePath.join(dir, `avatar.${ext}`);
    nodeFs.writeFileSync(file, Buffer.from(m[2].replace(/\s+/g, ''), 'base64'));
    const meta = this.readMeta(id);
    meta.avatar = { ...(meta.avatar || {}), url: `avatar.${ext}` };
    if (meta.avatar.top === undefined) meta.avatar.top = 14;
    if (meta.avatar.left === undefined) meta.avatar.left = 666;
    meta.updatedAt = new Date().toISOString();
    this.writeMeta(id, meta);
    this.bumpRev();
    return { avatar: meta.avatar };
  }

  setAvatarPosition(id, top, left, type) {
    const meta = this.readMeta(id);
    const shape = type === 'circle' || type === 'square' ? type : undefined;
    meta.avatar = {
      ...(meta.avatar || {}),
      top: Math.max(0, Math.min(1050, Math.round(top))),
      left: Math.max(0, Math.min(760, Math.round(left))),
      ...(shape ? { type: shape } : {}),
    };
    meta.updatedAt = new Date().toISOString();
    this.writeMeta(id, meta);
    this.bumpRev();
    return { avatar: meta.avatar };
  }

  /** 校徽：与头像同构（文件 + meta.schoolLogo 坐标） */
  schoolLogoFile(id) {
    const dir = this.resumeDir(id);
    for (const ext of ['png', 'svg', 'jpg', 'jpeg', 'webp']) {
      const p = nodePath.join(dir, `logo.${ext}`);
      if (nodeFs.existsSync(p)) return p;
    }
    return null;
  }

  saveSchoolLogo(id, dataUrl) {
    const m = String(dataUrl).trim().match(/^data:image\/(png|svg\+xml|jpeg|jpg|webp);base64,(.+)$/is);
    if (!m) throw new Error('需要 dataURL 图片（data:image/png|svg+xml|jpeg|webp;base64,...）');
    const rawExt = m[1].toLowerCase();
    const ext = rawExt === 'svg+xml' ? 'svg' : (rawExt === 'jpg' ? 'jpeg' : rawExt);
    const dir = this.resumeDir(id);
    for (const oldExt of ['png', 'svg', 'jpg', 'jpeg', 'webp']) {
      nodeFs.rmSync(nodePath.join(dir, `logo.${oldExt}`), { force: true });
    }
    const file = nodePath.join(dir, `logo.${ext}`);
    nodeFs.writeFileSync(file, Buffer.from(m[2].replace(/\s+/g, ''), 'base64'));
    const meta = this.readMeta(id);
    meta.schoolLogo = { ...(meta.schoolLogo || {}), url: `logo.${ext}` };
    if (meta.schoolLogo.top === undefined) meta.schoolLogo.top = 46;
    if (meta.schoolLogo.left === undefined) meta.schoolLogo.left = 52;
    meta.updatedAt = new Date().toISOString();
    this.writeMeta(id, meta);
    this.bumpRev();
    return { schoolLogo: meta.schoolLogo };
  }

  setSchoolLogoPosition(id, top, left) {
    const meta = this.readMeta(id);
    meta.schoolLogo = {
      ...(meta.schoolLogo || {}),
      top: Math.max(0, Math.min(1060, Math.round(top))),
      left: Math.max(0, Math.min(700, Math.round(left))),
    };
    meta.updatedAt = new Date().toISOString();
    this.writeMeta(id, meta);
    this.bumpRev();
    return { schoolLogo: meta.schoolLogo };
  }

  setAutoOnePage(id, enabled) {
    const meta = this.readMeta(id);
    meta.autoOnePage = !!enabled;
    meta.updatedAt = new Date().toISOString();
    this.writeMeta(id, meta);
    this.bumpRev();
    return { autoOnePage: meta.autoOnePage };
  }

  /** 用指定样式与正文创建简历（在线模板用） */
  createWith(name, style, content, typeName = 'online') {
    const id = this.newId();
    const now = new Date().toISOString();
    const dir = this.resumeDir(id);
    nodeFs.mkdirSync(dir, { recursive: true });
    const meta = {
      id, name: name || '未命名简历', type: typeName,
      style: { ...style },
      templateName: typeName,
      createdAt: now, updatedAt: now,
    };
    this.writeMeta(id, meta);
    this.writeContent(id, content);
    this.bumpRev();
    return meta;
  }

  async renderSelfContainedHtml(id) {
    const meta = this.readMeta(id);
    const content = this.readContent(id);
    const mimeFor = (fp) => {
      const ext = nodePath.extname(fp).toLowerCase();
      if (ext === '.svg') return 'image/svg+xml';
      if (ext === '.webp') return 'image/webp';
      if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
      return 'image/png';
    };
    const toDataSrc = (fp) => {
      if (!fp) return null;
      return `data:${mimeFor(fp)};base64,` + nodeFs.readFileSync(fp).toString('base64');
    };
    const avFile = this.avatarFile(id);
    const lgFile = this.schoolLogoFile(id);
    const htmlRaw = await renderFidelityDocument(content, meta.style, meta.name, {
      printMode: true,
      themeCssUrl: meta.onlineType ? themeCssUrlFor(meta.onlineType) : undefined,
      avatar: meta.avatar && avFile
        ? { ...meta.avatar, src: toDataSrc(avFile) }
        : undefined,
      schoolLogo: meta.schoolLogo && lgFile
        ? { ...meta.schoolLogo, src: toDataSrc(lgFile) }
        : undefined,
      autoFit: !!meta.autoOnePage,
    });
    return inlineLocalCss(htmlRaw, this, meta.onlineType);
  }

  async exportTo(id, format, ctx) {
    const fmt = String(format || 'md').trim().toLowerCase();
    const meta = this.readMeta(id);
    const content = this.readContent(id);
    const safe = String(meta.name).replace(/[\\/:*?"<>|]/g, '_').replace(/[\s.]+$/, '').slice(0, 60) || meta.id;
    const stamp = new Date().toISOString().slice(0, 10);
    const exportDir = nodePath.join(this.dir, 'exports');
    nodeFs.mkdirSync(exportDir, { recursive: true });
    const base = `${safe}-${stamp}`;

    if (fmt === 'md') {
      const file = nodePath.join(exportDir, `${base}.md`);
      nodeFs.writeFileSync(file, content);
      return { file, format: fmt };
    }
    if (fmt === 'html') {
      const file = nodePath.join(exportDir, `${base}.html`);
      const html = await this.renderSelfContainedHtml(id);
      nodeFs.writeFileSync(file, html);
      return { file, format: fmt };
    }
    if (fmt === 'pdf') {
      const file = nodePath.join(exportDir, `${base}.pdf`);
      const engine = findBrowserBinary(this.opts.browserPath);
      if (!engine) throw new Error('未找到 Edge/Chrome，无法生成 PDF；请安装 Microsoft Edge 或在配置中指定浏览器路径');
      const html = await this.renderSelfContainedHtml(id);
      const tmpDir = nodeFs.mkdtempSync(nodePath.join(nodeOs.tmpdir(), 'cvr-pdf-'));
      const tmpHtml = nodePath.join(tmpDir, 'resume.html');
      nodeFs.writeFileSync(tmpHtml, html, 'utf8');
      try {
        await printToPdf(engine, pathToFileURL(tmpHtml).href, file);
      } finally {
        try { nodeFs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* 忽略 */ }
      }
      return { file, format: fmt, engine: nodePath.basename(engine) };
    }
    if (fmt === 'png') {
      const file = nodePath.join(exportDir, `${base}.png`);
      let captured = false;
      // 桌面端优先走静默无头 Edge/Chrome 自包含文件截图：不弹窗、不触发桌面端内置浏览器侧栏、不受 webServer 鉴权影响
      const engine = findBrowserBinary(this.opts.browserPath);
      if (engine) {
        const html = await this.renderSelfContainedHtml(id);
        const tmpDir = nodeFs.mkdtempSync(nodePath.join(nodeOs.tmpdir(), 'cvr-png-src-'));
        const tmpHtml = nodePath.join(tmpDir, 'resume.html');
        nodeFs.writeFileSync(tmpHtml, html, 'utf8');
        try {
          await printToPng(engine, pathToFileURL(tmpHtml).href, file);
          if (nodeFs.existsSync(file) && nodeFs.statSync(file).size >= 800) captured = true;
        } finally {
          try { nodeFs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* 忽略 */ }
        }
      }
      if (!captured) {
        let origin = '';
        try {
          origin = ctx?.webServer?.getOrigin?.() || (ctx?.webServer?.port ? `http://127.0.0.1:${ctx.webServer.port}` : '');
        } catch { origin = ''; }
        const hasLiveOrigin = !!origin && !origin.endsWith(':0') && !origin.endsWith(':1');
        const browser = ctx?.get?.('browser');
        if (hasLiveOrigin && browser?.open) {
          try {
            const session = await browser.open('resume-export');
            try {
              await browser.openUrl(session, { url: previewUrl(origin, id, { print: true }) });
              await new Promise((r) => setTimeout(r, 1200));
              const shot = await browser.screenshot(session, { fullPage: true, format: 'png' });
              const b64 = String(shot?.dataUrl || '').replace(/^data:image\/png;base64,/, '');
              if (b64) {
                nodeFs.writeFileSync(file, Buffer.from(b64, 'base64'));
                if (nodeFs.existsSync(file) && nodeFs.statSync(file).size >= 800) captured = true;
              }
            } finally {
              try { await browser.close(session); } catch { /* 忽略 */ }
            }
          } catch { captured = false; }
        }
      }
      if (!captured) {
        if (!engine) throw new Error('PNG 导出失败：未找到 Edge/Chrome 且内置浏览器截图不可用');
        throw new Error('PNG 截图失败');
      }
      await cropPngToPageWidth(file, 794).catch(() => {});
      return { file, format: fmt };
    }
    throw new Error(`不支持的导出格式: ${format}（可选 md / html / pdf / png）`);
  }
}

/* ------------------------------ HTTP helpers ------------------------------ */

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > 5 * 1024 * 1024) { reject(new Error('body too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

/* --------------------------------- plugin --------------------------------- */

export function apply(ctx, config = {}) {
  syncSkillToUserHome();
  const store = new ResumeStore(config.storageDir || defaultStorageDir(), { browserPath: config.browserPath });
  const onlineTplCache = { at: 0, items: [] };
  registerIconfontProxy(ctx);
  registerTemplateCssProxy(ctx, store);

  /** 渲染一份简历的保真文档（编辑器同款效果）。opts.printMode/interactive 由调用方定 */
  const renderResumeFidelity = async (id, opts = {}) => {
    const meta = store.readMeta(id);
    // 迁移：早期在线模板简历缺 onlineType，按名称匹配补齐
    if (meta.type === 'online' && !meta.onlineType) {
      try {
        if (!onlineTplCache.at) {
          const res2 = await fetchWithTimeout('https://www.codecvcv.com/api/cv/public/page', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pageNum: 1, pageSize: 120, sortField: 'hot', needDescription: false, wheres: {} }),
          }, 8000);
          const d2 = await res2.json();
          if (d2.code === 200) onlineTplCache.items = (d2.data || []).map((t) => ({ id: t.type, name: t.name, cover: t.cover }));
          onlineTplCache.at = Date.now();
        }
        const hit = onlineTplCache.items.find((t) => meta.name.startsWith(t.name));
        if (hit) {
          meta.onlineType = hit.id;
          store.writeMeta(id, meta);
        }
      } catch { /* 迁移失败不影响渲染 */ }
    }
    const content = store.readContent(id);
    const avatarFile = store.avatarFile(id);
    const logoFile = store.schoolLogoFile(id);
    return renderFidelityDocument(content, meta.style, meta.name, {
      ...opts,
      themeCssUrl: meta.onlineType ? themeCssUrlFor(meta.onlineType) : undefined,
      avatar: meta.avatar && avatarFile
        ? { ...meta.avatar, src: `/resume/api/resume/${id}/avatar` }
        : undefined,
      schoolLogo: meta.schoolLogo && logoFile
        ? { ...meta.schoolLogo, src: `/resume/api/resume/${id}/logo` }
        : undefined,
      autoFit: !!meta.autoOnePage,
    });
  };

  /* ---------- Agent 工具 ---------- */

  /**
   * DSH 工具的 parameters 用的是简写 spec 格式（{id: {type, required, description}}），
   * 但 ctx.tools.register 会直接把 parameters 发给 LLM 的 function-calling API，
   * 而 API 只认标准 JSON Schema（{type:'object', properties:{...}, required:[...]}）。
   * 不转换就会触发 "Invalid schema for function 'xxx'" 导致整个请求失败。
   */
  /**
   * DSH 的 walkJsonValue 严格校验：undefined / NaN / Infinity / -0 / 函数 / Symbol
   * 全部判定为「不可无损 JSON 序列化」，一旦出现在工具返回值或 schema 里，
   * 整个 session event 就会直接抛错。
   * 这个函数递归清洗对象，确保输出严格符合 JSON 规范。
   */
  const sanitizeValue = (value) => {
    if (value === undefined || value === null) return null;
    const t = typeof value;
    if (t === 'number') {
      if (!Number.isFinite(value)) return null;
      return Object.is(value, -0) ? 0 : value;
    }
    if (t === 'string' || t === 'boolean') return value;
    if (t !== 'object') return null;
    if (Array.isArray(value)) return value.map(sanitizeValue);
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (v === undefined) continue;
      out[k] = sanitizeValue(v);
    }
    return out;
  };

  const specToJsonSchema = (spec) => {
    const properties = {};
    const required = [];
    for (const [key, val] of Object.entries(spec || {})) {
      const prop = { type: val.type || 'string' };
      if (val.description !== undefined) prop.description = String(val.description);
      if (val.enum) prop.enum = val.enum;
      if (val.items) prop.items = typeof val.items === 'object' ? specToJsonSchema(val.items) : { type: val.items };
      if (val.type === 'object') {
        if (val.additionalProperties !== undefined) prop.additionalProperties = !!val.additionalProperties;
        if (val.properties) prop.properties = specToJsonSchema(val.properties).properties;
        if (val.required && Array.isArray(val.required)) prop.required = val.required;
      }
      if (val.minimum !== undefined) prop.minimum = val.minimum;
      if (val.maximum !== undefined) prop.maximum = val.maximum;
      properties[key] = prop;
      if (val.required) required.push(key);
    }
    // 关键：不能输出 undefined 值！DSH 的 walkJsonValue 会把 undefined 判定为不可序列化，
    // 导致 session event "request/header" 整个请求直接失败。必须只在有值时才加 key。
    const result = { type: 'object', properties, additionalProperties: false };
    if (required.length > 0) result.required = required;
    return result;
  };

  /** 轻量参数校验：原生执行器不校验参数，这里兜住必填缺失与明显类型错误（宽松：数字可以是数字字符串）。 */
  const checkArgs = (schema, args) => {
    const problems = [];
    for (const key of schema.required || []) {
      if (args[key] === undefined || args[key] === null || args[key] === '') problems.push(`缺少必填参数 ${key}`);
    }
    for (const [key, prop] of Object.entries(schema.properties || {})) {
      const v = args[key];
      if (v === undefined || v === null) continue;
      if (prop.type === 'number' && (typeof v === 'boolean' || (typeof v === 'string' && !v.trim()) || !Number.isFinite(Number(v)))) {
        problems.push(`${key} 应为数字`);
      }
      if (prop.type === 'boolean' && typeof v !== 'boolean' && v !== 'true' && v !== 'false') problems.push(`${key} 应为布尔值`);
      if (prop.type === 'object' && (typeof v !== 'object' || Array.isArray(v))) problems.push(`${key} 应为对象`);
    }
    return problems;
  };

  const tool = (definition) => {
    try {
      // ctx.tools.register 要求 definition.output = { schema, render }，否则抛错。
      // 所有工具统一补一个 JSON 输出的默认 output（与 defineTool 产物对齐）。
      // parameters 必须是标准 JSON Schema（含 type:'object' / properties / required 包装）
      const jsonSchemaParams = specToJsonSchema(definition.parameters);
      const originalExecute = definition.execute;
      ctx.tools.register({
        ...definition,
        parameters: jsonSchemaParams,
        output: definition.output ?? {
          schema: { type: 'object', additionalProperties: true },
          // DSH 契约：render 必须返回 content block 数组（[{type:'text', text}]），
          // 与所有内置工具一致；返回裸字符串会让结果内容格式错误。
          render: (_args, value) => [{
            type: 'text',
            text: typeof value === 'string' ? value : JSON.stringify(value, null, 2),
          }],
        },
        // 所有返回值自动清洗，杜绝 undefined/NaN 混入 DSH 序列化；
        // DSH 会用 output.schema（type:object）校验返回值，非对象统一包成 { result }。
        async execute(args, exec) {
          const input = (args && typeof args === 'object' && !Array.isArray(args)) ? args : {};
          const problems = checkArgs(jsonSchemaParams, input);
          if (problems.length) throw new Error(`参数错误：${problems.join('；')}`);
          const v = sanitizeValue(await originalExecute(input, exec));
          return (v && typeof v === 'object' && !Array.isArray(v)) ? v : { result: v };
        },
      });
    }
    catch (error) { ctx.logger?.warn?.(`dsh-resume: 工具注册失败 ${definition.name}: ${String(error)}`); }
  };

  tool({
    name: 'resume_list',
    description: '列出本地所有简历（含 id、名称、模板、更新时间）。改简历前先用它找到目标简历的 id。',
    parameters: {},
    async execute() {
      return { resumes: store.list(), rev: store.rev };
    },
  });

  tool({
    name: 'resume_new',
    description: '从内置模板创建一份新简历，返回新简历 id。创建后通常接着用 resume_read 查看示例结构，再用 resume_write 替换成用户真实内容。',
    parameters: {
      type: { type: 'string', required: true, description: `模板编号，可选值见 template_list。当前内置: ${templates.map((t) => t.type).join(' / ')}` },
      name: { type: 'string', description: '简历名称（如 "张三 - 后端开发工程师"）' },
    },
    async execute(args) {
      const cleanName = typeof args.name === 'string' ? args.name.trim() : '';
      const meta = store.create(String(args.type || 'general'), cleanName || undefined);
      return { id: meta.id, name: meta.name, type: meta.type, hint: '用 resume_read 读取示例正文，了解 DSL 结构后按用户信息改写，再 resume_write 保存。' };
    },
  });

  tool({
    name: 'resume_read',
    description: '读取一份简历：name/meta 配置 + 正文 Markdown（Resume DSL：!bg 标题底色、!c 模块标题变色、::: start/end 多栏、icon: 图标、`标签` 徽章）。',
    parameters: {
      id: { type: 'string', required: true, description: '简历 id（resume_list 获得）' },
    },
    async execute(args) {
      const meta = store.readMeta(String(args.id));
      const content = store.readContent(String(args.id));
      return { meta, content };
    },
  });

  tool({
    name: 'resume_write',
    description: '整体保存简历正文（Resume DSL Markdown）与可选样式。这是改简历的主入口：先 resume_read 取得现状，改写后全文写回。保存后右侧工作台与聊天卡片会实时更新。',
    parameters: {
      id: { type: 'string', required: true, description: '简历 id' },
      content: { type: 'string', required: true, description: '完整正文（DSL Markdown 全文替换）' },
      name: { type: 'string', description: '可选：改名' },
      style: { type: 'object', additionalProperties: true, description: '可选：样式补丁 { primaryColor, primaryBGColor, fontFamily, lineHeight }' },
    },
    async execute(args) {
      const meta = store.save(String(args.id), {
        content: args.content,
        name: args.name,
        style: args.style,
      });
      return {
        ok: true, id: meta.id, name: meta.name, updatedAt: meta.updatedAt,
        view: `/resume/api/resume/${meta.id}`,
      };
    },
  });

  tool({
    name: 'resume_set_style',
    description: '只调简历样式：主文字色 primaryColor、模块主色 primaryBGColor、字体 fontFamily、行距 lineHeight。',
    parameters: {
      id: { type: 'string', required: true, description: '简历 id' },
      style: { type: 'object', additionalProperties: true, required: true, description: '样式补丁，如 { "primaryBGColor": "#2F54EB" }' },
    },
    async execute(args) {
      const meta = store.save(String(args.id), { style: args.style });
      return { ok: true, id: meta.id, style: meta.style };
    },
  });

  tool({
    name: 'resume_render',
    description: '渲染简历为完整 HTML（A4 版式），返回写入文件的路径。用于自查排版是否溢出/模块是否正常。',
    parameters: {
      id: { type: 'string', required: true, description: '简历 id' },
    },
    async execute(args) {
      const id = String(args.id);
      const html = await store.renderSelfContainedHtml(id);
      const file = nodePath.join(store.resumeDir(id), 'preview.html');
      nodeFs.writeFileSync(file, html);
      return { file, bytes: html.length };
    },
  });

  tool({
    name: 'resume_export',
    description: '导出简历到本地文件（存储目录 exports/ 下），返回绝对路径。format: md（Markdown 源文）/ html（自包含网页）/ pdf（A4 排版 PDF，走系统 Edge/Chrome headless 打印）/ png（整页长图，走内置浏览器截图）。发简历给 HR 用 pdf。',
    parameters: {
      id: { type: 'string', required: true, description: '简历 id' },
      format: { type: 'string', required: true, description: '导出格式: md | html | pdf | png' },
    },
    async execute(args) {
      return store.exportTo(String(args.id), String(args.format || 'md'), ctx);
    },
  });

  tool({
    name: 'resume_set_avatar',
    description: '给简历设置证件照/头像（base64 dataURL），渲染在 A4 纸右上区。设置后用户可在工作台预览里拖拽调整位置。',
    parameters: {
      id: { type: 'string', required: true, description: '简历 id' },
      imageDataUrl: { type: 'string', required: true, description: '图片 dataURL（data:image/png|jpeg|webp;base64,...），建议 ≤500KB' },
    },
    async execute(args) {
      return store.saveAvatar(String(args.id), String(args.imageDataUrl));
    },
  });

  tool({
    name: 'resume_set_avatar_position',
    description: '调整头像在 A4 纸上的位置（px 坐标，左上角原点，纸面 794×1123）与形状。',
    parameters: {
      id: { type: 'string', required: true, description: '简历 id' },
      top: { type: 'number', required: true, description: '距纸顶距离 px（0-1050）' },
      left: { type: 'number', required: true, description: '距纸左距离 px（0-760）' },
      shape: { type: 'string', description: 'square（方）| circle（圆），默认不变' },
    },
    async execute(args) {
      return store.setAvatarPosition(String(args.id), Number(args.top), Number(args.left), args.shape ? String(args.shape) : undefined);
    },
  });

  tool({
    name: 'resume_set_school_logo',
    description: '给简历设置校徽/公司 Logo（base64 dataURL，SVG 最佳），渲染在 A4 纸左上区，可在预览里拖拽定位。',
    parameters: {
      id: { type: 'string', required: true, description: '简历 id' },
      imageDataUrl: { type: 'string', required: true, description: '图片 dataURL（data:image/png|svg+xml;base64,...）' },
    },
    async execute(args) {
      return store.saveSchoolLogo(String(args.id), String(args.imageDataUrl));
    },
  });

  tool({
    name: 'resume_set_school_logo_position',
    description: '调整校徽在 A4 纸上的位置（px 坐标）。',
    parameters: {
      id: { type: 'string', required: true, description: '简历 id' },
      top: { type: 'number', required: true, description: '距纸顶距离 px（0-1060）' },
      left: { type: 'number', required: true, description: '距纸左距离 px（0-700）' },
    },
    async execute(args) {
      return store.setSchoolLogoPosition(String(args.id), Number(args.top), Number(args.left));
    },
  });

  tool({
    name: 'resume_set_auto_page',
    description: '开关"智能一页"：内容超出一页时自动缩放至恰好一页 A4（导出 PDF/PNG 与预览均生效）。',
    parameters: {
      id: { type: 'string', required: true, description: '简历 id' },
      enabled: { type: 'boolean', required: true, description: 'true 开启 / false 关闭' },
    },
    async execute(args) {
      const enabled = args.enabled === true || args.enabled === 'true';
      return store.setAutoOnePage(String(args.id), enabled);
    },
  });

  /* ---------- 求职情报（公开面经与岗位检索） ---------- */

  tool({
    name: 'mianjing_search',
    description: '检索面经（公司面试/笔试经验真题，公开数据）。可按公司 slug、岗位 slug、届别、批次筛选。写简历研究目标公司时很有用。',
    parameters: {
      company: { type: 'string', description: '公司 slug（如 bytedance / tencent / alibaba，用 mianjing_companies 查）' },
      position: { type: 'string', description: '岗位 slug（如 houduan / qianduan）' },
      grade: { type: 'number', description: '届别（如 2027）' },
      batch: { type: 'string', description: '批次：qiuzhao | chunzhao | shixi | shezhao' },
      pageSize: { type: 'number', description: '条数，默认 8，最大 30' },
    },
    async execute(args) {
      const qs = new URLSearchParams({ pageNum: '1', pageSize: String(Math.min(args.pageSize || 8, 30)) });
      for (const k of ['company', 'position', 'batch']) {
        if (args[k]) qs.set(k, String(args[k]));
      }
      if (args.grade) qs.set('grade', String(args.grade));
      const res = await fetchWithTimeout(`https://www.codecvcv.com/api/mianjing/list?${qs}`, {}, 12000);
      const data = await res.json();
      if (data.code !== 200) throw new Error(data.message || `HTTP ${res.status}`);
      return {
        items: (data.data || []).map((i) => ({
          id: i._id,
          title: i.title, company: i.companyName, position: i.positionName,
          grade: i.grade, batch: i.batch, round: i.round, result: i.result,
          summary: i.summary, questions: i.questionCount, views: i.viewCount,
        })),
        tip: '面经详情可用 mianjing_detail 查看完整题目列表。',
      };
    },
  });

  tool({
    name: 'mianjing_detail',
    description: '查看一条面经的完整内容（题目列表、流程记录）。',
    parameters: {
      id: { type: 'string', required: true, description: '面经 id（mianjing_search 返回里的 id）' },
    },
    async execute(args) {
      const res = await fetchWithTimeout(`https://www.codecvcv.com/api/mianjing/detail?id=${encodeURIComponent(String(args.id))}`, {}, 12000);
      const data = await res.json();
      if (data.code !== 200) throw new Error(data.message || `HTTP ${res.status}`);
      return { detail: data.data };
    },
  });

  tool({
    name: 'mianjing_companies',
    description: '列出面经库收录的公司（slug/别名/行业），用于 mianjing_search 的 company 参数。',
    parameters: {},
    async execute() {
      const res = await fetchWithTimeout('https://www.codecvcv.com/api/mianjing/companies', {}, 12000);
      const data = await res.json();
      if (data.code !== 200) throw new Error(data.message || `HTTP ${res.status}`);
      return { companies: (data.data || []).map((c) => ({ slug: c.slug || '', name: c.name || '', aliases: c.aliases || '', industry: c.industry || '' })) };
    },
  });

  tool({
    name: 'jobs_search',
    description: '搜索校招/实习岗位库（2.7 万条公开数据，来源公众号招聘文章）。可按公司/岗位/地点/行业筛选，返回报名入口链接。',
    parameters: {
      company: { type: 'string', description: '公司名（如 腾讯 / 字节跳动）' },
      positions: { type: 'string', description: '岗位名（如 后端 / 产品实习生）' },
      workLocation: { type: 'string', description: '工作地点（如 上海 / 全国）' },
      industry: { type: 'string', description: '行业（如 互联网 / 消费）' },
      title: { type: 'string', description: '标题关键词（如 2027实习）' },
      pageSize: { type: 'number', description: '条数，默认 10，最大 30' },
    },
    async execute(args) {
      const body = {
        pageNum: 1,
        pageSize: Math.min(args.pageSize || 10, 30),
        company: args.company, positions: args.positions,
        workLocation: args.workLocation, industry: args.industry, title: args.title,
      };
      for (const k of Object.keys(body)) if (!body[k]) delete body[k];
      const res = await fetchWithTimeout('https://www.codecvcv.com/api/job/page', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }, 12000);
      const data = await res.json();
      if (data.code !== 200) throw new Error(data.message || `HTTP ${res.status}`);
      return {
        total: data.total,
        items: (data.data || []).map((j) => ({
          title: j.title, company: j.company, positions: j.positions,
          location: j.workLocation, industry: j.industry, batch: j.channel,
          graduationYear: j.graduationYear,
          applyLink: j.referralMethod, deadline: j.deadline || null,
        })),
        total_in_db: data.total,
      };
    },
  });

  tool({
    name: 'resume_delete',
    description: '永久删除一份本地简历（不可恢复）。仅在用户明确要求删除时使用。',
    parameters: {
      id: { type: 'string', required: true, description: '简历 id' },
    },
    async execute(args) {
      return store.remove(String(args.id));
    },
  });

  tool({
    name: 'resume_duplicate',
    description: '复制一份简历（如"基于这份改一版投另一个岗位"）。',
    parameters: {
      id: { type: 'string', required: true, description: '要复制的简历 id' },
    },
    async execute(args) {
      const meta = store.duplicate(String(args.id));
      return { id: meta.id, name: meta.name };
    },
  });

  tool({
    name: 'template_list',
    description: '列出内置简历模板（编号/名称/适用标签）。创建简历前用它确认 type。',
    parameters: {},
    async execute() {
      return { templates: templates.map(({ type, name, description, tags }) => ({ type, name, description, tags })) };
    },
  });

  tool({
    name: 'template_get',
    description: '查看一个模板的完整示例正文（DSL 写法示范）。',
    parameters: {
      type: { type: 'string', required: true, description: '模板编号' },
    },
    async execute(args) {
      const tpl = getTemplate(String(args.type));
      if (!tpl) throw new Error(`未知模板 type: ${args.type}`);
      return { type: tpl.type, name: tpl.name, style: tpl.style, sampleContent: tpl.content };
    },
  });

  /* ---------- 增强功能工具（纯新增，与既有工具互不影响） ---------- */

  tool({
    name: 'resume_set_template',
    description: '一键换模板：只替换简历的版式与配色，正文一个字都不动。type 用内置模板编号，onlineType 用在线模板编号（二者择一）。',
    parameters: {
      id: { type: 'string', required: true, description: '简历 id' },
      type: { type: 'string', description: '内置模板编号，如 general / tech / ai_agent' },
      onlineType: { type: 'string', description: '在线模板编号，如 61' },
    },
    async execute(args) {
      const id = String(args.id);
      const meta = store.readMeta(id);
      if (!args.type && !args.onlineType) throw new Error('type 与 onlineType 至少给一个');
      if (args.onlineType) {
        const tpl = await fetchOnlineTemplate(String(args.onlineType));
        meta.style = mapOnlineStyle(tpl);
        meta.type = 'online';
        meta.onlineType = String(args.onlineType);
        meta.templateName = tpl.name;
      } else {
        const tpl = getTemplate(String(args.type));
        if (!tpl) throw new Error(`未知内置模板：${args.type}`);
        meta.style = { ...tpl.style };
        meta.type = tpl.type;
        meta.templateName = tpl.name;
        delete meta.onlineType;
      }
      meta.updatedAt = new Date().toISOString();
      store.writeMeta(id, meta);
      store.bumpRev();
      return { ok: true, id, template: meta.templateName, style: meta.style };
    },
  });

  tool({
    name: 'resume_sections',
    description: '列出简历的模块结构（按 ## 标题切分），返回序号与标题；配合 resume_move_section / resume_apply_edit 使用。',
    parameters: { id: { type: 'string', required: true, description: '简历 id' } },
    async execute(args) {
      const content = store.readContent(String(args.id));
      const { sections } = listSections(content);
      return { count: sections.length, sections: sections.map((x) => ({ index: x.index, title: x.title })) };
    },
  });

  tool({
    name: 'resume_move_section',
    description: '把某个模块上移/下移一位（调整简历板块顺序，比如把「项目经历」提到「实习经历」之前）。',
    parameters: {
      id: { type: 'string', required: true, description: '简历 id' },
      index: { type: 'number', required: true, description: '模块序号（从 0 开始，用 resume_sections 查）' },
      direction: { type: 'string', required: true, description: 'up 或 down' },
    },
    async execute(args) {
      const id = String(args.id);
      const rawDir = String(args.direction || '').trim().toLowerCase();
      if (rawDir !== 'up' && rawDir !== 'down') {
        throw new Error(`direction 必须为 up 或 down，收到: ${args.direction}`);
      }
      const dir = rawDir === 'up' ? -1 : 1;
      const r = moveSection(store.readContent(id), Number(args.index), dir);
      if (r.moved) store.save(id, { content: r.content });
      return { moved: r.moved, index: r.index, count: r.count };
    },
  });

  tool({
    name: 'resume_apply_edit',
    description: '局部改稿：只替换指定模块（## 标题）的正文，其它模块原样不动。比整篇 resume_write 更安全，适合按模块迭代修改。',
    parameters: {
      id: { type: 'string', required: true, description: '简历 id' },
      section: { type: 'string', required: true, description: '模块标题，如「实习经历」（支持模糊匹配）' },
      text: { type: 'string', required: true, description: '该模块新的正文（Markdown，不含 ## 标题行）' },
    },
    async execute(args) {
      const id = String(args.id);
      const r = applyEdit(store.readContent(id), args.section, args.text);
      store.save(id, { content: r.content });
      return { ok: true, section: r.section, index: r.index };
    },
  });

  tool({
    name: 'resume_proofread',
    description: '本地简历体检（不联网）：检查联系方式、模块完整性、成果量化、弱动词、空话、过长条目、标点混用，返回 0-100 分与问题清单。',
    parameters: { id: { type: 'string', required: true, description: '简历 id' } },
    async execute(args) {
      return proofread(store.readContent(String(args.id)));
    },
  });

  tool({
    name: 'resume_match_jd',
    description: 'JD 匹配度分析（不联网）：把岗位描述里的关键词和简历正文比覆盖率，返回匹配分、已命中词、缺失词，用于针对性补强简历。',
    parameters: {
      id: { type: 'string', required: true, description: '简历 id' },
      jd: { type: 'string', required: true, description: '岗位描述（JD）原文' },
    },
    async execute(args) {
      return matchJd(store.readContent(String(args.id)), String(args.jd ?? ''));
    },
  });

  tool({
    name: 'resume_import',
    description: '导入外部 Markdown 简历为新简历（从别的工具/旧简历迁移过来时用）。',
    parameters: {
      name: { type: 'string', description: '新简历名称' },
      content: { type: 'string', required: true, description: 'Markdown 正文' },
      baseType: { type: 'string', description: '套用哪个内置模板的样式，默认 general' },
    },
    async execute(args) {
      const text = String(args.content ?? '');
      if (!text.trim()) throw new Error('content 为空');
      const base = getTemplate(String(args.baseType || 'general')) || templates[0];
      return { item: store.createWith(String(args.name || '导入的简历').slice(0, 60), { ...base.style }, text, 'imported') };
    },
  });

  /* ---------- 面板 HTTP API（浏览器工作台同源调用） ---------- */

  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: API_PREFIX,
    handler: async (req, res) => {
      const url = new URL(req.url, 'http://local');
      const sub = url.pathname.slice(API_PREFIX.length) || '/';
      const seg = sub.split('/').filter(Boolean);

      try {
        // GET /rev
        if (req.method === 'GET' && sub === '/rev') {
          return sendJson(res, 200, { rev: store.rev });
        }

        // GET /resumes
        if (req.method === 'GET' && sub === '/resumes') {
          return sendJson(res, 200, { rev: store.rev, items: store.list() });
        }

        // GET /preview-local-tpl/:type → 内置模板示例整页渲染（保真效果，模板中心卡片用）
        if (req.method === 'GET' && seg[0] === 'preview-local-tpl' && seg[1]) {
          const tpl = getTemplate(String(seg[1]));
          if (!tpl) return sendJson(res, 404, { ok: false, error: '模板不存在' });
          const html = await renderFidelityDocument(tpl.content, tpl.style, tpl.name, { printMode: true });
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
          return res.end(html);
        }

        // GET /online-template/:tid → 单个在线模板完整信息（含正文，用于预览/使用）
        if (req.method === 'GET' && seg[0] === 'online-template' && seg[1]) {
          const tpl = await fetchOnlineTemplate(String(seg[1]));
          const mapped = mapOnlineStyle(tpl);
          const html = await renderFidelityDocument(tpl.content, mapped, tpl.name || '在线模板预览', {
            printMode: true,
            themeCssUrl: themeCssUrlFor(String(seg[1])),
          });
          return sendJson(res, 200, {
            id: tpl._id, name: tpl.name, description: tpl.description, cover: tpl.cover,
            tags: (tpl.tags || []).slice(0, 6), style: mapped, content: tpl.content, previewHtml: html,
          });
        }

        // GET /online-templates → 在线模板列表（10 分钟缓存）
        if (req.method === 'GET' && sub === '/online-templates') {
          if (config.onlineTemplates === false) return sendJson(res, 200, { items: [], disabled: true });
          const now = Date.now();
          if (!onlineTplCache.at || now - onlineTplCache.at > 10 * 60 * 1000) {
            const res2 = await fetchWithTimeout('https://www.codecvcv.com/api/cv/public/page', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ pageNum: 1, pageSize: 120, sortField: 'hot', needDescription: true, wheres: {} }),
            }, 12000);
            const data = await res2.json();
            if (data.code !== 200) throw new Error(`在线模板源请求失败: ${data.message || res2.status}`);
            onlineTplCache.at = now;
            onlineTplCache.items = (data.data || []).map((t) => ({
              id: t.type,
              slug: t.slug, name: t.name, description: (t.description || '').slice(0, 120),
              cover: t.cover, tags: (t.tags || []).slice(0, 6),
              style: {
                primaryColor: t.primaryColor || '#333333',
                primaryBGColor: t.primaryBgColor || t.primaryColor || '#4A6FA5',
                fontFamily: t.font || "'Noto Sans SC', 'Microsoft YaHei', sans-serif",
                lineHeight: t.lineHeight || 20,
              },
              hot: t.hot,
            }));
          }
          return sendJson(res, 200, { items: onlineTplCache.items });
        }

        // POST /resumes  {type, name} 或 {onlineType, name, useContent?}（在线模板样式 + 真实示例内容）
        if (req.method === 'POST' && sub === '/resumes') {
          const body = await readBody(req);
          if (body.onlineType) {
            const tpl = await fetchOnlineTemplate(String(body.onlineType));
            const style = mapOnlineStyle(tpl);
            const useContent = body.useContent !== false; // 默认带真实示例内容
            const meta = store.createWith(
              body.name || `${tpl.name} - 未命名`,
              style,
              useContent ? tpl.content : (getTemplate('general') || {}).content || '',
              'online',
            );
            meta.templateName = tpl.name;
            meta.onlineType = String(body.onlineType);
            store.writeMeta(meta.id, meta);
            return sendJson(res, 200, { item: meta });
          }
          const meta = store.create(String(body.type || 'general'), body.name);
          return sendJson(res, 200, { item: meta });
        }

        // GET /templates
        if (req.method === 'GET' && sub === '/templates') {
          return sendJson(res, 200, {
            items: templates.map(({ type, name, description, tags, style }) => ({ type, name, description, tags, style })),
          });
        }

        // /resume/:id
        if (seg[0] === 'resume' && seg[1]) {
          const id = String(seg[1]);

          // GET /resume/:id/avatar → 头像文件
          if (req.method === 'GET' && seg[2] === 'avatar') {
            const file = store.avatarFile(id);
            if (!file) return sendJson(res, 404, { ok: false, error: '未设置头像' });
            const ext = nodePath.extname(file).slice(1);
            const data = nodeFs.readFileSync(file);
            res.writeHead(200, { 'Content-Type': `image/${ext === 'jpeg' ? 'jpeg' : ext}`, 'Cache-Control': 'no-store', 'Content-Length': data.length });
            return res.end(data);
          }

          // GET /resume/:id/logo → 校徽文件
          if (req.method === 'GET' && seg[2] === 'logo') {
            const file = store.schoolLogoFile(id);
            if (!file) return sendJson(res, 404, { ok: false, error: '未设置校徽' });
            const ext = nodePath.extname(file).slice(1);
            const types = { svg: 'image/svg+xml', png: 'image/png', jpeg: 'image/jpeg', jpg: 'image/jpeg', webp: 'image/webp' };
            const data = nodeFs.readFileSync(file);
            res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream', 'Cache-Control': 'no-store', 'Content-Length': data.length });
            return res.end(data);
          }

          // GET /resume/:id/fragment → 正文片段 HTML（所见即所得编辑态）
          if (req.method === 'GET' && seg[2] === 'fragment') {
            const content = store.readContent(id);
            return sendJson(res, 200, { html: renderBody(content) });
          }

          // GET /resume/:id/sections → 模块结构清单（换序面板用）
          // 必须放在下面的通用 GET /resume/:id 之前，否则会被它吞掉
          if (req.method === 'GET' && seg[2] === 'sections') {
            const content = store.readContent(id);
            return sendJson(res, 200, listSections(content).sections.map((x) => ({ index: x.index, title: x.title })));
          }

          // GET /resume/:id/proofread → 本地体检报告（同样必须先于通用 GET）
          if (req.method === 'GET' && seg[2] === 'proofread') {
            const content = store.readContent(id);
            return sendJson(res, 200, proofread(content));
          }

          if (req.method === 'GET') {
            const meta = store.readMeta(id);
            const content = store.readContent(id);
            const html = renderDocument(content, meta.style, meta.name);
            return sendJson(res, 200, { item: meta, content, html });
          }

          if (req.method === 'PUT') {
            const body = await readBody(req);
            const meta = store.save(id, { content: body.content, style: body.style, name: body.name });
            let result = { ok: true, item: meta, rev: store.rev };
            if (body.autoOnePage !== undefined) {
              store.setAutoOnePage(id, !!body.autoOnePage);
              result.item.autoOnePage = !!body.autoOnePage;
            }
            return sendJson(res, 200, result);
          }

          if (req.method === 'DELETE') {
            return sendJson(res, 200, store.remove(id));
          }
        }

        /* ==================== 增强功能路由（不改动既有链路） ==================== */

        // POST /resume/:id/move-section {index, dir}
        if (req.method === 'POST' && seg[0] === 'resume' && seg[1] && seg[2] === 'move-section') {
          const id = String(seg[1]);
          const body = await readBody(req);
          const content = store.readContent(id);
          const r = moveSection(content, body.index, body.dir === -1 ? -1 : 1);
          if (r.moved) store.save(id, { content: r.content });
          return sendJson(res, 200, { ...r, rev: store.rev });
        }

        // POST /resume/:id/remove-section {index}
        if (req.method === 'POST' && seg[0] === 'resume' && seg[1] && seg[2] === 'remove-section') {
          const id = String(seg[1]);
          const body = await readBody(req);
          const r = removeSection(store.readContent(id), body.index);
          store.save(id, { content: r.content });
          return sendJson(res, 200, { ...r, rev: store.rev });
        }

        // POST /resume/:id/apply-edit {section, text} → 只替换该模块正文
        if (req.method === 'POST' && seg[0] === 'resume' && seg[1] && seg[2] === 'apply-edit') {
          const id = String(seg[1]);
          const body = await readBody(req);
          const r = applyEdit(store.readContent(id), body.section, body.text ?? '');
          store.save(id, { content: r.content });
          return sendJson(res, 200, { ok: true, section: r.section, rev: store.rev });
        }

        // POST /resume/:id/template {type | onlineType} → 只换版式，正文原样保留
        if (req.method === 'POST' && seg[0] === 'resume' && seg[1] && seg[2] === 'template') {
          const id = String(seg[1]);
          const body = await readBody(req);
          const meta = store.readMeta(id);
          const before = store.readContent(id);

          if (body.onlineType) {
            const tpl = await fetchOnlineTemplate(String(body.onlineType));
            meta.style = mapOnlineStyle(tpl);
            meta.type = 'online';
            meta.onlineType = String(body.onlineType);
            meta.templateName = tpl.name;
          } else {
            const tpl = getTemplate(String(body.type || ''));
            if (!tpl) return sendJson(res, 404, { ok: false, error: '模板不存在' });
            meta.style = { ...tpl.style };
            meta.type = tpl.type;
            meta.templateName = tpl.name;
            delete meta.onlineType;
          }
          meta.updatedAt = new Date().toISOString();
          store.writeMeta(id, meta);
          store.bumpRev();
          // 防御：换模板绝不允许动正文
          if (store.readContent(id) !== before) throw new Error('内部错误：换模板时正文被修改');
          return sendJson(res, 200, { ok: true, item: meta, rev: store.rev });
        }

        // POST /resume/:id/match-jd {jd}
        if (req.method === 'POST' && seg[0] === 'resume' && seg[1] && seg[2] === 'match-jd') {
          const body = await readBody(req);
          const content = store.readContent(String(seg[1]));
          return sendJson(res, 200, matchJd(content, body.jd ?? ''));
        }

        // POST /import {name, content} → 导入外部 Markdown 为新简历
        if (req.method === 'POST' && sub === '/import') {
          const body = await readBody(req);
          const text = String(body.content ?? '');
          if (!text.trim()) return sendJson(res, 400, { ok: false, error: '内容为空' });
          const base = getTemplate(String(body.baseType || 'general')) || templates[0];
          const name = String(body.name || '导入的简历').slice(0, 60);
          const meta = store.createWith(name, { ...base.style }, text, 'imported');
          return sendJson(res, 200, { item: meta, rev: store.rev });
        }

        /**
         * POST /preview-live/:id → 只渲染正文片段（不落盘）。
         * 编辑器边打字边推送右侧预览，与整页预览共用同一套渲染引擎，
         * 从根上避免「左边有、右边没有」的两套渲染器不一致。
         */
        if (req.method === 'POST' && seg[0] === 'preview-live' && seg[1]) {
          const body = await readBody(req);
          const html = await renderLiveBody(String(body.content ?? ''));
          return sendJson(res, 200, { html });
        }

        // GET /preview/:id → 保真渲染（编辑器同款效果）A4 文档；?print=1 净版；?simple=1 旧简化渲染（所见即所得编辑源）
        if (req.method === 'GET' && seg[0] === 'preview' && seg[1]) {
          const id = String(seg[1]);
          const simple = url.searchParams.get('simple') === '1';
          if (simple) {
            const meta = store.readMeta(id);
            const content = store.readContent(id);
            const html = renderDocument(content, meta.style, meta.name);
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
            return res.end(html);
          }
          const printMode = url.searchParams.get('print') === '1';
          const thumbMode = url.searchParams.get('thumb') === '1';
          const html = await renderResumeFidelity(id, { printMode, thumbMode, interactive: !printMode && !thumbMode });
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
          return res.end(html);
        }

        // POST /resume/:id/logo → 上传校徽 {imageDataUrl}
        if (req.method === 'POST' && seg[0] === 'resume' && seg[1] && seg[2] === 'logo') {
          const body = await readBody(req);
          return sendJson(res, 200, store.saveSchoolLogo(String(seg[1]), String(body.imageDataUrl || '')));
        }

        // PATCH /resume/:id/logo → 调整校徽位置 {top,left}
        if (req.method === 'PATCH' && seg[0] === 'resume' && seg[1] && seg[2] === 'logo') {
          const body = await readBody(req);
          return sendJson(res, 200, store.setSchoolLogoPosition(String(seg[1]), Number(body.top || 0), Number(body.left || 0)));
        }

        // POST /resume/:id/avatar → 上传头像 {imageDataUrl}
        if (req.method === 'POST' && seg[0] === 'resume' && seg[1] && seg[2] === 'avatar') {
          const body = await readBody(req);
          return sendJson(res, 200, store.saveAvatar(String(seg[1]), String(body.imageDataUrl || '')));
        }

        // PATCH /resume/:id/avatar → 调整位置 {top,left,shape}
        if (req.method === 'PATCH' && seg[0] === 'resume' && seg[1] && seg[2] === 'avatar') {
          const body = await readBody(req);
          return sendJson(res, 200, store.setAvatarPosition(String(seg[1]), Number(body.top || 0), Number(body.left || 0), body.shape));
        }

        // GET /export/:id?format=md|html|pdf|png → 附件下载
        if (req.method === 'GET' && seg[0] === 'export' && seg[1]) {
          const format = String(url.searchParams.get('format') || 'md').trim().toLowerCase();
          const { file } = await store.exportTo(String(seg[1]), format, ctx);
          const data = nodeFs.readFileSync(file);
          const types = {
            md: 'text/markdown; charset=utf-8',
            html: 'text/html; charset=utf-8',
            pdf: 'application/pdf',
            png: 'image/png',
          };
          res.writeHead(200, {
            'Content-Type': types[format] || 'application/octet-stream',
            'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(nodePath.basename(file))}`,
            'Content-Length': data.length,
          });
          return res.end(data);
        }

        return sendJson(res, 404, { ok: false, error: `no route: ${req.method} ${sub}` });
      } catch (error) {
        return sendJson(res, 400, { ok: false, error: String(error?.message || error) });
      }
    },
  }), 'resume-api-routes');

  ctx.logger?.info?.(`dsh-resume: 就绪（存储目录 ${store.dir}，rev=${store.rev}）`);
}
