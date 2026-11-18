/**
 * 简历导出引擎（V2）
 * - PDF：系统 Edge / Chrome headless --print-to-pdf（真排版引擎，零第三方依赖）
 * - PNG：优先 dsh-builtin-browser 全页截图，不可用或无 HTTP 源时降级系统 Edge / Chrome headless --screenshot
 */
import { spawn } from 'node:child_process';
import nodeFs from 'node:fs';
import nodeOs from 'node:os';
import nodePath from 'node:path';
import { createRequire } from 'node:module';

let _sharp;
/** 解析 DSH 自带的 sharp（宿主进程内可用；失败返回 null，调用方降级为不裁剪） */
async function getSharp() {
  if (_sharp !== undefined) return _sharp;
  try { _sharp = await import('sharp'); return (_sharp = _sharp.default ?? _sharp); } catch { /* 继续 */ }
  try {
    const anchor = process.env.DSH_INSTALL_DIR;
    if (anchor) {
      const req = createRequire(nodePath.join(anchor, 'index.js'));
      _sharp = req('sharp');
      return _sharp;
    }
  } catch { /* 继续 */ }
  try {
    if (process.resourcesPath) {
      const req = createRequire(nodePath.join(process.resourcesPath, 'app.asar', 'dsh', 'node_modules', '@deepseek-ai', 'dsh', 'index.js'));
      _sharp = req('sharp');
      return _sharp;
    }
  } catch { /* 继续 */ }
  _sharp = null;
  return null;
}

/**
 * 整页截图裁掉视口带来的右侧空白：保留 A4 页宽（794px，DPR=1）。
 * sharp 不可用时保持原图不裁（功能不劣化，只是可能带留白）。
 */
export async function cropPngToPageWidth(file, pageWidth = 794) {
  const sharp = await getSharp();
  if (!sharp) return { cropped: false };
  const meta = await sharp(file).metadata();
  if (!meta.width || meta.width <= pageWidth) return { cropped: false };
  const tmp = file + '.crop.png';
  await sharp(file).extract({ left: 0, top: 0, width: pageWidth, height: meta.height }).toFile(tmp);
  nodeFs.rmSync(file, { force: true });
  nodeFs.renameSync(tmp, file);
  return { cropped: true, width: pageWidth, height: meta.height };
}

/** 常见系统浏览器位置（Windows 优先 Edge，其次 Chrome；含用户目录安装与 macOS/linux 兜底） */
const LOCAL_APP = process.env.LOCALAPPDATA ? process.env.LOCALAPPDATA.replace(/\\/g, '/') : '';
const BROWSER_CANDIDATES = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  ...(LOCAL_APP ? [`${LOCAL_APP}/Microsoft/Edge/Application/msedge.exe`] : []),
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  ...(LOCAL_APP ? [`${LOCAL_APP}/Google/Chrome/Application/chrome.exe`] : []),
  '/usr/bin/microsoft-edge',
  '/usr/bin/microsoft-edge-stable',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];

/** 探测可用的打印引擎；configured 优先（后续 Config 暴露）。 */
export function findBrowserBinary(configured) {
  const list = configured ? [configured, ...BROWSER_CANDIDATES] : BROWSER_CANDIDATES;
  for (const p of list) {
    try { if (nodeFs.existsSync(p)) return p; } catch { /* 忽略 */ }
  }
  return null;
}

/**
 * headless 打印 URL 为 PDF。
 * @returns {Promise<{file: string, engine: string}>}
 */
export function printToPdf(browserExe, url, outPath, { timeoutMs = 90_000 } = {}) {
  return new Promise((resolve, reject) => {
    const profileDir = nodeFs.mkdtempSync(nodePath.join(nodeOs.tmpdir(), 'cvr-print-'));
    // 新旧两代 flag 都带上：不认识的会被忽略。--user-data-dir 隔离，避免动用户真实浏览器配置。
    const args = [
      '--headless',
      '--disable-gpu',
      '--no-first-run',
      '--disable-extensions',
      `--user-data-dir=${profileDir}`,
      '--no-pdf-header-footer',
      '--print-to-pdf-no-header',
      `--print-to-pdf=${outPath}`,
      '--virtual-time-budget=10000',
      url,
    ];
    let child;
    try {
      child = spawn(browserExe, args, { stdio: 'ignore', windowsHide: true });
    } catch (error) {
      try { nodeFs.rmSync(profileDir, { recursive: true, force: true }); } catch { /* 忽略 */ }
      reject(error);
      return;
    }
    const timer = setTimeout(() => {
      try { child.kill(); } catch { /* 忽略 */ }
      reject(new Error('PDF 渲染超时（90s）'));
    }, timeoutMs);
    child.on('error', (error) => {
      clearTimeout(timer);
      try { nodeFs.rmSync(profileDir, { recursive: true, force: true }); } catch { /* 忽略 */ }
      reject(error);
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      try { nodeFs.rmSync(profileDir, { recursive: true, force: true }); } catch { /* 忽略 */ }
      const ok = nodeFs.existsSync(outPath) && nodeFs.statSync(outPath).size > 800;
      if (ok) resolve({ file: outPath, engine: nodePath.basename(browserExe) });
      else reject(new Error(`PDF 生成失败（浏览器退出码 ${code}）— 可尝试在设置里指定浏览器路径`));
    });
  });
}

/**
 * headless 截图 URL 为 PNG（不依赖内置浏览器插件）。
 * @returns {Promise<{file: string, engine: string}>}
 */
/** 无头测量页面对齐 1123px 后的真实总高度（供多页 PNG 完整长图导出） */
function measurePngHeight(browserExe, url, timeoutMs = 30_000) {
  return new Promise((resolve) => {
    const profileDir = nodeFs.mkdtempSync(nodePath.join(nodeOs.tmpdir(), 'cvr-png-m-'));
    const args = [
      '--headless',
      '--disable-gpu',
      '--no-first-run',
      '--disable-extensions',
      `--user-data-dir=${profileDir}`,
      '--force-device-scale-factor=1',
      '--window-size=794,1123',
      '--virtual-time-budget=8000',
      '--dump-dom',
      url,
    ];
    let out = '';
    let child;
    try {
      child = spawn(browserExe, args, { stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true });
    } catch {
      try { nodeFs.rmSync(profileDir, { recursive: true, force: true }); } catch {}
      resolve(1123);
      return;
    }
    const timer = setTimeout(() => { try { child.kill(); } catch {} resolve(1123); }, timeoutMs);
    child.stdout?.on('data', (d) => { if (out.length < 256_000) out += d.toString('utf8'); });
    child.on('error', () => {
      clearTimeout(timer);
      try { nodeFs.rmSync(profileDir, { recursive: true, force: true }); } catch {}
      resolve(1123);
    });
    child.on('exit', () => {
      clearTimeout(timer);
      try { nodeFs.rmSync(profileDir, { recursive: true, force: true }); } catch {}
      const m = out.match(/data-cvr-height="(\d+)"/i);
      const h = m ? Number(m[1]) : 1123;
      resolve(Number.isFinite(h) && h >= 1123 ? Math.min(h, 1123 * 12) : 1123);
    });
  });
}

export async function printToPng(browserExe, url, outPath, { timeoutMs = 90_000, autoOnePage = false } = {}) {
  const targetH = autoOnePage ? 1123 : await measurePngHeight(browserExe, url, Math.min(timeoutMs, 30_000));
  return new Promise((resolve, reject) => {
    const profileDir = nodeFs.mkdtempSync(nodePath.join(nodeOs.tmpdir(), 'cvr-png-'));
    const args = [
      '--headless',
      '--disable-gpu',
      '--no-first-run',
      '--disable-extensions',
      '--hide-scrollbars',
      `--user-data-dir=${profileDir}`,
      '--force-device-scale-factor=1',
      `--window-size=794,${targetH}`,
      '--virtual-time-budget=10000',
      `--screenshot=${outPath}`,
      url,
    ];
    let child;
    try {
      child = spawn(browserExe, args, { stdio: 'ignore', windowsHide: true });
    } catch (error) {
      try { nodeFs.rmSync(profileDir, { recursive: true, force: true }); } catch { /* 忽略 */ }
      reject(error);
      return;
    }
    const timer = setTimeout(() => {
      try { child.kill(); } catch { /* 忽略 */ }
      reject(new Error('PNG 渲染超时（90s）'));
    }, timeoutMs);
    child.on('error', (error) => {
      clearTimeout(timer);
      try { nodeFs.rmSync(profileDir, { recursive: true, force: true }); } catch { /* 忽略 */ }
      reject(error);
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      try { nodeFs.rmSync(profileDir, { recursive: true, force: true }); } catch { /* 忽略 */ }
      const ok = nodeFs.existsSync(outPath) && nodeFs.statSync(outPath).size > 800;
      if (ok) resolve({ file: outPath, engine: nodePath.basename(browserExe) });
      else reject(new Error(`PNG 生成失败（浏览器退出码 ${code}）— 可尝试在设置里指定浏览器路径`));
    });
  });
}

/** 供 PNG 截图的净版预览 URL */
export function previewUrl(origin, id, { print = false } = {}) {
  return `${origin.replace(/\/$/, '')}/resume/api/preview/${id}${print ? '?print=1' : ''}`;
}
