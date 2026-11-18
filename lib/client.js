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
      close: 'M4 4l8 8M12 4l-8 8',
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
   dsh-resume · Scriptorium & Looseleaf 设计系统 (Phase 2)
   修道院手稿 / 古籍双线装帧 / 矿物颜料 / 做旧黄铜 / 火漆印章 / 纸纤维肌理
   ================================================================ */
.cvr-root,
.cvr-workbench,
.cvr-toolcard,
.cvr-modal-mask,
.cvr-lightbox-mask {
  --rs-font-sans: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", system-ui, -apple-system, sans-serif;
  --rs-font-title: "Noto Serif SC", "Source Han Serif SC", "Songti SC", "STSong", "SimSun", Georgia, serif;
  --rs-font-hand: "LXGW WenKai", "STKaiti", "Kaiti SC", "FangSong", "PingFang SC", sans-serif;
  --rs-font-serif: "Noto Serif SC", "Songti SC", Georgia, "Palatino Linotype", serif;
  --rs-font-mono: "JetBrains Mono", "IBM Plex Mono", "Cascadia Mono", ui-monospace, Consolas, monospace;

  /* 物理纸纹（启动预烘焙静态 128×128 颗粒图，零实时 SVG 滤镜重算） */
  --rs-noise-svg: var(--cvr-baked-noise, none);

  /* 浅色模式：Scriptorium Daylight Parchment */
  --rs-desk: #C9C0AE;
  --rs-desk-grid: rgba(38, 33, 28, .055);
  --rs-paper: #F6F1E5;
  --rs-card: #FAF5E8;
  --rs-card-2: #EFE7D6;
  --rs-slip: #F8F3E8;
  --rs-kraft: #DFD2B8;
  --rs-kraft-soft: rgba(207, 196, 176, .42);
  --rs-sticky-yellow: #F3DF98;
  --rs-sticky-mint: #D4E1C0;

  /* 铁胆墨水与古籍线框 */
  --rs-ink: #26211C;
  --rs-ink-soft: #544B40;
  --rs-text: #26211C;
  --rs-muted: rgba(38, 33, 28, .58);
  --rs-pencil: #7A7062;
  --rs-ink-line: rgba(38, 33, 28, .28);
  --rs-ink-shadow: rgba(38, 33, 28, .22);
  --rs-border: #CFC4B0;
  --rs-border-2: #B4A68E;
  --rs-inner-rule: rgba(38, 33, 28, .12);

  /* 双核心视觉锚点色（哑光纯色，无渐变无霓虹） */
  --rs-accent: #A63A2E;
  --rs-accent-btn: #A63A2E;
  --rs-accent-deep: #6E231B;
  --rs-accent-hover: #B84437;
  --rs-accent-soft: rgba(166, 58, 46, .11);
  --rs-accent-soft-2: rgba(166, 58, 46, .18);

  --rs-brass: #9E7C3E;
  --rs-brass-deep: #6E5426;
  --rs-brass-soft: rgba(158, 124, 62, .16);

  /* 语义校对辅助色（收敛于校对与文本） */
  --rs-blue: #34527A;
  --rs-blue-soft: rgba(52, 82, 122, .10);
  --rs-green: #3E6B48;
  --rs-green-soft: rgba(62, 107, 72, .14);
  --rs-warn: #9E621C;
  --rs-warn-soft: rgba(243, 223, 152, .65);
  --rs-danger: #A63A2E;
  --rs-danger-soft: rgba(166, 58, 46, .12);
  --rs-hi: rgba(179, 146, 86, .22);
  --rs-hi-soft: rgba(179, 146, 86, .11);
  --rs-seg-hover: rgba(255, 252, 244, .55);

  /* 信纸线与亚麻胶带 */
  --rs-rule-blue: rgba(118, 145, 176, .26);
  --rs-rule-red: rgba(166, 58, 46, .42);
  --rs-tape: rgba(226, 205, 162, .76);
  --rs-tape-edge: rgba(140, 118, 82, .48);
  --rs-mat-bg: #EAE0CA;
  --rs-mount-bg: #2B241D;
  --rs-mask: rgba(23, 21, 19, .62);
  --rs-thumb-tint: rgba(214, 184, 128, .12);
  --rs-thumb-dim: transparent;

  /* 硬偏移实体投影（无荧光模糊） */
  --rs-shadow: 2px 3px 0 rgba(38, 33, 28, .16), 0 6px 14px rgba(38, 33, 28, .10);
  --rs-shadow-md: 3px 4px 0 rgba(38, 33, 28, .18), 0 10px 24px rgba(38, 33, 28, .14);
  --rs-shadow-lg: 4px 5px 0 rgba(26, 22, 18, .22), 0 16px 36px rgba(26, 22, 18, .24);
  --rs-shadow-stack:
    4px 4px 0 #F4EEE0, 5px 5px 0 rgba(38, 33, 28, .32),
    8px 8px 0 #E7DEC9, 9px 9px 0 rgba(38, 33, 28, .28),
    12px 12px 0 #D8CEB6, 13px 13px 0 rgba(38, 33, 28, .22),
    0 16px 28px rgba(26, 22, 18, .26);
  --rs-radius: 8px;
  font-family: var(--rs-font-sans);
  color-scheme: light dark;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-cvr-theme="light"]) .cvr-root,
  :root:not([data-cvr-theme="light"]) .cvr-workbench,
  :root:not([data-cvr-theme="light"]) .cvr-toolcard,
  :root:not([data-cvr-theme="light"]) .cvr-modal-mask,
  :root:not([data-cvr-theme="light"]) .cvr-lightbox-mask {
    --rs-desk: #100E0C;
    --rs-desk-grid: rgba(230, 222, 200, .062);
    --rs-paper: #1B1815;
    --rs-card: #211D18;
    --rs-card-2: #2A251F;
    --rs-slip: #24201A;
    --rs-kraft: #332C23;
    --rs-kraft-soft: rgba(68, 60, 49, .58);
    --rs-sticky-yellow: #3B321C;
    --rs-sticky-mint: #223125;

    --rs-ink: #EAE2CE;
    --rs-ink-soft: #C7BEA6;
    --rs-text: #EAE2CE;
    --rs-muted: rgba(234, 226, 206, .62);
    --rs-pencil: #988E7B;
    --rs-ink-line: rgba(234, 226, 206, .26);
    --rs-ink-shadow: #0A0908;
    --rs-border: #443D33;
    --rs-border-2: #595043;
    --rs-inner-rule: rgba(194, 158, 95, .24);

    --rs-accent: #CC5243;
    --rs-accent-btn: #A63A2E;
    --rs-accent-deep: #5E1D16;
    --rs-accent-hover: #B84437;
    --rs-accent-soft: rgba(166, 58, 46, .22);
    --rs-accent-soft-2: rgba(166, 58, 46, .30);

    --rs-brass: #C29E5F;
    --rs-brass-deep: #7C6235;
    --rs-brass-soft: rgba(194, 158, 95, .18);

    --rs-blue: #7FA0C9;
    --rs-blue-soft: rgba(127, 160, 201, .14);
    --rs-green: #6FB07C;
    --rs-green-soft: rgba(111, 176, 124, .16);
    --rs-warn: #D9AC5B;
    --rs-warn-soft: rgba(59, 50, 28, .85);
    --rs-danger: #D45D4E;
    --rs-danger-soft: rgba(166, 58, 46, .22);
    --rs-hi: rgba(179, 146, 86, .22);
    --rs-hi-soft: rgba(179, 146, 86, .10);
    --rs-seg-hover: rgba(230, 222, 200, .07);

    --rs-rule-blue: rgba(143, 166, 192, .11);
    --rs-rule-red: rgba(166, 58, 46, .42);
    --rs-tape: rgba(226, 205, 162, .48);
    --rs-tape-edge: rgba(244, 232, 204, .42);
    --rs-mat-bg: #171411;
    --rs-mount-bg: #14110E;
    --rs-mask: rgba(10, 9, 8, .80);
    --rs-thumb-tint: rgba(186, 152, 92, .16);
    --rs-thumb-dim: rgba(18, 15, 11, .08);

    --rs-shadow: 0 6px 18px rgba(0, 0, 0, .48), 2px 3px 0 #0A0908;
    --rs-shadow-md: 0 8px 24px rgba(0, 0, 0, .55), 3px 4px 0 #0A0908;
    --rs-shadow-lg: 0 18px 42px rgba(0, 0, 0, .68), 4px 5px 0 #0A0908;
    --rs-shadow-stack:
      4px 4px 0 #EFE9DA, 5px 5px 0 #0A0908,
      8px 8px 0 #D8CFBC, 9px 9px 0 #0A0908,
      12px 12px 0 #BEB49E, 13px 13px 0 #0A0908,
      0 18px 34px rgba(0, 0, 0, .64);
  }
}

:root[data-cvr-theme="dark"] .cvr-root,
:root[data-cvr-theme="dark"] .cvr-workbench,
:root[data-cvr-theme="dark"] .cvr-toolcard,
:root[data-cvr-theme="dark"] .cvr-modal-mask,
:root[data-cvr-theme="dark"] .cvr-lightbox-mask,
body[data-ds-dark-theme] .cvr-root,
body[data-ds-dark-theme] .cvr-workbench,
body[data-ds-dark-theme] .cvr-toolcard,
body[data-ds-dark-theme] .cvr-modal-mask,
body[data-ds-dark-theme] .cvr-lightbox-mask {
  --rs-desk: #100E0C;
  --rs-desk-grid: rgba(230, 222, 200, .062);
  --rs-paper: #1B1815;
  --rs-card: #211D18;
  --rs-card-2: #2A251F;
  --rs-slip: #24201A;
  --rs-kraft: #332C23;
  --rs-kraft-soft: rgba(68, 60, 49, .58);
  --rs-sticky-yellow: #3B321C;
  --rs-sticky-mint: #223125;

  --rs-ink: #EAE2CE;
  --rs-ink-soft: #C7BEA6;
  --rs-text: #EAE2CE;
  --rs-muted: rgba(234, 226, 206, .62);
  --rs-pencil: #988E7B;
  --rs-ink-line: rgba(234, 226, 206, .26);
  --rs-ink-shadow: #0A0908;
  --rs-border: #443D33;
  --rs-border-2: #595043;
  --rs-inner-rule: rgba(194, 158, 95, .24);

  --rs-accent: #CC5243;
  --rs-accent-btn: #A63A2E;
  --rs-accent-deep: #5E1D16;
  --rs-accent-hover: #B84437;
  --rs-accent-soft: rgba(166, 58, 46, .22);
  --rs-accent-soft-2: rgba(166, 58, 46, .30);

  --rs-brass: #C29E5F;
  --rs-brass-deep: #7C6235;
  --rs-brass-soft: rgba(194, 158, 95, .18);

  --rs-blue: #7FA0C9;
  --rs-blue-soft: rgba(127, 160, 201, .14);
  --rs-green: #6FB07C;
  --rs-green-soft: rgba(111, 176, 124, .16);
  --rs-warn: #D9AC5B;
  --rs-warn-soft: rgba(59, 50, 28, .85);
  --rs-danger: #D45D4E;
  --rs-danger-soft: rgba(166, 58, 46, .22);
  --rs-hi: rgba(179, 146, 86, .22);
  --rs-hi-soft: rgba(179, 146, 86, .10);
  --rs-seg-hover: rgba(230, 222, 200, .07);

  --rs-rule-blue: rgba(143, 166, 192, .11);
  --rs-rule-red: rgba(166, 58, 46, .42);
  --rs-tape: rgba(226, 205, 162, .48);
  --rs-tape-edge: rgba(244, 232, 204, .42);
  --rs-mat-bg: #171411;
  --rs-mount-bg: #14110E;
  --rs-mask: rgba(10, 9, 8, .80);
  --rs-thumb-tint: rgba(186, 152, 92, .16);
  --rs-thumb-dim: rgba(18, 15, 11, .08);

  --rs-shadow: 0 6px 18px rgba(0, 0, 0, .48), 2px 3px 0 #0A0908;
  --rs-shadow-md: 0 8px 24px rgba(0, 0, 0, .55), 3px 4px 0 #0A0908;
  --rs-shadow-lg: 0 18px 42px rgba(0, 0, 0, .68), 4px 5px 0 #0A0908;
  --rs-shadow-stack:
    4px 4px 0 #EFE9DA, 5px 5px 0 #0A0908,
    8px 8px 0 #D8CFBC, 9px 9px 0 #0A0908,
    12px 12px 0 #BEB49E, 13px 13px 0 #0A0908,
    0 18px 34px rgba(0, 0, 0, .64);
}

/* ============ 物理纸纹覆盖层（fractalNoise）与古籍装帧构件 ============ */
.cvr-root::before,
.cvr-workbench::before,
.cvr-sheet-stage::before,
.cvr-toolcard::before,
.cvr-tpl-card::before,
.cvr-modal::before {
  content: '';
  position: absolute; inset: 0; border-radius: inherit;
  pointer-events: none; z-index: 0;
  opacity: 0.062;
  background-image: var(--rs-noise-svg);
  background-repeat: repeat;
}
.cvr-codex-inner {
  position: absolute; inset: 4px; border-radius: inherit;
  border: 1px solid var(--rs-inner-rule);
  pointer-events: none; z-index: 1;
}
.cvr-corners {
  position: absolute; inset: 0; pointer-events: none; z-index: 4;
}
.cvr-corner {
  position: absolute; width: 12px; height: 12px;
  border-color: var(--rs-brass); border-style: solid; border-width: 0;
  opacity: .65;
  transition: transform 220ms cubic-bezier(0.22, 1, 0.36, 1), opacity 220ms cubic-bezier(0.22, 1, 0.36, 1);
}
.cvr-corner.tl { top: 5px; left: 5px; border-top-width: 1.75px; border-left-width: 1.75px; }
.cvr-corner.tr { top: 5px; right: 5px; border-top-width: 1.75px; border-right-width: 1.75px; }
.cvr-corner.bl { bottom: 5px; left: 5px; border-bottom-width: 1.75px; border-left-width: 1.75px; }
.cvr-corner.br { bottom: 5px; right: 5px; border-bottom-width: 1.75px; border-right-width: 1.75px; }
.cvr-toolcard:hover .cvr-corner.tl,
.cvr-tpl-card:hover .cvr-corner.tl,
.cvr-sheet-stage:hover .cvr-corner.tl,
.cvr-modal:hover .cvr-corner.tl { transform: translate(-2px, -2px); opacity: 1; }
.cvr-toolcard:hover .cvr-corner.tr,
.cvr-tpl-card:hover .cvr-corner.tr,
.cvr-sheet-stage:hover .cvr-corner.tr,
.cvr-modal:hover .cvr-corner.tr { transform: translate(2px, -2px); opacity: 1; }
.cvr-toolcard:hover .cvr-corner.bl,
.cvr-tpl-card:hover .cvr-corner.bl,
.cvr-sheet-stage:hover .cvr-corner.bl,
.cvr-modal:hover .cvr-corner.bl { transform: translate(-2px, 2px); opacity: 1; }
.cvr-toolcard:hover .cvr-corner.br,
.cvr-tpl-card:hover .cvr-corner.br,
.cvr-sheet-stage:hover .cvr-corner.br,
.cvr-modal:hover .cvr-corner.br { transform: translate(2px, 2px); opacity: 1; }

/* 钢笔划墨底线（hover / active 自左向右绘制） */
.cvr-pen-underline {
  position: absolute; left: 10px; right: 10px; bottom: 2px; height: 5px;
  width: calc(100% - 20px); pointer-events: none; overflow: visible;
}
.cvr-pen-underline path {
  fill: none; stroke: var(--rs-brass); stroke-width: 1.85; stroke-linecap: round;
  stroke-dasharray: 140; stroke-dashoffset: 140;
  transition: stroke-dashoffset 260ms cubic-bezier(0.22, 1, 0.36, 1), stroke 180ms ease;
}
.cvr-navtab:hover .cvr-pen-underline path,
.cvr-navtab.active .cvr-pen-underline path { stroke-dashoffset: 0; }
.cvr-navtab.active .cvr-pen-underline path { stroke: var(--rs-brass); }

.cvr-ink-layer { position: absolute; inset: 0; pointer-events: none; z-index: 2; overflow: visible; }
.cvr-ink-svg { display: block; width: 100%; height: 100%; overflow: visible; }
.cvr-ink-stroke { fill: none; stroke: var(--rs-ink-line); stroke-linecap: round; stroke-linejoin: round; transition: stroke .16s ease, opacity .16s ease; }
.cvr-ink-ghost { fill: none; stroke: var(--rs-pencil); stroke-linecap: round; stroke-linejoin: round; opacity: .24; }
.cvr-ink-rule { display: block; width: 100%; height: 6px; pointer-events: none; flex: none; }
.cvr-tape { display: block; pointer-events: none; flex: none; }

/* ============ 页面外壳（深胡桃桌垫 + 档案卷宗） ============ */
.cvr-root {
  position: relative;
  display: flex; flex-direction: column; height: 100%; min-height: 0;
  font-size: 13px; color: var(--rs-text); overflow: hidden;
  padding: 10px 12px 12px; gap: 0;
  background-color: var(--rs-desk);
  background-image:
    radial-gradient(ellipse 78% 74% at 50% 45%, rgba(255, 240, 210, .028) 0%, transparent 48%, rgba(0, 0, 0, .60) 100%),
    linear-gradient(var(--rs-desk-grid) 1px, transparent 1px),
    linear-gradient(90deg, var(--rs-desk-grid) 1px, transparent 1px);
  background-size: 100% 100%, 24px 24px, 24px 24px;
  border-radius: 10px;
}
.cvr-sheet-stage {
  position: relative; flex: 1; min-height: 0;
  display: flex; flex-direction: column; overflow: hidden;
  padding: 12px;
  border-radius: 2px 10px 10px 10px;
  background-color: var(--rs-paper);
  border: 1px solid var(--rs-border-2);
  box-shadow: var(--rs-shadow-md);
}
.cvr-folio-panel {
  position: relative; z-index: 1;
  display: flex; flex-direction: column; flex: 1; min-height: 0;
  animation: cvr-folio-unfold 280ms cubic-bezier(0.22, 1, 0.36, 1);
}
@keyframes cvr-folio-unfold {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}
.cvr-workbench {
  display: flex; flex-direction: column; flex: 1; height: 100%; min-height: 0; gap: 10px;
  position: relative; padding: 10px;
  background-color: var(--rs-paper);
  color: var(--rs-text); border-radius: 10px;
}
.cvr-root .cvr-sheet-stage .cvr-workbench {
  padding: 0; background: transparent; border-radius: 0;
}
.cvr-root .cvr-sheet-stage .cvr-workbench::before { display: none; }

/* ============ 档案卷宗索引页签（Ledger Tabs） ============ */
.cvr-page-tabs {
  position: relative; z-index: 4;
  display: flex; align-items: flex-end; gap: 6px;
  padding: 2px 10px 0 2px;
  flex-wrap: wrap;
}
.cvr-brand {
  display: inline-flex; flex-direction: row; align-items: center; gap: 9px;
  margin-right: 12px; padding: 0 4px 8px 2px; flex: none; white-space: nowrap;
}
.cvr-brand .logo {
  display: inline-flex; align-items: center; justify-content: center;
  width: 30px; height: 30px; border-radius: 6px;
  background: var(--rs-card);
  border: 1px solid var(--rs-brass);
  outline: 1px solid var(--rs-inner-rule); outline-offset: -3px;
  color: var(--rs-accent);
  box-shadow: 2px 2px 0 rgba(0, 0, 0, .28);
}
.cvr-brand .name {
  white-space: nowrap; font-size: 17.5px; font-weight: 800;
  font-family: var(--rs-font-title);
  color: var(--rs-ink); letter-spacing: 1px;
}
.cvr-navtab {
  position: relative;
  display: inline-flex; align-items: center; gap: 7px;
  padding: 7px 17px 9px;
  border-radius: 7px 7px 0 0;
  font-size: 13.5px; font-weight: 700; font-family: var(--rs-font-title); letter-spacing: .5px;
  color: var(--rs-ink-soft);
  background: var(--rs-kraft);
  border: 1px solid var(--rs-border);
  border-bottom: none;
  margin-bottom: -1px;
  cursor: pointer;
  transition: background 180ms cubic-bezier(0.22, 1, 0.36, 1), color 180ms ease, transform 180ms cubic-bezier(0.22, 1, 0.36, 1);
}
.cvr-navtab .folio-tag {
  font-family: var(--rs-font-serif); font-size: 9.5px; letter-spacing: .8px;
  color: var(--rs-pencil); text-transform: uppercase;
}
.cvr-navtab:hover {
  color: var(--rs-ink);
  background: var(--rs-card-2);
  transform: translateY(-1px);
}
.cvr-navtab.active {
  z-index: 5;
  color: var(--rs-ink);
  background: var(--rs-paper);
  border-color: var(--rs-border-2);
  border-top: 2px solid var(--rs-brass);
  font-weight: 800;
  padding-bottom: 10px;
  transform: none;
}
.cvr-navtab.active .folio-tag { color: var(--rs-brass); }
.cvr-tabs-right {
  margin-left: auto; padding-bottom: 8px;
  font-size: 11px; font-weight: 500;
  color: var(--rs-pencil);
  letter-spacing: .3px;
}

/* ============ 工具栏与活字星标分隔符 ============ */
.cvr-toolbar {
  position: relative; z-index: 3;
  display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
  padding: 8px 12px; border-radius: 8px;
  background-color: var(--rs-slip);
  border: 1px solid var(--rs-border-2);
  box-shadow: var(--rs-shadow);
}
.cvr-cluster { display: flex; align-items: center; gap: 5px; }
.cvr-sep {
  display: inline-flex; align-items: center; justify-content: center;
  width: 12px; height: 18px; margin: 0 1px; background: transparent;
  color: var(--rs-pencil); opacity: .55; font-size: 9px; line-height: 1; user-select: none;
}
.cvr-sep::before { content: '✦'; }

/* ============ 按钮（铁胆墨水线框 + 朱砂火漆机械按压 + 黄铜锚点） ============ */
.cvr-btn {
  display: inline-flex; align-items: center; gap: 5px; padding: 5.5px 11px;
  font-size: 12.5px; font-weight: 600; font-family: inherit;
  border-radius: 6px; border: 1px solid var(--rs-border-2);
  background: var(--rs-card); color: var(--rs-ink);
  cursor: pointer; white-space: nowrap;
  box-shadow: 0 1.5px 0 var(--rs-ink-shadow);
  transition: background 150ms cubic-bezier(0.22, 1, 0.36, 1),
              border-color 150ms cubic-bezier(0.22, 1, 0.36, 1),
              color 150ms ease,
              box-shadow 120ms cubic-bezier(0.22, 1, 0.36, 1),
              transform 120ms cubic-bezier(0.22, 1, 0.36, 1);
}
.cvr-btn:hover:not(:disabled) {
  background: var(--rs-card-2);
  border-color: var(--rs-brass);
  color: var(--rs-ink);
  transform: translateY(-1px);
  box-shadow: 0 2.5px 0 var(--rs-ink-shadow);
}
.cvr-btn:active:not(:disabled) {
  transform: translateY(1.5px);
  box-shadow: none;
  transition-duration: 80ms;
}
.cvr-btn:disabled { opacity: .36; cursor: default; box-shadow: none; }

/* 常规工具按钮收敛为统一做旧墨线（移除五颜六色边框） */
.cvr-btn.tint-blue,
.cvr-btn.tint-violet,
.cvr-btn.tint-yellow {
  background: var(--rs-card);
  border-color: var(--rs-border-2);
  color: var(--rs-ink);
}
.cvr-btn.tint-blue:hover:not(:disabled),
.cvr-btn.tint-violet:hover:not(:disabled),
.cvr-btn.tint-yellow:hover:not(:disabled) {
  background: var(--rs-card-2);
  border-color: var(--rs-brass);
  color: var(--rs-ink);
}

/* 锚点 2：做旧黄铜金（专用于智能一页） */
.cvr-btn.is-brass {
  border-color: var(--rs-brass);
  color: var(--rs-brass);
  background: var(--rs-card);
}
.cvr-btn.is-brass:hover:not(:disabled) {
  background: var(--rs-brass-soft);
  border-color: var(--rs-brass);
  color: var(--rs-ink);
}
.cvr-btn.is-brass.active {
  background: var(--rs-brass);
  border-color: var(--rs-brass-deep);
  color: #171513;
  font-weight: 800;
  box-shadow: 0 2px 0 var(--rs-brass-deep);
}

.cvr-btn.danger { color: var(--rs-ink-soft); border-color: var(--rs-border-2); }
.cvr-btn.danger:hover:not(:disabled) {
  background: var(--rs-danger-soft); border-color: var(--rs-accent); color: var(--rs-accent);
}

/* 锚点 1：朱砂火漆红铭牌（内嵌羊皮细框 + 物理唇边 + 机械按压） */
.cvr-btn.primary {
  background: var(--rs-accent-btn);
  border: 1px solid var(--rs-accent-deep);
  border-bottom: 2px solid var(--rs-accent-deep);
  color: #F7F1E3; font-weight: 700; letter-spacing: .3px;
  box-shadow: inset 0 0 0 1px rgba(242, 226, 196, .30), 0 3px 0 #3E120D, 0 5px 10px rgba(0, 0, 0, .38);
}
.cvr-btn.primary:hover:not(:disabled) {
  background: var(--rs-accent-hover); border-color: var(--rs-accent-deep); color: #FFFBF2;
  transform: translateY(-1px);
  box-shadow: inset 0 0 0 1px rgba(242, 226, 196, .42), 0 4px 0 #3E120D, 0 7px 14px rgba(0, 0, 0, .46);
}
.cvr-btn.primary:active:not(:disabled) {
  transform: translateY(2px);
  border-bottom-width: 1px;
  box-shadow: inset 0 0 0 1px rgba(242, 226, 196, .22), 0 1px 0 #3E120D;
  transition-duration: 80ms;
}

.cvr-btn.softaccent {
  background: var(--rs-brass-soft); border-color: var(--rs-brass);
  color: var(--rs-ink); font-weight: 700;
}
.cvr-btn.softaccent:hover:not(:disabled) { background: var(--rs-hi); border-color: var(--rs-brass); }
.cvr-btn.active {
  background: var(--rs-brass-soft); border-color: var(--rs-brass);
  color: var(--rs-ink); font-weight: 700;
}
.cvr-btn.icononly { padding: 5.5px; border-radius: 6px; }

.cvr-seg {
  display: inline-flex; gap: 2px; padding: 2px; border-radius: 7px;
  background: var(--rs-kraft-soft); border: 1px solid var(--rs-border-2);
}
.cvr-seg .cvr-btn {
  border: 1px solid transparent; border-radius: 5px; padding: 4.5px 11px;
  background: transparent; color: var(--rs-ink-soft); box-shadow: none;
}
.cvr-seg .cvr-btn:hover:not(:disabled) { background: var(--rs-seg-hover); color: var(--rs-ink); transform: none; box-shadow: none; }
.cvr-seg .cvr-btn.active {
  background: var(--rs-paper); color: var(--rs-ink); font-weight: 700;
  border-color: var(--rs-brass);
  box-shadow: 1px 1px 0 var(--rs-ink-shadow);
}

/* ============ 下拉目录卡 ============ */
.cvr-pop-menu {
  position: absolute; top: calc(100% + 6px); left: 0; z-index: 60;
  min-width: 274px; padding: 6px; border-radius: 8px;
  background: var(--rs-card); border: 1px solid var(--rs-border-2);
  outline: 1px solid var(--rs-inner-rule); outline-offset: -4px;
  box-shadow: var(--rs-shadow-lg);
  display: flex; flex-direction: column; gap: 2px;
  animation: cvr-pop 160ms cubic-bezier(0.22, 1, 0.36, 1);
}
.cvr-pop-item {
  padding: 8px 11px; border-radius: 6px; cursor: pointer; font-size: 12.5px;
  border: 1px solid transparent;
  transition: background 140ms ease, border-color 140ms ease, transform 140ms cubic-bezier(0.22, 1, 0.36, 1);
}
.cvr-pop-item:hover { background: var(--rs-card-2); border-color: var(--rs-brass); transform: translateX(2px); }
.cvr-pop-item-active { background: var(--rs-brass-soft); border-color: var(--rs-brass); }
.cvr-pop-item .row { display: flex; align-items: center; gap: 8px; }
.cvr-pop-item .sub { font-size: 11px; color: var(--rs-pencil); margin-top: 2px; }
.cvr-dot { width: 10px; height: 10px; border-radius: 2px; flex: none; border: 1px solid var(--rs-border-2); }

/* ============ 状态印章（含盖章落印动效） ============ */
.cvr-status {
  margin-left: auto; display: inline-flex; align-items: center; gap: 6px;
  font-size: 11.5px; font-weight: 700; white-space: nowrap;
  padding: 4px 10px; border-radius: 5px;
  border: 1px dashed var(--rs-border-2);
}
.cvr-status .led { width: 6.5px; height: 6.5px; border-radius: 50%; flex: none; }
.cvr-status.ok {
  background: var(--rs-sticky-mint); color: var(--rs-green); border-color: rgba(111, 176, 124, .48);
  animation: cvr-stamp-press 160ms cubic-bezier(0.22, 1, 0.36, 1);
}
.cvr-status.dirty { background: var(--rs-sticky-yellow); color: var(--rs-warn); border-color: rgba(217, 172, 91, .48); }
.cvr-status.saving { background: var(--rs-blue-soft); color: var(--rs-blue); border-color: rgba(127, 160, 201, .42); }
.cvr-status.stale { background: var(--rs-danger-soft); color: var(--rs-danger); border-color: rgba(166, 58, 46, .5); }
@keyframes cvr-stamp-press {
  from { transform: scale(1.12) rotate(-2deg); opacity: .7; }
  to { transform: scale(1) rotate(0deg); opacity: 1; }
}

/* ============ 编辑/预览分区 ============ */
.cvr-body { flex: 1; display: flex; min-height: 0; gap: 10px; }
.cvr-editor {
  position: relative; contain: layout style;
  flex: 1; min-width: 0; display: flex; flex-direction: column;
  border-radius: 8px;
  background-color: var(--rs-paper);
  background-image: linear-gradient(90deg, transparent 27px, var(--rs-rule-red) 27px, var(--rs-rule-red) 28.5px, transparent 28.5px);
  border: 1px solid var(--rs-border-2); box-shadow: var(--rs-shadow); overflow: hidden;
}
.cvr-wysiwyg-toolbar {
  position: relative; z-index: 2;
  display: flex; align-items: center; gap: 3px; padding: 7px 12px;
  border-bottom: 1px solid var(--rs-border-2);
  background: var(--rs-slip);
  flex-wrap: wrap;
}
.cvr-wysiwyg-toolbar .cvr-btn { background: var(--rs-card); border-color: var(--rs-border-2); }
.cvr-wt-group { display: flex; align-items: center; gap: 2px; }
.cvr-wt-group-label {
  font-size: 10.5px; font-weight: 700; letter-spacing: .5px;
  color: var(--rs-ink-soft); background: var(--rs-kraft-soft);
  border: 1px solid var(--rs-border);
  padding: 2px 8px; border-radius: 4px; margin: 0 3px;
}
.cvr-wysiwyg-hint { font-size: 11px; color: var(--rs-pencil); margin-left: auto; }
.cvr-md {
  flex: 1; resize: none; border: none; outline: none; background: transparent; color: var(--rs-ink);
  padding: 16px 20px 24px 38px; font-size: 13px; line-height: 24px; tab-size: 2;
  font-family: var(--rs-font-mono);
  background-image: repeating-linear-gradient(to bottom, transparent 0, transparent 23px, var(--rs-rule-blue) 23px, var(--rs-rule-blue) 24px);
  background-position: 0 16px;
  background-attachment: local;
}
.cvr-md::placeholder { color: var(--rs-pencil); opacity: .6; }
.cvr-wysiwyg {
  flex: 1; overflow: auto; outline: none;
  padding: 18px 22px 24px 38px; font-size: 13px; line-height: 1.75; color: var(--rs-ink);
}
.cvr-wysiwyg:focus { background: rgba(179, 146, 86, .04); }
.cvr-wysiwyg .cv-doctitle { font-size: 20px; font-weight: 700; margin-bottom: 8px; letter-spacing: .5px; }
.cvr-wysiwyg .cv-module { margin-top: 16px; }
.cvr-wysiwyg .cv-module-title { font-size: 15px; font-weight: 800; letter-spacing: 1px; padding-bottom: 5px; margin-bottom: 8px; border-bottom: 2px solid var(--cvr-acc, var(--rs-accent)); }
.cvr-wysiwyg .cv-p { margin: 6px 0; }
.cvr-wysiwyg .cv-row { display: flex; gap: 12px; align-items: baseline; margin: 8px 0 4px; }
.cvr-wysiwyg .cv-row .cv-cell { flex: 1 1 0; min-width: 0; }
.cvr-wysiwyg .cv-cell-line { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cvr-wysiwyg .cv-cell-h { font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cvr-wysiwyg .cv-cell-h-big { font-size: 16px; }
.cvr-wysiwyg .cv-chip { display: inline-block; font-size: 11px; line-height: 1; padding: 3px 8px; margin: 0 2px; background: var(--rs-accent-soft); color: var(--cvr-acc, var(--rs-accent)); border: 1px solid var(--rs-border-2); border-radius: 4px; font-family: inherit; font-style: normal; }
.cvr-wysiwyg .cv-icon { display: inline-block; width: 14px; height: 14px; vertical-align: -3px; margin-right: 4px; }
.cvr-wysiwyg .cv-icon i { display: block; width: 100%; height: 100%; background: var(--cvr-acc, var(--rs-accent)); border-radius: 50%; }
.cvr-wysiwyg .cv-list { margin: 6px 0 6px 1.4em; }
.cvr-wysiwyg .cv-list li { margin: 4px 0; list-style: disc; }
.cvr-wysiwyg ol.cv-list li { list-style: decimal; }
.cvr-wysiwyg .cv-list .cv-list { margin: 3px 0 3px 1.3em; }
.cvr-wysiwyg .cv-list .cv-list li { list-style: circle; }
.cvr-wysiwyg .cv-bg { padding: 2px 10px; display: inline-block; border-radius: 3px; }
.cvr-wysiwyg .cv-quote { border-left: 3px solid var(--cvr-acc, var(--rs-accent)); padding: 4px 10px; margin: 6px 0; background: var(--rs-kraft-soft); }
.cvr-wysiwyg .cv-pre { background: var(--rs-kraft-soft); padding: 8px 10px; border-radius: 4px; font-family: var(--rs-font-mono); font-size: 11.5px; }
.cvr-wysiwyg .cv-hr { border: none; border-top: 1px dashed var(--rs-border-2); margin: 12px 0; }
.cvr-wysiwyg .cv-table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 12px; }
.cvr-wysiwyg .cv-table th, .cvr-wysiwyg .cv-table td { border: 1px solid var(--rs-border-2); padding: 4px 8px; }
.cvr-wysiwyg .cv-table th { font-weight: 700; background: var(--rs-kraft-soft); }
.cvr-wysiwyg .cv-subtitle { font-size: 14px; font-weight: 700; margin: 10px 0 4px; }
.cvr-wysiwyg .cv-title { font-size: 17px; font-weight: 700; margin-bottom: 6px; }
.cvr-wysiwyg a { color: var(--cvr-acc, var(--rs-blue)); text-decoration: underline; text-decoration-style: dotted; }
.cvr-wysiwyg-loading { flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 12px; color: var(--rs-pencil); }

/* ============ 右侧桌面：双层纸叠 A4 预览 + 相册角贴 + 黄铜纸夹 ============ */
.cvr-preview {
  width: 44%; min-width: 300px; display: flex; flex-direction: column; contain: layout style;
  border-radius: 8px; background: var(--rs-slip);
  border: 1px solid var(--rs-border-2); box-shadow: var(--rs-shadow); overflow: hidden;
}
.cvr-preview-head {
  display: flex; align-items: center; gap: 7px; padding: 7px 12px;
  border-bottom: 1px solid var(--rs-border-2); font-size: 12.5px; font-weight: 700;
  background: var(--rs-slip); color: var(--rs-ink);
}
.cvr-preview-head-title { font-family: var(--rs-font-title); letter-spacing: .5px; }
.cvr-preview-head .pvicon {
  width: 22px; height: 22px; border-radius: 5px; background: var(--rs-kraft);
  border: 1px solid var(--rs-border-2);
  display: flex; align-items: center; justify-content: center; color: var(--rs-brass);
}
.cvr-zoom-cluster {
  margin-left: auto; display: flex; align-items: center; gap: 2px;
  background: var(--rs-kraft-soft); border: 1px solid var(--rs-border);
  border-radius: 6px; padding: 2px;
}
.cvr-zoom-cluster .cvr-btn { border: none; box-shadow: none; background: transparent; padding: 4px; }
.cvr-zoom-cluster .cvr-btn:hover:not(:disabled) { background: var(--rs-card); transform: none; box-shadow: none; }
.cvr-zoom-label {
  font-size: 11px; padding: 0 6px; min-width: 38px; text-align: center;
  font-weight: 700; font-family: var(--rs-font-mono); font-variant-numeric: tabular-nums;
  color: var(--rs-ink);
}
.cvr-preview-scroll {
  flex: 1; overflow: auto; padding: 26px 18px 34px;
  background-color: var(--rs-desk);
  background-image:
    radial-gradient(ellipse 80% 76% at 50% 45%, rgba(255, 240, 210, .025) 0%, transparent 48%, rgba(0, 0, 0, .54) 100%),
    linear-gradient(var(--rs-desk-grid) 1px, transparent 1px),
    linear-gradient(90deg, var(--rs-desk-grid) 1px, transparent 1px);
  background-size: 100% 100%, 22px 22px, 22px 22px;
}
.cvr-a4-stage {
  position: relative; margin: 0 auto; background: #fff; border-radius: 2px;
  border: 1px solid rgba(38, 33, 28, .28);
  box-shadow: var(--rs-shadow-stack);
  transition: width 160ms ease, height 160ms ease;
}
.cvr-a4-clip-box {
  position: relative; width: 100%; height: 100%; overflow: hidden; border-radius: 2px;
}
.cvr-a4-mount {
  position: absolute; width: 24px; height: 24px; pointer-events: none; z-index: 4;
  background: var(--rs-mount-bg, #14110E);
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, .45));
}
.cvr-a4-mount::after {
  content: ''; position: absolute; inset: 0;
  background: var(--rs-brass); opacity: .65;
}
.cvr-a4-mount.tl { top: -3px; left: -3px; clip-path: polygon(0 0, 100% 0, 0 100%); }
.cvr-a4-mount.tl::after { clip-path: polygon(0 0, 100% 0, 0 3px, 3px 3px, 3px 100%, 0 100%); }
.cvr-a4-mount.tr { top: -3px; right: -3px; clip-path: polygon(0 0, 100% 0, 100% 100%); }
.cvr-a4-mount.tr::after { clip-path: polygon(0 0, 100% 0, 100% 100%, calc(100% - 3px) 100%, calc(100% - 3px) 3px, 0 3px); }
.cvr-a4-clip {
  position: absolute; top: -13px; left: 50%; transform: translateX(-50%);
  z-index: 5; pointer-events: none; filter: drop-shadow(0 3px 3px rgba(0, 0, 0, .48));
}
.cvr-frame { border: none; background: #fff; display: block; }

/* ============ Sticky Note 冲突便利贴 ============ */
.cvr-banner {
  position: relative;
  padding: 9px 14px; font-size: 12px; display: flex; gap: 10px; align-items: center;
  border-radius: 4px 6px 4px 6px;
  background: var(--rs-sticky-yellow);
  border: 1px solid rgba(179, 146, 86, .48);
  border-left: 3.5px solid var(--rs-accent);
  color: var(--rs-ink);
  box-shadow: var(--rs-shadow);
}
.cvr-banner-actions { display: flex; gap: 8px; align-items: center; margin-left: auto; }
.cvr-banner-actions .cvr-btn { background: var(--rs-card); border-color: var(--rs-border-2); color: var(--rs-ink); }

/* ============ 空态（桌角贴纸卡） ============ */
.cvr-empty {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 12px; text-align: center; padding: 28px;
}
.cvr-empty-card {
  position: relative; max-width: 340px; padding: 26px 26px 22px;
  border-radius: 8px; background: var(--rs-card);
  border: 1px solid var(--rs-border-2);
  box-shadow: var(--rs-shadow-md);
  display: flex; flex-direction: column; align-items: center; gap: 10px;
}
.cvr-empty .ring {
  width: 60px; height: 60px; border-radius: 8px;
  background: var(--rs-kraft); border: 1px solid var(--rs-brass);
  display: flex; align-items: center; justify-content: center;
  color: var(--rs-accent);
  box-shadow: 2px 2px 0 var(--rs-ink-shadow);
}
.cvr-empty .title { font-size: 18px; font-weight: 800; font-family: var(--rs-font-title); letter-spacing: .6px; color: var(--rs-ink); }
.cvr-empty .desc { font-size: 12px; color: var(--rs-ink-soft); line-height: 1.85; white-space: pre-line; }

/* ============ Toast 桌面小字条 ============ */
.cvr-toast {
  position: absolute; bottom: 18px; left: 50%; transform: translateX(-50%);
  display: flex; align-items: center; gap: 8px;
  padding: 9px 18px; border-radius: 7px; font-size: 12.5px; font-weight: 600;
  background: var(--rs-card); color: var(--rs-ink);
  border: 1px solid var(--rs-border-2);
  border-left: 3.5px solid var(--rs-accent);
  box-shadow: var(--rs-shadow-lg);
  z-index: 80; animation: cvr-toastin 200ms cubic-bezier(0.22, 1, 0.36, 1);
}
.cvr-toast .tic { color: var(--rs-accent); }
@keyframes cvr-toastin { from { opacity: 0; transform: translateX(-50%) translateY(8px); } to { opacity: 1; transform: translateX(-50%); } }
@keyframes cvr-pop { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
.cvr-spin { animation: cvr-rotate 1s linear infinite; }
@keyframes cvr-rotate { to { transform: rotate(360deg); } }

/* ============ 模板中心（修道院馆藏图鉴柜 · 揭纸动效） ============ */
.cvr-tc-wrap { display: flex; flex-direction: column; height: 100%; min-height: 0; }
.cvr-tc-head {
  padding: 4px 12px 10px; display: flex; align-items: center; gap: 12px;
  border-bottom: 1px dashed var(--rs-border-2);
}
.cvr-tc-head .emoji {
  width: 42px; height: 42px; border-radius: 8px;
  background: var(--rs-kraft); border: 1px solid var(--rs-brass);
  outline: 1px solid var(--rs-inner-rule); outline-offset: -3px;
  display: flex; align-items: center; justify-content: center;
  color: var(--rs-accent);
  box-shadow: 2px 2px 0 var(--rs-ink-shadow);
  flex: none;
}
.cvr-tc-title {
  position: relative; display: inline-block; padding-bottom: 6px;
  font-size: 23px; font-weight: 800; letter-spacing: 1.2px;
  font-family: var(--rs-font-title); color: var(--rs-ink);
}
.cvr-tc-title .cvr-pen-underline { left: 0; right: 0; width: 100%; bottom: 0; }
.cvr-tc-title .cvr-pen-underline path { stroke-dashoffset: 0; stroke: var(--rs-accent); }
.cvr-tc-sub { font-size: 12px; color: var(--rs-ink-soft); margin-top: 2px; }
.cvr-tc-controls { display: flex; align-items: center; gap: 10px; padding: 11px 12px 9px; flex-wrap: wrap; }
.cvr-search {
  display: flex; align-items: center; gap: 8px; flex: 1; max-width: 340px;
  padding: 6.5px 12px; border-radius: 6px;
  background: var(--rs-card); border: 1px solid var(--rs-border-2);
  color: var(--rs-pencil);
  transition: border-color 160ms ease;
}
.cvr-search:focus-within { border-color: var(--rs-brass); color: var(--rs-ink); }
.cvr-search input {
  flex: 1; border: none; outline: none; background: transparent; color: var(--rs-ink); font-size: 12.5px; font-family: inherit;
}
.cvr-search input::placeholder { color: var(--rs-pencil); opacity: .78; }
.cvr-count-chip {
  font-size: 11px; padding: 4px 10px; border-radius: 5px;
  background: var(--rs-kraft); color: var(--rs-ink);
  border: 1px solid var(--rs-border-2);
  font-weight: 700; font-family: var(--rs-font-serif); font-variant-numeric: tabular-nums;
  letter-spacing: .5px; white-space: nowrap;
}
.cvr-grid {
  flex: 1; overflow: auto; padding: 12px 12px 24px;
  display: grid; grid-template-columns: repeat(auto-fill, minmax(184px, 1fr)); gap: 18px;
  align-content: start;
}
.cvr-tpl-card {
  position: relative;
  content-visibility: auto;
  contain-intrinsic-size: 200px 310px;
  contain: layout style paint;
  cursor: pointer; border-radius: 7px; padding: 12px 10px 10px;
  background: var(--rs-card); border: 1px solid var(--rs-border-2);
  box-shadow: var(--rs-shadow);
  transition: border-color 200ms ease;
}
.cvr-tpl-card:hover {
  border-color: var(--rs-brass);
}
.cvr-tpl-tape {
  position: absolute; top: 1px; left: 50%; transform: translateX(-50%) rotate(-1.5deg); z-index: 6;
}
/* 揭纸动效 + 凹陷相框垫板感：仅合成层 transform + ::after 阴影透明度过渡（零逐帧阴影重绘） */
.cvr-tpl-cover {
  position: relative; z-index: 2; border-radius: 4px; padding: 5px;
  background: var(--rs-mat-bg, #171411);
  aspect-ratio: 794/1123;
  border: 1px solid rgba(194, 158, 95, .32);
  box-shadow: inset 0 2px 7px rgba(0, 0, 0, .65), inset 0 0 0 1px rgba(226, 205, 162, .16), 2px 3px 0 rgba(10, 9, 8, .50);
  transform-origin: top center;
  transition: transform 250ms cubic-bezier(0.22, 1, 0.36, 1);
  will-change: transform;
}
.cvr-tpl-cover::after {
  content: ''; position: absolute; inset: -1px; border-radius: inherit; pointer-events: none; z-index: -1;
  opacity: 0;
  box-shadow: 5px 11px 0 rgba(10, 9, 8, .56), 0 14px 24px rgba(0, 0, 0, .44);
  transition: opacity 250ms cubic-bezier(0.22, 1, 0.36, 1);
}
.cvr-tpl-cover-inner {
  position: relative; width: 100%; height: 100%; overflow: hidden;
  border-radius: 2px; background: #EFE6D2;
  border: 1px solid rgba(194, 158, 95, .30);
}
.cvr-tpl-cover-inner::after,
.cvr-toolcard-thumb::after {
  content: ''; position: absolute; inset: 0; pointer-events: none; z-index: 1;
  background-color: var(--rs-thumb-tint);
  box-shadow: inset 0 0 0 9999px var(--rs-thumb-dim);
}
.cvr-tpl-card:hover .cvr-tpl-cover {
  transform: translateY(-5px) rotate(-1deg);
}
.cvr-tpl-card:hover .cvr-tpl-cover::after { opacity: 1; }
.cvr-tpl-card:active .cvr-tpl-cover {
  transform: translateY(-2px) rotate(-0.3deg);
  transition-duration: 90ms;
}
.cvr-tpl-cover img { width: 100%; height: 100%; object-fit: cover; display: block; }
.cvr-tpl-cover iframe {
  width: 794px; height: 1123px; border: none;
  transform: scale(0.205); transform-origin: top left; pointer-events: none;
}
/* 红色残缺感手绘 SVG 印章框 */
.cvr-hot {
  position: absolute; top: 8px; right: 8px; z-index: 3;
  font-size: 9.5px; font-weight: 800; padding: 3px 8px; border-radius: 2px;
  background: rgba(246, 236, 214, .88); color: #9E2E23;
  transform: rotate(-4deg);
  font-family: var(--rs-font-title); font-variant-numeric: tabular-nums;
  letter-spacing: .5px;
  box-shadow: 1px 1px 0 rgba(10, 9, 8, .28);
}
.cvr-hot-svg {
  position: absolute; inset: -1px; width: calc(100% + 2px); height: calc(100% + 2px);
  pointer-events: none; overflow: visible;
}
.cvr-tpl-name {
  position: relative; z-index: 2;
  font-size: 13px; font-weight: 700; font-family: var(--rs-font-title); letter-spacing: .3px;
  margin-top: 9px; color: var(--rs-ink);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.cvr-tpl-tags {
  position: relative; z-index: 2;
  font-size: 11px; color: var(--rs-pencil); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px;
}

/* ============ 弹窗（桌面摊开的档案卷宗，严禁毛玻璃） ============ */
.cvr-modal-mask {
  position: fixed; inset: 0; z-index: 200;
  background: var(--rs-mask);
  display: flex; align-items: center; justify-content: center;
  animation: cvr-fade 160ms ease-out;
  color: var(--rs-ink);
}
.cvr-modal {
  position: relative;
  display: flex; gap: 20px; padding: 20px; border-radius: 8px;
  background-color: var(--rs-card);
  border: 1px solid var(--rs-border-2);
  box-shadow: var(--rs-shadow-lg); max-height: 92vh;
  color: var(--rs-ink);
  animation: cvr-folio-unfold 240ms cubic-bezier(0.22, 1, 0.36, 1);
}
@keyframes cvr-fade { from { opacity: 0; } }
.cvr-modal-cover {
  position: relative; z-index: 2;
  width: 430px; flex: none; height: 560px; overflow-y: auto; overflow-x: hidden;
  border-radius: 6px;
  background-color: var(--rs-desk);
  background-image: linear-gradient(var(--rs-desk-grid) 1px, transparent 1px), linear-gradient(90deg, var(--rs-desk-grid) 1px, transparent 1px);
  background-size: 20px 20px;
  border: 1px solid var(--rs-border-2);
}
.cvr-modal-pane-label {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 11px; font-weight: 700; padding: 3px 10px; margin: 10px 0 6px;
  border-radius: 4px; background: var(--rs-kraft); color: var(--rs-ink);
  border: 1px solid var(--rs-border-2);
}
.cvr-modal-cover .cover-img { width: 100%; border-radius: 3px; border: 1px solid var(--rs-border-2); display: block; box-shadow: var(--rs-shadow-md); }
.cvr-modal-cover .cover-wrap { position: relative; border-radius: 3px; overflow: hidden; }
.cvr-modal-cover .cover-wrap::after { content: ''; position: absolute; inset: 0; pointer-events: none; background-color: var(--rs-thumb-tint); box-shadow: inset 0 0 0 9999px var(--rs-thumb-dim); }
.cvr-modal-cover .render-clip {
  position: relative; border-radius: 3px; overflow: hidden; height: 300px; background: #fff;
  border: 1px solid var(--rs-border-2); box-shadow: var(--rs-shadow-md);
}
.cvr-modal-cover .render-clip iframe {
  width: 794px; height: 1123px; border: none; transform: scale(0.52); transform-origin: top left; pointer-events: none;
}
.cvr-modal-side { position: relative; z-index: 2; width: 270px; display: flex; flex-direction: column; gap: 12px; }
.cvr-modal-head {
  position: relative; z-index: 2;
  display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;
  padding: 15px 18px 12px; border-bottom: 1px solid var(--rs-border-2);
  position: sticky; top: 0; background: var(--rs-paper);
}
.cvr-modal-title { font-size: 17px; font-weight: 800; font-family: var(--rs-font-title); letter-spacing: .5px; color: var(--rs-ink); }
.cvr-modal-sub { font-size: 11.5px; color: var(--rs-pencil); margin-top: 2px; }
.cvr-modal-body { position: relative; z-index: 2; padding: 14px 18px 18px; }
.cvr-swap-tabs { display: flex; gap: 8px; margin-bottom: 12px; }
.cvr-swap-empty { padding: 26px 8px; text-align: center; font-size: 12.5px; color: var(--rs-pencil); }
.cvr-swap-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 10px; }
.cvr-swap-card {
  display: flex; flex-direction: column; gap: 4px; align-items: flex-start; text-align: left;
  padding: 11px 12px; border-radius: 6px; border: 1px solid var(--rs-border-2);
  background: var(--rs-slip); cursor: pointer; transition: 160ms ease; font: inherit; color: inherit;
  box-shadow: 0 1.5px 0 var(--rs-ink-shadow);
}
.cvr-swap-card:hover:not(:disabled) { border-color: var(--rs-brass); background: var(--rs-card-2); transform: translateY(-1px); box-shadow: var(--rs-shadow); }
.cvr-swap-card:disabled { opacity: .55; cursor: not-allowed; }
.cvr-swap-card .dot { width: 10px; height: 10px; border-radius: 2px; display: block; border: 1px solid var(--rs-border-2); }
.cvr-swap-card .nm { font-size: 12.5px; font-weight: 700; color: var(--rs-ink); }
.cvr-swap-card .sub { font-size: 11px; color: var(--rs-pencil); }
.cvr-sec-list { display: flex; flex-direction: column; gap: 6px; }
.cvr-sec-row {
  display: flex; align-items: center; gap: 10px; padding: 9px 12px;
  border-radius: 6px; border: 1px solid var(--rs-border-2); background: var(--rs-slip);
}
.cvr-sec-row .idx {
  font-size: 11px; font-weight: 700; font-family: var(--rs-font-serif); font-variant-numeric: tabular-nums;
  padding: 2px 7px; border-radius: 4px; background: var(--rs-kraft); color: var(--rs-ink);
  border: 1px solid var(--rs-border);
}
.cvr-sec-row .nm { flex: 1; font-size: 12.5px; font-weight: 600; color: var(--rs-ink); }
.cvr-sec-row .ops { display: flex; gap: 4px; }
.cvr-score {
  display: flex; align-items: center; gap: 16px; padding: 14px 16px;
  border-radius: 7px; background: var(--rs-slip); border: 1px solid var(--rs-border-2); margin-bottom: 12px;
}
.cvr-score-stamp {
  width: 62px; height: 62px; border-radius: 999px; flex: none;
  display: flex; align-items: center; justify-content: center;
  border: 2px solid currentColor; outline: 1px dashed currentColor; outline-offset: 3px;
  transform: rotate(-5deg);
  font-size: 24px; font-weight: 800; font-family: var(--rs-font-serif); font-variant-numeric: tabular-nums; line-height: 1;
}
.cvr-score .num { font-size: 30px; font-weight: 800; font-variant-numeric: tabular-nums; line-height: 1; }
.cvr-score .lbl { font-size: 13.5px; font-weight: 800; color: var(--rs-ink); }
.cvr-score .sub { font-size: 11.5px; color: var(--rs-ink-soft); margin-top: 3px; }
.cvr-issue-list { display: flex; flex-direction: column; gap: 8px; }
.cvr-issue {
  display: flex; gap: 10px; padding: 10px 12px; border-radius: 6px;
  background: var(--rs-slip); border: 1px solid var(--rs-border);
}
.cvr-issue .bar { width: 3.5px; border-radius: 2px; flex: none; }
.cvr-issue .msg { font-size: 12.5px; font-weight: 600; color: var(--rs-ink); }
.cvr-issue .ln { font-weight: 500; color: var(--rs-pencil); font-size: 11px; font-family: var(--rs-font-mono); }
.cvr-issue .quote { font-size: 11.5px; color: var(--rs-ink-soft); margin-top: 3px; font-style: italic; }
.cvr-issue .fix { font-size: 11.5px; color: var(--rs-green); font-weight: 600; margin-top: 4px; }
.cvr-jd-input {
  width: 100%; border-radius: 6px; border: 1px solid var(--rs-border-2);
  background: var(--rs-paper); color: var(--rs-ink); padding: 10px 12px;
  font: inherit; font-size: 12.5px; line-height: 1.7; resize: vertical;
}
.cvr-jd-input:focus { outline: none; border-color: var(--rs-brass); }
.cvr-kw-block { margin-top: 12px; }
.cvr-kw-block .t { font-size: 11.5px; font-weight: 700; color: var(--rs-ink-soft); margin-bottom: 6px; }
.cvr-kw-row { display: flex; flex-wrap: wrap; gap: 6px; }
.cvr-kw { font-size: 11.5px; padding: 3px 9px; border-radius: 4px; border: 1px solid var(--rs-border-2); font-weight: 600; }
.cvr-kw.miss { color: var(--rs-warn); border-color: rgba(217, 172, 91, .5); background: var(--rs-sticky-yellow); }
.cvr-kw.hit { color: var(--rs-green); border-color: rgba(111, 176, 124, .48); background: var(--rs-sticky-mint); }
.cvr-modal-side .name { font-size: 20px; font-weight: 800; line-height: 1.35; font-family: var(--rs-font-title); letter-spacing: .5px; color: var(--rs-ink); }
.cvr-modal-side .tagrow { display: flex; flex-wrap: wrap; gap: 5px; }
.cvr-modal-side .tag {
  font-size: 11px; padding: 3px 9px; border-radius: 4px;
  background: var(--rs-kraft-soft); border: 1px solid var(--rs-border-2);
  color: var(--rs-ink-soft); font-weight: 600;
}
.cvr-modal-side .desc { font-size: 12px; color: var(--rs-ink-soft); line-height: 1.75; overflow-y: auto; flex: 1; }
.cvr-modal-side .note {
  font-size: 11.5px; color: var(--rs-ink); line-height: 1.6;
  background: var(--rs-sticky-yellow); border: 1px solid rgba(179, 146, 86, .42);
  border-radius: 6px; padding: 8px 11px;
}

/* ============ 聊天工具卡 · Scriptorium 典籍标本卡 ============ */
.cvr-toolcard {
  position: relative; overflow: visible; isolation: isolate;
  display: flex; align-items: stretch; gap: 16px; flex-wrap: nowrap;
  padding: 16px 18px 16px 22px; margin: 12px 0 8px; font-size: 12px;
  border-radius: 8px;
  border: 1px solid var(--rs-border-2);
  background-color: var(--rs-card);
  color: var(--rs-ink);
  box-shadow: var(--rs-shadow-md);
  animation: cvr-folio-unfold 280ms cubic-bezier(0.22, 1, 0.36, 1);
  transition: border-color 180ms ease;
}
.cvr-toolcard:hover { border-color: var(--rs-brass); }
.cvr-hand-red-rule {
  position: absolute; left: 5px; top: 10px; bottom: 10px; width: 8px; height: calc(100% - 20px);
  pointer-events: none; z-index: 3; overflow: visible;
}
.cvr-toolcard-tape {
  position: absolute; top: -8px; left: 22px; z-index: 6;
  transform: rotate(-2.5deg); pointer-events: none;
}
.cvr-toolcard.is-live {
  border-color: var(--rs-brass);
  border-left-color: var(--rs-accent);
}
.cvr-toolcard.compact:not(.is-live) { align-items: center; gap: 10px; padding: 11px 14px; }
.cvr-toolcard.is-error { border-color: var(--rs-danger); border-left-color: var(--rs-danger); background-color: var(--rs-card); }

.cvr-toolcard-thumb, .cvr-mini-paper-box {
  position: relative; z-index: 2;
  width: 128px; height: 181px; flex: none;
  border-radius: 3px; overflow: hidden; background: #FAF6EB;
  border: 1px solid rgba(38, 33, 28, .28);
  box-shadow: 3px 3px 0 rgba(12, 10, 8, .30), 0 8px 16px rgba(0, 0, 0, .24);
  transition: transform 220ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 220ms cubic-bezier(0.22, 1, 0.36, 1);
}
.cvr-toolcard-thumb { cursor: pointer; }
.cvr-toolcard-thumb:hover {
  transform: translateY(-2px);
  box-shadow: 4px 6px 0 rgba(12, 10, 8, .36), 0 12px 22px rgba(0, 0, 0, .30);
}
.cvr-toolcard-thumb iframe {
  width: 794px; height: 1123px; border: none; display: block; background: #fff;
  transform: scale(0.1612); transform-origin: top left; pointer-events: none;
}
.cvr-thumb-overlay {
  position: absolute; inset: 0; z-index: 3; display: flex; align-items: flex-end; justify-content: center;
  padding: 10px 8px; opacity: 0; pointer-events: none;
  background: linear-gradient(180deg, transparent 48%, rgba(23, 21, 19, .72) 100%);
  transition: opacity 180ms ease;
}
.cvr-toolcard-thumb:hover .cvr-thumb-overlay { opacity: 1; }
.cvr-thumb-pill {
  display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 4px;
  font-size: 10.5px; font-weight: 700; color: var(--rs-ink);
  background: var(--rs-card); border: 1px solid var(--rs-brass);
  box-shadow: 2px 2px 0 rgba(0, 0, 0, .3);
}
.cvr-thumb-corner {
  position: absolute; top: 6px; right: 6px; z-index: 4; padding: 1.5px 6px;
  border-radius: 3px; font-size: 9px; font-weight: 800; letter-spacing: .5px;
  font-family: var(--rs-font-serif);
  color: var(--rs-accent); background: rgba(250, 245, 232, .92);
  border: 1.25px solid var(--rs-accent);
  pointer-events: none;
}
.cvr-mini-paper {
  position: relative; width: 100%; height: 100%; padding: 9px 10px;
  color: #26211C; font-size: 4.9px; line-height: 1.45; overflow: hidden;
  display: flex; flex-direction: column; gap: 2.5px;
  font-family: var(--rs-font-sans);
}
.cvr-mp-h1 { font-size: 6.6px; font-weight: 800; color: #1D1A17; line-height: 1.3; margin-bottom: 1px; padding-right: 26px; word-break: break-word; }
.cvr-mp-h1.band { display: inline-block; padding: 2px 5px; border-radius: 2px; color: #fff; }
.cvr-mp-h2 { font-size: 5.4px; font-weight: 800; color: var(--sp-accent, #A63A2E); border-bottom: 1px solid var(--sp-accent, #A63A2E); padding-bottom: 1px; margin-top: 2.5px; }
.cvr-mp-row { display: flex; gap: 4px; justify-content: space-between; font-weight: 700; font-size: 4.6px; color: #4A423B; }
.cvr-mp-row > span { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cvr-mp-p { font-size: 4.5px; color: #5B5249; word-break: break-word; }
.cvr-mp-li { font-size: 4.5px; color: #3D3630; padding-left: 5px; position: relative; word-break: break-word; }
.cvr-mp-li::before { content: ""; position: absolute; left: 1px; top: 2.3px; width: 2px; height: 2px; border-radius: 50%; background: var(--sp-accent, #A63A2E); }
.cvr-mp-chip { display: inline-block; padding: 0 2.5px; border-radius: 2px; font-size: 4px; background: var(--sp-soft, rgba(166, 58, 46, .12)); color: var(--sp-accent, #A63A2E); border: .5px solid var(--sp-accent, #A63A2E); margin: 0 1px; }
.cvr-mp-cursor { display: inline-block; width: 3px; height: 5.5px; vertical-align: middle; margin-left: 2px; background: var(--rs-accent); border-radius: 1px; }
.cvr-mp-skel { height: 3.5px; border-radius: 2px; background: #E4DDD0; margin-top: 2px; }
.cvr-mp-skel.head { height: 7px; width: 65%; background: #D8CEBC; margin-bottom: 3px; }
.cvr-mp-skel.sub { height: 4px; width: 42%; background: #DFD6C5; margin-top: 4px; }
.cvr-draft-sweep {
  position: absolute; left: 0; right: 0; top: 0; height: 2px; pointer-events: none; z-index: 4;
  background: var(--rs-accent); opacity: .75;
}

.cvr-toolcard-info { position: relative; z-index: 2; flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: space-between; gap: 10px; padding: 1px 0; }
.cvr-toolcard-head { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.cvr-toolcard-title-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-width: 0; }
.cvr-toolcard-title-left { display: flex; align-items: center; gap: 8px; min-width: 0; flex: 1; }
.cvr-atelier-icon {
  width: 28px; height: 28px; border-radius: 6px; flex: none;
  display: inline-flex; align-items: center; justify-content: center;
  background: var(--rs-kraft); color: var(--rs-brass);
  border: 1px solid var(--rs-border-2);
  box-shadow: 1.5px 1.5px 0 var(--rs-ink-shadow);
}
.cvr-toolcard-title { font-size: 15.5px; font-weight: 800; font-family: var(--rs-font-title); letter-spacing: .4px; color: var(--rs-ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cvr-toolcard-badge {
  display: inline-flex; align-items: center; gap: 5px; flex: none;
  font-size: 10.5px; font-weight: 700; padding: 2px 8px; border-radius: 4px;
  background: var(--rs-sticky-mint); color: var(--rs-green);
  border: 1px solid rgba(111, 176, 124, .48); white-space: nowrap;
}
.cvr-toolcard.is-live .cvr-toolcard-badge {
  background: var(--rs-sticky-yellow); color: var(--rs-warn); border-color: rgba(217, 172, 91, .50);
}
.cvr-seal-svg { width: 13px; height: 13px; flex: none; display: block; }
.cvr-live-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--rs-accent); }
.cvr-toolcard-id {
  font-size: 10.5px; padding: 2px 7px; border-radius: 4px; flex: none;
  background: var(--rs-paper); border: 1px solid var(--rs-border-2); color: var(--rs-pencil);
  font-family: var(--rs-font-mono); font-variant-numeric: tabular-nums;
}
.cvr-toolcard-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 11.5px; color: var(--rs-ink-soft); line-height: 1.4; }
.cvr-atelier-highlight {
  display: inline-flex; align-items: center; gap: 5px; padding: 2px 8px; border-radius: 4px;
  font-size: 11px; font-weight: 700;
  background: var(--rs-kraft-soft); color: var(--rs-ink); border: 1px solid var(--rs-border);
}
.cvr-atelier-stats { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; color: var(--rs-pencil); font-variant-numeric: tabular-nums; }
.cvr-atelier-stats .sep { opacity: .45; }
.cvr-sec-pills { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; }
.cvr-sec-pill {
  display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 4px;
  font-size: 10.5px; font-weight: 600; background: var(--rs-paper); border: 1px solid var(--rs-border);
  color: var(--rs-ink-soft); max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  transition: border-color 160ms cubic-bezier(0.22, 1, 0.36, 1), color 160ms ease, transform 140ms cubic-bezier(0.22, 1, 0.36, 1);
}
.cvr-sec-pill:hover { border-color: var(--rs-brass); color: var(--rs-ink); transform: translateY(-1px); }
.cvr-sec-pill.active { background: var(--rs-brass-soft); border-color: var(--rs-brass); color: var(--rs-ink); font-weight: 700; }
.cvr-sec-pill.done { color: var(--rs-ink); }
.cvr-live-steps { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-size: 10.5px; color: var(--rs-pencil); }
.cvr-live-step { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 4px; background: var(--rs-paper); border: 1px solid var(--rs-border); }
.cvr-live-step.on { color: var(--rs-ink); border-color: var(--rs-brass); background: var(--rs-sticky-yellow); font-weight: 700; }
.cvr-live-step.done { color: var(--rs-green); border-color: rgba(111, 176, 124, .42); background: var(--rs-sticky-mint); }
.cvr-live-ticker {
  padding: 7px 10px; border-radius: 5px; background: var(--rs-paper); border: 1px dashed var(--rs-border-2);
  font-family: var(--rs-font-mono); font-size: 11px; line-height: 1.5;
  color: var(--rs-ink-soft); max-height: 46px; overflow: hidden; word-break: break-all;
}
.cvr-live-ticker-cursor { display: inline-block; width: 6px; height: 11px; vertical-align: -1px; margin-left: 3px; background: var(--rs-accent); border-radius: 1px; }
.cvr-toolcard-actions { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }
.cvr-export-seg {
  display: inline-flex; align-items: center; padding: 2px; border-radius: 6px;
  background: var(--rs-kraft-soft); border: 1px solid var(--rs-border-2); gap: 2px;
}
.cvr-export-seg button {
  border: 1px solid transparent; background: transparent; color: var(--rs-ink-soft); font-size: 11px; font-weight: 700;
  padding: 4px 9px; border-radius: 4px; cursor: pointer; transition: background 140ms, color 140ms, border-color 140ms;
  display: inline-flex; align-items: center; gap: 4px; font-family: inherit;
}
.cvr-export-seg button:hover:not(:disabled) { background: var(--rs-card); border-color: var(--rs-brass); color: var(--rs-ink); }
.cvr-export-seg button:disabled { opacity: .42; cursor: default; }

/* ============ 高清审阅灯箱（桌垫审阅板，严禁毛玻璃） ============ */
.cvr-lightbox-mask {
  position: fixed; inset: 0; z-index: 10050; background: var(--rs-mask);
  display: flex; align-items: center; justify-content: center; padding: 20px;
}
.cvr-lightbox {
  position: relative;
  width: min(920px, 94vw); height: min(90vh, 920px); display: flex; flex-direction: column; overflow: hidden;
  border-radius: 8px; border: 1px solid var(--rs-border-2);
  background: var(--rs-paper); color: var(--rs-ink);
  box-shadow: var(--rs-shadow-lg);
}
.cvr-lightbox-head {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 11px 16px; border-bottom: 1px solid var(--rs-border-2); background: var(--rs-slip);
}
.cvr-lightbox-body {
  flex: 1; min-height: 0; overflow: auto; display: flex; justify-content: center; align-items: flex-start; padding: 26px;
  background-color: var(--rs-desk);
  background-image:
    radial-gradient(ellipse 90% 85% at 50% 45%, transparent 48%, rgba(0, 0, 0, .20) 100%),
    linear-gradient(var(--rs-desk-grid) 1px, transparent 1px),
    linear-gradient(90deg, var(--rs-desk-grid) 1px, transparent 1px);
  background-size: 100% 100%, 22px 22px, 22px 22px;
}
.cvr-lightbox-foot {
  display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap;
  padding: 10px 16px; border-top: 1px solid var(--rs-border-2); background: var(--rs-slip);
}

/* ============ 输入框与 Reduced Motion ============ */
.cvr-select {
  padding: 6px 12px; font-size: 12.5px; border-radius: 6px;
  border: 1px solid var(--rs-border-2); background: var(--rs-card); color: var(--rs-ink); outline: none;
  transition: border-color .16s;
}
.cvr-select:focus { border-color: var(--rs-brass); }

@media (prefers-reduced-motion: reduce) {
  .cvr-root *, .cvr-workbench *, .cvr-toolcard, .cvr-toolcard *, .cvr-modal, .cvr-modal *, .cvr-lightbox, .cvr-lightbox * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
`;

    let bakedNoiseCss = null;
    function getBakedNoiseUrl() {
      if (bakedNoiseCss !== null) return bakedNoiseCss;
      try {
        const c = document.createElement('canvas');
        c.width = 128; c.height = 128;
        const g = c.getContext('2d');
        if (!g) { bakedNoiseCss = 'none'; return bakedNoiseCss; }
        const img = g.createImageData(128, 128);
        const d = img.data;
        let s = 0x5EEDBEEF;
        for (let i = 0; i < d.length; i += 4) {
          s = (s + 0x6D2B79F5) >>> 0;
          let t = Math.imul(s ^ (s >>> 15), 1 | s);
          t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
          const v = ((t ^ (t >>> 14)) >>> 24);
          d[i] = v;
          d[i + 1] = Math.max(0, v - 4);
          d[i + 2] = Math.max(0, v - 10);
          d[i + 3] = 255;
        }
        g.putImageData(img, 0, 0);
        bakedNoiseCss = 'url("' + c.toDataURL('image/png') + '")';
      } catch {
        bakedNoiseCss = 'none';
      }
      return bakedNoiseCss;
    }

    function injectStyles() {
      const noiseVar = ':root { --cvr-baked-noise: ' + getBakedNoiseUrl() + '; }\n';
      const existing = document.querySelector('style[data-plugin-css="dsh-resume"]');
      if (existing) { existing.textContent = noiseVar + CSS; return; }
      const tag = document.createElement('style');
      tag.dataset.plugin = 'dsh-resume';
      tag.dataset.pluginCss = 'dsh-resume';
      tag.textContent = noiseVar + CSS;
      document.head.appendChild(tag);
    }

    /* ---------------------- Looseleaf Ink & Paper Primitives ---------------------- */
    // 轻量确定性 SVG 手绘原语：零构建、纯数学噪声微扰，严格保持高频区 calm 可读性

    function inkHash(str) {
      let h1 = 0x811c9dc5;
      const s = String(str ?? 'll');
      for (let i = 0; i < s.length; i++) {
        h1 ^= s.charCodeAt(i);
        h1 = Math.imul(h1, 0x01000193);
      }
      h1 ^= h1 >>> 16;
      h1 = Math.imul(h1, 0x85ebca6b);
      h1 ^= h1 >>> 13;
      return h1 >>> 0;
    }

    function inkRng(seed) {
      let a = (typeof seed === 'number' ? seed : inkHash(seed)) >>> 0;
      return () => {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }

    function inkSmoothNoise(rng, len, period) {
      const count = Math.max(2, Math.ceil(len / Math.max(8, period)) + 2);
      const vals = [];
      for (let i = 0; i < count; i++) vals.push(rng() * 2 - 1);
      return (u) => {
        const x = (u / Math.max(1, len)) * (count - 1);
        const i0 = Math.max(0, Math.min(count - 2, Math.floor(x)));
        const f = x - i0;
        const mu = (1 - Math.cos(f * Math.PI)) * 0.5;
        return vals[i0] * (1 - mu) + vals[i0 + 1] * mu;
      };
    }

    function inkRectD(w, h1, r, seed, wobble = 0.42) {
      const rx = Math.max(0, Math.min(r, w / 2, h1 / 2));
      const rng = inkRng(seed);
      const nT = inkSmoothNoise(rng, w, 46);
      const nR = inkSmoothNoise(rng, h1, 46);
      const nB = inkSmoothNoise(rng, w, 46);
      const nL = inkSmoothNoise(rng, h1, 46);
      const pts = [];
      const pushSeg = (x0, y0, x1, y1, nx, ny, fn) => {
        const dist = Math.hypot(x1 - x0, y1 - y0);
        const steps = Math.max(2, Math.round(dist / 18));
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          const fade = Math.sin(t * Math.PI);
          const d = fn(t * dist) * wobble * (0.35 + 0.65 * fade);
          pts.push([x0 + (x1 - x0) * t + nx * d, y0 + (y1 - y0) * t + ny * d]);
        }
      };
      const pushArc = (cx, cy, a0, a1) => {
        if (rx < 1) return;
        for (let i = 1; i <= 3; i++) {
          const a = a0 + (a1 - a0) * (i / 3);
          pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * rx]);
        }
      };
      pushSeg(rx, 0.75, w - rx, 0.75, 0, 1, nT);
      pushArc(w - rx, rx + 0.75, -Math.PI / 2, 0);
      pushSeg(w - 0.75, rx, w - 0.75, h1 - rx, -1, 0, nR);
      pushArc(w - rx - 0.75, h1 - rx, 0, Math.PI / 2);
      pushSeg(w - rx, h1 - 0.75, rx, h1 - 0.75, 0, -1, nB);
      pushArc(rx + 0.75, h1 - rx, Math.PI / 2, Math.PI);
      pushSeg(0.75, h1 - rx, 0.75, rx, 1, 0, nL);
      pushArc(rx + 0.75, rx + 0.75, Math.PI, Math.PI * 1.5);
      return 'M' + pts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('L') + 'Z';
    }

    function InkFrame({ seed, radius = 10, wobble = 0.42, doubleLine = false, strokeWidth = 1.25 }) {
      const boxRef = useRef(null);
      const [sz, setSz] = useState({ w: 0, h: 0 });
      useEffect(() => {
        const el = boxRef.current;
        if (!el) return;
        const measure = () => {
          const r = el.getBoundingClientRect();
          const w = Math.round(r.width), h1 = Math.round(r.height);
          if (w > 4 && h1 > 4) setSz((prev) => (prev.w === w && prev.h === h1 ? prev : { w, h: h1 }));
        };
        measure();
        if (typeof ResizeObserver === 'function') {
          const ro = new ResizeObserver(measure);
          ro.observe(el);
          return () => ro.disconnect();
        }
      }, []);
      const paths = useMemo(() => {
        if (sz.w <= 4 || sz.h <= 4) return null;
        return {
          main: inkRectD(sz.w, sz.h, radius, seed, wobble),
          ghost: doubleLine ? inkRectD(sz.w, sz.h, radius, String(seed) + ':g', wobble * 1.35) : null,
        };
      }, [sz.w, sz.h, radius, seed, wobble, doubleLine]);
      return h('span', { className: 'cvr-ink-layer', ref: boxRef, 'aria-hidden': true },
        paths && h('svg', { className: 'cvr-ink-svg', width: sz.w, height: sz.h, viewBox: `0 0 ${sz.w} ${sz.h}` },
          paths.ghost && h('path', { className: 'cvr-ink-ghost', d: paths.ghost, strokeWidth: 0.9 }),
          h('path', { className: 'cvr-ink-stroke', d: paths.main, strokeWidth }),
        ),
      );
    }

    function InkRule({ seed = 'rule', className }) {
      const d = useMemo(() => {
        const rng = inkRng(seed);
        const n1 = inkSmoothNoise(rng, 400, 68);
        const pts = [];
        for (let x = 2; x <= 398; x += 16) {
          const y = 3 + n1(x) * 0.75;
          pts.push(`${x} ${y.toFixed(2)}`);
        }
        return 'M' + pts.join(' L');
      }, [seed]);
      return h('svg', {
        className: 'cvr-ink-rule' + (className ? ' ' + className : ''),
        viewBox: '0 0 400 6', preserveAspectRatio: 'none', 'aria-hidden': true,
      }, h('path', { d, fill: 'none', stroke: 'var(--rs-ink-line)', strokeWidth: 1.25, strokeLinecap: 'round' }));
    }

    const WashiTape = React.memo(function WashiTape({ seed = 'tape', width = 48, height = 14, variant = 'masking', className, style }) {
      const geo = useMemo(() => {
        const rng = inkRng(seed);
        const left = [], right = [];
        const pitch = 2.2;
        for (let y = 0, k = 0; y <= height + 0.1; y += pitch, k++) {
          const yy = Math.min(y, height);
          left.push([k % 2 ? 2.4 + rng() * 0.9 : 0.4, yy]);
          right.push([width - (k % 2 ? 2.4 + rng() * 0.9 : 0.4), yy]);
        }
        const pts = [...left, ...right.reverse()];
        const body = 'M' + pts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('L') + 'Z';
        return { body };
      }, [seed, width, height]);
      return h('svg', {
        className: 'cvr-tape' + (className ? ' ' + className : ''),
        width, height: height + 2, viewBox: `0 0 ${width} ${height + 2}`,
        'aria-hidden': true, style,
      },
        h('path', { d: geo.body, transform: 'translate(0, 1.8)', fill: 'rgba(0, 0, 0, 0.24)' }),
        h('path', { d: geo.body, fill: 'var(--rs-tape)', stroke: 'var(--rs-tape-edge)', strokeWidth: 0.9, strokeLinejoin: 'round' }),
        h('path', {
          d: `M4 ${(height * 0.32).toFixed(1)}H${width - 4}M4 ${(height * 0.54).toFixed(1)}H${width - 4}M4 ${(height * 0.76).toFixed(1)}H${width - 4}`,
          stroke: 'var(--rs-tape-edge)', strokeOpacity: 0.42, strokeWidth: 0.6, strokeDasharray: '2.5 2',
        }),
        variant === 'washi' && h('path', {
          d: `M5 ${(height * 0.28).toFixed(1)}H${width - 5}M5 ${(height * 0.72).toFixed(1)}H${width - 5}`,
          stroke: 'var(--rs-accent)', strokeOpacity: 0.45, strokeWidth: 1.0, strokeDasharray: '4 3',
        }),
      );
    });

    const CornerBrackets = React.memo(function CornerBrackets() {
      return h('span', { className: 'cvr-corners', 'aria-hidden': true },
        h('span', { className: 'cvr-corner tl' }),
        h('span', { className: 'cvr-corner tr' }),
        h('span', { className: 'cvr-corner bl' }),
        h('span', { className: 'cvr-corner br' }),
      );
    });

    function BrassClip() {
      return h('svg', {
        className: 'cvr-a4-clip', width: 44, height: 22, viewBox: '0 0 44 22', 'aria-hidden': true,
      },
        h('path', { d: 'M15 6V3.5a7 7 0 0 1 14 0V6', fill: 'none', stroke: 'var(--rs-brass)', strokeWidth: 1.8, strokeLinecap: 'round' }),
        h('rect', { x: 4, y: 6, width: 36, height: 13, rx: 3, fill: 'var(--rs-brass)', stroke: 'var(--rs-brass-deep)', strokeWidth: 1.4 }),
        h('line', { x1: 8, y1: 10.5, x2: 36, y2: 10.5, stroke: '#EFE4CA', strokeOpacity: 0.45, strokeWidth: 0.9 }),
        h('line', { x1: 8, y1: 14.5, x2: 36, y2: 14.5, stroke: 'var(--rs-brass-deep)', strokeOpacity: 0.72, strokeWidth: 1.1 }),
      );
    }

    function PenUnderline({ seed = 'pen' }) {
      const d = useMemo(() => {
        const rng = inkRng(seed);
        const cy = (0.8 + rng() * 1.1).toFixed(2);
        const ey = (3.4 + rng() * 1.0).toFixed(2);
        return `M2 4.1 Q 60 ${cy} 118 ${ey}`;
      }, [seed]);
      return h('svg', {
        className: 'cvr-pen-underline', viewBox: '0 0 120 6', preserveAspectRatio: 'none', 'aria-hidden': true,
      }, h('path', { d }));
    }

    function HandRedRule({ seed = 'redrule' }) {
      const paths = useMemo(() => {
        const r1 = inkRng(seed);
        const r2 = inkRng(String(seed) + ':2');
        const n1 = inkSmoothNoise(r1, 200, 32);
        const n2 = inkSmoothNoise(r2, 200, 26);
        const p1 = [], p2 = [];
        for (let y = 0; y <= 200; y += 12) {
          p1.push(`${(3.4 + n1(y) * 0.9).toFixed(2)} ${y}`);
          p2.push(`${(5.2 + n2(y) * 0.7).toFixed(2)} ${y}`);
        }
        return { main: 'M' + p1.join(' L'), twin: 'M' + p2.join(' L') };
      }, [seed]);
      return h('svg', {
        className: 'cvr-hand-red-rule', viewBox: '0 0 8 200', preserveAspectRatio: 'none', 'aria-hidden': true,
      },
        h('path', { d: paths.main, fill: 'none', stroke: 'var(--rs-accent)', strokeWidth: 2.2, strokeLinecap: 'round' }),
        h('path', { d: paths.twin, fill: 'none', stroke: 'var(--rs-accent)', strokeOpacity: 0.42, strokeWidth: 0.9, strokeLinecap: 'round' }),
      );
    }

    const HotStamp = React.memo(function HotStamp({ seed = 'hot', text }) {
      const d = useMemo(() => inkRectD(64, 22, 2, seed, 0.55), [seed]);
      return h('span', { className: 'cvr-hot' },
        h('svg', { className: 'cvr-hot-svg', viewBox: '0 0 64 22', preserveAspectRatio: 'none', 'aria-hidden': true },
          h('path', { d, fill: 'none', stroke: '#9E2E23', strokeWidth: 1.5, strokeDasharray: '18 2 12 1.5', strokeLinecap: 'round' }),
        ),
        text,
      );
    });


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
        if (hasCls(el, 'cv-bg') || el.tagName === 'MARK') {
          const color = toHexColor(el.getAttribute('style'), 'background(?:-color)?');
          const inner = collectInline(el);
          out += color ? `!bg[${inner}](${color})` : inner;
          lastWrap = '';
        } else if (hasCls(el, 'cv-c') || (el.tagName === 'SPAN' && toHexColor(el.getAttribute('style'), 'color'))) {
          const color = toHexColor(el.getAttribute('style'), 'color');
          const inner = collectInline(el);
          out += color ? `!c[${inner}](${color})` : inner;
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
          const walkList = (listEl, depth = 0) => {
            const marker = listEl.tagName === 'OL' ? '1. ' : '- ';
            const pad = '  '.repeat(depth);
            for (const li of listEl.children) {
              if (li.tagName !== 'LI') continue;
              const inlineNodes = [];
              const childLists = [];
              for (const ch of li.childNodes) {
                if (ch.nodeType === 1 && (ch.tagName === 'UL' || ch.tagName === 'OL')) childLists.push(ch);
                else inlineNodes.push(ch);
              }
              const t = collectInline({ childNodes: inlineNodes }).trim();
              if (t) lines.push(pad + marker + t);
              for (const sub of childLists) walkList(sub, depth + 1);
            }
          };
          walkList(el, 0);
          lines.push('');
          listMode = tag.toLowerCase();
          return;
        }
        if (tag === 'BLOCKQUOTE') {
          closeList();
          const t = collectInline(el).trim();
          if (t) { lines.push(''); t.split(/\n+/).forEach((ln) => lines.push('> ' + ln.trim())); lines.push(''); }
          return;
        }
        if (tag === 'PRE') {
          closeList();
          const t = (el.textContent || '').replace(/\n+$/, '');
          if (t) { lines.push('', '```', t, '```', ''); }
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

    const Btn = React.memo(function Btn({ icon, label, onClick, onMouseDown, disabled, active, danger, primary, softaccent, brass, tintBlue, tintViolet, tintYellow, iconOnly, title, spin, style }) {
      return h('button', {
        className: 'cvr-btn'
          + (active ? ' active' : '')
          + (danger ? ' danger' : '')
          + (primary ? ' primary' : '')
          + (softaccent ? ' softaccent' : '')
          + (brass ? ' is-brass' : '')
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
    });

    const StatusPill = React.memo(function StatusPill({ saving, dirty, extStale }) {
      const kind = saving ? 'saving' : dirty ? 'dirty' : extStale ? 'stale' : 'ok';
      const ledColor = saving ? 'var(--rs-blue)' : dirty ? 'var(--rs-warn)' : extStale ? 'var(--rs-danger)' : 'var(--rs-green)';
      const text = saving ? '保存中…' : dirty ? '未保存' : extStale ? '外部有更新' : '已保存';
      return h('span', { key: kind, className: 'cvr-status ' + kind },
        h('span', { className: 'led', style: { background: ledColor } }),
        text,
      );
    });

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
                  try {
                    const d = await api('/resumes', { method: 'POST', body: JSON.stringify({ type: t.type }) });
                    onCreated(d.item);
                  } catch (e) { flashGlobal('创建失败：' + e.message, ICONS.refresh); }
                },
              },
                h('div', { className: 'row' },
                  h('span', { className: 'cvr-dot', style: { background: t.style?.primaryBGColor || '#4A6FA5' } }),
                  h('span', { style: { fontWeight: 600 } }, t.name),
                ),
                h('div', { className: 'sub' }, t.tags?.slice(0, 6)?.join(' · ')),
              )),
          h('div', { className: 'sub', style: { padding: '6px 10px 6px', borderTop: '1px dashed var(--rs-border-2)', color: 'var(--rs-pencil)' } },
            '更多模板请进「模板中心」标签页浏览'),
        ),
      );
    }

    /* ------------------------------ Template Center ---------------------------- */

    const LazyLocalIframe = React.memo(function LazyLocalIframe({ src, title }) {
      const holderRef = useRef(null);
      const [active, setActive] = useState(false);
      useEffect(() => {
        if (active) return;
        const el = holderRef.current;
        if (!el || typeof IntersectionObserver !== 'function') { setActive(true); return; }
        const io = new IntersectionObserver((entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            setActive(true);
            io.disconnect();
          }
        }, { rootMargin: '180px' });
        io.observe(el);
        return () => io.disconnect();
      }, [active]);
      return h('div', { ref: holderRef, style: { width: '100%', height: '100%' } },
        active
          ? h('iframe', { src, title, scrolling: 'no', loading: 'lazy' })
          : h('div', { style: { width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#7A7062', background: '#FAF5E8' } }, title),
      );
    });



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

      return h('div', { className: 'cvr-tc-wrap' },
        /* 头部大标题 */
        h('div', { className: 'cvr-tc-head' },
          h('div', { className: 'emoji' }, h(Icon, { d: ICONS.layers, size: 20 })),
          h('div', null,
            h('div', { className: 'cvr-tc-title' }, '模板中心', h(PenUnderline, { seed: 'tc-title' })),
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
            `FOLIO · ${(source === 'online' ? (online || []) : (local || [])).filter(matchTags).length} 套`),
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
              : (online.filter(matchTags).length === 0
                ? h('div', { className: 'cvr-empty', style: { gridColumn: '1 / -1' } }, h('div', { className: 'desc' }, '没有匹配的模板，换个关键词试试'))
                : online.filter(matchTags).map((t) => h('div', {
                  key: t.id,
                  className: 'cvr-tpl-card',
                  onClick: () => openDetail('online', t),
                },
                  h('span', { className: 'cvr-codex-inner', 'aria-hidden': true }),
                  h(CornerBrackets),
                  h(WashiTape, { seed: 'tpl-' + t.id, width: 48, height: 14, variant: 'masking', className: 'cvr-tpl-tape' }),
                  h('div', { className: 'cvr-tpl-cover' },
                    h('div', { className: 'cvr-tpl-cover-inner' },
                      h('img', { src: t.cover, alt: t.name, loading: 'lazy', decoding: 'async' }),
                    ),
                    !!t.hot && h(HotStamp, { seed: 'hot-' + t.id, text: 'HOT ' + (t.hot > 10000 ? (t.hot / 10000).toFixed(1) + 'w' : t.hot) }),
                  ),
                  h('div', { className: 'cvr-tpl-name', title: t.name }, t.name),
                  h('div', { className: 'cvr-tpl-tags' }, t.tags?.join(' · ')),
                ))))
            : (local === null
              ? h('div', { className: 'cvr-empty' }, h('div', { className: 'title' }, '加载中…'))
              : local.filter(matchTags).map((t) => h('div', {
                  key: t.type,
                  className: 'cvr-tpl-card',
                  onClick: () => openDetail('local', t),
                },
                  h('span', { className: 'cvr-codex-inner', 'aria-hidden': true }),
                  h(CornerBrackets),
                  h(WashiTape, { seed: 'local-' + t.type, width: 48, height: 14, variant: 'washi', className: 'cvr-tpl-tape' }),
                  h('div', { className: 'cvr-tpl-cover' },
                    h('div', { className: 'cvr-tpl-cover-inner' },
                      h(LazyLocalIframe, { src: `${API}/preview-local-tpl/${t.type}`, title: t.name }),
                    ),
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
                      h('div', { className: 'cvr-modal-pane-label' }, h(Icon, { d: ICONS.doc, size: 12 }), '模板封面预览'),
                      h('div', { className: 'cover-wrap' }, h('img', { className: 'cover-img', src: detail.cover, decoding: 'async' })),
                    ),
                    (detail.html || detail.localSrc) && h('div', null,
                      h('div', { className: 'cvr-modal-pane-label' }, h(Icon, { d: ICONS.fit, size: 12 }), '实时排版预览'),
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
          h('span', { className: 'cvr-codex-inner', 'aria-hidden': true }),
          h(CornerBrackets),
          h('div', { className: 'cvr-modal-head' },
            h('div', null,
              h('div', { className: 'cvr-modal-title' }, title),
              subtitle ? h('div', { className: 'cvr-modal-sub' }, subtitle) : null,
            ),
            h(Btn, { icon: ICONS.close, iconOnly: true, title: '关闭', onClick: onClose }),
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

      const sevColor = { high: 'var(--rs-danger)', medium: 'var(--rs-warn)', low: 'var(--rs-pencil)' };
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
                      h('div', { className: 'cvr-score-stamp', style: { color: report.score >= 80 ? 'var(--rs-green)' : report.score >= 60 ? 'var(--rs-warn)' : 'var(--rs-danger)' } }, String(report.score)),
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
                  h('div', { className: 'cvr-score-stamp', style: { color: match.score >= 70 ? 'var(--rs-green)' : match.score >= 45 ? 'var(--rs-warn)' : 'var(--rs-danger)' } }, match.score + '%'),
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
                  it.id === activeId ? h('span', { style: { color: 'var(--rs-accent)', fontSize: 11, flex: 'none' } }, '●') : h('span', { style: { width: 11, flex: 'none' } }),
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
      const isVisible = props.visible !== false;
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
      const [previewMetrics, setPreviewMetrics] = useState({ height: 1123, pages: 1 });
      const [toast, setToast] = useState(null);
      const [dialog, setDialog] = useState(null); // 'template' | 'sections' | 'checkup'

      const contentRef = useRef('');
      const dirtyRef = useRef(false);
      const activeIdRef = useRef(null);
      const editableRef = useRef(null);
      const fragmentLoadedRef = useRef('');
      const fragReadyRef = useRef(false);
      const fragCacheRef = useRef({ md: null, html: '' });
      const fragReqSeqRef = useRef(0);
      const previewBoxRef = useRef(null);
      const createdSeqRef = useRef(0);
      const pendingRef = useRef(null);
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
        if (!editableRef.current || !fragReadyRef.current) return contentRef.current;
        let md;
        try { md = htmlToMd(editableRef.current); }
        catch { md = contentRef.current; }
        const domHasText = !!(editableRef.current.textContent || '').trim();
        // 安全网：DOM 里有字却转出空串，或未编辑的空 DOM 误覆盖已有正文 → 不覆盖
        if (!md || (!md.trim() && domHasText) || (!md.trim() && !domHasText && !dirtyRef.current && contentRef.current.trim())) {
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
        if (d.rev !== undefined) { setRev(d.rev); revRef.current = d.rev; }
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
        setPreviewMetrics({ height: 1123, pages: 1 });
        setPreviewKey((k) => k + 1);
        contentRef.current = d.content;
        lastContentRef.current = d.content;
        fragReadyRef.current = false;
        fragCacheRef.current = { md: null, html: '' };
        fragmentLoadedRef.current = '';
        setFragSeq((s) => s + 1);
        clearHistory(d.content);
      }, []);

      /* 统一保存调度：编辑瞬间锁定 {id, content}，防止切换简历时串写 */
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

      useEffect(() => { loadList(true); }, [loadList]);
      useEffect(() => { if (activeId && activeId !== 'none') loadResume(activeId); }, [activeId, loadResume]);

      /* 从模板中心创建新简历切回时，立即刷新列表并选中新简历 */
      useEffect(() => {
        const req = props.createdResumeReq;
        if (!req || !req.seq || req.seq === createdSeqRef.current) return;
        createdSeqRef.current = req.seq;
        (async () => {
          await flushSave().catch(() => {});
          await loadList(false);
          if (req.id) setActiveId(req.id);
        })();
      }, [props.createdResumeReq, loadList, flushSave]);

      /* Tab 重新切回可见时，校对缩放与外部 rev，防止隐藏态尺寸滞后 */
      useEffect(() => {
        if (!isVisible) return;
        const raf = requestAnimationFrame(() => {
          const box = previewBoxRef.current;
          if (box) {
            const w = box.clientWidth;
            if (w > 100 && w < 794 * zoom + 36) {
              const fit = Math.max(0.4, Math.min(1, +((w - 44) / 794).toFixed(2)));
              if (fit < zoom) setZoom(fit);
            }
          }
          const fr = previewFrameRef.current;
          if (fr && fr.contentWindow && activeIdRef.current && activeIdRef.current !== 'none') {
            fr.contentWindow.postMessage({ type: 'cvr-recalc' }, '*');
          }
        });
        api('/rev').then(async (d) => {
          if (d && d.rev !== revRef.current && !dirtyRef.current) {
            setRev(d.rev); revRef.current = d.rev;
            const list = await api('/resumes');
            setItems(list.items);
            const cur = activeIdRef.current;
            if (cur && cur !== 'none' && list.items.some((i) => i.id === cur)) {
              loadResume(cur);
            }
          }
        }).catch(() => {});
        return () => cancelAnimationFrame(raf);
      }, [isVisible]);

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
                  fragCacheRef.current = { md: null, html: '' };
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

      // 切到富文本：直接基于内存最新 content 生成片段（零网络阻塞等待落盘 + 命中缓存秒切）
      useEffect(() => {
        if (mode !== 'wysiwyg' || !activeId || activeId === 'none') return;
        const rid = activeId;
        const seq = fragSeq;
        const loadKey = rid + ':' + seq;
        if (fragmentLoadedRef.current === loadKey) return;
        fragReadyRef.current = false;
        const mdSrc = contentRef.current || '';
        const applyHtml = (html) => {
          fragmentLoadedRef.current = loadKey;
          if (editableRef.current) {
            editableRef.current.innerHTML = html;
            fragReadyRef.current = true;
            clearHistory(html);
          }
          setFragLoading(false);
        };
        if (fragCacheRef.current.md === mdSrc && fragCacheRef.current.html) {
          applyHtml(fragCacheRef.current.html);
          return;
        }
        const reqId = ++fragReqSeqRef.current;
        setFragLoading(true);
        api('/fragment', { method: 'POST', body: JSON.stringify({ content: mdSrc }) }).catch((e) => (String(e?.message || '').includes('no route') ? api('/resume/' + rid + '/fragment') : Promise.reject(e))).then((d) => {
          if (reqId !== fragReqSeqRef.current || activeIdRef.current !== rid || modeRef.current !== 'wysiwyg') return;
          fragCacheRef.current = { md: mdSrc, html: d.html };
          applyHtml(d.html);
        }).catch(() => {
          if (reqId !== fragReqSeqRef.current) return;
          setFragLoading(false);
          setTimeout(() => { if (modeRef.current === 'wysiwyg') setFragSeq((s) => s + 1); }, 1200);
        });
      }, [mode, activeId, fragSeq]);

      const switchMode = (next) => {
        if (next === mode) return;
        clearTimeout(saveTimerRef.current);
        clearTimeout(pushTimerRef.current);
        clearTimeout(syncTimerRef.current);

        const md = currentMd();
        contentRef.current = md;
        if (mode === 'wysiwyg') {
          if (fragReadyRef.current && editableRef.current) {
            fragCacheRef.current = { md, html: editableRef.current.innerHTML };
          }
          setContent(md);
        }
        clearHistory(md);

        const hadPending = dirtyRef.current;
        if (hadPending) {
          pendingRef.current = { id: activeIdRef.current, content: md };
          flushSave();
        }

        if (next === 'wysiwyg') {
          fragReadyRef.current = false;
          fragmentLoadedRef.current = '';
          setFragSeq((s) => s + 1);
          pushLivePreview(md);
        }
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
          await ensureSaved();
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
          await ensureSaved();
          const up = await api('/resume/' + activeId + '/avatar', { method: 'POST', body: JSON.stringify({ imageDataUrl: dataUrl }) });
          const fresh = await api('/resume/' + activeId);
          const nextRev = fresh.rev !== undefined ? fresh.rev : up.rev;
          if (nextRev !== undefined) { setRev(nextRev); revRef.current = nextRev; }
          setMeta(fresh.item);
          bumpPreview();
          flash('头像已设置，可在预览里拖拽调整位置');
        } catch (e) { flash('头像上传失败：' + e.message, ICONS.refresh); }
      };

      /* 预览里拖拽头像/校徽 → postMessage → 保存坐标 */
      useEffect(() => {
        const onMessage = (e) => {
          const data = e.data;
          if (!data) return;
          if (data.type === 'cvr-preview-metrics') {
            const fr = previewFrameRef.current;
            if (fr && fr.contentWindow && e.source === fr.contentWindow) {
              const hNext = Math.max(1123, Number(data.height) || 1123);
              const pNext = Math.max(1, Number(data.pages) || 1);
              setPreviewMetrics((prev) => (prev.height === hNext && prev.pages === pNext ? prev : { height: hNext, pages: pNext }));
            }
            return;
          }
          if (activeIdRef.current === null || activeIdRef.current === 'none') return;
          if (data.type === 'cvr-avatar-move') {
            api('/resume/' + activeIdRef.current + '/avatar', {
              method: 'PATCH',
              body: JSON.stringify({ top: data.top, left: data.left }),
            }).then((d) => { if (d && d.rev !== undefined) { setRev(d.rev); revRef.current = d.rev; } }).catch(() => {});
          } else if (data.type === 'cvr-logo-move') {
            api('/resume/' + activeIdRef.current + '/logo', {
              method: 'PATCH',
              body: JSON.stringify({ top: data.top, left: data.left }),
            }).then((d) => { if (d && d.rev !== undefined) { setRev(d.rev); revRef.current = d.rev; } }).catch(() => {});
          }
        };
        window.addEventListener('message', onMessage);
        return () => window.removeEventListener('message', onMessage);
      }, []);

      /* 导入简历：支持 .md / .txt / .json / .html / .htm（服务端自动提取样式与安全清洗） */
      const importInputRef = useRef(null);
      const onImportFile = async (file) => {
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) { flash('文件请小于 2MB', ICONS.refresh); return; }
        let text = '';
        try { text = await file.text(); } catch { flash('读取文件失败', ICONS.refresh); return; }
        let jsonStyle = null;
        let jsonName = '';
        try {
          const j = JSON.parse(text);
          if (j && typeof j.content === 'string') {
            text = j.content;
            if (j.style && typeof j.style === 'object') jsonStyle = j.style;
            if (typeof j.name === 'string') jsonName = j.name;
          }
        } catch { /* 非 JSON 按 MD/TXT/HTML 原文送服务端解析 */ }
        if (!text.trim()) { flash('文件内容为空', ICONS.refresh); return; }
        try {
          await flushSave().catch(() => {});
          const name = (jsonName || String(file.name || '导入的简历').replace(/\.[^.]+$/, '')).slice(0, 60);
          const d = await api('/import', {
            method: 'POST',
            body: JSON.stringify({ name, content: text, filename: file.name, ...(jsonStyle ? { style: jsonStyle } : {}) }),
          });
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
          await ensureSaved();
          const up = await api('/resume/' + activeId + '/logo', { method: 'POST', body: JSON.stringify({ imageDataUrl: dataUrl }) });
          const fresh = await api('/resume/' + activeId);
          const nextRev = fresh.rev !== undefined ? fresh.rev : up.rev;
          if (nextRev !== undefined) { setRev(nextRev); revRef.current = nextRev; }
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
          await ensureSaved();
          const d = await api('/resume/' + activeId, { method: 'PUT', body: JSON.stringify({ autoOnePage: next }) });
          if (d && d.rev !== undefined) { setRev(d.rev); revRef.current = d.rev; }
          setMeta((m) => ({ ...m, autoOnePage: next }));
          setPreviewMetrics({ height: 1123, pages: 1 });
          bumpPreview(0);
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
      const previewPageH = (meta && meta.autoOnePage) ? 1123 : Math.max(1123, previewMetrics.height);

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
            h(Btn, { icon: ICONS.fit, label: '智能一页', onClick: toggleAutoPage, disabled: noResume, active: !!(meta && meta.autoOnePage), brass: true, title: '内容超页自动缩放至恰好一页' }),
          ),
          h('div', { className: 'cvr-sep' }),
          /* 新增：换模板 / 模块顺序 / 体检 / 导入 */
          h('div', { className: 'cvr-cluster' },
            h(Btn, { icon: ICONS.swap, label: '换模板', onClick: () => setDialog('template'), disabled: noResume, tintViolet: true, title: '只换版式配色，正文不动' }),
            h(Btn, { icon: ICONS.layers, label: '模块', onClick: () => setDialog('sections'), disabled: noResume, tintBlue: true, title: '调整模块顺序 / 删除模块' }),
            h(Btn, { icon: ICONS.target, label: '体检', onClick: async () => { if (dirtyRef.current || pendingRef.current) await ensureSaved().catch(() => {}); setDialog('checkup'); }, disabled: noResume, tintYellow: true, title: '本地体检 + JD 匹配' }),
            h(Btn, { icon: ICONS.upload, label: '导入', onClick: () => importInputRef.current?.click(), title: '导入 .md / .txt / .html / .json 为新简历' }),
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
            ref: importInputRef, type: 'file', accept: '.md,.markdown,.txt,.json,.html,.htm,text/plain,text/markdown,text/html,application/json',
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
                  h('div', { className: 'cvr-empty-card' },
                    h(WashiTape, { seed: 'empty-card', width: 64, height: 18, variant: 'masking', style: { position: 'absolute', top: -9, left: '50%', transform: 'translateX(-50%) rotate(-2deg)' } }),
                    h(InkFrame, { seed: 'empty-card-frame', radius: 12, wobble: 0.45, doubleLine: true }),
                    h('div', { className: 'ring' }, h(Icon, { d: ICONS.resume, size: 28 })),
                    h('div', { className: 'title' }, '还没有简历'),
                    h('div', { className: 'desc' }, '点上方「＋新建」从模板创建一份，\n或直接在对话里让 Agent 帮你写一份。'),
                  ),
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
                      style: { display: fragLoading ? 'none' : undefined, '--cvr-acc': (meta && meta.style && meta.style.primaryBGColor) || '#c2412d' },
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
              h('span', { className: 'cvr-preview-head-title' }, 'A4 实时预览'),
              !noResume && (meta && meta.autoOnePage
                ? h('span', { className: 'cvr-count-chip', style: { padding: '1px 7px', fontSize: 10.5 } }, '智能一页')
                : (previewMetrics.pages > 1 && h('span', { className: 'cvr-count-chip', style: { padding: '1px 7px', fontSize: 10.5 } }, `共 ${previewMetrics.pages} 页`))),
              h('div', { className: 'cvr-zoom-cluster' },
                h(Btn, { icon: ICONS.zoomOut, iconOnly: true, onClick: () => setZoom((z) => Math.max(0.4, +(z - 0.1).toFixed(2))), title: '缩小' }),
                h('span', { className: 'cvr-zoom-label' }, Math.round(zoom * 100) + '%'),
                h(Btn, { icon: ICONS.zoomIn, iconOnly: true, onClick: () => setZoom((z) => Math.min(1.2, +(z + 0.1).toFixed(2))), title: '放大' }),
                h(Btn, { icon: ICONS.refresh, iconOnly: true, onClick: () => setPreviewKey((k) => k + 1), title: '刷新预览' }),
              ),
            ),
            h('div', { className: 'cvr-preview-scroll', ref: previewBoxRef },
              !noResume
                ? h('div', {
                    className: 'cvr-a4-stage',
                    style: {
                      width: Math.round(794 * previewScale) + 2,
                      height: Math.round(previewPageH * previewScale) + 2,
                    },
                  },
                    h('span', { className: 'cvr-a4-mount tl', 'aria-hidden': true }),
                    h('span', { className: 'cvr-a4-mount tr', 'aria-hidden': true }),
                    h(BrassClip),
                    h('div', { className: 'cvr-a4-clip-box' },
                      h('iframe', {
                        ref: previewFrameRef,
                        key: previewKey,
                        className: 'cvr-frame',
                        onLoad: () => { if (dirtyRef.current || pendingRef.current) pushLivePreview(currentMd()); },
                        src: `${API}/preview/${activeId}?v=${previewKey}`,
                        title: '简历预览',
                        style: {
                          width: 794, height: previewPageH,
                          transform: `scale(${previewScale})`, transformOrigin: 'top left',
                        },
                      }),
                    ),
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

    let ReactDOMCache = undefined;
    function getReactDOM() {
      if (ReactDOMCache !== undefined) return ReactDOMCache;
      try { ReactDOMCache = require('react-dom'); } catch { ReactDOMCache = null; }
      return ReactDOMCache;
    }

    let gsapBootPromise = null;
    let gsapEasesReady = false;
    function loadScriptOnce(src) {
      return new Promise((resolve, reject) => {
        if (typeof document === 'undefined' || !document.head) return resolve(false);
        const existing = document.querySelector(`script[data-cvr-gsap="${src}"]`);
        if (existing) {
          if (existing.dataset.loaded === '1') return resolve(true);
          existing.addEventListener('load', () => resolve(true), { once: true });
          existing.addEventListener('error', () => resolve(false), { once: true });
          return;
        }
        const el = document.createElement('script');
        el.src = src;
        el.async = false;
        el.dataset.cvrGsap = src;
        el.addEventListener('load', () => { el.dataset.loaded = '1'; resolve(true); }, { once: true });
        el.addEventListener('error', () => resolve(false), { once: true });
        document.head.appendChild(el);
      });
    }

    function initGsapPlugins(g) {
      if (!g || gsapEasesReady) return g;
      try {
        const plugins = [window.CustomEase, window.ScrambleTextPlugin, window.DrawSVGPlugin].filter(Boolean);
        if (plugins.length && typeof g.registerPlugin === 'function') g.registerPlugin(...plugins);
        if (window.CustomEase && typeof window.CustomEase.create === 'function') {
          window.CustomEase.create('atelierExpo', 'M0,0 C0.16,1 0.3,1 1,1');
          window.CustomEase.create('atelierSnap', 'M0,0 C0.2,0.9 0.3,1.08 1,1');
        }
        gsapEasesReady = true;
      } catch { /* fallback to built-in eases */ }
      return g;
    }

    function ensureGsap() {
      if (typeof window === 'undefined') return Promise.resolve(null);
      if (window.gsap) return Promise.resolve(initGsapPlugins(window.gsap));
      if (gsapBootPromise) return gsapBootPromise;
      gsapBootPromise = (async () => {
        const base = API + '/vendor/gsap/';
        const ok = await loadScriptOnce(base + 'gsap.min.js');
        if (!ok || !window.gsap) return null;
        await Promise.all([
          loadScriptOnce(base + 'CustomEase.min.js'),
          loadScriptOnce(base + 'ScrambleTextPlugin.min.js'),
          loadScriptOnce(base + 'DrawSVGPlugin.min.js'),
        ]);
        return initGsapPlugins(window.gsap);
      })();
      return gsapBootPromise;
    }

    function extractPartialJsonFields(raw) {
      const out = {};
      if (typeof raw !== 'string' || !raw) return out;
      const grab = (key) => {
        const re = new RegExp('"' + key + '"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)');
        const m = raw.match(re);
        if (!m) return undefined;
        try { return JSON.parse('"' + m[1] + '"'); } catch { return m[1].replace(/\\n/g, '\n').replace(/\\"/g, '"'); }
      };
      for (const k of ['id', 'resumeId', 'name', 'type', 'baseType', 'onlineType', 'section', 'direction', 'content', 'text']) {
        const v = grab(k);
        if (v !== undefined) out[k] = v;
      }
      return out;
    }

    function readToolArgs(block) {
      const raw = block?.args;
      if (raw && typeof raw === 'object' && typeof raw.text === 'function') {
        const str = (k) => { try { return raw.text(k); } catch { return undefined; } };
        const val = (k) => { try { return typeof raw.value === 'function' ? raw.value(k) : undefined; } catch { return undefined; } };
        const done = (k) => { try { return typeof raw.complete === 'function' ? !!raw.complete(k) : true; } catch { return false; } };
        const len = (k) => { try { return typeof raw.stringLength === 'function' ? raw.stringLength(k, { step: 8 }) : undefined; } catch { return undefined; } };
        const content = str('content'), text = str('text');
        return {
          id: str('id') || str('resumeId'), name: str('name'), type: str('type') || str('baseType'),
          onlineType: str('onlineType'), section: str('section'), direction: str('direction'),
          content, text, style: val('style'),
          contentLen: len('content') ?? (typeof content === 'string' ? content.length : undefined),
          textLen: len('text') ?? (typeof text === 'string' ? text.length : undefined),
          _contentComplete: done('content'), _textComplete: done('text'),
          _closed: typeof raw.closed === 'function' ? raw.closed() : true,
        };
      }
      const fallback = raw ?? block?.input ?? block?.arguments ?? block?.call?.argsRaw ?? block?.argsRaw;
      if (typeof fallback === 'string') {
        try { return JSON.parse(fallback); } catch { return extractPartialJsonFields(fallback); }
      }
      return fallback || {};
    }

    function readToolResult(block, props) {
      const raw = block?.result?.value ?? props?.result?.value ?? block?.value ?? block?.result?.content?.[0]?.text ?? block?.content?.[0]?.text;
      if (!raw) return null;
      if (typeof raw === 'string') { try { return JSON.parse(raw); } catch { return null; } }
      return typeof raw === 'object' ? raw : null;
    }

    function cleanDslLabel(v) {
      return String(v ?? '')
        .replace(/!bg\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/!c\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/icon:[a-zA-Z0-9_-]+\s*/g, '')
        .replace(/[*_`~]+/g, '')
        .trim();
    }

    function resolveAtelierAccent(hex) {
      const m = String(hex || '').trim().match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
      if (m) {
        let h6 = m[1];
        if (h6.length === 3) h6 = h6[0] + h6[0] + h6[1] + h6[1] + h6[2] + h6[2];
        const r = parseInt(h6.slice(0, 2), 16), g = parseInt(h6.slice(2, 4), 16), b = parseInt(h6.slice(4, 6), 16);
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        const sat = max === 0 ? 0 : (max - min) / max;
        const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        if (sat > 0.2 && lum > 0.16 && lum < 0.85) {
          return { accent: '#' + h6, soft: `rgba(${r},${g},${b},0.16)`, glow: `rgba(${r},${g},${b},0.32)` };
        }
      }
      return { accent: '#A63A2E', soft: 'rgba(166,58,46,0.14)', glow: 'rgba(166,58,46,0.22)' };
    }

    function analyzeDslStream(text, isComplete) {
      const raw = String(text ?? '');
      const lines = raw.split(/\r?\n/);
      const sections = [];
      let docTitle = '', inFence = false;
      const nonEmpty = [];
      for (const line of lines) {
        const t = line.trim();
        if (/^:::\s*start$/i.test(t)) { inFence = true; continue; }
        if (/^:::\s*end$/i.test(t)) { inFence = false; continue; }
        if (!t || /^:::$/.test(t)) continue;
        nonEmpty.push(cleanDslLabel(t));
        if (!inFence) {
          if (!docTitle && /^#{1,3}\s+/.test(t) && !/^##\s+/.test(t)) {
            docTitle = cleanDslLabel(t.replace(/^#{1,3}\s+/, ''));
          } else if (/^##\s+/.test(t)) {
            const title = cleanDslLabel(t.replace(/^##\s+/, ''));
            if (title) sections.push(title);
          }
        }
      }
      const charCount = raw.replace(/\s+/g, '').length;
      const metrics = raw.match(/\d+(?:\.\d+)?(?:%|ms|s|k|w|万|亿|倍|x|X|\+|次|家|人|年|个月)/g) || [];
      return {
        docTitle, sections, charCount, metricCount: metrics.length,
        tailLines: nonEmpty.slice(-2),
        activeSection: !isComplete && sections.length ? sections[sections.length - 1] : '',
      };
    }

    function renderMiniInlineNodes(raw) {
      const parts = String(raw ?? '').split(/(`[^`]+`)/g);
      if (parts.length <= 1) return cleanDslLabel(raw);
      return parts.map((p, idx) => (p.startsWith('`') && p.endsWith('`') && p.length > 2)
        ? h('span', { key: idx, className: 'cvr-mp-chip' }, p.slice(1, -1))
        : cleanDslLabel(p));
    }

    function buildMiniPaperContent(mdText, opts = {}) {
      const lines = String(mdText ?? '').split(/\r?\n/);
      const nodes = [];
      let i = 0, firstHeading = true;
      if (opts.sectionBanner) nodes.push(h('div', { key: 'sec-head', className: 'cvr-mp-h2' }, opts.sectionBanner));
      while (i < lines.length && nodes.length < 60) {
        const t = lines[i].trim();
        if (!t) { i++; continue; }
        if (/^:::\s*start$/i.test(t)) {
          const cols = []; let cur = []; i++;
          while (i < lines.length && !/^:::\s*end$/i.test(lines[i].trim())) {
            const ct = lines[i].trim();
            if (/^:::$/.test(ct)) { if (cur.length) cols.push(cur.join(' ')); cur = []; }
            else if (ct) cur.push(cleanDslLabel(ct));
            i++;
          }
          if (cur.length) cols.push(cleanDslLabel(cur.join(' ')));
          if (cols.length) nodes.push(h('div', { key: 'r-' + i, className: 'cvr-mp-row' }, cols.slice(0, 4).map((c, ci) => h('span', { key: ci }, c))));
          i++; continue;
        }
        const hm = t.match(/^(#{1,4})\s+(.*)$/);
        if (hm) {
          const lvl = hm[1].length;
          const bgMatch = hm[2].match(/!bg\[([^\]]*)\]\((#[0-9a-fA-F]{3,8})\)/);
          const clean = cleanDslLabel(hm[2]);
          if (lvl === 1 || (firstHeading && lvl !== 2)) {
            firstHeading = false;
            nodes.push(h('div', { key: 'h1-' + i, className: 'cvr-mp-h1' + (bgMatch ? ' band' : ''), style: bgMatch ? { background: bgMatch[2] } : undefined }, clean || '简历标题'));
          } else if (lvl === 2) {
            firstHeading = false;
            nodes.push(h('div', { key: 'h2-' + i, className: 'cvr-mp-h2' }, clean));
          } else {
            nodes.push(h('div', { key: 'h3-' + i, className: 'cvr-mp-p', style: { fontWeight: 700 } }, clean));
          }
          i++; continue;
        }
        if (/^[-*]\s+/.test(t) || /^\d+[.、]\s+/.test(t)) {
          nodes.push(h('div', { key: 'li-' + i, className: 'cvr-mp-li' }, renderMiniInlineNodes(t.replace(/^([-*]|\d+[.、])\s+/, ''))));
          i++; continue;
        }
        nodes.push(h('div', { key: 'p-' + i, className: 'cvr-mp-p' }, renderMiniInlineNodes(t)));
        i++;
      }
      if (nodes.length === 0) {
        return h('div', { className: 'cvr-mini-paper', ref: opts.paperRef },
          h('div', { className: 'cvr-mp-skel head' }),
          h('div', { className: 'cvr-mp-skel', style: { width: '86%' } }),
          h('div', { className: 'cvr-mp-skel sub' }),
          h('div', { className: 'cvr-mp-skel', style: { width: '92%' } }),
          h('div', { className: 'cvr-mp-skel', style: { width: '78%' } }),
          h('div', { className: 'cvr-mp-skel sub' }),
          h('div', { className: 'cvr-mp-skel', style: { width: '88%' } }),
          h('div', { className: 'cvr-mp-skel', style: { width: '70%' } }),
        );
      }
      return h('div', { className: 'cvr-mini-paper', ref: opts.paperRef },
        nodes,
        opts.live && h('span', { className: 'cvr-mp-cursor' }),
        opts.live && nodes.length < 18 && h('div', { className: 'cvr-mp-skel', style: { width: '72%', marginTop: 4 } }),
        opts.live && nodes.length < 16 && h('div', { className: 'cvr-mp-skel', style: { width: '54%' } }),
      );
    }

    const toolMetaCache = new Map();

    function ResumeQuickPreviewModal({ id, title, ver, sections, onClose, onOpenWorkbench, onExport, busyFmt, exportNote }) {
      const [zoom, setZoom] = useState(0.84);
      const [metrics, setMetrics] = useState({ height: 1123, pages: 1 });
      const maskRef = useRef(null);
      const boxRef = useRef(null);
      const frameWrapRef = useRef(null);
      const iframeRef = useRef(null);

      useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
      }, [onClose]);

      useEffect(() => {
        setMetrics({ height: 1123, pages: 1 });
        const onMsg = (e) => {
          const d = e.data;
          if (!d || d.type !== 'cvr-preview-metrics') return;
          const fr = iframeRef.current;
          if (fr && fr.contentWindow && e.source === fr.contentWindow) {
            const hNext = Math.max(1123, Number(d.height) || 1123);
            const pNext = Math.max(1, Number(d.pages) || 1);
            setMetrics((prev) => (prev.height === hNext && prev.pages === pNext ? prev : { height: hNext, pages: pNext }));
          }
        };
        window.addEventListener('message', onMsg);
        return () => window.removeEventListener('message', onMsg);
      }, [id]);

      useEffect(() => {
        let dead = false, mm = null;
        ensureGsap().then((g) => {
          if (dead || !g || !boxRef.current) return;
          mm = g.matchMedia();
          mm.add({ all: 'all', reduce: '(prefers-reduced-motion: reduce)' }, (mc) => {
            const d = mc.conditions.reduce ? 0 : 1;
            if (maskRef.current) {
              g.fromTo(maskRef.current, { opacity: 0 }, { opacity: 1, duration: 0.22 * d, ease: 'power2.out', clearProps: 'opacity' });
            }
            g.fromTo(boxRef.current,
              { y: 8, opacity: 0.2 },
              { y: 0, opacity: 1, duration: 0.28 * d, ease: 'power3.out', clearProps: 'opacity,transform' });
          }, boxRef);
        });
        return () => { dead = true; try { mm && mm.revert(); } catch {} };
      }, [id]);

      useEffect(() => {
        const g = typeof window !== 'undefined' ? window.gsap : null;
        if (!g || !iframeRef.current) return;
        g.to(iframeRef.current, { scale: zoom, duration: 0.28, ease: 'power3.out' });
      }, [zoom]);

      const frameW = Math.round(794 * zoom), frameH = Math.round(metrics.height * zoom);
      const modalEl = h('div', { className: 'cvr-lightbox-mask', ref: maskRef, onClick: onClose },
        h('div', { className: 'cvr-lightbox', ref: boxRef, onClick: (e) => e.stopPropagation() },
          h('div', { className: 'cvr-lightbox-head' },
            h('div', { style: { display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 } },
              h('span', { className: 'cvr-atelier-icon' }, h(Icon, { d: ICONS.resume, size: 15 })),
              h('span', { className: 'cvr-modal-title', style: { fontWeight: 800, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, title),
              h('code', { className: 'cvr-toolcard-id' }, id),
              metrics.pages > 1 && h('span', { className: 'cvr-count-chip', style: { padding: '1px 7px', fontSize: 10.5 } }, `共 ${metrics.pages} 页`),
            ),
            h('div', { style: { display: 'flex', alignItems: 'center', gap: 6, flex: 'none' } },
              [0.72, 0.84, 1].map((z) => h(Btn, { key: z, label: Math.round(z * 100) + '%', active: zoom === z, onClick: () => setZoom(z) })),
              h(Btn, { icon: ICONS.close, iconOnly: true, title: '关闭', onClick: onClose }),
            ),
          ),
          h('div', { className: 'cvr-lightbox-body' },
            h('div', { ref: frameWrapRef, className: 'cvr-a4-stage', style: { width: frameW, height: frameH, flex: 'none' } },
              h('span', { className: 'cvr-a4-mount tl', 'aria-hidden': true }),
              h('span', { className: 'cvr-a4-mount tr', 'aria-hidden': true }),
              h(BrassClip),
              h('div', { className: 'cvr-a4-clip-box' },
                h('iframe', {
                  ref: iframeRef,
                  src: `${API}/preview/${id}?print=1${ver ? '&v=' + ver : ''}`,
                  title: 'A4 高清阅览',
                  style: { width: 794, height: metrics.height, border: 'none', display: 'block', transform: `scale(${zoom})`, transformOrigin: 'top left' },
                }),
              ),
            ),
          ),
          h('div', { className: 'cvr-lightbox-foot' },
            h('div', { style: { display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' } },
              (sections || []).slice(0, 6).map((sec, idx) => h('span', { key: idx, className: 'cvr-sec-pill done' }, sec)),
              exportNote && h('span', { className: 'cvr-atelier-highlight' }, exportNote),
            ),
            h('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
              h('div', { className: 'cvr-export-seg' },
                h('button', { disabled: !!busyFmt, onClick: () => onExport('pdf') }, busyFmt === 'pdf' ? '生成中…' : 'PDF'),
                h('button', { disabled: !!busyFmt, onClick: () => onExport('png') }, busyFmt === 'png' ? '生成中…' : 'PNG'),
                h('button', { disabled: !!busyFmt, onClick: () => onExport('md') }, busyFmt === 'md' ? '导出中…' : 'MD'),
              ),
              h(Btn, { icon: ICONS.open, label: '在工作台精修', primary: true, onClick: () => { onClose(); onOpenWorkbench(); } }),
            ),
          ),
        ),
      );
      const RDOM = getReactDOM();
      if (RDOM && typeof RDOM.createPortal === 'function' && typeof document !== 'undefined' && document.body) {
        return RDOM.createPortal(modalEl, document.body);
      }
      return modalEl;
    }

    function SealCheckSvg({ live }) {
      if (live) return h('span', { className: 'cvr-live-dot' });
      return h('svg', { className: 'cvr-seal-svg', viewBox: '0 0 16 16', fill: 'none' },
        h('circle', { className: 'cvr-seal-ring', cx: 8, cy: 8, r: 6.2, stroke: 'currentColor', strokeWidth: 1.5, strokeOpacity: 0.7 }),
        h('path', { className: 'cvr-seal-check', d: 'M5.2 8.2l2 2 3.8-4', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' }),
      );
    }

    function ResumeToolView(props) {
      const block = props?.block || {};
      const args = readToolArgs(block);
      const resObj = readToolResult(block, props);
      const phase = props?.phase || 'result';
      const settled = !props?.phase || phase === 'result';
      const id = (props.toolName === 'resume_duplicate' ? resObj?.id : undefined)
        || args?.id || args?.resumeId || resObj?.id || resObj?.item?.id;

      const [previewOpen, setPreviewOpen] = useState(false);
      const [busyFmt, setBusyFmt] = useState('');
      const [exportNote, setExportNote] = useState('');
      const [hydrated, setHydrated] = useState(null);
      const [elapsed, setElapsed] = useState(0);
      const liveStartRef = useRef(0);
      const miniPaperRef = useRef(null);
      const cardRef = useRef(null);
      const thumbRef = useRef(null);
      const charNumRef = useRef(null);
      const metricNumRef = useRef(null);
      const seenSecsRef = useRef(0);
      const countedRef = useRef(false);
      const playedSettledRef = useRef('');

      const ver = encodeURIComponent(String(resObj?.updatedAt || resObj?.rev || ''));
      const cacheKey = id ? `${id}:${ver}` : '';

      useEffect(() => {
        if (!settled) {
          if (!liveStartRef.current) liveStartRef.current = Date.now();
          const timer = setInterval(() => setElapsed((Date.now() - liveStartRef.current) / 1000), 200);
          return () => clearInterval(timer);
        }
      }, [settled]);

      useEffect(() => {
        if (!settled || block?.isError || !id) return;
        const hasInline = Array.isArray(resObj?.sections) && (resObj?.style || resObj?.item?.style);
        if (hasInline) return;
        const cached = toolMetaCache.get(cacheKey);
        if (cached) { setHydrated(cached); return; }
        let dead = false;
        api('/resume/' + id).then((d) => {
          if (dead || !d) return;
          const info = analyzeDslStream(d.content || '', true);
          const payload = { name: d.item?.name, style: d.item?.style, sections: info.sections, charCount: info.charCount, metricCount: info.metricCount };
          toolMetaCache.set(cacheKey, payload);
          setHydrated(payload);
        }).catch(() => {});
        return () => { dead = true; };
      }, [settled, block?.isError, id, cacheKey]);

      const streamMd = typeof args?.content === 'string' ? args.content : (typeof args?.text === 'string' ? args.text : '');
      useEffect(() => {
        if (!settled && miniPaperRef.current) {
          miniPaperRef.current.scrollTop = miniPaperRef.current.scrollHeight;
        }
      }, [settled, streamMd]);

      const streamInfo = useMemo(() => analyzeDslStream(streamMd, settled), [streamMd, settled]);
      const activeStyle = resObj?.style || resObj?.item?.style || hydrated?.style || args?.style;
      const aura = resolveAtelierAccent(activeStyle?.primaryBGColor);
      const cardStyle = { '--sp-accent': aura.accent, '--sp-soft': aura.soft };

      const badgeMap = {
        resume_new: '已创建', resume_import: '已导入', resume_duplicate: '已复制',
        resume_set_template: '模板已切换', resume_apply_edit: '模块已精修',
        resume_move_section: '模块已调序', resume_set_style: '样式已更新', resume_write: '已保存',
      };
      const liveVerbMap = {
        resume_new: '正在装配模板', resume_import: '正在导入排版', resume_duplicate: '正在复制副本',
        resume_set_template: '正在切换配色',
        resume_apply_edit: '实时精修中',
        resume_move_section: '调整模块顺序', resume_set_style: '调整主题样式', resume_write: '实时撰写排版',
      };

      const badge = badgeMap[props.toolName] || '已更新';
      const liveTitle = args?.name
        || streamInfo.docTitle
        || (args?.section ? `精修「${cleanDslLabel(args.section)}」` : '')
        || (args?.type ? `模板：${args.type}` : (args?.onlineType ? `在线模板 #${args.onlineType}` : ''))
        || (id ? `简历 ${id}` : '正在处理简历');
      const settledTitle = args?.name || resObj?.name || resObj?.item?.name || hydrated?.name || streamInfo.docTitle || badge;
      const sections = resObj?.sections || hydrated?.sections || streamInfo.sections;
      const charCount = resObj?.charCount ?? hydrated?.charCount ?? streamInfo.charCount;
      const metricCount = resObj?.metricCount ?? hydrated?.metricCount ?? streamInfo.metricCount;
      const editedSection = cleanDslLabel(resObj?.section || args?.section || '');

      /* ---------- GSAP 编排：过程态激光循环 + 成稿态电影落盘 + quickTo 3D 磁吸 ---------- */
      useEffect(() => {
        if (block?.isError) return;
        if (settled && id) {
          seenSecsRef.current = (sections || []).length;
        }
        let dead = false, mm = null;
        ensureGsap().then((g) => {
          if (dead || !g || !cardRef.current) return;
          mm = g.matchMedia();
          mm.add({ all: 'all', reduce: '(prefers-reduced-motion: reduce)' }, (mc) => {
            const noMotion = mc.conditions.reduce;
            const el = cardRef.current;

            if (!settled) {
              if (noMotion) return;
              g.fromTo(el, { y: 6, opacity: 0.4 }, { y: 0, opacity: 1, duration: 0.32, ease: 'power2.out', clearProps: 'opacity,transform' });
              const sweep = el.querySelector('.cvr-draft-sweep');
              if (sweep) g.fromTo(sweep, { scaleX: 0.2, xPercent: -40 }, { scaleX: 1, xPercent: 40, duration: 1.4, repeat: -1, yoyo: true, ease: 'sine.inOut' });
              const dot = el.querySelector('.cvr-live-dot');
              if (dot) g.to(dot, { scale: 1.35, opacity: 0.45, duration: 0.65, repeat: -1, yoyo: true, ease: 'sine.inOut' });
              const curs = el.querySelectorAll('.cvr-mp-cursor, .cvr-live-ticker-cursor');
              if (curs.length) g.to(curs, { opacity: 0.1, duration: 0.42, repeat: -1, yoyo: true, ease: 'steps(2)' });
              return;
            }

            if (!id) return;
            const runKey = `${id}:${ver}:${props.toolName}`;
            if (playedSettledRef.current !== runKey && !noMotion) {
              playedSettledRef.current = runKey;
              const tl = g.timeline({ defaults: { ease: 'atelierExpo' } });
              tl.fromTo(el,
                { y: 8, opacity: 0.3 },
                { y: 0, opacity: 1, duration: 0.42, clearProps: 'opacity,transform' }, 0);
              if (thumbRef.current) {
                tl.fromTo(thumbRef.current,
                  { y: 5, opacity: 0.45 },
                  { y: 0, opacity: 1, duration: 0.30, ease: 'power3.out', clearProps: 'opacity,transform' }, 0.04);
              }
              const sealRing = el.querySelector('.cvr-seal-ring');
              const sealChk = el.querySelector('.cvr-seal-check');
              if (sealRing && sealChk) {
                tl.fromTo([sealRing, sealChk], { drawSVG: '0%' }, { drawSVG: '100%', duration: 0.46, stagger: 0.12, ease: 'power2.out' }, 0.14);
              }
              const pills = el.querySelectorAll('.cvr-sec-pill');
              if (pills.length) {
                tl.fromTo(pills,
                  { y: 4, opacity: 0.25 },
                  { y: 0, opacity: 1, duration: 0.28, stagger: 0.035, ease: 'power2.out', clearProps: 'opacity,transform' }, 0.14);
              }
              if (charCount > 0 && charNumRef.current && !countedRef.current) {
                countedRef.current = true;
                const counter = { c: 0, m: 0 };
                tl.to(counter, {
                  c: charCount, m: metricCount || 0, duration: 0.6, ease: 'power2.out',
                  onUpdate() {
                    if (charNumRef.current) charNumRef.current.textContent = String(Math.round(counter.c));
                    if (metricNumRef.current) metricNumRef.current.textContent = String(Math.round(counter.m));
                  },
                }, 0.12);
              }
            }

            return undefined;
          }, cardRef);
        });
        return () => { dead = true; try { mm && mm.revert(); } catch {} };
      }, [settled, id, ver, props.toolName, block?.isError]);

      /* 增量模块胶囊与异步补全统计：仅动画新出现的胶囊，不重播主卡片动画 */
      useEffect(() => {
        if (!cardRef.current) return;
        const count = (sections || []).length;
        if (count <= seenSecsRef.current) return;
        const prev = seenSecsRef.current;
        seenSecsRef.current = count;
        ensureGsap().then((g) => {
          if (!g || !cardRef.current) return;
          if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return;
          const pills = Array.from(cardRef.current.querySelectorAll('.cvr-sec-pill')).slice(prev);
          if (pills.length) {
            g.fromTo(pills, { y: 6, scale: 0.86, opacity: 0.2 }, { y: 0, scale: 1, opacity: 1, duration: 0.34, stagger: 0.04, ease: 'back.out(1.7)', clearProps: 'opacity,transform' });
          }
          if (settled && !countedRef.current && charCount > 0 && charNumRef.current) {
            countedRef.current = true;
            const counter = { c: 0, m: 0 };
            g.to(counter, {
              c: charCount, m: metricCount || 0, duration: 0.65, ease: 'power2.out',
              onUpdate() {
                if (charNumRef.current) charNumRef.current.textContent = String(Math.round(counter.c));
                if (metricNumRef.current) metricNumRef.current.textContent = String(Math.round(counter.m));
              },
            });
          }
        });
      }, [settled, (sections || []).length, charCount, metricCount]);

      const openWorkbench = () => openWorkbenchVia(props?.ctx);
      const exportFile = (format) => {
        if (!id || busyFmt) return;
        setBusyFmt(format);
        setExportNote(`正在生成 ${format.toUpperCase()}…`);
        downloadExport(id, format, (msg, icon) => {
          if (globalToastFn) flashGlobal(msg, icon);
          return () => {};
        }).then((fname) => {
          setExportNote(`已导出 ${fname}`);
          setTimeout(() => setExportNote(''), 3000);
        }).catch((e) => {
          const msg = `导出 ${format.toUpperCase()} 失败：${e?.message || e}`;
          setExportNote(msg);
          if (globalToastFn) flashGlobal(msg, ICONS.refresh);
          setTimeout(() => setExportNote(''), 4000);
        }).finally(() => setBusyFmt(''));
      };

      if (block?.isError) {
        return h('div', { className: 'cvr-toolcard compact is-error', style: cardStyle, ref: cardRef },
          h('span', { className: 'cvr-atelier-icon' }, h(Icon, { d: ICONS.resume, size: 15 })),
          h('span', { style: { fontWeight: 700, position: 'relative', zIndex: 2 } }, '操作失败'),
          h('span', { style: { color: 'var(--rs-ink-soft)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', position: 'relative', zIndex: 2 } },
            block?.content?.[0]?.text || '请检查参数后重试'),
          id && h('code', { className: 'cvr-toolcard-id', style: { position: 'relative', zIndex: 2 } }, id),
        );
      }

      if (!settled) {
        const hasStream = streamMd.trim().length > 0;
        const stepIdx = phase === 'start' ? 2 : (hasStream ? 1 : 0);
        const stepLabels = ['① 解析指令', '② 活字排版', '③ 落盘成稿'];
        const sectionBanner = props.toolName === 'resume_apply_edit' && editedSection ? editedSection : '';
        const tickerText = streamInfo.tailLines.length
          ? streamInfo.tailLines.join('  /  ').slice(-110)
          : (args?.type ? `正在载入内置「${args.type}」模板结构…` : '正在等待模型输出简历结构…');

        return h('div', { className: 'cvr-toolcard is-live compact', style: cardStyle, ref: cardRef },
          h('span', { className: 'cvr-codex-inner', 'aria-hidden': true }),
          h(HandRedRule, { seed: 'red-live-' + (id || 'new') }),
          h(CornerBrackets),
          h(WashiTape, { seed: 'tc-live-' + (id || 'new'), width: 56, height: 15, variant: 'washi', className: 'cvr-toolcard-tape' }),
          h('div', { className: 'cvr-mini-paper-box' },
            buildMiniPaperContent(streamMd, { live: true, sectionBanner, paperRef: miniPaperRef }),
            h('span', { className: 'cvr-thumb-corner' }, 'LIVE'),
            h('div', { className: 'cvr-draft-sweep' }),
          ),
          h('div', { className: 'cvr-toolcard-info' },
            h('div', { className: 'cvr-toolcard-head' },
              h('div', { className: 'cvr-toolcard-title-row' },
                h('div', { className: 'cvr-toolcard-title-left' },
                  h('span', { className: 'cvr-atelier-icon' }, h(Icon, { d: ICONS.pen, size: 14 })),
                  h('span', { className: 'cvr-toolcard-title', title: liveTitle }, liveTitle),
                  h('span', { className: 'cvr-toolcard-badge' }, h(SealCheckSvg, { live: true }), h('span', { className: 'cvr-badge-txt' }, liveVerbMap[props.toolName] || '正在处理')),
                ),
                h('code', { className: 'cvr-toolcard-id' },
                  (elapsed > 0 ? elapsed.toFixed(1) + 's · ' : '') + (streamInfo.charCount ? streamInfo.charCount + ' 字' : '准备中')),
              ),
              h('div', { className: 'cvr-live-steps' },
                stepLabels.map((lbl, idx) => h('span', { key: lbl, className: 'cvr-live-step' + (idx === stepIdx ? ' on' : (idx < stepIdx ? ' done' : '')) }, lbl)),
                streamInfo.metricCount > 0 && h('span', { className: 'cvr-atelier-highlight' }, `量化指标 ${streamInfo.metricCount} 处`),
              ),
              streamInfo.sections.length > 0 && h('div', { className: 'cvr-sec-pills' },
                streamInfo.sections.slice(0, 6).map((sec, idx) => {
                  const isActive = idx === streamInfo.sections.length - 1 && phase === 'preparing';
                  return h('span', { key: idx, className: 'cvr-sec-pill ' + (isActive ? 'active' : 'done') }, isActive ? '✍️ ' + sec : '✓ ' + sec);
                }),
              ),
            ),
            h('div', { className: 'cvr-live-ticker' }, tickerText, h('span', { className: 'cvr-live-ticker-cursor' })),
          ),
        );
      }

      if (!id) {
        return h('div', { className: 'cvr-toolcard compact is-settled', style: cardStyle, ref: cardRef },
          h('span', { className: 'cvr-atelier-icon' }, h(Icon, { d: ICONS.resume, size: 15 })),
          h('span', { className: 'cvr-toolcard-title' }, settledTitle),
          h('span', { className: 'cvr-toolcard-badge' }, h(SealCheckSvg, { live: false }), h('span', { className: 'cvr-badge-txt' }, badge)),
        );
      }

      const contextLabel = resObj?.template
        ? `版式模板：${resObj.template}`
        : (editedSection ? `精修模块：${editedSection}` : 'A4 成稿已落盘');

      const cardNode = h('div', { className: 'cvr-toolcard is-settled', style: cardStyle, ref: cardRef },
        h('span', { className: 'cvr-codex-inner', 'aria-hidden': true }),
        h(HandRedRule, { seed: 'red-' + id }),
        h(CornerBrackets),
        h(WashiTape, { seed: 'tc-' + id, width: 56, height: 15, variant: 'masking', className: 'cvr-toolcard-tape' }),
        h('div', { className: 'cvr-toolcard-thumb', ref: thumbRef, onClick: () => setPreviewOpen(true), title: '点击弹出 A4 高清阅览' },
          h('iframe', {
            src: `${API}/preview/${id}?print=1&thumb=1${ver ? '&v=' + ver : ''}`,
            title: '简历缩略',
            scrolling: 'no',
            tabIndex: -1,
          }),
          h('span', { className: 'cvr-thumb-corner' }, 'A4'),
          h('div', { className: 'cvr-thumb-overlay' },
            h('span', { className: 'cvr-thumb-pill' }, h(Icon, { d: ICONS.search, size: 11 }), '放大阅览'),
          ),
        ),
        h('div', { className: 'cvr-toolcard-info' },
          h('div', { className: 'cvr-toolcard-head' },
            h('div', { className: 'cvr-toolcard-title-row' },
              h('div', { className: 'cvr-toolcard-title-left' },
                h('span', { className: 'cvr-atelier-icon' }, h(Icon, { d: ICONS.resume, size: 15 })),
                h('span', { className: 'cvr-toolcard-title', title: settledTitle }, settledTitle),
                h('span', { className: 'cvr-toolcard-badge' }, h(SealCheckSvg, { live: false }), h('span', { className: 'cvr-badge-txt' }, badge)),
              ),
              h('code', { className: 'cvr-toolcard-id' }, id),
            ),
            h('div', { className: 'cvr-toolcard-meta' },
              h('span', { className: 'cvr-atelier-highlight' }, contextLabel),
              (sections?.length > 0 || charCount > 0) && h('span', { className: 'cvr-atelier-stats' },
                sections?.length > 0 && h('span', null, `${sections.length} 模块`),
                sections?.length > 0 && charCount > 0 && h('span', { className: 'sep' }, '·'),
                charCount > 0 && h('span', null, h('span', { ref: charNumRef }, String(charCount)), ' 字'),
                metricCount > 0 && h('span', { className: 'sep' }, '·'),
                metricCount > 0 && h('span', null, h('span', { ref: metricNumRef }, String(metricCount)), ' 处量化'),
              ),
              exportNote && h('span', { className: 'cvr-atelier-highlight' }, exportNote),
            ),
            sections?.length > 0 && h('div', { className: 'cvr-sec-pills' },
              sections.slice(0, 6).map((sec, idx) => {
                const hit = editedSection && (sec.includes(editedSection) || editedSection.includes(sec));
                return h('span', { key: idx, className: 'cvr-sec-pill ' + (hit ? 'active' : 'done') }, sec);
              }),
            ),
          ),
          h('div', { className: 'cvr-toolcard-actions' },
            h(Btn, { icon: ICONS.open, label: '打开工作台', primary: true, onClick: openWorkbench }),
            h(Btn, { icon: ICONS.search, label: '高清预览', onClick: () => setPreviewOpen(true) }),
            h('div', { className: 'cvr-export-seg' },
              h('button', { disabled: !!busyFmt, onClick: () => exportFile('pdf'), title: '导出 PDF' }, h(Icon, { d: ICONS.pdf, size: 12 }), busyFmt === 'pdf' ? '…' : 'PDF'),
              h('button', { disabled: !!busyFmt, onClick: () => exportFile('png'), title: '导出 PNG' }, h(Icon, { d: ICONS.fit, size: 12 }), busyFmt === 'png' ? '…' : 'PNG'),
              h('button', { disabled: !!busyFmt, onClick: () => exportFile('md'), title: '下载 Markdown' }, h(Icon, { d: ICONS.download, size: 12 }), busyFmt === 'md' ? '…' : 'MD'),
            ),
          ),
        ),
      );

      return h(React.Fragment, null,
        cardNode,
        previewOpen && h(ResumeQuickPreviewModal, {
          id, title: settledTitle, ver, sections,
          onClose: () => setPreviewOpen(false),
          onOpenWorkbench: openWorkbench,
          onExport: exportFile,
          busyFmt,
          exportNote,
        }),
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
      const [centerMounted, setCenterMounted] = useState(false);
      const [createdReq, setCreatedReq] = useState(null);
      const [toast, setToast] = useState(null);
      useEffect(() => {
        globalToastFn = (msg, icon) => {
          setToast({ msg, icon: icon || ICONS.check });
          setTimeout(() => setToast(null), 2200);
        };
        return () => { globalToastFn = null; };
      }, []);
      const switchTab = (next) => {
        if (next === 'center' && !centerMounted) setCenterMounted(true);
        setTab(next);
      };
      const handleUseTemplate = useCallback((item) => {
        setCreatedReq((prev) => ({ seq: (prev ? prev.seq : 0) + 1, id: item?.id || null }));
        setTab('workbench');
      }, []);
      return h('div', { className: 'cvr-root' },
        /* 档案卷宗顶栏：品牌 + 双 tab + 状态语 */
        h('div', { className: 'cvr-page-tabs' },
          h('div', { className: 'cvr-brand' },
            h('span', { className: 'logo', 'aria-hidden': true }, h(Icon, { d: ICONS.resume, size: 18 })),
            h('span', { className: 'name' }, '简历工作台'),
          ),
          h('button', {
            className: 'cvr-navtab' + (tab === 'workbench' ? ' active' : ''),
            onClick: () => switchTab('workbench'),
          },
            h(Icon, { d: ICONS.pen, size: 14 }),
            h('span', { className: 'folio-tag' }, 'I.'),
            '编辑工作台',
            h(PenUnderline, { seed: 'tab-wb' }),
          ),
          h('button', {
            className: 'cvr-navtab' + (tab === 'center' ? ' active' : ''),
            onClick: () => switchTab('center'),
          },
            h(Icon, { d: ICONS.doc, size: 14 }),
            h('span', { className: 'folio-tag' }, 'II.'),
            '模板中心',
            h(PenUnderline, { seed: 'tab-tc' }),
          ),
          h('span', { className: 'cvr-tabs-right' }, '本地手稿库 · Agent 实时协作 · 自动落盘'),
        ),
        h('div', { className: 'cvr-sheet-stage' },
          h(CornerBrackets),
          h('div', {
            className: 'cvr-folio-panel',
            style: { display: tab === 'workbench' ? 'flex' : 'none' },
          }, h(Workbench, { ...props, visible: tab === 'workbench', createdResumeReq: createdReq })),
          centerMounted && h('div', {
            className: 'cvr-folio-panel',
            style: { display: tab === 'center' ? 'flex' : 'none' },
          }, h(TemplateCenter, { onUse: handleUseTemplate })),
        ),
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

        try { ensureGsap().catch(() => {}); } catch {}

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
