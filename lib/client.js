/**
 * dsh-resume · Client half (v0.2.0 UI 精修版)
 *
 * 入口矩阵：
 * - main slot 页面（中栏整页） ← sidebar.panellist 全局面板行（「插件」旁）点击落点
 * - sidebar.right.pane.tab 右侧栏工作台 tab
 * - tool.call.toolview 聊天内嵌卡片（Agent 保存简历后）
 * （底部 footer 按钮已按需求移除，避免入口冗余）
 *
 * 与 Host 的同步：同源 fetch /resume/api/* + 3s 轮询 rev。
 */
window.__ModuleLoader__.load({
  id: 'dsh-resume',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { useState, useEffect, useRef, useCallback, useMemo } = React;

    const API = '/resume/api';
    const TAB_ID = 'dsh-resume/workbench';
    const PANEL_ID = 'dsh-resume/panel';

    /* ------------------------------- icon system ------------------------------ */
    // 16 网格 stroke 图标，currentColor 描边，与宿主插件（armory 等）同风格。

    const ICONS = {
      resume: 'M9.5 1.5H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V5L9.5 1.5zM9.5 1.5V5H13M5.5 8.2h5M5.5 10.5h5M5.5 5.5h2',
      plus: 'M8 3v10M3 8h10',
      doc: 'M9.5 1.5H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V5L9.5 1.5zM9.5 1.5V5H13M5.5 8h5M5.5 10.5h5',
      code: 'M5.5 5L2.5 8l3 3M10.5 5l3 3-3 3',
      pen: 'M12.3 2.7a1.6 1.6 0 0 1 2.3 2.3L6 13.6l-3.5.9.9-3.5zM11 4l2.3 2.3',
      download: 'M8 2v8M4.8 7l3.2 3.2L11.2 7M3 13.5h10',
      globe: 'M8 1.8a6.2 6.2 0 1 0 0 12.4A6.2 6.2 0 0 0 8 1.8zM1.8 8h12.4M8 1.8c1.9 1.7 2.8 3.8 2.8 6.2s-.9 4.5-2.8 6.2C6.1 12.5 5.2 10.4 5.2 8S6.1 3.5 8 1.8z',
      trash: 'M3 4h10M6.5 4V2.8a.8.8 0 0 1 .8-.8h1.4a.8.8 0 0 1 .8.8V4M4.5 4l.6 9a1 1 0 0 0 1 .9h3.8a1 1 0 0 0 1-.9l.6-9M6.7 7v4.5M9.3 7v4.5',
      refresh: 'M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 2.5v3h-3',
      zoomOut: 'M10.5 6.5h-5M8 1.8a6.2 6.2 0 1 0 0 12.4A6.2 6.2 0 0 0 8 1.8zM13.8 13.8L10.6 10.6',
      zoomIn: 'M8 5.5v5M5.5 8h5M8 1.8a6.2 6.2 0 1 0 0 12.4A6.2 6.2 0 0 0 8 1.8zM13.8 13.8L10.6 10.6',
      portrait: 'M8 1.8a6.2 6.2 0 1 0 0 12.4A6.2 6.2 0 0 0 8 1.8zM5.6 11.7c.5-1.7 1.4-2.5 2.4-2.5s1.9.8 2.4 2.5M8 4.2a1.9 1.9 0 1 0 0 3.8 1.9 1.9 0 0 0 0-3.8z',
      pdf: 'M9.5 1.5H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V5L9.5 1.5zM9.5 1.5V5H13M5.5 8.5h5v3h-5z',
      fit: 'M5 2.5H3.2a.7.7 0 0 0-.7.7V5M11 2.5h1.8a.7.7 0 0 1 .7.7V5M2.5 11v1.8a.7.7 0 0 0 .7.7H5M13.5 11v1.8a.7.7 0 0 1-.7.7H11M5.8 8h4.4M8 5.8v4.4',
      cloud: 'M4.6 12.5a3.1 3.1 0 0 1-.4-6.2 4 4 0 0 1 7.8-.9 2.9 2.9 0 0 1 .4 5.7M8 6.5v5M5.8 9.3 8 11.5l2.2-2.2',
      external: 'M9.5 2.5h4v4M13.2 2.8L7.5 8.5M11 9.5v3a1 1 0 0 1-1 1H3.5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h3',
      open: 'M6.5 3.5H3.5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V9.5M9.5 2h4.5v4.5M13.6 2.4L7.8 8.2',
      check: 'M3 8.5l3.2 3.2L13 4.5',
      search: 'M7 13a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM14.5 14.5L11 11',
      bold: 'M6 3v10M6 3h4a2.5 2.5 0 0 1 0 5H6M6 8h4.5a2.5 2.5 0 0 1 0 5H6',
      italic: 'M9.5 3h4.5M6 13h4.5M10 3L6.5 13',
      underline: 'M8 2.5v6.5M5 12c0 1.6 1.3 2.2 3 2.2s3-.6 3-2.2M4.5 14.5h7',
      strike: 'M3.5 8h9M6 4h4M6 12h4M4.5 6.5c.5-2.5 8-2 8 .5M4.5 9.5c.5 2.5 8 2 8-.5',
      listU: 'M5.5 4h8M5.5 8h8M5.5 12h8M2.8 4h.01M2.8 8h.01M2.8 12h.01',
      listO: 'M6 4h7.5M6 8h7.5M6 12h7.5M3 3.5h.8v2M2.8 7.5h1.2v2.5h-1.2M3 12h1.5',
      eraser: 'M3.5 13.5h9M9 2.5l4.5 4.5-6.5 6.5H4.5L2.5 11z',
      dot: 'M8 6.4a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2z',
      undo: 'M4 6.5h5.5a3.5 3.5 0 0 1 0 7H7M4 6.5L6.5 4M4 6.5L6.5 9',
      redo: 'M12 6.5H6.5a3.5 3.5 0 0 0 0 7H9M12 6.5L9.5 4M12 6.5L9.5 9',
      layers: 'M8 2.2L2.4 5.2 8 8.2l5.6-3zM2.6 8.6L8 11.6l5.4-3M2.6 11.6L8 14.6l5.4-3',
      target: 'M8 1.8a6.2 6.2 0 1 0 0 12.4A6.2 6.2 0 0 0 8 1.8zM8 4.9a3.1 3.1 0 1 0 0 6.2 3.1 3.1 0 0 0 0-6.2zM8 7.4a.6.6 0 1 0 0 1.2.6.6 0 0 0 0-1.2z',
      swap: 'M4.5 3.5h7l-2-2M11.5 12.5h-7l2 2M11.5 3.5l-2 2M4.5 12.5l2-2',
      upload: 'M8 11V3M4.8 6.2L8 3l3.2 3.2M3 12.5h10',
      arrowUp: 'M8 12.5V3.5M4.5 7L8 3.5 11.5 7',
      arrowDown: 'M8 3.5v9M4.5 9l3.5 3.5L11.5 9',
    };

    const Icon = ({ d, size = 14, className }) =>
      h('svg', {
        className,
        width: size, height: size, viewBox: '0 0 16 16',
        fill: 'none', stroke: 'currentColor', strokeWidth: 1.6,
        strokeLinecap: 'round', strokeLinejoin: 'round',
        'aria-hidden': true,
        style: { flex: 'none', display: 'block' },
      }, h('path', { d }));

    /* --------------------------------- styles --------------------------------- */

    const CSS = `
/* ================================================================
   dsh-resume · Fresh Mint Soft UI 设计系统
   浅薄荷绿 / 嫩绿 / 奶白 / 浅灰 + 柔和黄点缀
   ================================================================ */
.cvr-root,
.cvr-workbench,
.cvr-toolcard {
  --rs-accent: #10b981;
  --rs-accent-hover: #059669;
  --rs-accent-strong: #34d399;
  --rs-accent-soft: rgba(16,185,129,.1);
  --rs-accent-soft-2: rgba(16,185,129,.16);
  --rs-mint-grad: linear-gradient(135deg, #6ee7b7 0%, #34d399 55%, #10b981 100%);
  --rs-warn: #f59e0b;
  --rs-warn-soft: rgba(245,158,11,.12);
  --rs-danger: #e11d48;
  --rs-danger-soft: rgba(225,29,72,.1);
  --rs-info: #38bdf8;
  --rs-page: #f0f7f2;
  --rs-card: #ffffff;
  --rs-card-2: #fbfdfb;
  --rs-border: rgba(20,80,50,.12);
  --rs-border-2: rgba(16,185,129,.25);
  --rs-text: #1a2e24;
  --rs-muted: rgba(20,60,40,.55);
  --rs-seg-hover: rgba(255,255,255,.5);
  --rs-mask: rgba(16,64,42,.4);
  --rs-shadow: 0 2px 10px rgba(16,64,42,.06);
  --rs-shadow-md: 0 6px 20px rgba(16,64,42,.09);
  --rs-shadow-lg: 0 18px 48px rgba(16,64,42,.14);
  --rs-radius: 16px;
  color-scheme: light dark;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-cvr-theme="light"]) .cvr-root,
  :root:not([data-cvr-theme="light"]) .cvr-workbench,
  :root:not([data-cvr-theme="light"]) .cvr-toolcard {
    --rs-accent: #22c55e;
    --rs-accent-hover: #16a34a;
    --rs-accent-strong: #16a34a;
    --rs-accent-soft: rgba(34,197,94,.12);
    --rs-accent-soft-2: rgba(34,197,94,.18);
    --rs-mint-grad: linear-gradient(135deg, #22c55e 0%, #16a34a 55%, #15803d 100%);
    --rs-warn: #f59e0b;
    --rs-warn-soft: rgba(245,158,11,.12);
    --rs-danger: #ef4444;
    --rs-danger-soft: rgba(239,68,68,.12);
    --rs-info: #3b82f6;
    --rs-page: #18181b;
    --rs-card: #27272a;
    --rs-card-2: #2e2e33;
    --rs-border: rgba(255,255,255,.08);
    --rs-border-2: rgba(255,255,255,.15);
    --rs-text: #e4e4e7;
    --rs-muted: rgba(228,228,231,.5);
    --rs-seg-hover: rgba(255,255,255,.1);
    --rs-mask: rgba(0,0,0,.55);
    --rs-shadow: 0 2px 10px rgba(0,0,0,.35);
    --rs-shadow-md: 0 8px 24px rgba(0,0,0,.4);
    --rs-shadow-lg: 0 18px 48px rgba(0,0,0,.5);
  }
}
:root[data-cvr-theme="dark"] .cvr-root,
:root[data-cvr-theme="dark"] .cvr-workbench,
:root[data-cvr-theme="dark"] .cvr-toolcard,
body[data-ds-dark-theme] .cvr-root,
body[data-ds-dark-theme] .cvr-workbench,
body[data-ds-dark-theme] .cvr-toolcard {
  --rs-accent: #22c55e;
  --rs-accent-hover: #16a34a;
  --rs-accent-strong: #16a34a;
  --rs-accent-soft: rgba(34,197,94,.12);
  --rs-accent-soft-2: rgba(34,197,94,.18);
  --rs-mint-grad: linear-gradient(135deg, #22c55e 0%, #16a34a 55%, #15803d 100%);
  --rs-warn: #f59e0b;
  --rs-warn-soft: rgba(245,158,11,.12);
  --rs-danger: #ef4444;
  --rs-danger-soft: rgba(239,68,68,.12);
  --rs-info: #3b82f6;
  --rs-page: #18181b;
  --rs-card: #27272a;
  --rs-card-2: #2e2e33;
  --rs-border: rgba(255,255,255,.08);
  --rs-border-2: rgba(255,255,255,.15);
  --rs-text: #e4e4e7;
  --rs-muted: rgba(228,228,231,.5);
  --rs-seg-hover: rgba(255,255,255,.1);
  --rs-mask: rgba(0,0,0,.55);
  --rs-shadow: 0 2px 10px rgba(0,0,0,.35);
  --rs-shadow-md: 0 8px 24px rgba(0,0,0,.4);
  --rs-shadow-lg: 0 18px 48px rgba(0,0,0,.5);
}

/* ============ 页面外壳 ============ */
.cvr-root {
  display: flex; flex-direction: column; height: 100%; min-height: 0;
  font-size: 13px; color: var(--rs-text); overflow: hidden;
  padding: 10px; gap: 10px;
  background: var(--rs-page); border-radius: 16px;
}
.cvr-workbench {
  display: flex; flex-direction: column; flex: 1; height: 100%; min-height: 0; gap: 10px;
  position: relative; background: var(--rs-page); color: var(--rs-text); border-radius: 14px;
}

/* ============ 导航胶囊行 ============ */
.cvr-page-tabs {
  position: relative;
  display: flex; align-items: center; gap: 6px;
  padding: 10px 18px; border-radius: 16px;
  background: linear-gradient(135deg, #6ee7b7 0%, #34d399 55%, #10b981 100%);
  border: none; box-shadow: 0 8px 26px rgba(16,185,129,.4);
  color: #fff;
}
.cvr-page-tabs::before {
  content: ''; position: absolute; inset: 0; border-radius: 16px; pointer-events: none;
  background: radial-gradient(ellipse 340px 90px at 88% 15%, rgba(255,255,255,.28), transparent 70%);
}
.cvr-page-tabs > * { position: relative; z-index: 1; }
.cvr-navtab {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 7px 18px; border-radius: 999px;
  font-size: 13px; font-weight: 600;
  color: rgba(255,255,255,.88); background: rgba(255,255,255,.16);
  border: 1px solid rgba(255,255,255,.25);
  cursor: pointer; transition: all .18s ease;
}
.cvr-navtab:hover { color: #fff; background: rgba(255,255,255,.32); }
.cvr-navtab.active {
  color: var(--rs-accent); background: #ffffff; font-weight: 800;
  box-shadow: 0 2px 10px rgba(0,40,25,.18);
}

.cvr-tabs-right { margin-left: auto; font-size: 11.5px; color: rgba(255,255,255,.92); font-weight: 500; letter-spacing: .2px; }

/* 暗色主题：顶栏改深灰 */
@media (prefers-color-scheme: dark) {
  :root:not([data-cvr-theme="light"]) .cvr-page-tabs {
    background: linear-gradient(135deg, #27272a 0%, #1e1e22 100%) !important;
    box-shadow: 0 6px 22px rgba(0,0,0,.4) !important;
  }
  :root:not([data-cvr-theme="light"]) .cvr-page-tabs::before {
    background: radial-gradient(ellipse 340px 90px at 88% 15%, rgba(255,255,255,.06), transparent 70%) !important;
  }
  :root:not([data-cvr-theme="light"]) .cvr-navtab {
    color: rgba(228,228,231,.65) !important;
    background: rgba(255,255,255,.06) !important;
    border-color: rgba(255,255,255,.1) !important;
  }
  :root:not([data-cvr-theme="light"]) .cvr-navtab:hover {
    color: #e4e4e7 !important;
    background: rgba(255,255,255,.12) !important;
  }
  :root:not([data-cvr-theme="light"]) .cvr-navtab.active {
    color: var(--rs-accent) !important;
    background: var(--rs-card) !important;
    box-shadow: 0 2px 10px rgba(0,0,0,.3) !important;
  }
  :root:not([data-cvr-theme="light"]) .cvr-brand .logo {
    background: rgba(255,255,255,.1) !important;
    border-color: rgba(255,255,255,.18) !important;
    color: var(--rs-accent) !important;
  }
  :root:not([data-cvr-theme="light"]) .cvr-brand .name { color: var(--rs-text) !important; }
  :root:not([data-cvr-theme="light"]) .cvr-tabs-right { color: rgba(228,228,231,.5) !important; }
}
:root[data-cvr-theme="dark"] .cvr-page-tabs,
body[data-ds-dark-theme] .cvr-page-tabs {
  background: linear-gradient(135deg, #27272a 0%, #1e1e22 100%) !important;
  box-shadow: 0 6px 22px rgba(0,0,0,.4) !important;
}
:root[data-cvr-theme="dark"] .cvr-page-tabs::before,
body[data-ds-dark-theme] .cvr-page-tabs::before {
  background: radial-gradient(ellipse 340px 90px at 88% 15%, rgba(255,255,255,.06), transparent 70%) !important;
}
:root[data-cvr-theme="dark"] .cvr-navtab,
body[data-ds-dark-theme] .cvr-navtab {
  color: rgba(228,228,231,.65) !important;
  background: rgba(255,255,255,.06) !important;
  border-color: rgba(255,255,255,.1) !important;
}
:root[data-cvr-theme="dark"] .cvr-navtab:hover,
body[data-ds-dark-theme] .cvr-navtab:hover {
  color: #e4e4e7 !important;
  background: rgba(255,255,255,.12) !important;
}
:root[data-cvr-theme="dark"] .cvr-navtab.active,
body[data-ds-dark-theme] .cvr-navtab.active {
  color: var(--rs-accent) !important;
  background: var(--rs-card) !important;
  box-shadow: 0 2px 10px rgba(0,0,0,.3) !important;
}
:root[data-cvr-theme="dark"] .cvr-brand .logo,
body[data-ds-dark-theme] .cvr-brand .logo {
  background: rgba(255,255,255,.1) !important;
  border-color: rgba(255,255,255,.18) !important;
  color: var(--rs-accent) !important;
}
:root[data-cvr-theme="dark"] .cvr-brand .name,
body[data-ds-dark-theme] .cvr-brand .name { color: var(--rs-text) !important; }
:root[data-cvr-theme="dark"] .cvr-tabs-right,
body[data-ds-dark-theme] .cvr-tabs-right { color: rgba(228,228,231,.5) !important; }
/* ============ 工具栏（奶白卡片） ============ */
.cvr-toolbar {
  display: flex; align-items: center; gap: 7px; flex-wrap: wrap;
  padding: 10px 14px; border-radius: var(--rs-radius);
  background: linear-gradient(180deg, #ffffff 0%, #f4faf6 100%);
  border: 1px solid var(--rs-border);
  box-shadow: var(--rs-shadow);
}
.cvr-cluster { display: flex; align-items: center; gap: 5px; }
.cvr-sep { width: 1px; height: 22px; background: var(--rs-border); margin: 0 3px; }

/* 暗色主题：工具栏/编辑器/预览深灰卡片 */
@media (prefers-color-scheme: dark) {
  :root:not([data-cvr-theme="light"]) .cvr-toolbar { background: var(--rs-card) !important; }
  :root:not([data-cvr-theme="light"]) .cvr-editor {
    background: var(--rs-card) !important;
    border-color: var(--rs-border) !important;
    box-shadow: 0 2px 10px rgba(0,0,0,.35) !important;
  }
  :root:not([data-cvr-theme="light"]) .cvr-preview { background: var(--rs-card) !important; }
  :root:not([data-cvr-theme="light"]) .cvr-preview-scroll { background: var(--rs-page) !important; }
  :root:not([data-cvr-theme="light"]) .cvr-wysiwyg-toolbar { background: var(--rs-card-2) !important; border-color: var(--rs-border) !important; }
}
:root[data-cvr-theme="dark"] .cvr-toolbar,
body[data-ds-dark-theme] .cvr-toolbar { background: var(--rs-card) !important; }
:root[data-cvr-theme="dark"] .cvr-editor,
body[data-ds-dark-theme] .cvr-editor {
  background: var(--rs-card) !important;
  border-color: var(--rs-border) !important;
  box-shadow: 0 2px 10px rgba(0,0,0,.35) !important;
}
:root[data-cvr-theme="dark"] .cvr-preview,
body[data-ds-dark-theme] .cvr-preview { background: var(--rs-card) !important; }
:root[data-cvr-theme="dark"] .cvr-preview-scroll,
body[data-ds-dark-theme] .cvr-preview-scroll { background: var(--rs-page) !important; }
:root[data-cvr-theme="dark"] .cvr-wysiwyg-toolbar,
body[data-ds-dark-theme] .cvr-wysiwyg-toolbar { background: var(--rs-card-2) !important; border-color: var(--rs-border) !important; }

/* ============ 按钮（胶囊 + 薄荷绿） ============ */
.cvr-btn {
  display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px;
  font-size: 12.5px; font-weight: 500;
  border-radius: 999px; border: 1px solid var(--rs-border);
  background: var(--rs-card-2); color: inherit; cursor: pointer; white-space: nowrap;
  transition: background .16s ease, border-color .16s ease, color .16s ease,
              box-shadow .16s ease, transform .12s ease;
}
.cvr-btn:hover:not(:disabled) {
  background: var(--rs-accent-soft); border-color: var(--rs-border-2);
  color: var(--rs-accent); transform: translateY(-1px);
}
.cvr-btn:active:not(:disabled) { transform: scale(.96); }
.cvr-btn:disabled { opacity: .35; cursor: default; }
.cvr-btn.danger { color: var(--rs-danger); border-color: rgba(225,29,72,.28); }
.cvr-btn.danger:hover:not(:disabled) { background: var(--rs-danger-soft); border-color: var(--rs-danger); color: var(--rs-danger); }
.cvr-btn.primary {
  background: var(--rs-mint-grad); border: none; color: #fff; font-weight: 700;
  box-shadow: 0 4px 14px rgba(16,185,129,.35);
}
.cvr-btn.primary:hover:not(:disabled) {
  box-shadow: 0 6px 20px rgba(16,185,129,.45); transform: translateY(-1px);
}
.cvr-btn.softaccent {
  background: var(--rs-accent-soft-2); border-color: var(--rs-border-2);
  color: var(--rs-accent); font-weight: 700;
}
.cvr-btn.softaccent:hover:not(:disabled) { background: var(--rs-accent-soft-2); border-color: var(--rs-accent); }
.cvr-btn.active {
  background: var(--rs-accent-soft-2); border-color: var(--rs-accent);
  color: var(--rs-accent); font-weight: 700;
}
.cvr-btn.icononly { padding: 6px; border-radius: 999px; }
.cvr-seg {
  display: inline-flex; gap: 2px; padding: 2.5px; border-radius: 999px;
  background: var(--rs-accent-soft); border: 1px solid var(--rs-border-2);
}
.cvr-seg .cvr-btn { border: none; border-radius: 999px; padding: 5px 15px; background: transparent; color: var(--rs-muted); }
.cvr-seg .cvr-btn:hover:not(:disabled) { background: var(--rs-seg-hover); color: var(--rs-accent); }
.cvr-seg .cvr-btn.active {
  background: var(--rs-card); color: var(--rs-accent); font-weight: 700;
  box-shadow: 0 2px 8px rgba(16,64,42,.12);
}

/* ============ 下拉弹层（白卡 + 绿 hover） ============ */
.cvr-pop-menu {
  position: absolute; top: calc(100% + 6px); left: 0; z-index: 60;
  min-width: 270px; padding: 6px; border-radius: 18px;
  background: var(--rs-card); border: 1px solid var(--rs-border);
  box-shadow: var(--rs-shadow-lg);
  display: flex; flex-direction: column; gap: 2px;
  animation: cvr-pop .18s cubic-bezier(.2,.9,.3,1.15);
}
.cvr-pop-item {
  padding: 9px 11px; border-radius: 12px; cursor: pointer; font-size: 12.5px;
  transition: background .14s ease, transform .1s ease;
}
.cvr-pop-item:hover { background: var(--rs-accent-soft); transform: translateX(2px); }
.cvr-pop-item-active { background: var(--rs-accent-soft-2); }
.cvr-pop-item .row { display: flex; align-items: center; gap: 8px; }
.cvr-pop-item .sub { font-size: 11px; opacity: .55; margin-top: 2px; }
.cvr-dot { width: 10px; height: 10px; border-radius: 4px; flex: none; }

/* ============ 状态徽章（彩色 pill） ============ */
.cvr-status {
  margin-left: auto; display: inline-flex; align-items: center; gap: 6px;
  font-size: 11.5px; font-weight: 600; white-space: nowrap;
  padding: 5px 13px; border-radius: 999px;
  border: 1px solid var(--rs-border);
}
.cvr-status .led { width: 7px; height: 7px; border-radius: 50%; }
.cvr-status.ok { background: var(--rs-accent-soft); color: var(--rs-accent); border-color: transparent; }
.cvr-status.dirty { background: var(--rs-warn-soft); color: var(--rs-warn); border-color: transparent; }
.cvr-status.saving { background: rgba(56,189,248,.12); color: var(--rs-info); border-color: transparent; }
.cvr-status.stale { background: var(--rs-danger-soft); color: var(--rs-danger); border-color: transparent; }

/* ============ 编辑/预览分区（圆角卡片） ============ */
.cvr-body { flex: 1; display: flex; min-height: 0; gap: 10px; }
.cvr-editor {
  flex: 1; min-width: 0; display: flex; flex-direction: column;
  border-radius: var(--rs-radius); background: #fdfefd;
  border: 1px solid var(--rs-border); box-shadow: var(--rs-shadow); overflow: hidden;
}
.cvr-wysiwyg-toolbar {
  display: flex; align-items: center; gap: 2px; padding: 7px 12px;
  border-bottom: 1px solid var(--rs-border); background: var(--rs-card-2);
  flex-wrap: wrap;
}
.cvr-wysiwyg-toolbar .cvr-btn {
  background: var(--rs-card);
  border-color: var(--rs-border);
}
.cvr-wysiwyg-toolbar .cvr-btn:hover:not(:disabled) {
  color: var(--rs-accent);
  border-color: var(--rs-border-2);
  background: var(--rs-accent-soft);
}
.cvr-wt-group { display: flex; align-items: center; gap: 2px; }
.cvr-wt-group-label {
  font-size: 10.5px; font-weight: 700; letter-spacing: .5px;
  color: var(--rs-accent); opacity: .85;
  background: var(--rs-accent-soft);
  padding: 3px 9px; border-radius: 999px; margin: 0 3px;
}
.cvr-wysiwyg-hint { font-size: 11px; opacity: .5; margin-left: auto; }
.cvr-md {
  flex: 1; resize: none; border: none; outline: none; background: transparent; color: inherit;
  padding: 16px 20px; font-size: 13px; line-height: 1.8; tab-size: 2;
  font-family: 'Cascadia Code','JetBrains Mono',Consolas,monospace;
}
.cvr-md::placeholder { opacity: .35; }
.cvr-wysiwyg { flex: 1; overflow: auto; outline: none; padding: 18px 22px; font-size: 13px; line-height: 1.75; }
.cvr-wysiwyg:focus { background: var(--rs-accent-soft); }
/* —— 富文本编辑区还原简历排版（fragment 用的是 cv-* 类，此前无任何样式） —— */
.cvr-wysiwyg .cv-doctitle { font-size: 20px; font-weight: 700; margin-bottom: 8px; letter-spacing: .5px; }
.cvr-wysiwyg .cv-module { margin-top: 16px; }
.cvr-wysiwyg .cv-module-title { font-size: 15px; font-weight: 800; letter-spacing: 1px; padding-bottom: 5px; margin-bottom: 8px; border-bottom: 2px solid var(--cvr-acc, #10b981); }
.cvr-wysiwyg .cv-p { margin: 6px 0; }
.cvr-wysiwyg .cv-row { display: flex; gap: 12px; align-items: baseline; margin: 8px 0 4px; }
.cvr-wysiwyg .cv-row .cv-cell { flex: 1 1 0; min-width: 0; }
.cvr-wysiwyg .cv-cell-line { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cvr-wysiwyg .cv-cell-h { font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cvr-wysiwyg .cv-cell-h-big { font-size: 16px; }
.cvr-wysiwyg .cv-chip { display: inline-block; font-size: 11px; line-height: 1; padding: 3px 8px; margin: 0 2px; background: rgba(16,185,129,.10); color: var(--cvr-acc, #10b981); border: 1px solid rgba(16,185,129,.35); border-radius: 4px; font-family: inherit; font-style: normal; }
.cvr-wysiwyg .cv-icon { display: inline-block; width: 14px; height: 14px; vertical-align: -3px; margin-right: 4px; }
.cvr-wysiwyg .cv-icon i { display: block; width: 100%; height: 100%; background: var(--cvr-acc, #10b981); border-radius: 50%; }
.cvr-wysiwyg .cv-list { margin: 6px 0 6px 1.4em; }
.cvr-wysiwyg .cv-list li { margin: 4px 0; list-style: disc; }
.cvr-wysiwyg ol.cv-list li { list-style: decimal; }
.cvr-wysiwyg .cv-hr { border: none; border-top: 1px dashed var(--rs-border); margin: 12px 0; }
.cvr-wysiwyg .cv-table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 12px; }
.cvr-wysiwyg .cv-table th, .cvr-wysiwyg .cv-table td { border: 1px solid var(--rs-border); padding: 4px 8px; }
.cvr-wysiwyg .cv-table th { font-weight: 700; background: var(--rs-accent-soft); }
.cvr-wysiwyg .cv-subtitle { font-size: 14px; font-weight: 700; margin: 10px 0 4px; }
.cvr-wysiwyg .cv-title { font-size: 17px; font-weight: 700; margin-bottom: 6px; }
.cvr-wysiwyg a { color: var(--cvr-acc, #10b981); text-decoration: none; }
/* 富文本加载态 */
.cvr-wysiwyg-loading { flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 12px; opacity: .6; }
.cvr-preview {
  width: 44%; min-width: 300px; display: flex; flex-direction: column;
  border-radius: var(--rs-radius); background: var(--rs-card);
  border: 1px solid var(--rs-border); box-shadow: var(--rs-shadow); overflow: hidden;
}
.cvr-preview-head {
  display: flex; align-items: center; gap: 5px; padding: 8px 13px;
  border-bottom: 1px solid var(--rs-border); font-size: 12px; font-weight: 700;
}
.cvr-preview-head .pvicon {
  width: 22px; height: 22px; border-radius: 7px; background: var(--rs-accent-soft);
  display: flex; align-items: center; justify-content: center; color: var(--rs-accent);
}
.cvr-zoom-cluster {
  margin-left: auto; display: flex; align-items: center; gap: 2px;
  background: var(--rs-accent-soft); border-radius: 999px; padding: 2px;
}
.cvr-zoom-label { font-size: 11px; padding: 0 5px; min-width: 36px; text-align: center; font-weight: 600; color: var(--rs-accent); }
.cvr-preview-scroll { flex: 1; overflow: auto; padding: 16px 0 24px; background: var(--rs-page); }
.cvr-frame { border: none; border-radius: 12px; background: #fff; box-shadow: 0 6px 24px rgba(16,64,42,.14); }

/* ============ 横幅 ============ */
.cvr-banner {
  padding: 9px 14px; font-size: 12px; display: flex; gap: 10px; align-items: center;
  border-radius: 12px; background: var(--rs-warn-soft);
  border: 1px solid rgba(245,158,11,.3); color: var(--rs-warn);
}
.cvr-banner-actions { display: flex; gap: 8px; align-items: center; margin-left: auto; }
.cvr-banner-actions .cvr-btn { background: var(--rs-card); border-color: rgba(245,158,11,.4); color: inherit; }

/* ============ 空态（立体小元素） ============ */
.cvr-empty {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 12px; text-align: center; padding: 24px;
}
.cvr-empty .ring {
  width: 76px; height: 76px; border-radius: 26px;
  background: var(--rs-mint-grad);
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-size: 34px;
  box-shadow: 0 10px 28px rgba(16,185,129,.35);
  transform: rotate(-4deg);
  transition: transform .2s ease;
}
.cvr-empty:hover .ring { transform: rotate(2deg) scale(1.05); }
.cvr-empty .title { font-size: 14px; font-weight: 800; color: inherit; }
.cvr-empty .desc { font-size: 12px; opacity: .6; line-height: 1.9; white-space: pre-line; }

/* ============ Toast ============ */
.cvr-toast {
  position: absolute; bottom: 18px; left: 50%; transform: translateX(-50%);
  display: flex; align-items: center; gap: 8px;
  padding: 10px 20px; border-radius: 999px; font-size: 12.5px; font-weight: 600;
  background: var(--rs-card); color: var(--rs-text);
  border: 1px solid var(--rs-border-2); box-shadow: var(--rs-shadow-lg);
  z-index: 80; animation: cvr-toastin .22s cubic-bezier(.2,.9,.3,1.2);
}
.cvr-toast .tic { color: var(--rs-accent); }
@keyframes cvr-toastin { from { opacity: 0; transform: translateX(-50%) translateY(10px) scale(.95); } to { opacity: 1; transform: translateX(-50%); } }
@keyframes cvr-pop { from { opacity: 0; transform: translateY(6px) scale(.97); } to { opacity: 1; transform: none; } }
.cvr-spin { animation: cvr-rotate 1s linear infinite; }
@keyframes cvr-rotate { to { transform: rotate(360deg); } }

/* ============ 模板中心 ============ */
.cvr-tc-head { padding: 4px 22px 2px; display: flex; align-items: center; gap: 12px; }
.cvr-tc-head .emoji {
  width: 46px; height: 46px; border-radius: 16px;
  background: var(--rs-mint-grad);
  display: flex; align-items: center; justify-content: center;
  font-size: 24px; box-shadow: 0 6px 18px rgba(16,185,129,.3);
  transform: rotate(-5deg); flex: none;
}
.cvr-tc-title { font-size: 21px; font-weight: 800; letter-spacing: .3px; }
.cvr-tc-sub { font-size: 12px; opacity: .6; margin-top: 3px; }
.cvr-tc-controls { display: flex; align-items: center; gap: 10px; padding: 12px 22px 10px; flex-wrap: wrap; }
.cvr-search {
  display: flex; align-items: center; gap: 8px; flex: 1; max-width: 340px;
  padding: 8px 16px; border-radius: 999px;
  background: var(--rs-card); border: 1px solid var(--rs-border);
  box-shadow: var(--rs-shadow); color: var(--rs-muted);
  transition: border-color .16s, box-shadow .16s;
}
.cvr-search:focus-within { border-color: var(--rs-accent); box-shadow: 0 0 0 3px var(--rs-accent-soft); color: var(--rs-accent); }
.cvr-search input {
  flex: 1; border: none; outline: none; background: transparent; color: inherit; font-size: 12.5px;
}
.cvr-search input::placeholder { opacity: .4; }
.cvr-count-chip {
  font-size: 11.5px; padding: 4px 12px; border-radius: 999px;
  background: var(--rs-mint-grad); color: #fff; font-weight: 700;
  white-space: nowrap; box-shadow: 0 3px 10px rgba(16,185,129,.3);
}
.cvr-grid {
  flex: 1; overflow: auto; padding: 6px 22px 24px;
  display: grid; grid-template-columns: repeat(auto-fill, minmax(176px, 1fr)); gap: 18px;
  align-content: start;
}
.cvr-tpl-card {
  cursor: pointer; border-radius: 18px; padding: 9px;
  background: var(--rs-card); border: 1px solid var(--rs-border);
  box-shadow: var(--rs-shadow);
  transition: transform .18s cubic-bezier(.2,.9,.3,1.2), box-shadow .18s ease, border-color .18s ease;
}
.cvr-tpl-card:hover {
  transform: translateY(-5px);
  border-color: var(--rs-border-2);
  box-shadow: 0 14px 36px rgba(16,185,129,.2);
}
.cvr-tpl-card:active { transform: translateY(-1px) scale(.98); }
.cvr-tpl-cover {
  position: relative; border-radius: 12px; overflow: hidden;
  background: var(--rs-page); aspect-ratio: 794/1123;
  box-shadow: inset 0 0 0 1px rgba(16,24,40,.05);
}
.cvr-tpl-cover img { width: 100%; height: 100%; object-fit: cover; display: block; }
.cvr-tpl-cover iframe {
  width: 794px; height: 1123px; border: none;
  transform: scale(0.214); transform-origin: top left; pointer-events: none;
}
.cvr-hot {
  position: absolute; top: 8px; left: 8px; z-index: 2;
  font-size: 10.5px; font-weight: 700; padding: 3px 10px; border-radius: 999px;
  background: linear-gradient(135deg, #fb923c, #ef4444); color: #fff;
  box-shadow: 0 3px 10px rgba(239,68,68,.4);
}
.cvr-tpl-name {
  font-size: 12.5px; font-weight: 700; margin-top: 9px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.cvr-tpl-tags { font-size: 11px; opacity: .55; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px; }

/* ============ 弹窗（薄荷卡片） ============ */
.cvr-modal-mask {
  position: fixed; inset: 0; z-index: 200;
  background: var(--rs-mask); backdrop-filter: blur(8px);
  display: flex; align-items: center; justify-content: center;
  animation: cvr-fade .16s ease-out;
}
.cvr-modal {
  display: flex; gap: 20px; padding: 22px; border-radius: 22px;
  background: var(--rs-card); border: 1px solid var(--rs-border-2);
  box-shadow: var(--rs-shadow-lg); max-height: 92vh;
  animation: cvr-rise .22s cubic-bezier(.2,.9,.3,1.18);
}
@keyframes cvr-fade { from { opacity: 0; } }
@keyframes cvr-rise { from { opacity: 0; transform: translateY(16px) scale(.97); } }
.cvr-modal-cover {
  width: 430px; flex: none; height: 560px; overflow-y: auto; overflow-x: hidden;
  border-radius: 16px; background: var(--rs-page); border: 1px solid var(--rs-border);
}
.cvr-modal-pane-label {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 11px; font-weight: 700; padding: 4px 12px; margin: 12px 0 6px;
  border-radius: 999px; background: var(--rs-mint-grad); color: #fff;
  box-shadow: 0 2px 8px rgba(16,185,129,.3);
}
.cvr-modal-cover .cover-img { width: 100%; border-radius: 12px; border: 1px solid var(--rs-border); display: block; }
.cvr-modal-cover .render-clip {
  position: relative; border-radius: 12px; overflow: hidden; height: 300px; background: #fff;
}
.cvr-modal-cover .render-clip iframe {
  width: 794px; height: 1123px; border: none; transform: scale(0.52); transform-origin: top left; pointer-events: none;
}
.cvr-modal-side { width: 270px; display: flex; flex-direction: column; gap: 12px; }
/* —— 新增：通用弹窗头 / 换模板 / 模块排序 / 体检 —— */
.cvr-modal-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 16px 18px 12px; border-bottom: 1px solid var(--rs-border); position: sticky; top: 0; background: var(--rs-card); z-index: 1; }
.cvr-modal-title { font-size: 15px; font-weight: 800; }
.cvr-modal-sub { font-size: 11.5px; opacity: .6; margin-top: 3px; }
.cvr-modal-body { padding: 14px 18px 18px; }
.cvr-swap-tabs { display: flex; gap: 8px; margin-bottom: 12px; }
.cvr-swap-empty { padding: 26px 8px; text-align: center; font-size: 12.5px; opacity: .55; }
.cvr-swap-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 10px; }
.cvr-swap-card { display: flex; flex-direction: column; gap: 4px; align-items: flex-start; text-align: left; padding: 11px 12px; border-radius: 12px; border: 1px solid var(--rs-border); background: var(--rs-card-2); cursor: pointer; transition: .15s; font: inherit; color: inherit; }
.cvr-swap-card:hover:not(:disabled) { border-color: var(--rs-accent); transform: translateY(-1px); box-shadow: var(--rs-shadow-md); }
.cvr-swap-card:disabled { opacity: .55; cursor: not-allowed; }
.cvr-swap-card .dot { width: 9px; height: 9px; border-radius: 50%; display: block; }
.cvr-swap-card .nm { font-size: 12.5px; font-weight: 700; }
.cvr-swap-card .sub { font-size: 11px; opacity: .55; }
.cvr-sec-list { display: flex; flex-direction: column; gap: 6px; }
.cvr-sec-row { display: flex; align-items: center; gap: 10px; padding: 9px 12px; border-radius: 10px; border: 1px solid var(--rs-border); background: var(--rs-card-2); }
.cvr-sec-row .idx { font-size: 11px; font-weight: 700; opacity: .45; font-variant-numeric: tabular-nums; }
.cvr-sec-row .nm { flex: 1; font-size: 12.5px; font-weight: 600; }
.cvr-sec-row .ops { display: flex; gap: 4px; }
.cvr-score { display: flex; align-items: center; gap: 14px; padding: 14px 16px; border-radius: 14px; background: var(--rs-card-2); border: 1px solid var(--rs-border); margin-bottom: 12px; }
.cvr-score .num { font-size: 34px; font-weight: 800; font-variant-numeric: tabular-nums; line-height: 1; }
.cvr-score .lbl { font-size: 13px; font-weight: 700; }
.cvr-score .sub { font-size: 11.5px; opacity: .6; margin-top: 3px; }
.cvr-issue-list { display: flex; flex-direction: column; gap: 8px; }
.cvr-issue { display: flex; gap: 10px; padding: 10px 12px; border-radius: 10px; background: var(--rs-card-2); border: 1px solid var(--rs-border); }
.cvr-issue .bar { width: 3px; border-radius: 2px; flex: none; }
.cvr-issue .msg { font-size: 12.5px; font-weight: 600; }
.cvr-issue .ln { font-weight: 400; opacity: .5; font-size: 11px; }
.cvr-issue .quote { font-size: 11.5px; opacity: .6; margin-top: 3px; font-style: italic; }
.cvr-issue .fix { font-size: 11.5px; color: var(--rs-accent); margin-top: 4px; }
.cvr-jd-input { width: 100%; border-radius: 10px; border: 1px solid var(--rs-border); background: var(--rs-card-2); color: var(--rs-text); padding: 10px 12px; font: inherit; font-size: 12.5px; line-height: 1.7; resize: vertical; }
.cvr-jd-input:focus { outline: none; border-color: var(--rs-accent); }
.cvr-kw-block { margin-top: 12px; }
.cvr-kw-block .t { font-size: 11.5px; font-weight: 700; opacity: .6; margin-bottom: 6px; }
.cvr-kw-row { display: flex; flex-wrap: wrap; gap: 6px; }
.cvr-kw { font-size: 11.5px; padding: 3px 9px; border-radius: 999px; border: 1px solid var(--rs-border); }
.cvr-kw.miss { color: var(--rs-warn); border-color: var(--rs-warn); background: rgba(245,158,11,.08); }
.cvr-kw.hit { color: var(--rs-accent); border-color: var(--rs-accent); background: var(--rs-accent-soft); }
.cvr-modal-side .name { font-size: 18px; font-weight: 800; line-height: 1.4; }
.cvr-modal-side .tagrow { display: flex; flex-wrap: wrap; gap: 5px; }
.cvr-modal-side .tag {
  font-size: 11px; padding: 4px 11px; border-radius: 999px;
  background: var(--rs-accent-soft); color: var(--rs-accent); font-weight: 600;
}
.cvr-modal-side .desc { font-size: 12px; opacity: .8; line-height: 1.75; overflow-y: auto; flex: 1; }
.cvr-modal-side .note {
  font-size: 11px; opacity: .6; line-height: 1.6;
  background: var(--rs-accent-soft); border-radius: 10px; padding: 8px 12px;
}

/* ============ 聊天工具卡 ============ */
.cvr-toolcard {
  display: flex; align-items: stretch; gap: 14px; flex-wrap: nowrap;
  padding: 12px 14px; margin: 4px 0; font-size: 12px;
  border-radius: 16px; border: 1px solid var(--rs-border-2);
  background: var(--rs-card); color: var(--rs-text); box-shadow: var(--rs-shadow);
}
.cvr-toolcard.compact { align-items: center; gap: 8px; padding: 10px 14px; }
.cvr-toolcard-thumb {
  width: 112px; height: 158px; flex: none; position: relative;
  border-radius: 8px; overflow: hidden; background: #fff;
  border: 1px solid var(--rs-border); box-shadow: 0 2px 10px rgba(0,0,0,.18);
  cursor: pointer; transition: transform .16s ease, box-shadow .16s ease;
}
.cvr-toolcard-thumb:hover {
  transform: translateY(-2px); box-shadow: 0 6px 18px rgba(16,185,129,.22);
}
.cvr-toolcard-thumb iframe {
  width: 794px; height: 1123px; border: none; display: block; background: #fff;
  transform: scale(0.141); transform-origin: top left; pointer-events: none;
}
.cvr-toolcard-info {
  flex: 1; min-width: 0; display: flex; flex-direction: column;
  justify-content: space-between; gap: 8px; padding: 2px 0;
}
.cvr-toolcard-head { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.cvr-toolcard-title-row { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; min-width: 0; }
.cvr-toolcard-title {
  font-size: 13.5px; font-weight: 700; color: var(--rs-text);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%;
}
.cvr-toolcard-badge {
  font-size: 10.5px; font-weight: 600; padding: 2px 8px; border-radius: 999px;
  background: var(--rs-accent-soft); color: var(--rs-accent); white-space: nowrap;
}
.cvr-toolcard-meta {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
  font-size: 11.5px; color: var(--rs-muted);
}
.cvr-toolcard-id {
  font-size: 11px; padding: 1px 6px; border-radius: 6px;
  background: var(--rs-card-2); border: 1px solid var(--rs-border); color: var(--rs-muted);
}
.cvr-toolcard-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }

/* ============ 输入框 ============ */
.cvr-select {
  padding: 6px 14px; font-size: 12.5px; border-radius: 999px;
  border: 1px solid var(--rs-border); background: var(--rs-card); color: inherit; outline: none;
  transition: border-color .16s, box-shadow .16s;
}
.cvr-select:focus { border-color: var(--rs-accent); box-shadow: 0 0 0 3px var(--rs-accent-soft); }

/* ============ Fresh Mint 精修层 ============ */
/* brand：图标+文字不换行 */
.cvr-brand {
  display: inline-flex !important; flex-direction: row !important;
  align-items: center !important; gap: 10px;
  margin-right: 18px; flex: none; white-space: nowrap;
}
.cvr-brand .logo {
  display: inline-flex; align-items: center; justify-content: center;
  width: 34px; height: 34px; border-radius: 11px;
  background: rgba(255,255,255,.24); border: 1px solid rgba(255,255,255,.35);
  box-shadow: none !important; color: #fff !important;
}
.cvr-brand .name {
  white-space: nowrap; font-size: 15px; font-weight: 800;
  color: #fff; letter-spacing: .5px;
}

/* 按钮质感：内高光 + hover 绿光 */
.cvr-btn {
  box-shadow: inset 0 1px 0 rgba(255,255,255,.05);
}
.cvr-btn:hover:not(:disabled) {
  border-color: var(--rs-border-2);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.08), 0 2px 8px rgba(16,185,129,.1);
}
.cvr-btn.primary {
  box-shadow: inset 0 1px 0 rgba(255,255,255,.25), 0 4px 14px rgba(16,185,129,.4);
}
.cvr-btn.softaccent {
  box-shadow: inset 0 1px 0 rgba(255,255,255,.12);
}

/* 彩底图标按钮（参考图彩色容器语言）：头像=蓝 校徽=紫 一页=黄 */
.cvr-btn.tint-blue { background: var(--rs-info-soft, rgba(14,165,233,.1)); border-color: rgba(14,165,233,.3); color: var(--rs-info); }
.cvr-btn.tint-blue:hover:not(:disabled) { background: rgba(14,165,233,.18); border-color: var(--rs-info); box-shadow: 0 2px 10px rgba(14,165,233,.25); }
.cvr-btn.tint-violet { background: var(--rs-violet-soft, rgba(139,92,246,.1)); border-color: rgba(139,92,246,.3); color: var(--cvr-violet, #a78bfa); }
.cvr-btn.tint-violet:hover:not(:disabled) { background: rgba(139,92,246,.18); border-color: var(--cvr-violet, #a78bfa); box-shadow: 0 2px 10px rgba(139,92,246,.25); }
.cvr-btn.tint-yellow { background: var(--rs-warn-soft); border-color: rgba(217,119,6,.3); color: var(--rs-warn); }
.cvr-btn.tint-yellow:hover:not(:disabled) { background: var(--rs-warn-soft); border-color: var(--rs-warn); box-shadow: 0 2px 10px rgba(217,119,6,.25); }

/* 欢迎横幅光斑：柔和光效 */
.cvr-welcome::before {
  content: ''; position: absolute; inset: 0; pointer-events: none;
  background:
    radial-gradient(ellipse 220px 90px at 82% 20%, rgba(255,255,255,.32), transparent 70%),
    radial-gradient(ellipse 160px 80px at 12% 90%, rgba(255,255,255,.18), transparent 70%);
}
.cvr-welcome > * { position: relative; z-index: 1; }
.cvr-welcome .deco {
  animation: cvr-float 3.2s ease-in-out infinite;
}
@keyframes cvr-float {
  0%, 100% { transform: rotate(8deg) translateY(0); }
  50% { transform: rotate(8deg) translateY(-4px); }
}

/* 状态 LED 光晕 */
.cvr-status .led { box-shadow: 0 0 6px currentColor; }

/* 工具栏分隔线柔和化 */
.cvr-sep { background: var(--rs-border); opacity: .8; }

/* 预览帧 hover 阴影呼吸 */
.cvr-frame { transition: box-shadow .2s ease; }
.cvr-frame:hover { box-shadow: 0 8px 32px rgba(16,64,42,.2); }

/* 下拉菜单项按压反馈 */
.cvr-pop-item:active { transform: scale(.985); }
`;

    function injectStyles() {
      if (document.querySelector('style[data-plugin-css="dsh-resume"]')) return;
      const tag = document.createElement('style');
      tag.dataset.plugin = 'dsh-resume';
      tag.dataset.pluginCss = 'dsh-resume';
      tag.textContent = CSS;
      document.head.appendChild(tag);
    }

    /* -------------------------------- utilities -------------------------------- */

    async function api(path, opts) {
      const res = await fetch(API + path, {
        headers: { 'Content-Type': 'application/json' },
        ...opts,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      return data;
    }

    /** 精确类名判定：'cv-chip'.includes('cv-c') 会误命中，必须按 token 比较 */
    function hasCls(el, name) {
      const c = el && el.className;
      const s = typeof c === 'string' ? c : (c && c.baseVal) || '';
      return s.split(/\s+/).indexOf(name) >= 0;
    }

    function unesc(s) {
      return String(s ?? '')
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"').replace(/&amp;/g, '&');
    }

    // 行内 DOM → DSL 行内文本（还原 !bg / !c / icon: / chip / 粗体 / 链接）
    function collectInline(node) {
      const toHexColor = (styleStr, prop) => {
        const s = String(styleStr || '');
        const scoped = prop
          ? (s.match(new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, 'i'))?.[1] || '')
          : '';
        const src = scoped || s;
        const hex = src.match(/#[0-9a-fA-F]{3,8}/);
        if (hex) return hex[0];
        const rgb = src.match(/rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i);
        if (rgb) {
          const h2 = (n) => Math.max(0, Math.min(255, Number(n))).toString(16).padStart(2, '0');
          return '#' + h2(rgb[1]) + h2(rgb[2]) + h2(rgb[3]);
        }
        return '';
      };
      const wrapMark = (mark, text) => {
        if (!text) return '';
        const m = String(text).match(/^(\s*)([\s\S]*?)(\s*)$/);
        if (!m || !m[2]) return text;
        return m[1] + mark + m[2] + mark + m[3];
      };
      const styleFlags = (el) => {
        const st = el.getAttribute('style') || '';
        const fw = st.match(/(?:^|;)\s*font-weight\s*:\s*([^;]+)/i)?.[1]?.trim().toLowerCase() || '';
        const fs = st.match(/(?:^|;)\s*font-style\s*:\s*([^;]+)/i)?.[1]?.trim().toLowerCase() || '';
        const td = st.match(/(?:^|;)\s*text-decoration(?:-line)?\s*:\s*([^;]+)/i)?.[1]?.trim().toLowerCase() || '';
        return {
          bold: fw === 'bold' || fw === 'bolder' || (/^\d+$/.test(fw) && Number(fw) >= 600),
          italic: fs === 'italic' || fs === 'oblique',
          underline: td.includes('underline'),
          strike: td.includes('line-through'),
        };
      };
      const applyWrap = (text, f) => {
        let s = text;
        if (f.bold) s = wrapMark('**', s);
        if (f.italic) s = wrapMark('*', s);
        if (f.strike) s = wrapMark('~~', s);
        if (f.underline) s = wrapMark('++', s);
        return s;
      };

      let out = '';
      let lastWrap = '';
      const appendWrapped = (mark, raw) => {
        const chunk = wrapMark(mark, raw);
        if (!chunk) return;
        if (lastWrap === mark && out.endsWith(mark) && chunk.startsWith(mark)) {
          out = out.slice(0, -mark.length) + chunk.slice(mark.length);
        } else {
          out += chunk;
        }
        lastWrap = chunk.endsWith(mark) ? mark : '';
      };

      for (const child of node.childNodes) {
        if (child.nodeType === 3) {
          const txt = unesc(child.textContent);
          out += txt;
          if (txt) lastWrap = '';
          continue;
        }
        if (child.nodeType !== 1) continue;
        const el = child;
        if (hasCls(el, 'cv-bg')) {
          const color = toHexColor(el.getAttribute('style'), 'background(?:-color)?');
          out += `!bg[${collectInline(el)}](${color})`;
          lastWrap = '';
        } else if (hasCls(el, 'cv-c')) {
          const color = toHexColor(el.getAttribute('style'), 'color');
          out += `!c[${collectInline(el)}](${color})`;
          lastWrap = '';
        } else if (hasCls(el, 'cv-icon')) {
          out += `icon:${el.getAttribute('data-icon') || 'dot'} `;
          lastWrap = '';
        } else if (el.tagName === 'CODE') {
          const codeTxt = '`' + unesc(el.textContent) + '`';
          const flags = { ...styleFlags(el) };
          const scanFmt = (nd) => {
            for (const c of nd.children) {
              if (c.tagName === 'STRONG' || c.tagName === 'B') flags.bold = true;
              else if (c.tagName === 'EM' || c.tagName === 'I') flags.italic = true;
              else if (c.tagName === 'DEL' || c.tagName === 'S' || c.tagName === 'STRIKE') flags.strike = true;
              else if (c.tagName === 'U') flags.underline = true;
              const sf = styleFlags(c);
              if (sf.bold) flags.bold = true;
              if (sf.italic) flags.italic = true;
              if (sf.strike) flags.strike = true;
              if (sf.underline) flags.underline = true;
              scanFmt(c);
            }
          };
          scanFmt(el);
          out += applyWrap(codeTxt, flags);
          lastWrap = '';
        } else if (el.tagName === 'STRONG' || el.tagName === 'B') {
          appendWrapped('**', collectInline(el));
        } else if (el.tagName === 'EM' || el.tagName === 'I') {
          appendWrapped('*', collectInline(el));
        } else if (el.tagName === 'DEL' || el.tagName === 'S' || el.tagName === 'STRIKE') {
          appendWrapped('~~', collectInline(el));
        } else if (el.tagName === 'U') {
          appendWrapped('++', collectInline(el));
        } else if (el.tagName === 'BR') {
          out += ' ';
          lastWrap = '';
        } else if (el.tagName === 'IMG') {
          out += '![' + (el.getAttribute('alt') || '') + '](' + (el.getAttribute('src') || '') + ')';
          lastWrap = '';
        } else if (el.tagName === 'A') {
          out += '[' + collectInline(el) + '](' + (el.getAttribute('href') || '') + ')';
          lastWrap = '';
        } else {
          const sf = styleFlags(el);
          const inner = collectInline(el);
          if (sf.bold && !sf.italic && !sf.strike && !sf.underline) appendWrapped('**', inner);
          else if (sf.italic && !sf.bold && !sf.strike && !sf.underline) appendWrapped('*', inner);
          else if (sf.strike && !sf.bold && !sf.italic && !sf.underline) appendWrapped('~~', inner);
          else if (sf.underline && !sf.bold && !sf.italic && !sf.strike) appendWrapped('++', inner);
          else { out += applyWrap(inner, sf); lastWrap = ''; }
        }
      }
      return out;
    }

    // 渲染器产出的 DOM → DSL Markdown（所见即所得模式保存时用）
    function htmlToMd(rootEl) {
      const lines = [];
      let listMode = null;

      const closeList = () => { if (listMode) listMode = null; };
      const BLOCK_TAGS = new Set([
        'SECTION', 'DIV', 'P', 'UL', 'OL', 'LI', 'TABLE', 'HR',
        'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'PRE',
      ]);
      const isBlockEl = (nd) => nd && nd.nodeType === 1 && (
        BLOCK_TAGS.has(nd.tagName) || hasCls(nd, 'cv-row') || hasCls(nd, 'cv-p') || hasCls(nd, 'cv-module')
      );
      const hasBlockChild = (el) => Array.from(el.children).some(isBlockEl);

      const walkBlock = (el) => {
        if (!el || el.nodeType !== 1) return;
        const tag = el.tagName;

        // 文档大标题（renderBody 把首个 h1/h2 渲染成 h2.cv-doctitle）
        if (tag === 'H1' || (tag === 'H2' && hasCls(el, 'cv-doctitle'))) {
          closeList();
          const t = collectInline(el).trim();
          if (t) lines.push('', '# ' + t, '');
          return;
        }
        // 模块标题
        if (tag === 'H2' && hasCls(el, 'cv-module-title')) {
          closeList();
          lines.push('', '## ' + collectInline(el).trim(), '');
          return;
        }
        // h3 / h4 / h5 / h6（原来只认 h3+特定类，h4 小标题会被整段丢弃）
        if (tag === 'H3' || tag === 'H4' || tag === 'H5' || tag === 'H6') {
          closeList();
          const level = Number(tag[1]);
          const t = collectInline(el).trim();
          if (t) lines.push('', '#'.repeat(level) + ' ' + t, '');
          return;
        }
        // 多栏行
        if (hasCls(el, 'cv-row')) {
          closeList();
          const cells = Array.from(el.children).filter((c) => hasCls(c, 'cv-cell'));
          if (!cells.length) return;
          const cellTexts = cells.map((cell) => {
            const rows = Array.from(cell.children).filter((c) => hasCls(c, 'cv-cell-line') || hasCls(c, 'cv-cell-h') || hasCls(c, 'cv-cell-h-big'));
            const src = rows.length ? rows : [cell];
            const outLines = [];
            for (const ln of src) {
              const listEls = Array.from(ln.children || []).filter((c) => c.tagName === 'UL' || c.tagName === 'OL');
              if (ln.tagName === 'UL' || ln.tagName === 'OL' || listEls.length) {
                const lists = (ln.tagName === 'UL' || ln.tagName === 'OL') ? [ln] : listEls;
                for (const lst of lists) {
                  const mk = lst.tagName === 'OL' ? '1. ' : '- ';
                  for (const li of lst.children) {
                    const lt = collectInline(li).trim();
                    if (lt) outLines.push(mk + lt);
                  }
                }
                continue;
              }
              const t = collectInline(ln).trim();
              if (!t) continue;
              // 单元格内的“粗体大标题”行还原成 ### 标题（renderBody 反向解析）
              outLines.push(hasCls(ln, 'cv-cell-h') || hasCls(ln, 'cv-cell-h-big') ? '### ' + t : t);
            }
            return outLines.join('\n');
          }).filter(Boolean);
          if (!cellTexts.length) return;
          lines.push('', '::: start', cellTexts.join('\n:::\n'), '::: end', '');
          return;
        }
        if (tag === 'UL' || tag === 'OL') {
          closeList();
          const marker = tag === 'OL' ? '1. ' : '- ';
          for (const li of el.children) {
            const t = collectInline(li).trim();
            if (t) lines.push(marker + t);
          }
          lines.push('');
          listMode = tag.toLowerCase();
          return;
        }
        // 表格：还原成 GFM 管道表格（含对齐），否则往返会把结构压平
        if (tag === 'TABLE') {
          closeList();
          const trs = [];
          const walkTr = (node) => {
            for (const c of node.children) {
              if (c.tagName === 'TR') trs.push(c);
              else walkTr(c);
            }
          };
          walkTr(el);
          if (!trs.length) return;
          const alignOfCell = (c) => {
            const sm = (c.getAttribute('style') || '').match(/text-align:\s*(left|center|right)/i);
            return sm ? sm[1].toLowerCase() : '';
          };
          const cellsOf = (tr) => Array.from(tr.children)
            .filter((c) => c.tagName === 'TH' || c.tagName === 'TD')
            .map((c) => ({ text: collectInline(c).trim().replace(/\|/g, '\\|'), align: alignOfCell(c) }));
          const header = cellsOf(trs[0]);
          if (!header.length) return;
          const sepOf = (a) => (a === 'center' ? ':---:' : a === 'right' ? '---:' : a === 'left' ? ':---' : '---');
          lines.push('');
          lines.push('| ' + header.map((c) => c.text).join(' | ') + ' |');
          lines.push('| ' + header.map((c) => sepOf(c.align)).join(' | ') + ' |');
          for (let k = 1; k < trs.length; k++) {
            const cells = cellsOf(trs[k]);
            while (cells.length < header.length) cells.push({ text: '', align: '' });
            lines.push('| ' + cells.slice(0, header.length).map((c) => c.text).join(' | ') + ' |');
          }
          lines.push('');
          return;
        }
        if (tag === 'HR') { closeList(); lines.push('', '---', ''); return; }
        // 段落（注意：浏览器 insertUnorderedList 可能把 <ul> 直接包进 <p.cv-p>，含块级子元素时需按容器走）
        if ((tag === 'P' || hasCls(el, 'cv-p')) && !hasBlockChild(el)) {
          closeList();
          const text = collectInline(el).trim();
          if (text) lines.push('', text, '');
          return;
        }
        // 其它容器（section.cv-module / div / blockquote / 含块子元素的 p…）按节点顺序保留行内与块级交替
        let inlineBuf = [];
        const flushInline = () => {
          if (!inlineBuf.length) return;
          const text = collectInline({ childNodes: inlineBuf }).trim();
          inlineBuf = [];
          if (text) { closeList(); lines.push('', text, ''); }
        };
        for (const ch of el.childNodes) {
          if (isBlockEl(ch)) {
            flushInline();
            walkBlock(ch);
          } else if (ch.nodeType === 1 && ch.tagName === 'BR') {
            flushInline();
          } else {
            inlineBuf.push(ch);
          }
        }
        flushInline();
      };

      for (const child of rootEl.children) walkBlock(child);
      closeList();
      return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
    }

    /* ------------------------------ shared widgets ----------------------------- */

    /** 下载文件：fetch→blob→a.click，带生成等待提示（PDF/PNG 服务端要跑几秒） */
    async function downloadExport(id, format, setToast) {
      const slow = format === 'pdf' || format === 'png';
      const hide = slow && setToast ? setToast(`正在生成 ${format.toUpperCase()}（首次约 5-10 秒）…`, ICONS.refresh, 0) : null;
      try {
        const res = await fetch(`${API}/export/${id}?format=${format}`);
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err?.error || `HTTP ${res.status}`);
        }
        const blob = await res.blob();
        const dispo = res.headers.get('Content-Disposition') || '';
        const m = dispo.match(/filename\*=UTF-8''([^;]+)/);
        const name = m ? decodeURIComponent(m[1]) : `resume.${format}`;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
        if (hide) hide();
        return name;
      } catch (e) {
        if (hide) hide();
        throw e;
      }
    }

    function Btn({ icon, label, onClick, onMouseDown, disabled, active, danger, primary, softaccent, tintBlue, tintViolet, tintYellow, iconOnly, title, spin, style }) {
      return h('button', {
        className: 'cvr-btn'
          + (active ? ' active' : '')
          + (danger ? ' danger' : '')
          + (primary ? ' primary' : '')
          + (softaccent ? ' softaccent' : '')
          + (tintBlue ? ' tint-blue' : '')
          + (tintViolet ? ' tint-violet' : '')
          + (tintYellow ? ' tint-yellow' : '')
          + (iconOnly ? ' icononly' : ''),
        onClick, onMouseDown, disabled, title: title || (typeof label === 'string' ? label : undefined),
        style,
      },
        icon ? h(Icon, { d: icon, size: 13, className: spin ? 'cvr-spin' : undefined }) : null,
        iconOnly ? null : label,
      );
    }

    function StatusPill({ saving, dirty, extStale }) {
      const kind = saving ? 'saving' : dirty ? 'dirty' : extStale ? 'stale' : 'ok';
      const ledColor = saving ? '#38bdf8' : dirty ? '#f59e0b' : extStale ? '#fb7185' : '#34d399';
      const text = saving ? '保存中…' : dirty ? '未保存' : extStale ? '外部有更新' : '已保存';
      return h('span', { className: 'cvr-status ' + kind },
        h('span', { className: 'led', style: { background: ledColor } }),
        text,
      );
    }

    function NewResumeBar({ onCreated }) {
      const [templates, setTemplates] = useState(null);
      const [open, setOpen] = useState(false);
      const boxRef = useRef(null);
      useEffect(() => { api('/templates').then((d) => setTemplates(d.items)).catch(() => {}); }, []);
      useEffect(() => {
        if (!open) return;
        const close = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
      }, [open]);
      return h('div', { style: { position: 'relative' }, ref: boxRef },
        h(Btn, { icon: ICONS.plus, label: '新建', onClick: () => setOpen(!open), active: open }),
        open && h('div', { className: 'cvr-pop-menu' },
          templates === null
            ? h('div', { style: { padding: '6px 8px', fontSize: 12, opacity: .6 } }, '加载中…')
            : templates.map((t) => h('div', {
                key: t.type,
                className: 'cvr-pop-item',
                onClick: async () => {
                  setOpen(false);
                  const d = await api('/resumes', { method: 'POST', body: JSON.stringify({ type: t.type }) });
                  onCreated(d.item);
                },
              },
                h('div', { className: 'row' },
                  h('span', { className: 'cvr-dot', style: { background: t.style?.primaryBGColor || '#4A6FA5' } }),
                  h('span', { style: { fontWeight: 600 } }, t.name),
                ),
                h('div', { className: 'sub' }, t.tags?.slice(0, 6)?.join(' · ')),
              )),
          h('div', { className: 'sub', style: { padding: '4px 10px 6px', borderTop: '1px solid rgba(127,127,127,.25)', opacity: .6 } },
            '更多模板请进「模板中心」标签页浏览'),
        ),
      );
    }

    /* ------------------------------ Template Center ---------------------------- */

    function TemplateCenter({ onUse }) {
      const [source, setSource] = useState('online'); // online | local
      const [online, setOnline] = useState(null);
      const [local, setLocal] = useState(null);
      const [detail, setDetail] = useState(null); // {kind, id, name, tags, desc, html?}
      const [using, setUsing] = useState(false);
      const [filter, setFilter] = useState('');

      useEffect(() => {
        api('/online-templates').then((d) => setOnline(d.items)).catch(() => setOnline([]));
        api('/templates').then((d) => setLocal(d.items)).catch(() => {});
      }, []);

      const openDetail = async (kind, item) => {
        if (kind === 'online') {
          setDetail({ kind, id: item.id, name: item.name, tags: item.tags, desc: item.description, cover: item.cover, loading: true });
          try {
            const d = await api('/online-template/' + encodeURIComponent(item.id));
            setDetail({ kind, id: item.id, name: d.name, tags: d.tags, desc: d.description, cover: item.cover, html: d.previewHtml });
          } catch (e) { setDetail({ kind, id: item.id, name: item.name, tags: item.tags, desc: '预览加载失败：' + e.message, cover: item.cover }); }
        } else {
          setDetail({ kind, id: item.type, name: item.name, tags: item.tags, desc: item.description, localSrc: `${API}/preview-local-tpl/${item.type}` });
        }
      };

      const useTemplate = async () => {
        if (!detail || using) return;
        setUsing(true);
        try {
          const body = detail.kind === 'online'
            ? { onlineType: detail.id, name: `${detail.name} - 我的简历` }
            : { type: detail.id, name: `${detail.name} - 我的简历` };
          const d = await api('/resumes', { method: 'POST', body: JSON.stringify(body) });
          setUsing(false);
          setDetail(null);
          flashGlobal('已创建：' + (d.item?.name || detail.name), ICONS.check);
          onUse && onUse(d.item);
        } catch (e) { setUsing(false); flashGlobal('创建失败：' + e.message, ICONS.refresh); }
      };

      const q = filter.trim().toLowerCase();
      const matchTags = (t) => !q || (t.name || '').toLowerCase().includes(q) || (t.tags || []).some((x) => String(x).toLowerCase().includes(q));

      return h('div', { style: { display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 } },
        /* 头部大标题 */
        h('div', { className: 'cvr-tc-head' },
          h('div', { className: 'emoji' }, '🗂️'),
          h('div', null,
            h('div', { className: 'cvr-tc-title' }, '模板中心'),
            h('div', { className: 'cvr-tc-sub' },
              source === 'online'
                ? '来自公开模板库 · 含真实示例内容 · 使用后可随意改写'
                : '内置 7 套精选模板 · 创建即得完整示例结构'),
          ),
        ),
        /* 控件行 */
        h('div', { className: 'cvr-tc-controls' },
          h('div', { className: 'cvr-search' },
            h(Icon, { d: ICONS.search || ICONS.doc, size: 14 }),
            h('input', {
              placeholder: '按名称或标签搜索模板…',
              value: filter, onChange: (e) => setFilter(e.target.value),
            }),
          ),
          h('span', { className: 'cvr-count-chip' },
            `${(source === 'online' ? (online || []) : (local || [])).filter(matchTags).length} 套模板`),
          h('div', { className: 'cvr-seg', style: { marginLeft: 'auto' } },
            h(Btn, { label: '在线模板源', active: source === 'online', onClick: () => setSource('online'), title: 'Resume 公开模板库（100+ 套）' }),
            h(Btn, { label: '内置模板', active: source === 'local', onClick: () => setSource('local'), title: '本插件内置模板' }),
          ),
        ),
        /* 画廊 */
        h('div', { className: 'cvr-grid' },
          source === 'online'
            ? (online === null
              ? h('div', { className: 'cvr-empty' }, h('div', { className: 'title' }, '加载中…'))
              : online.filter(matchTags).map((t) => h('div', {
                  key: t.id,
                  className: 'cvr-tpl-card',
                  onClick: () => openDetail('online', t),
                },
                  h('div', { className: 'cvr-tpl-cover' },
                    h('img', { src: t.cover, alt: t.name, loading: 'lazy' }),
                    !!t.hot && h('span', { className: 'cvr-hot' }, '🔥 ' + (t.hot > 10000 ? (t.hot / 10000).toFixed(1) + 'w' : t.hot)),
                  ),
                  h('div', { className: 'cvr-tpl-name', title: t.name }, t.name),
                  h('div', { className: 'cvr-tpl-tags' }, t.tags?.join(' · ')),
                )))
            : (local === null
              ? h('div', { className: 'cvr-empty' }, h('div', { className: 'title' }, '加载中…'))
              : local.filter(matchTags).map((t) => h('div', {
                  key: t.type,
                  className: 'cvr-tpl-card',
                  onClick: () => openDetail('local', t),
                },
                  h('div', { className: 'cvr-tpl-cover' },
                    h('iframe', { src: `${API}/preview-local-tpl/${t.type}`, title: t.name, scrolling: 'no' }),
                  ),
                  h('div', { className: 'cvr-tpl-name', title: t.name }, t.name),
                  h('div', { className: 'cvr-tpl-tags' }, t.tags?.join(' · ')),
                ))),
        ),
        /* 大图预览弹窗 */
        detail && h('div', {
          onClick: () => setDetail(null),
          className: 'cvr-modal-mask',
        },
          h('div', {
            onClick: (e) => e.stopPropagation(),
            className: 'cvr-modal',
          },
            /* 左：模板封面 + 实时渲染预览 */
            h('div', { className: 'cvr-modal-cover' },
              detail.loading
                ? h('div', { style: { height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: .5, fontSize: 13 } }, '正在加载模板预览…')
                : h('div', { style: { display: 'flex', flexDirection: 'column', gap: 8, padding: 10 } },
                    detail.cover && h('div', null,
                      h('div', { className: 'cvr-modal-pane-label' }, '📌 模板封面预览'),
                      h('img', { src: detail.cover, style: { width: '100%', borderRadius: 10, border: '1px solid var(--rs-border)', display: 'block' } }),
                    ),
                    (detail.html || detail.localSrc) && h('div', null,
                      h('div', { className: 'cvr-modal-pane-label' }, '⚙️ 实时排版预览'),
                      h('div', { className: 'render-clip', style: { height: 300 } },
                        detail.kind === 'online'
                          ? h('iframe', { srcDoc: detail.html, title: '插件渲染' })
                          : h('iframe', { src: detail.localSrc, title: '插件渲染' }),
                      ),
                    ),
                  )),
            /* 右：信息与操作 */
            h('div', { className: 'cvr-modal-side' },
              h('div', { className: 'name' }, detail.name),
              h('div', { className: 'tagrow' },
                (detail.tags || []).map((t) => h('span', { key: t, className: 'tag' }, t))),
              h('div', { className: 'desc' }, detail.desc || '（无描述）'),
              h('div', { className: 'note' }, detail.kind === 'online'
                ? '使用后将创建含真实示例内容的简历，所有内容可随意改写。'
                : '内置模板，创建后即得完整示例结构。'),
              h(Btn, { icon: ICONS.check, label: using ? '创建中…' : '使用此模板', onClick: useTemplate, primary: true, disabled: using }),
              h(Btn, { label: '关闭', onClick: () => setDetail(null) }),
            ),
          ),
        ),
      );
    }

    /** 全局轻提示（供模板中心等非 Workbench 页面用） */
    let globalToastFn = null;
    function flashGlobal(msg, icon) { globalToastFn && globalToastFn(msg, icon); }

    /* ------------------------------ Resume switcher ---------------------------- */

    /**
     * 换模板/换序前的兜底落盘。
     * 关键：这些操作会重新读取磁盘正文，如果用户还有未落盘的编辑就会丢。
     * 做法是把 contentEditable 里的真实内容先 PUT 一次（与主保存同源），
     * 再执行结构变更；失败则整体中止，绝不 silently 覆盖。
     */
    async function flushResumeBeforeSwap(id, opts = {}) {
      const mode = opts.mode || 'md';
      const editable = opts.editable;
      let content = opts.content;
      if (mode === 'wysiwyg' && editable) {
        const md = htmlToMd(editable);
        if (md && md.trim()) content = md;
      }
      if (typeof content !== 'string') return;
      await api('/resume/' + id, { method: 'PUT', body: JSON.stringify({ content }) });
    }

    /* ------------------------- 通用弹窗外壳（新增） ------------------------- */

    function Modal({ title, subtitle, onClose, children, width }) {
      useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
      }, [onClose]);
      return h('div', {
        className: 'cvr-modal-mask',
        onClick: onClose,
        style: { position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' },
      },
        h('div', {
          className: 'cvr-modal',
          onClick: (e) => e.stopPropagation(),
          style: { width: width || 720, maxWidth: '92vw', maxHeight: '86vh', overflow: 'auto', padding: 0, display: 'block' },
        },
          h('div', { className: 'cvr-modal-head' },
            h('div', null,
              h('div', { className: 'cvr-modal-title' }, title),
              subtitle ? h('div', { className: 'cvr-modal-sub' }, subtitle) : null,
            ),
            h(Btn, { icon: ICONS.plus, iconOnly: true, title: '关闭', onClick: onClose, style: { transform: 'rotate(45deg)' } }),
          ),
          h('div', { className: 'cvr-modal-body' }, children),
        ),
      );
    }

    /* --------------------------- 换模板（新增） --------------------------- */

    function TemplateSwapDialog({ resumeId, onClose, onDone, onBeforeChange }) {
      const [tab, setTab] = useState('local');
      const [local, setLocal] = useState(null);
      const [online, setOnline] = useState(null);
      const [busy, setBusy] = useState('');

      useEffect(() => {
        api('/templates').then((d) => setLocal(d.items)).catch(() => setLocal([]));
        api('/online-templates').then((d) => setOnline(d.items || [])).catch(() => setOnline([]));
      }, []);

      const apply = async (payload, label) => {
        if (busy) return;
        setBusy(label);
        try {
          if (onBeforeChange) await onBeforeChange();
          await api('/resume/' + resumeId + '/template', { method: 'POST', body: JSON.stringify(payload) });
          onDone && onDone();
          onClose();
        } catch (e) {
          window.alert('换模板失败：' + e.message);
        } finally { setBusy(''); }
      };

      const list = tab === 'local' ? local : online;
      return h(Modal, { title: '一键换模板', subtitle: '只换版式和配色，正文一个字都不动', onClose, width: 820 },
        h('div', { className: 'cvr-swap-tabs' },
          h(Btn, { label: '内置模板', active: tab === 'local', onClick: () => setTab('local') }),
          h(Btn, { label: '在线模板', active: tab === 'online', onClick: () => setTab('online') }),
        ),
        list === null
          ? h('div', { className: 'cvr-swap-empty' }, '加载中…')
          : list.length === 0
            ? h('div', { className: 'cvr-swap-empty' }, tab === 'online' ? '在线模板源不可用（可离线使用内置模板）' : '没有可用模板')
            : h('div', { className: 'cvr-swap-grid' },
                list.map((t) => {
                  const key = tab === 'local' ? t.type : t.id;
                  const color = (t.style && t.style.primaryBGColor) || '#4A6FA5';
                  return h('button', {
                    key,
                    className: 'cvr-swap-card',
                    disabled: !!busy,
                    onClick: () => apply(tab === 'local' ? { type: t.type } : { onlineType: t.id }, t.name),
                    title: '点击套用',
                  },
                    h('span', { className: 'dot', style: { background: color } }),
                    h('span', { className: 'nm' }, t.name),
                    h('span', { className: 'sub' }, busy === t.name ? '正在套用…' : (t.tags || []).slice(0, 3).join(' · ')),
                  );
                }),
              ),
      );
    }

    /* ------------------------- 模块排序（新增） ------------------------- */

    function SectionOrderDialog({ resumeId, onClose, onChanged, onBeforeChange }) {
      const [items, setItems] = useState(null);
      const [busy, setBusy] = useState(false);

      const load = () => api('/resume/' + resumeId + '/sections').then(setItems).catch(() => setItems([]));
      useEffect(() => { load(); }, [resumeId]);

      const move = async (index, dir) => {
        if (busy) return;
        setBusy(true);
        try {
          if (onBeforeChange) await onBeforeChange();
          await api('/resume/' + resumeId + '/move-section', { method: 'POST', body: JSON.stringify({ index, dir }) });
          await load();
          onChanged && onChanged();
        } catch (e) { window.alert('调整失败：' + e.message); }
        finally { setBusy(false); }
      };

      const del = async (index, title) => {
        if (busy) return;
        if (!window.confirm(`删除模块「${title}」？该模块内容会被移除。`)) return;
        setBusy(true);
        try {
          if (onBeforeChange) await onBeforeChange();
          await api('/resume/' + resumeId + '/remove-section', { method: 'POST', body: JSON.stringify({ index }) });
          await load();
          onChanged && onChanged();
        } catch (e) { window.alert('删除失败：' + e.message); }
        finally { setBusy(false); }
      };

      return h(Modal, { title: '模块顺序', subtitle: '上移 / 下移调整板块顺序，改动会立即保存', onClose, width: 560 },
        items === null
          ? h('div', { className: 'cvr-swap-empty' }, '加载中…')
          : items.length === 0
            ? h('div', { className: 'cvr-swap-empty' }, '没有识别到「## 模块」，请先在正文里用 ## 标题分节')
            : h('div', { className: 'cvr-sec-list' },
                items.map((it) => h('div', { key: it.index + ':' + it.title, className: 'cvr-sec-row' },
                  h('span', { className: 'idx' }, String(it.index + 1).padStart(2, '0')),
                  h('span', { className: 'nm' }, it.title),
                  h('span', { className: 'ops' },
                    h(Btn, { icon: ICONS.arrowUp, iconOnly: true, title: '上移', disabled: busy || it.index === 0, onClick: () => move(it.index, -1) }),
                    h(Btn, { icon: ICONS.arrowDown, iconOnly: true, title: '下移', disabled: busy || it.index === items.length - 1, onClick: () => move(it.index, 1) }),
                    h(Btn, { icon: ICONS.trash, iconOnly: true, title: '删除该模块', danger: true, disabled: busy, onClick: () => del(it.index, it.title) }),
                  ),
                )),
              ),
      );
    }

    /* --------------------- 简历体检 + JD 匹配（新增） --------------------- */

    function CheckupDialog({ resumeId, onClose }) {
      const [tab, setTab] = useState('check');
      const [report, setReport] = useState(null);
      const [jd, setJd] = useState('');
      const [match, setMatch] = useState(null);
      const [busy, setBusy] = useState(false);

      useEffect(() => {
        api('/resume/' + resumeId + '/proofread').then(setReport).catch((e) => setReport({ error: e.message, issues: [], score: 0, stats: {} }));
      }, [resumeId]);

      const runMatch = async () => {
        if (busy || !jd.trim()) return;
        setBusy(true);
        try { setMatch(await api('/resume/' + resumeId + '/match-jd', { method: 'POST', body: JSON.stringify({ jd }) })); }
        catch (e) { window.alert('匹配失败：' + e.message); }
        finally { setBusy(false); }
      };

      const sevColor = { high: '#ef4444', medium: '#f59e0b', low: '#64748b' };
      return h(Modal, { title: '简历体检', subtitle: '全部本地计算，不联网、不外传', onClose, width: 780 },
        h('div', { className: 'cvr-swap-tabs' },
          h(Btn, { label: '体检评分', active: tab === 'check', onClick: () => setTab('check') }),
          h(Btn, { label: 'JD 匹配', active: tab === 'jd', onClick: () => setTab('jd') }),
        ),
        tab === 'check'
          ? (report === null
              ? h('div', { className: 'cvr-swap-empty' }, '正在体检…')
              : report.error
                ? h('div', { className: 'cvr-swap-empty' }, '体检失败：' + report.error)
                : h(React.Fragment, null,
                    h('div', { className: 'cvr-score' },
                      h('div', { className: 'num', style: { color: report.score >= 80 ? '#10b981' : report.score >= 60 ? '#f59e0b' : '#ef4444' } }, String(report.score)),
                      h('div', { className: 'meta' },
                        h('div', { className: 'lbl' }, '简历健康度'),
                        h('div', { className: 'sub' }, `${report.stats.sections || 0} 个模块 · ${report.stats.bullets || 0} 条要点 · ${report.stats.quantifiedBullets || 0} 条有数据`),
                      ),
                    ),
                    report.issues.length === 0
                      ? h('div', { className: 'cvr-swap-empty' }, '没发现问题，这份简历状态不错 🎉')
                      : h('div', { className: 'cvr-issue-list' },
                          report.issues.map((it, i) => h('div', { key: i, className: 'cvr-issue' },
                            h('span', { className: 'bar', style: { background: sevColor[it.severity] || '#64748b' } }),
                            h('div', { className: 'body' },
                              h('div', { className: 'msg' }, it.message, it.line ? h('span', { className: 'ln' }, ` 第 ${it.line} 行`) : null),
                              it.text ? h('div', { className: 'quote' }, it.text) : null,
                              it.suggestion ? h('div', { className: 'fix' }, '建议：' + it.suggestion) : null,
                            ),
                          )),
                        ),
                  ))
          : h('div', { className: 'cvr-jd' },
              h('textarea', {
                className: 'cvr-jd-input',
                placeholder: '把招聘 JD 原文整段粘进来，越完整越准…',
                value: jd,
                onChange: (e) => setJd(e.target.value),
                rows: 7,
              }),
              h('div', { style: { display: 'flex', gap: 8, marginTop: 10 } },
                h(Btn, { icon: ICONS.target, label: busy ? '分析中…' : '开始匹配', primary: true, disabled: busy || !jd.trim(), onClick: runMatch }),
              ),
              match && h('div', { className: 'cvr-match' },
                h('div', { className: 'cvr-score' },
                  h('div', { className: 'num', style: { color: match.score >= 70 ? '#10b981' : match.score >= 45 ? '#f59e0b' : '#ef4444' } }, match.score + '%'),
                  h('div', { className: 'meta' },
                    h('div', { className: 'lbl' }, '关键词覆盖率'),
                    h('div', { className: 'sub' }, `命中 ${match.matched.length} 个 · 缺失 ${match.missing.length} 个`),
                  ),
                ),
                match.missing.length > 0 && h('div', { className: 'cvr-kw-block' },
                  h('div', { className: 't' }, '建议补进简历的关键词'),
                  h('div', { className: 'cvr-kw-row' }, match.missing.map((k) => h('span', { key: k, className: 'cvr-kw miss' }, k))),
                ),
                match.matched.length > 0 && h('div', { className: 'cvr-kw-block' },
                  h('div', { className: 't' }, '已命中'),
                  h('div', { className: 'cvr-kw-row' }, match.matched.map((k) => h('span', { key: k, className: 'cvr-kw hit' }, k))),
                ),
              ),
            ),
      );
    }

    function ResumeSwitcher({ items, activeId, onSwitch }) {
      const [open, setOpen] = useState(false);
      const boxRef = useRef(null);
      useEffect(() => {
        if (!open) return;
        const close = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
      }, [open]);
      const current = (items || []).find((i) => i.id === activeId) || null;
      return h('div', { style: { position: 'relative' }, ref: boxRef },
        h('button', {
          className: 'cvr-btn' + (open ? ' active' : ''),
          onClick: () => setOpen(!open),
          style: { minWidth: 170, justifyContent: 'space-between' },
          title: current ? current.name : '选择简历',
        },
          h('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 190 } },
            current ? current.name : (items === null ? '加载中…' : items.length ? '选择简历' : '（还没有简历）')),
          h('span', { style: { fontSize: 10, opacity: .7 } }, '▾'),
        ),
        open && h('div', { className: 'cvr-pop-menu', style: { minWidth: 290, maxHeight: 340, overflowY: 'auto' } },
          (items || []).length === 0
            ? h('div', { style: { padding: '8px 10px', fontSize: 12, opacity: .6 } }, '还没有简历，点「＋新建」创建一份')
            : items.map((it) => h('div', {
                key: it.id,
                className: 'cvr-pop-item' + (it.id === activeId ? ' cvr-pop-item-active' : ''),
                onClick: () => { setOpen(false); onSwitch(it.id); },
              },
                h('div', { style: { display: 'flex', alignItems: 'center', gap: 6 } },
                  it.id === activeId ? h('span', { style: { color: '#4a8cff', fontSize: 11, flex: 'none' } }, '●') : h('span', { style: { width: 11, flex: 'none' } }),
                  h('span', {
                    style: { fontWeight: it.id === activeId ? 700 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 },
                    title: it.name,
                  }, it.name),
                  h('span', { style: { fontSize: 10, opacity: .5, flex: 'none' } }, String(it.updatedAt || '').slice(5, 16)),
                ),
              ))),
      );
    }

    /* -------------------------------- Workbench -------------------------------- */

    function Workbench(props) {
      const [items, setItems] = useState(null);
      const [activeId, setActiveId] = useState(null);
      const [meta, setMeta] = useState(null);
      const [content, setContent] = useState('');
      const [mode, setMode] = useState('md');
      const [dirty, setDirty] = useState(false);
      const [saving, setSaving] = useState(false);
      const [rev, setRev] = useState(0);
      const [extStale, setExtStale] = useState(false);
      const [previewKey, setPreviewKey] = useState(0);
      const [fragSeq, setFragSeq] = useState(0);
      const [fragLoading, setFragLoading] = useState(false);
      const [zoom, setZoom] = useState(0.8);
      const [toast, setToast] = useState(null);
      const [dialog, setDialog] = useState(null); // 'template' | 'sections' | 'checkup'

      const contentRef = useRef('');
      const dirtyRef = useRef(false);
      const activeIdRef = useRef(null);
      const editableRef = useRef(null);
      const fragmentLoadedRef = useRef('');
      const saveTimerRef = useRef(null);
      const pollRef = useRef(null);
      const textareaRef = useRef(null);
      const historyRef = useRef({ snaps: [], idx: -1 });
      const pushTimerRef = useRef(null);
      const savedRangeRef = useRef(null);
      const revRef = useRef(0);
      const modeRef = useRef('md');
      const syncTimerRef = useRef(null);
      const previewFrameRef = useRef(null);
      const liveSeqRef = useRef(0);
      const caretRef = useRef(0);
      const lastContentRef = useRef('');
      const composingRef = useRef(false);
      const [canUndo, setCanUndo] = useState(false);
      const [canRedo, setCanRedo] = useState(false);

      // 只在 content 状态真的变化时同步 ref：否则 setSaving/setToast 这类无关渲染
      // 会把处理器里刚写入的最新内容覆盖回旧的 state 值
      if (lastContentRef.current !== content) { lastContentRef.current = content; contentRef.current = content; }
      dirtyRef.current = dirty;
      activeIdRef.current = activeId;
      revRef.current = rev;
      modeRef.current = mode;

      const flash = (msg, icon, ms) => {
        setToast({ msg, icon: icon || ICONS.check });
        if (ms !== 0) setTimeout(() => setToast(null), ms || 1800);
        return () => setToast(null);
      };

      /* 预览刷新节流：连续编辑只在停顿后重载一次 iframe（原来每次保存都整页重载） */
      const previewTimerRef = useRef(null);
      const bumpPreview = (delay) => {
        clearTimeout(previewTimerRef.current);
        previewTimerRef.current = setTimeout(() => setPreviewKey((k) => k + 1), delay === undefined ? 600 : delay);
      };

      /* 把富文本 DOM 同步成 markdown —— 全流程唯一转换点 */
      const syncFromWysiwyg = () => {
        if (!editableRef.current) return contentRef.current;
        let md;
        try { md = htmlToMd(editableRef.current); }
        catch { md = contentRef.current; }
        // 安全网：DOM 里有字却转出空串 → 判定转换异常，不覆盖
        if (!md || (!md.trim() && (editableRef.current.textContent || '').trim())) {
          return contentRef.current;
        }
        contentRef.current = md;
        return md;
      };

      /* 当前真源 markdown（按模式取） */
      const currentMd = () => (modeRef.current === 'wysiwyg' ? syncFromWysiwyg() : contentRef.current);

      /* 实时预览：POST 正文 → postMessage 就地替换 iframe 内容（不重载、不闪、不丢滚动） */
      const pushLivePreview = (md) => {
        const id = activeIdRef.current;
        if (!id || id === 'none') return;
        const seq = ++liveSeqRef.current;
        api('/preview-live/' + id, { method: 'POST', body: JSON.stringify({ content: md }) })
          .then((d) => {
            if (seq !== liveSeqRef.current) return; // 只应用最新一次，防乱序
            const fr = previewFrameRef.current;
            if (fr && fr.contentWindow) {
              fr.contentWindow.postMessage({ type: 'cvr-preview-set', html: d.html }, '*');
            }
          })
          .catch(() => { /* 静默：预览失败不影响编辑 */ });
      };

      /* 编辑统一调度：合并 → 同步真源 → 推送预览 → 1.2s 后落盘 */
      const scheduleSync = (delay) => {
        clearTimeout(syncTimerRef.current);
        syncTimerRef.current = setTimeout(() => {
          const id = activeIdRef.current;
          if (!id || id === 'none') return;
          const md = currentMd();
          if (modeRef.current === 'wysiwyg') setContent(md);
          pendingRef.current = { id, content: md };
          pushLivePreview(md);
          clearTimeout(saveTimerRef.current);
          saveTimerRef.current = setTimeout(() => flushSave(), 1200);
        }, delay === undefined ? 350 : delay);
      };

      /* -------- Undo / Redo（快照列表 + 游标） -------- */
      const getSnapshot = () => mode === 'md' ? contentRef.current : (editableRef.current?.innerHTML || '');

      const applySnapshot = (snap) => {
        const id = activeIdRef.current;
        if (modeRef.current === 'md') {
          setContent(snap); contentRef.current = snap;
          // 恢复光标：撤销不该把光标甩到开头
          const pos = Math.min(caretRef.current || 0, snap.length);
          requestAnimationFrame(() => {
            const ta = textareaRef.current;
            if (ta) { try { ta.setSelectionRange(pos, pos); } catch { /* ignore */ } }
          });
        } else if (editableRef.current) {
          editableRef.current.innerHTML = snap;
          const md = htmlToMd(editableRef.current);
          setContent(md); contentRef.current = md;
          savedRangeRef.current = null; // 旧 Range 已随 DOM 失效，避免工具栏作用到野节点
        }
        setDirty(true);
        pendingRef.current = { id, content: contentRef.current };
        pushLivePreview(contentRef.current);
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => flushSave(), 1000);
      };

      const _pushSnap = (snap) => {
        const s = snap !== undefined ? snap : getSnapshot();
        const h = historyRef.current;
        if (h.idx >= 0 && h.snaps[h.idx] === s) return;
        h.snaps = h.snaps.slice(0, h.idx + 1);
        h.snaps.push(s);
        h.idx = h.snaps.length - 1;
        if (h.snaps.length > 100) { h.snaps.shift(); h.idx--; }
        setCanUndo(h.idx > 0); setCanRedo(false);
      };

      const scheduleUndoPush = () => {
        clearTimeout(pushTimerRef.current);
        pushTimerRef.current = setTimeout(() => _pushSnap(), 500);
      };

      const doUndo = () => {
        clearTimeout(pushTimerRef.current);
        clearTimeout(syncTimerRef.current);
        const h = historyRef.current;
        const snap = getSnapshot();
        if (h.idx >= 0 && h.snaps[h.idx] !== snap) _pushSnap(snap);
        if (h.idx <= 0) return;
        h.idx--;
        applySnapshot(h.snaps[h.idx]);
        setCanUndo(h.idx > 0); setCanRedo(h.idx < h.snaps.length - 1);
      };

      const doRedo = () => {
        clearTimeout(pushTimerRef.current);
        clearTimeout(syncTimerRef.current);
        const h = historyRef.current;
        if (h.idx >= h.snaps.length - 1) return;
        h.idx++;
        applySnapshot(h.snaps[h.idx]);
        setCanUndo(h.idx > 0); setCanRedo(h.idx < h.snaps.length - 1);
      };

      const clearHistory = (initialSnap) => {
        const snap = initialSnap !== undefined ? initialSnap : getSnapshot();
        historyRef.current = { snaps: [snap], idx: 0 };
        clearTimeout(pushTimerRef.current);
        setCanUndo(false); setCanRedo(false);
      };

      /* 选区保存 / 恢复（工具栏按钮不丢焦点；同步追踪拖出编辑区松手的选区） */
      const saveSelection = () => {
        const ed = editableRef.current;
        const sel = window.getSelection();
        if (!ed || !sel || !sel.rangeCount) return;
        const rng = sel.getRangeAt(0);
        if (ed.contains(rng.commonAncestorContainer)) {
          savedRangeRef.current = rng.cloneRange();
        }
      };
      useEffect(() => {
        if (mode !== 'wysiwyg') return;
        const onSelChange = () => saveSelection();
        document.addEventListener('selectionchange', onSelChange);
        return () => document.removeEventListener('selectionchange', onSelChange);
      }, [mode]);

      const restoreSelection = () => {
        const ed = editableRef.current;
        if (!ed) return;
        try {
          if (document.activeElement !== ed && !ed.contains(document.activeElement)) {
            ed.focus({ preventScroll: true });
          }
        } catch {
          try { ed.focus(); } catch { /* ignore */ }
        }
        const sel = window.getSelection();
        if (!sel) return;
        // 若浏览器当前选区仍在编辑器内，保留实时选区，避免被陈旧的 savedRange 覆盖
        if (sel.rangeCount > 0 && ed.contains(sel.getRangeAt(0).commonAncestorContainer)) {
          savedRangeRef.current = sel.getRangeAt(0).cloneRange();
          return;
        }
        const saved = savedRangeRef.current;
        if (saved && ed.contains(saved.commonAncestorContainer)) {
          sel.removeAllRanges();
          sel.addRange(saved);
        }
      };

      const stripTagsInSelection = (ed, selector) => {
        const sel = window.getSelection();
        if (!ed || !sel || !sel.rangeCount || sel.isCollapsed) return;
        const rng = sel.getRangeAt(0);
        if (!ed.contains(rng.commonAncestorContainer)) return;
        const targets = Array.from(ed.querySelectorAll(selector)).filter((el) => {
          try { return rng.intersectsNode(el); } catch { return false; }
        });
        for (const el of targets) {
          const rEl = document.createRange();
          rEl.selectNodeContents(el);
          const cmpStart = rng.compareBoundaryPoints(Range.START_TO_START, rEl);
          const cmpEnd = rng.compareBoundaryPoints(Range.END_TO_END, rEl);
          if (cmpStart <= 0 && cmpEnd >= 0) {
            const p = el.parentNode;
            if (!p) continue;
            while (el.firstChild) p.insertBefore(el.firstChild, el);
            p.removeChild(el);
            continue;
          }
          const rMid = document.createRange();
          rMid.setStart(cmpStart > 0 ? rng.startContainer : rEl.startContainer, cmpStart > 0 ? rng.startOffset : rEl.startOffset);
          rMid.setEnd(cmpEnd < 0 ? rng.endContainer : rEl.endContainer, cmpEnd < 0 ? rng.endOffset : rEl.endOffset);
          let afterFrag = null;
          if (cmpEnd < 0) {
            const rA = document.createRange();
            rA.setStart(rMid.endContainer, rMid.endOffset);
            rA.setEnd(rEl.endContainer, rEl.endOffset);
            afterFrag = rA.extractContents();
          }
          const midFrag = rMid.extractContents();
          const p = el.parentNode;
          if (!p) continue;
          const anchor = el.nextSibling;
          if (afterFrag && afterFrag.textContent) {
            const cloneA = el.cloneNode(false);
            cloneA.appendChild(afterFrag);
            p.insertBefore(cloneA, anchor);
          }
          p.insertBefore(midFrag, afterFrag && afterFrag.textContent ? el.nextSibling : anchor);
          if (!el.textContent && !el.querySelector('*')) p.removeChild(el);
        }
      };

      const execCmd = (cmd, val) => {
        composingRef.current = false;
        restoreSelection();
        try { document.execCommand('styleWithCSS', false, false); } catch { /* ignore */ }
        document.execCommand(cmd, false, val || null);
        if (cmd === 'removeFormat') {
          stripTagsInSelection(editableRef.current, 'del, s, strike');
        }
        saveSelection();
        scheduleUndoPush();
        setDirty(true);
        scheduleSync(60);
      };

      /* 字符级 Backspace / Delete（WYSIWYG 防整块删除） */
      const _lastTextNode = (nd) => {
        if (!nd) return null;
        if (nd.nodeType === 3) return nd;
        if (nd.nodeType !== 1) return null;
        for (let i = nd.childNodes.length - 1; i >= 0; i--) { const r = _lastTextNode(nd.childNodes[i]); if (r) return r; }
        return null;
      };
      const _firstTextNode = (nd) => {
        if (!nd) return null;
        if (nd.nodeType === 3) return nd;
        if (nd.nodeType !== 1) return null;
        for (let i = 0; i < nd.childNodes.length; i++) { const r = _firstTextNode(nd.childNodes[i]); if (r) return r; }
        return null;
      };
      const handleEditorKeyDown = (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); doSave(); return; }
        if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') { e.preventDefault(); doUndo(); return; }
        if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); doRedo(); return; }
        if (e.key !== 'Backspace' && e.key !== 'Delete') return;
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount || !sel.isCollapsed) return;
        e.preventDefault();
        const rng = sel.getRangeAt(0);
        const ct = rng.startContainer, of = rng.startOffset;
        if (e.key === 'Backspace') {
          if (ct.nodeType === 3 && of > 0) {
            ct.deleteData(of - 1, 1);
            rng.setStart(ct, of - 1); rng.collapse(true);
            sel.removeAllRanges(); sel.addRange(rng);
          } else {
            let nd = ct.nodeType === 1 ? (of > 0 ? _lastTextNode(ct.childNodes[of - 1]) : null) : null;
            if (!nd) {
              let el = ct.nodeType === 3 ? ct.parentNode : ct;
              while (el && el !== editableRef.current) {
                const pv = el.previousSibling;
                if (pv) { nd = _lastTextNode(pv); break; }
                el = el.parentNode;
              }
            }
            if (nd && nd.length > 0) {
              nd.deleteData(nd.length - 1, 1);
              const r2 = document.createRange();
              r2.setStart(nd, nd.length); r2.collapse(true);
              sel.removeAllRanges(); sel.addRange(r2);
            }
          }
        } else {
          if (ct.nodeType === 3 && of < ct.length) {
            ct.deleteData(of, 1);
            rng.setStart(ct, of); rng.collapse(true);
            sel.removeAllRanges(); sel.addRange(rng);
          } else {
            let nd = ct.nodeType === 1 ? (of < ct.childNodes.length ? _firstTextNode(ct.childNodes[of]) : null) : null;
            if (!nd) {
              let el = ct.nodeType === 3 ? ct.parentNode : ct;
              while (el && el !== editableRef.current) {
                const nx = el.nextSibling;
                if (nx) { nd = _firstTextNode(nx); break; }
                el = el.parentNode;
              }
            }
            if (nd && nd.length > 0) {
              nd.deleteData(0, 1);
              const r2 = document.createRange();
              r2.setStart(nd, 0); r2.collapse(true);
              sel.removeAllRanges(); sel.addRange(r2);
            }
          }
        }
        onWysiwygInput();
      };

      const loadList = useCallback(async (preferFirst) => {
        const d = await api('/resumes');
        setItems(d.items);
        setRev(d.rev); revRef.current = d.rev;
        setActiveId((cur) => {
          if (cur && d.items.some((i) => i.id === cur)) return cur;
          if (preferFirst && d.items.length) return d.items[0].id;
          return d.items.length ? d.items[0].id : 'none';
        });
      }, []);

      const loadResume = useCallback(async (id) => {
        if (!id || id === 'none') { setMeta(null); setContent(''); return; }
        const d = await api('/resume/' + id);
        setMeta(d.item);
        setContent(d.content);
        setDirty(false);
        clearTimeout(previewTimerRef.current);
        clearTimeout(syncTimerRef.current);
        clearTimeout(saveTimerRef.current);
        clearTimeout(pushTimerRef.current);
        pendingRef.current = null;
        savedRangeRef.current = null;
        caretRef.current = 0;
        liveSeqRef.current += 1;   // 作废在途的实时预览响应
        composingRef.current = false;
        setPreviewKey((k) => k + 1);
        contentRef.current = d.content;
        lastContentRef.current = d.content;
        fragmentLoadedRef.current = '';
        setFragSeq((s) => s + 1);
        clearHistory(d.content);
      }, []);

      useEffect(() => { loadList(true); }, [loadList]);
      useEffect(() => { if (activeId && activeId !== 'none') loadResume(activeId); }, [activeId, loadResume]);

      /* 页面隐藏/关闭时兜底保存未落盘内容（keepalive 保证请求存活） */
      useEffect(() => {
        const onFlush = () => {
          const id = activeIdRef.current;
          if (!id || id === 'none') return;
          // 手里没有待保存快照、但仍有未落盘编辑时，也要抢救一次（不能只看 pendingRef）
          if (!pendingRef.current && !dirtyRef.current) return;
          let content;
          try { content = currentMd(); } catch { content = contentRef.current; }
          try {
            fetch(API + '/resume/' + id, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ content }),
              keepalive: true,
            });
            pendingRef.current = null;
          } catch { /* 兜底失败静默 */ }
        };
        const onVis = () => { if (document.visibilityState === 'hidden') onFlush(); };
        window.addEventListener('pagehide', onFlush);
        document.addEventListener('visibilitychange', onVis);
        return () => {
          window.removeEventListener('pagehide', onFlush);
          document.removeEventListener('visibilitychange', onVis);
        };
      }, []);

      // 轮询外部变更（Agent 工具写入时，面板自动刷新）
      useEffect(() => {
        pollRef.current = setInterval(async () => {
          try {
            const d = await api('/rev');
            if (d.rev !== revRef.current) {
              setRev(d.rev); revRef.current = d.rev;
              if (!dirtyRef.current) {
                const list = await api('/resumes');
                setItems(list.items);
                const cur = activeIdRef.current;
                if (cur && cur !== 'none' && list.items.some((i) => i.id === cur)) {
                  const fresh = await api('/resume/' + cur);
                  setMeta(fresh.item);
                  setContent(fresh.content);
                  contentRef.current = fresh.content;
                  lastContentRef.current = fresh.content;
                  clearHistory(fresh.content);
                  bumpPreview();
                  // 富文本编辑器是 contentEditable，React 不会回写它的内容，
                  // 必须作废片段游标让它重拉，否则 Agent 改了内容编辑器里还是旧的
                  fragmentLoadedRef.current = '';
                  if (modeRef.current === 'wysiwyg') setFragSeq((s) => s + 1);
                }
              } else {
                setExtStale(true);
              }
            }
          } catch { /* 静默 */ }
        }, 3000);
        return () => clearInterval(pollRef.current);
      }, []);

      /* 统一保存调度：编辑瞬间锁定 {id, content}，防止切换简历时串写 */
      const pendingRef = useRef(null);
      const flushSave = useCallback(async () => {
        clearTimeout(saveTimerRef.current);
        clearTimeout(syncTimerRef.current);
        const p = pendingRef.current;
        pendingRef.current = null;
        if (!p) return;
        // 关键：落盘前用当前真源覆盖快照，杜绝「保存的是旧内容」
        if (p.id === activeIdRef.current) p.content = currentMd();
        setSaving(true);
        try {
          const d = await api('/resume/' + p.id, { method: 'PUT', body: JSON.stringify({ content: p.content }) });
          setRev(d.rev); revRef.current = d.rev;
          // 仅当仍停留在该简历且没有新编辑时才清除脏标记
          if (activeIdRef.current === p.id && !pendingRef.current) setDirty(false);
          // 保存后不再整页重载 iframe（会闪、会丢滚动），只在推送失败时兜底刷新
          pushLivePreview(p.content);
        } catch (e) { flash('保存失败：' + e.message, ICONS.refresh); }
        finally { setSaving(false); }
      }, []);

      const doSave = useCallback(async (targetId, overrideContent) => {
        const id = targetId || activeIdRef.current;
        if (!id || id === 'none') return;
        let payload = overrideContent;
        if (payload === undefined) {
          payload = currentMd();
          if (modeRef.current === 'wysiwyg') setContent(payload);
        }
        pendingRef.current = { id, content: payload };
        setSaving(true);
        try {
          const d = await api('/resume/' + id, { method: 'PUT', body: JSON.stringify({ content: payload }) });
          setRev(d.rev); revRef.current = d.rev;
          setDirty(false);
          // 只清理这次自己写的快照；期间用户新产生的编辑要保留
          const pend = pendingRef.current;
          if (pend && pend.id === id && pend.content === payload) pendingRef.current = null;
          pushLivePreview(payload);
        } catch (e) { flash('保存失败：' + e.message, ICONS.refresh); }
        finally { setSaving(false); }
      }, []);

      const onMdInput = (value) => {
        scheduleUndoPush();
        setContent(value);
        contentRef.current = value;
        setDirty(true);
        caretRef.current = textareaRef.current ? textareaRef.current.selectionStart : 0;
        scheduleSync();
      };

      const onWysiwygInput = () => {
        scheduleUndoPush();
        setDirty(true);
        // 输入法合成中（中文拼音候选）不转换，否则会把半成品写进 markdown
        if (composingRef.current) return;
        scheduleSync();
      };

      const onCompositionStart = () => { composingRef.current = true; };
      const onCompositionEnd = () => {
        composingRef.current = false;
        setDirty(true);
        scheduleUndoPush();
        scheduleSync();
      };

      // 切到富文本：拉取渲染片段（每次进入模式强制重取；自身保存 rev 变化被游标挡住不重载）
      useEffect(() => {
        if (mode !== 'wysiwyg' || !activeId || activeId === 'none') return;
        if (fragmentLoadedRef.current === activeId + ':' + fragSeq) return;
        const rid = activeId;
        const seq = fragSeq;
        setFragLoading(true);
        api('/resume/' + rid + '/fragment').then((d) => {
          // 过期响应丢弃：已切简历 或 已离开富文本 或 已有更新的请求
          if (activeIdRef.current !== rid || modeRef.current !== 'wysiwyg' || seq !== fragSeq) return;
          fragmentLoadedRef.current = rid + ':' + seq;
          if (editableRef.current) {
            editableRef.current.innerHTML = d.html;
            clearHistory(d.html);
          }
          setFragLoading(false);
        }).catch(() => {
          setFragLoading(false);
          setTimeout(() => setFragSeq((s) => s + 1), 1200); // 失败自动重试
        });
      }, [mode, activeId, fragSeq, rev]);

      const switchMode = (next) => {
        if (next === mode) return;
        // 三个定时器全清：漏掉 syncTimer 会让旧模式的延迟同步在新模式里回写内容
        clearTimeout(saveTimerRef.current);
        clearTimeout(pushTimerRef.current);
        clearTimeout(syncTimerRef.current);

        // 固化当前模式的真源（富文本走统一转换点，带安全网）
        const md = currentMd();
        contentRef.current = md;
        if (mode === 'wysiwyg') setContent(md);
        clearHistory(md);

        const hadPending = dirtyRef.current;
        if (hadPending) pendingRef.current = { id: activeIdRef.current, content: md };

        // 进入富文本：作废旧片段游标 + 序号 +1，强制重拉。
        // 必须等落盘完成再切，因为 fragment 是服务端从磁盘读的，否则读到旧内容。
        if (next === 'wysiwyg') {
          fragmentLoadedRef.current = '';
          setFragSeq((s) => s + 1);
          pushLivePreview(md);
          if (hadPending) {
            flushSave().then(() => { setMode(next); }).catch(() => setMode(next));
            return;
          }
        }
        if (hadPending) flushSave();
        setMode(next);
      };

      /** 结构变更前确保正文已落盘（换模板 / 换序 / 删模块前调用） */
      const ensureSaved = async () => {
        clearTimeout(syncTimerRef.current);
        clearTimeout(saveTimerRef.current);
        const id = activeIdRef.current;
        if (!id || id === 'none') return;
        if (!dirtyRef.current && !pendingRef.current) return;
        const md = currentMd();
        contentRef.current = md;
        lastContentRef.current = md;
        pendingRef.current = null;
        const d = await api('/resume/' + id, { method: 'PUT', body: JSON.stringify({ content: md }) });
        if (d && d.rev !== undefined) { setRev(d.rev); revRef.current = d.rev; }
        setDirty(false);
      };

      const exportResume = async (format) => {
        if (!activeId || activeId === 'none') return;
        try {
          const name = await downloadExport(activeId, format, (msg, icon) => flash(msg, icon, 0));
          flash(`已导出：${name}`, ICONS.download);
        } catch (e) {
          flash(`导出失败：${e.message}`, ICONS.refresh);
        }
      };

      /* 头像上传 */
      const fileInputRef = useRef(null);
      const onAvatarFile = async (file) => {
        if (!activeId || activeId === 'none') return;
        if (!file || !/^image\/(png|jpe?g|webp)$/.test(file.type)) { flash('请选择 PNG/JPG/WebP 图片', ICONS.refresh); return; }
        if (file.size > 1024 * 1024) { flash('图片请小于 1MB（可在预览里确认效果）', ICONS.refresh); return; }
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        try {
          await api('/resume/' + activeId + '/avatar', { method: 'POST', body: JSON.stringify({ imageDataUrl: dataUrl }) });
          const fresh = await api('/resume/' + activeId);
          setMeta(fresh.item);
          bumpPreview();
          flash('头像已设置，可在预览里拖拽调整位置');
        } catch (e) { flash('头像上传失败：' + e.message, ICONS.refresh); }
      };

      /* 预览里拖拽头像/校徽 → postMessage → 保存坐标 */
      useEffect(() => {
        const onMessage = (e) => {
          const data = e.data;
          if (!data || activeIdRef.current === null || activeIdRef.current === 'none') return;
          if (data.type === 'cvr-avatar-move') {
            api('/resume/' + activeIdRef.current + '/avatar', {
              method: 'PATCH',
              body: JSON.stringify({ top: data.top, left: data.left }),
            }).catch(() => {});
          } else if (data.type === 'cvr-logo-move') {
            api('/resume/' + activeIdRef.current + '/logo', {
              method: 'PATCH',
              body: JSON.stringify({ top: data.top, left: data.left }),
            }).catch(() => {});
          }
        };
        window.addEventListener('message', onMessage);
        return () => window.removeEventListener('message', onMessage);
      }, []);

      /* 导入简历（新增）：读 .md/.txt/.json 文本，建为新简历 */
      const importInputRef = useRef(null);
      const onImportFile = async (file) => {
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) { flash('文件请小于 2MB', ICONS.refresh); return; }
        let text = '';
        try { text = await file.text(); } catch { flash('读取文件失败', ICONS.refresh); return; }
        // 支持我们自己的 JSON 导出格式；否则按纯文本/Markdown 处理
        try {
          const j = JSON.parse(text);
          if (j && typeof j.content === 'string') text = j.content;
        } catch { /* 不是 JSON，按原文处理 */ }
        if (!text.trim()) { flash('文件内容为空', ICONS.refresh); return; }
        try {
          await flushSave().catch(() => {});
          const name = String(file.name || '导入的简历').replace(/\.[^.]+$/, '').slice(0, 60);
          const d = await api('/import', { method: 'POST', body: JSON.stringify({ name, content: text }) });
          await loadList(false);
          setActiveId(d.item.id);
          flash('已导入：' + d.item.name, ICONS.upload);
        } catch (e) { flash('导入失败：' + e.message, ICONS.refresh); }
      };

      /* 校徽上传 */
      const logoInputRef = useRef(null);
      const onLogoFile = async (file) => {
        if (!activeId || activeId === 'none') return;
        if (!file || !/^image\/(png|svg\+xml|jpe?g|webp)$/.test(file.type)) { flash('请选择 PNG/SVG/JPG/WebP 图片', ICONS.refresh); return; }
        if (file.size > 1024 * 1024) { flash('图片请小于 1MB', ICONS.refresh); return; }
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        try {
          await api('/resume/' + activeId + '/logo', { method: 'POST', body: JSON.stringify({ imageDataUrl: dataUrl }) });
          const fresh = await api('/resume/' + activeId);
          setMeta(fresh.item);
          bumpPreview();
          fragmentLoadedRef.current = '';
          flash('校徽已设置，可在预览里拖拽调整位置');
        } catch (e) { flash('校徽上传失败：' + e.message, ICONS.refresh); }
      };

      /* 智能一页开关 */
      const toggleAutoPage = async () => {
        if (!activeId || activeId === 'none') return;
        const next = !(meta && meta.autoOnePage);
        try {
          await api('/resume/' + activeId, { method: 'PUT', body: JSON.stringify({ autoOnePage: next }) });
          setMeta((m) => ({ ...m, autoOnePage: next }));
          bumpPreview();
          flash(next ? '智能一页已开启：内容超页自动缩放' : '智能一页已关闭', ICONS.fit);
        } catch (e) { flash('操作失败：' + e.message, ICONS.refresh); }
      };

      const removeResume = async () => {
        if (!activeId || activeId === 'none') return;
        if (!window.confirm('确定删除这份简历？不可恢复。')) return;
        await api('/resume/' + activeId, { method: 'DELETE' });
        setActiveId(null);
        await loadList(true);
        flash('已删除', ICONS.trash);
      };

      const noResume = !activeId || activeId === 'none';
      const previewScale = Math.min(zoom, 1);

      return h('div', { className: 'cvr-workbench' },
        /* 顶栏（卡片化分组） */
        h('div', { className: 'cvr-toolbar' },
          h('div', { className: 'cvr-cluster' },
            h(NewResumeBar, {
              onCreated: async (item) => { await flushSave().catch(() => {}); await loadList(false); setActiveId(item.id); flash('已创建：' + item.name); },
            }),
            h(ResumeSwitcher, {
              items, activeId,
              onSwitch: async (id) => {
                await flushSave().catch(() => {});
                setExtStale(false);
                setActiveId(id || null);
              },
            }),
          ),
          h('div', { className: 'cvr-sep' }),
          h('div', { className: 'cvr-seg' },
            h(Btn, { icon: ICONS.code, label: 'MD', active: mode === 'md', onClick: () => switchMode('md'), title: 'Markdown 源码模式' }),
            h(Btn, { icon: ICONS.pen, label: '富文本', active: mode === 'wysiwyg', onClick: () => switchMode('wysiwyg'), title: '所见即所得模式' }),
          ),
          h('div', { className: 'cvr-cluster' },
            h(Btn, { icon: ICONS.undo, label: '撤销', onClick: doUndo, disabled: noResume || !canUndo, title: 'Ctrl+Z' }),
            h(Btn, { icon: ICONS.redo, label: '重做', onClick: doRedo, disabled: noResume || !canRedo, title: 'Ctrl+Y' }),
          ),
          h('div', { className: 'cvr-cluster' },
            h(Btn, { icon: ICONS.check, label: '保存', onClick: () => doSave(), disabled: noResume || !dirty, softaccent: dirty, title: 'Ctrl+S' }),
            h(Btn, { icon: ICONS.portrait, label: '头像', onClick: () => fileInputRef.current?.click(), disabled: noResume, tintBlue: true, title: '上传证件照（预览里可拖拽定位）' }),
            h(Btn, { icon: ICONS.resume, label: '校徽', onClick: () => logoInputRef.current?.click(), disabled: noResume, tintViolet: true, title: '上传校徽/公司 Logo（预览里可拖拽定位）' }),
            h(Btn, { icon: ICONS.fit, label: '智能一页', onClick: toggleAutoPage, disabled: noResume, active: !!(meta && meta.autoOnePage), tintYellow: !!(meta && meta.autoOnePage) === false, title: '内容超页自动缩放至恰好一页' }),
          ),
          h('div', { className: 'cvr-sep' }),
          /* 新增：换模板 / 模块顺序 / 体检 / 导入 */
          h('div', { className: 'cvr-cluster' },
            h(Btn, { icon: ICONS.swap, label: '换模板', onClick: () => setDialog('template'), disabled: noResume, tintViolet: true, title: '只换版式配色，正文不动' }),
            h(Btn, { icon: ICONS.layers, label: '模块', onClick: () => setDialog('sections'), disabled: noResume, tintBlue: true, title: '调整模块顺序 / 删除模块' }),
            h(Btn, { icon: ICONS.target, label: '体检', onClick: () => setDialog('checkup'), disabled: noResume, tintYellow: true, title: '本地体检 + JD 匹配' }),
            h(Btn, { icon: ICONS.upload, label: '导入', onClick: () => importInputRef.current?.click(), title: '导入 .md / .txt / .json 为新简历' }),
          ),
          h('div', { className: 'cvr-sep' }),
          h('div', { className: 'cvr-cluster' },
            h(Btn, { icon: ICONS.pdf, label: '导出 PDF', onClick: () => exportResume('pdf'), disabled: noResume, primary: true, title: '导出 A4 PDF（发 HR 用这个）' }),
            h(Btn, { icon: ICONS.download, label: 'PNG', onClick: () => exportResume('png'), disabled: noResume, title: '导出 A4 PNG 长图' }),
            h(Btn, { icon: ICONS.download, label: 'MD', onClick: () => exportResume('md'), disabled: noResume, title: '导出 Markdown 文件' }),
            h(Btn, { icon: ICONS.download, label: 'HTML', onClick: () => exportResume('html'), disabled: noResume, title: '导出 HTML 文件' }),
            h(Btn, { icon: ICONS.trash, label: '删除', onClick: removeResume, disabled: noResume, danger: true, title: '删除这份简历' }),
          ),
          h('input', {
            ref: fileInputRef, type: 'file', accept: 'image/png,image/jpeg,image/webp',
            style: { display: 'none' },
            onChange: (e) => { const f = e.target.files?.[0]; if (f) onAvatarFile(f); e.target.value = ''; },
          }),
          h('input', {
            ref: logoInputRef, type: 'file', accept: 'image/png,image/svg+xml,image/jpeg,image/webp',
            style: { display: 'none' },
            onChange: (e) => { const f = e.target.files?.[0]; if (f) onLogoFile(f); e.target.value = ''; },
          }),
          h('input', {
            ref: importInputRef, type: 'file', accept: '.md,.markdown,.txt,.json,text/plain,text/markdown,application/json',
            style: { display: 'none' },
            onChange: (e) => { const f = e.target.files?.[0]; if (f) onImportFile(f); e.target.value = ''; },
          }),
          h(StatusPill, { saving, dirty, extStale }),
        ),

        /* 新增弹窗：挂在工作台根节点下，互不干扰 */
        dialog === 'template' && !noResume && h(TemplateSwapDialog, {
          resumeId: activeId,
          onBeforeChange: ensureSaved,
          onClose: () => setDialog(null),
          onDone: () => { loadResume(activeId); flash('模板已切换', ICONS.swap); },
        }),
        dialog === 'sections' && !noResume && h(SectionOrderDialog, {
          resumeId: activeId,
          onBeforeChange: ensureSaved,
          onClose: () => setDialog(null),
          onChanged: () => { loadResume(activeId); flash('模块顺序已更新', ICONS.layers); },
        }),
        dialog === 'checkup' && !noResume && h(CheckupDialog, {
          resumeId: activeId,
          onClose: () => setDialog(null),
        }),

        extStale && dirty && h('div', { className: 'cvr-banner' },
          h('span', null, 'Agent 或其它入口更新了这份简历，你本地还有未保存修改。'),
          h('div', { className: 'cvr-banner-actions' },
            h(Btn, {
              label: '放弃我的修改并刷新',
              onClick: async () => { setExtStale(false); setDirty(false); await loadResume(activeIdRef.current); },
            }),
          ),
        ),

        /* 主体 */
        h('div', { className: 'cvr-body' },
          /* 左：编辑区 */
          h('div', { className: 'cvr-editor' },
            noResume
              ? h('div', { className: 'cvr-empty' },
                  h('div', { className: 'ring' }, h(Icon, { d: ICONS.resume, size: 30 })),
                  h('div', { className: 'title' }, '还没有简历'),
                  h('div', { className: 'desc' }, '点上方「＋新建」从模板创建一份，\n或直接在对话里让 Agent 帮你写一份。'),
                )
              : mode === 'md'
                ? h('textarea', {
                    className: 'cvr-md',
                    ref: textareaRef,
                    value: content,
                    placeholder: '用 Resume DSL 编写简历…',
                    onChange: (e) => onMdInput(e.target.value),
                    onKeyDown: (e) => {
                      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); doSave(); return; }
                      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') { e.preventDefault(); doUndo(); return; }
                      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); doRedo(); return; }
                    },
                    spellCheck: false,
                  })
                : h(React.Fragment, null,
                    /* 富文本浮动工具条（分组 + 语义图标 + 标签） */
                    h('div', { className: 'cvr-wysiwyg-toolbar' },
                      h('span', { className: 'cvr-wt-group-label' }, '文字'),
                      h('div', { className: 'cvr-wt-group' },
                        h(Btn, { icon: ICONS.bold, iconOnly: true, title: '加粗', onMouseDown: (e) => e.preventDefault(), onClick: () => execCmd('bold') }),
                        h(Btn, { icon: ICONS.italic, iconOnly: true, title: '斜体', onMouseDown: (e) => e.preventDefault(), onClick: () => execCmd('italic') }),
                        h(Btn, { icon: ICONS.underline, iconOnly: true, title: '下划线', onMouseDown: (e) => e.preventDefault(), onClick: () => execCmd('underline') }),
                        h(Btn, { icon: ICONS.strike, iconOnly: true, title: '删除线', onMouseDown: (e) => e.preventDefault(), onClick: () => execCmd('strikeThrough') }),
                      ),
                      h('span', { className: 'cvr-sep' }),
                      h('span', { className: 'cvr-wt-group-label' }, '段落'),
                      h('div', { className: 'cvr-wt-group' },
                        h(Btn, { icon: ICONS.listU, iconOnly: true, title: '无序列表', onMouseDown: (e) => e.preventDefault(), onClick: () => execCmd('insertUnorderedList') }),
                        h(Btn, { icon: ICONS.listO, iconOnly: true, title: '有序列表', onMouseDown: (e) => e.preventDefault(), onClick: () => execCmd('insertOrderedList') }),
                      ),
                      h('span', { className: 'cvr-sep' }),
                      h('span', { className: 'cvr-wt-group-label' }, '清除'),
                      h('div', { className: 'cvr-wt-group' },
                        h(Btn, { icon: ICONS.eraser, iconOnly: true, title: '清除格式', onMouseDown: (e) => e.preventDefault(), onClick: () => execCmd('removeFormat') }),
                      ),
                      h('span', { className: 'cvr-wysiwyg-hint' }, '模块结构（标题/多栏/图标）建议用 MD 模式或让 Agent 调整'),
                    ),
                    fragLoading && h('div', { className: 'cvr-wysiwyg-loading' },
                      h(Icon, { d: ICONS.refresh, size: 13, className: 'cvr-spin' }), '正在载入富文本…'),
                    h('div', {
                      className: 'cvr-wysiwyg',
                      ref: editableRef,
                      contentEditable: true,
                      suppressContentEditableWarning: true,
                      style: { display: fragLoading ? 'none' : undefined, '--cvr-acc': (meta && meta.style && meta.style.primaryBGColor) || '#10b981' },
                      onInput: onWysiwygInput,
                      onCompositionStart,
                      onCompositionEnd,
                      onKeyUp: saveSelection,
                      onMouseUp: saveSelection,
                      onKeyDown: handleEditorKeyDown,
                      onBlur: () => { if (dirtyRef.current && !composingRef.current) scheduleSync(); },
                    }),
                  ),
          ),
          /* 右：A4 预览 */
          h('div', { className: 'cvr-preview' },
            h('div', { className: 'cvr-preview-head' },
              h('span', { className: 'pvicon' }, h(Icon, { d: ICONS.doc, size: 12 })),
              h('span', null, 'A4 实时预览'),
              h('div', { className: 'cvr-zoom-cluster' },
                h(Btn, { icon: ICONS.zoomOut, iconOnly: true, onClick: () => setZoom((z) => Math.max(0.4, +(z - 0.1).toFixed(2))), title: '缩小' }),
                h('span', { className: 'cvr-zoom-label' }, Math.round(zoom * 100) + '%'),
                h(Btn, { icon: ICONS.zoomIn, iconOnly: true, onClick: () => setZoom((z) => Math.min(1.2, +(z + 0.1).toFixed(2))), title: '放大' }),
                h(Btn, { icon: ICONS.refresh, iconOnly: true, onClick: () => setPreviewKey((k) => k + 1), title: '刷新预览' }),
              ),
            ),
            h('div', { className: 'cvr-preview-scroll' },
              !noResume
                ? h('div', {
                    style: {
                      width: Math.round(794 * previewScale) + 2,
                      height: Math.round(1123 * previewScale) + 2,
                      margin: '0 auto',
                      overflow: 'hidden',
                      transition: 'width .15s, height .15s',
                    },
                  },
                    h('iframe', {
                      ref: previewFrameRef,
                      key: previewKey,
                      className: 'cvr-frame',
                      onLoad: () => { pushLivePreview(currentMd()); },
                      src: `${API}/preview/${activeId}?v=${previewKey}`,
                      title: '简历预览',
                      style: {
                        width: 794, height: 1123,
                        transform: `scale(${previewScale})`, transformOrigin: 'top left',
                      },
                    }),
                  )
                : h('div', { style: { padding: 24, opacity: .5, fontSize: 12, textAlign: 'center', lineHeight: 1.9 } }, '选择简历后显示 A4 实时预览'),
            ),
          ),
        ),

        toast && h('div', { className: 'cvr-toast' },
          h(Icon, { d: toast.icon, size: 13, className: 'tic' }),
          h('span', null, toast.msg),
        ),
      );
    }

    /* ------------------------------ panel row icon ----------------------------- */
    // 全局面板行（sidebar.panellist）：行点击由宿主承担（layout.selectPanel → main slot），
    // 本组件只画行内图形。不能渲染 null（label 来自注册 options）。

    function PanelRowIcon({ size, active }) {
      return h(Icon, { d: ICONS.resume, size: size || 16, className: 'cvr-panel-ic' + (active ? ' active' : '') });
    }

    /* ------------------------------ tool view card ----------------------------- */

    function readToolArgs(block) {
      const args = block?.args ?? block?.input ?? block?.arguments ?? block?.call?.argsRaw ?? block?.argsRaw;
      if (typeof args === 'string') { try { return JSON.parse(args); } catch { return {}; } }
      return args || {};
    }

    function readToolResult(block, props) {
      const raw = block?.result?.value
        ?? props?.result?.value
        ?? block?.value
        ?? block?.result?.content?.[0]?.text
        ?? block?.content?.[0]?.text;
      if (!raw) return null;
      if (typeof raw === 'string') { try { return JSON.parse(raw); } catch { return null; } }
      return typeof raw === 'object' ? raw : null;
    }

    function ResumeToolView(props) {
      const block = props?.block || {};
      const args = readToolArgs(block);
      const resObj = readToolResult(block, props);
      const settled = !props?.phase || props.phase === 'result';
      const id = (props.toolName === 'resume_duplicate' ? resObj?.id : undefined)
        || args?.id
        || args?.resumeId
        || resObj?.id
        || resObj?.item?.id;
      const badgeMap = {
        resume_new: '已创建',
        resume_import: '已导入',
        resume_duplicate: '已复制',
        resume_set_template: '模板已切换',
        resume_apply_edit: '模块已修改',
        resume_move_section: '模块已调序',
        resume_set_style: '样式已更新',
        resume_write: '已保存',
      };
      const badge = badgeMap[props.toolName] || '已更新';
      const title = block?.isError
        ? '操作失败'
        : (!settled
            ? '正在处理简历…'
            : (args?.name || resObj?.name || resObj?.item?.name || badge));
      const detailHint = resObj?.template
        ? `当前模板：${resObj.template}`
        : (resObj?.section ? `已更新模块：${resObj.section}` : 'A4 成稿微缩预览 · 点击缩略图或右侧按钮继续编辑');
      const openWorkbench = () => openWorkbenchVia(props?.ctx);
      const exportFile = (format) => {
        if (!id) return;
        downloadExport(id, format, (msg, icon) => {
          if (globalToastFn) flashGlobal(msg, icon);
          return () => {};
        }).catch((e) => {
          const msg = `导出 ${format.toUpperCase()} 失败：${e?.message || e}`;
          if (globalToastFn) flashGlobal(msg, ICONS.refresh);
          else window.alert(msg);
        });
      };
      const ver = encodeURIComponent(String(resObj?.updatedAt || resObj?.rev || ''));

      if (!settled || block?.isError || !id) {
        return h('div', { className: 'cvr-toolcard compact' },
          h(Icon, { d: settled ? ICONS.resume : ICONS.refresh, size: 14, className: settled ? undefined : 'cvr-spin' }),
          h('span', { style: { fontWeight: 600 } }, title),
          id && h('code', { className: 'cvr-toolcard-id' }, id),
        );
      }

      return h('div', { className: 'cvr-toolcard' },
        h('div', {
          className: 'cvr-toolcard-thumb',
          onClick: openWorkbench,
          title: '点击打开简历工作台',
        },
          h('iframe', {
            src: `${API}/preview/${id}?print=1&thumb=1${ver ? '&v=' + ver : ''}`,
            title: '简历缩略',
            scrolling: 'no',
            tabIndex: -1,
          }),
        ),
        h('div', { className: 'cvr-toolcard-info' },
          h('div', { className: 'cvr-toolcard-head' },
            h('div', { className: 'cvr-toolcard-title-row' },
              h(Icon, { d: ICONS.resume, size: 15 }),
              h('span', { className: 'cvr-toolcard-title', title }, title),
              h('span', { className: 'cvr-toolcard-badge' }, badge),
            ),
            h('div', { className: 'cvr-toolcard-meta' },
              h('code', { className: 'cvr-toolcard-id' }, id),
              h('span', null, detailHint),
            ),
          ),
          h('div', { className: 'cvr-toolcard-actions' },
            h(Btn, { icon: ICONS.open, label: '打开工作台', softaccent: true, onClick: openWorkbench }),
            h(Btn, { icon: ICONS.pdf, label: '导出 PDF', onClick: () => exportFile('pdf') }),
            h(Btn, { icon: ICONS.download, label: '下载 MD', onClick: () => exportFile('md') }),
          ),
        ),
      );
    }

    /* ------------------------------ open workbench ----------------------------- */

    /** 打开工作台：优先全局面板（中栏整页），退回右侧栏 tab。 */
    function openWorkbenchVia(ctx) {
      try {
        const layout = ctx && typeof ctx.get === 'function' ? ctx.get('layout') : null;
        if (layout && typeof layout.selectPanel === 'function') {
          const active = layout.panelInfo && typeof layout.panelInfo.getSnapshot === 'function'
            ? layout.panelInfo.getSnapshot()?.activePanelId
            : undefined;
          layout.selectPanel(active === PANEL_ID ? null : PANEL_ID);
          return;
        }
      } catch { /* 继续尝试右侧栏 */ }
      try {
        const sr = ctx && typeof ctx.get === 'function' ? ctx.get('sidebarRight') : null;
        if (sr?.openTab) { sr.openTab(TAB_ID); return; }
      } catch { /* 兜底 */ }
      window.alert('当前客户端不支持面板能力（layout/sidebarRight 服务缺失）。');
    }

    /* --------------------------------- MainPage -------------------------------- */

    /** 中栏整页：编辑工作台 | 模板中心 双 tab */
    function MainPage(props) {
      const [tab, setTab] = useState('workbench');
      const [toast, setToast] = useState(null);
      useEffect(() => {
        globalToastFn = (msg, icon) => {
          setToast({ msg, icon: icon || ICONS.check });
          setTimeout(() => setToast(null), 2200);
        };
        return () => { globalToastFn = null; };
      }, []);
      return h('div', { className: 'cvr-root' },
        /* 薄荷渐变顶栏：品牌 + 双 tab + 状态语（三合一） */
        h('div', { className: 'cvr-page-tabs' },
          h('div', { className: 'cvr-brand' },
            h('span', { className: 'logo', 'aria-hidden': true }, h(Icon, { d: ICONS.resume, size: 18 })),
            h('span', { className: 'name' }, '简历工作台'),
          ),
          h('button', {
            className: 'cvr-navtab' + (tab === 'workbench' ? ' active' : ''),
            onClick: () => setTab('workbench'),
          }, h(Icon, { d: ICONS.pen, size: 14 }), '编辑工作台'),
          h('button', {
            className: 'cvr-navtab' + (tab === 'center' ? ' active' : ''),
            onClick: () => setTab('center'),
          }, h(Icon, { d: ICONS.doc, size: 14 }), '模板中心'),
          h('span', { className: 'cvr-tabs-right' }, '本地工作区 · Agent 实时协作 · 自动保存'),
        ),
        tab === 'workbench'
          ? h(Workbench, props)
          : h(TemplateCenter, { onUse: () => setTab('workbench') }),
        toast && h('div', { className: 'cvr-toast' },
          h(Icon, { d: toast.icon, size: 13, className: 'tic' }),
          h('span', null, toast.msg),
        ),
      );
    }

    /* --------------------------------- plugin --------------------------------- */

    return {
      inject: ['slots'],
      apply(ctx) {
        injectStyles();

        /* 宿主主题同步：对齐 DSH（body[data-ds-dark-theme]、ctx.theme、colorScheme）与通用暗色标记 */
        let themeObserver = null;
        let mql = null;
        let onMqlChange = null;
        let disposeThemeListener = null;
        try {
          const resolveHostTheme = () => {
            try {
              const themeSvc = ctx && typeof ctx.get === 'function' ? ctx.get('theme') : null;
              const scheme = themeSvc && typeof themeSvc.getTheme === 'function'
                ? themeSvc.getTheme()?.active?.colorScheme
                : null;
              if (scheme === 'dark' || scheme === 'light') return scheme;
            } catch { /* ignore */ }
            const html = document.documentElement;
            const body = document.body;
            if (body && (body.hasAttribute('data-ds-dark-theme') || body.classList.contains('dark'))) return 'dark';
            if (html.classList.contains('dark')
              || html.getAttribute('data-theme') === 'dark'
              || html.getAttribute('data-mode') === 'dark'
              || html.style?.colorScheme === 'dark') return 'dark';
            const dsSource = html.dataset ? html.dataset.dsThemeSource : html.getAttribute('data-ds-theme-source');
            if (dsSource === 'dark') return 'dark';
            if (dsSource === 'light') return 'light';
            if (dsSource === 'system') {
              return (body && body.hasAttribute('data-ds-dark-theme')) ? 'dark' : 'light';
            }
            if (html.style?.colorScheme === 'light'
              || html.getAttribute('data-theme') === 'light'
              || html.getAttribute('data-mode') === 'light'
              || html.classList.contains('light')) return 'light';
            return null;
          };
          const syncCvrTheme = () => {
            const html = document.documentElement;
            const resolved = resolveHostTheme();
            if (resolved === 'dark' || resolved === 'light') {
              html.dataset.cvrTheme = resolved;
            } else {
              delete html.dataset.cvrTheme;
            }
          };
          syncCvrTheme();
          themeObserver = new MutationObserver(syncCvrTheme);
          themeObserver.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['class', 'data-theme', 'data-mode', 'data-ds-theme-source', 'style'],
          });
          if (document.body) {
            themeObserver.observe(document.body, {
              attributes: true,
              attributeFilter: ['class', 'data-ds-dark-theme'],
            });
          }
          if (typeof window.matchMedia === 'function') {
            mql = window.matchMedia('(prefers-color-scheme: dark)');
            onMqlChange = () => syncCvrTheme();
            if (typeof mql.addEventListener === 'function') mql.addEventListener('change', onMqlChange);
            else if (typeof mql.addListener === 'function') mql.addListener(onMqlChange);
          }
          if (ctx && typeof ctx.on === 'function') {
            disposeThemeListener = ctx.on('theme/change', syncCvrTheme);
          }
        } catch { /* 主题检测失败不阻塞插件 */ }

        /* 1. 中栏整页（main slot，key = PANEL_ID）：双 tab 页面（工作台/模板中心） */
        ctx.slots.inject('main', () => ctx.slots.register(
          { name: 'main', key: PANEL_ID, label: '简历工作台', inject: () => ({ ctx }) },
          MainPage,
        ));

        /* 2. 左上角全局面板行（sidebar.panellist，「插件」旁）：点击由宿主承担 */
        try {
          ctx.slots.inject('sidebar.panellist', () => ctx.slots.register(
            { name: 'sidebar.panellist', id: PANEL_ID, order: 20, label: '简历工作台' },
            PanelRowIcon,
          ));
        } catch (error) {
          console.warn('[dsh-resume] panellist 注册失败:', error);
        }

        /* 3. 右侧栏工作台 tab（page 型，无 patterns，按 kind 打开） */
        const tabs = ctx.get('sidebarRightTabs');
        let disposeTab = () => {};
        if (tabs) {
          try {
            const d1 = tabs.register({
              id: TAB_ID,
              kind: TAB_ID,
              title: () => '简历工作台',
              keepMounted: true,
            });
            const d2 = ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register(
              { name: 'sidebar.right.pane.tab', key: TAB_ID, inject: () => ({ ctx }) },
              Workbench,
            ));
            disposeTab = () => { try { d1(); } catch {} try { d2(); } catch {} };
          } catch (error) {
            console.warn('[dsh-resume] tab 注册失败:', error);
          }
        } else {
          console.warn('[dsh-resume] 当前客户端没有 sidebarRightTabs 服务，右侧栏 tab 不可用（全局面板仍可用）');
        }

        /* 4. 聊天内嵌工具卡片 */
        ctx.slots.inject('tool.call.toolview', function* () {
          for (const key of [
            'resume_write', 'resume_new', 'resume_set_style', 'resume_duplicate',
            'resume_apply_edit', 'resume_set_template', 'resume_move_section', 'resume_import',
          ]) {
            yield ctx.slots.register(
              { name: 'tool.call.toolview', key, inject: (sessionId) => ({ sessionId, ctx }) },
              ResumeToolView,
            );
          }
        });

        return () => {
          try { themeObserver && themeObserver.disconnect(); } catch { /* 忽略 */ }
          try {
            if (mql && onMqlChange) {
              if (typeof mql.removeEventListener === 'function') mql.removeEventListener('change', onMqlChange);
              else if (typeof mql.removeListener === 'function') mql.removeListener(onMqlChange);
            }
          } catch { /* 忽略 */ }
          try { typeof disposeThemeListener === 'function' && disposeThemeListener(); } catch { /* 忽略 */ }
          disposeTab();
        };
      },
    };
  },
});
