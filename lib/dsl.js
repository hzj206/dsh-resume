/**
 * Resume DSL 统一清洗、容错与词法解析器（零依赖）
 *
 * 解决三类核心问题：
 * 1. 非代码区 `:::\n` 字面量换行转义、单行粘连 `::: start ... ::: ... ::: end`、缺空格 `:::start` 及孤立/未闭合围栏容错；
 *    严格跳过 ``` 代码块与 `...` 行内反引号，绝不误伤开发者代码里的 `\n`。
 * 2. `!bg[...](#hex)` 与 `!c[...](#hex)` 的平衡方括号词法解析（支持内部嵌套 `[姓名待填]` 与连续 `!c[A](#c1)!c[B](#c2)`），
 *    以及空颜色 `!c[tag]()` 兼容降级。
 * 3. 基于 WCAG 相对亮度的前景色自动对比度计算（浅底自动配深墨色字，深底配白色字）。
 */

/** 解析 #rgb / #rrggbb / #rgba / #rrggbbaa 为 { r, g, b }，失败返回 null */
export function parseHexColor(hex) {
  const m = String(hex || '').trim().match(/^#([0-9a-fA-F]{3,8})$/);
  if (!m) return null;
  const raw = m[1];
  if (raw.length === 3 || raw.length === 4) {
    return {
      r: parseInt(raw[0] + raw[0], 16),
      g: parseInt(raw[1] + raw[1], 16),
      b: parseInt(raw[2] + raw[2], 16),
    };
  }
  if (raw.length === 6 || raw.length === 8) {
    return {
      r: parseInt(raw.slice(0, 2), 16),
      g: parseInt(raw.slice(2, 4), 16),
      b: parseInt(raw.slice(4, 6), 16),
    };
  }
  return null;
}

/** 计算 WCAG 2.x 相对亮度（0 = 纯黑, 1 = 纯白） */
export function hexLuminance(hex) {
  const rgb = parseHexColor(hex);
  if (!rgb) return 0;
  const lin = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(rgb.r) + 0.7152 * lin(rgb.g) + 0.0722 * lin(rgb.b);
}

/** 根据背景十六进制色返回高对比前景色（浅底配深墨色，深底配纯白） */
export function contrastTextForHex(hex, darkInk = '#1a2433', lightInk = '#ffffff') {
  const rgb = parseHexColor(hex);
  if (!rgb) return lightInk;
  return hexLuminance(hex) > 0.56 ? darkInk : lightInk;
}

/**
 * 将文本切分为“代码区 / 普通文本区”片段，避免正则误伤 ``` 代码块或 `...` 行内代码里的 `\n`、:::` 等字符。
 */
export function mapOutsideCode(input, transformFn) {
  const src = String(input ?? '');
  const out = [];
  let i = 0;
  let plainStart = 0;
  const n = src.length;

  const flushPlain = (end) => {
    if (end > plainStart) out.push(transformFn(src.slice(plainStart, end)));
  };

  while (i < n) {
    const atLineStart = i === 0 || src[i - 1] === '\n';
    // 1. 围栏代码块 ``` 或 ~~~
    if (atLineStart) {
      const rest = src.slice(i);
      const fm = rest.match(/^[ \t]{0,3}(`{3,}|~{3,})/);
      if (fm) {
        const fenceChar = fm[1][0];
        const fenceLen = fm[1].length;
        const closeRe = new RegExp(`\\n[ \\t]{0,3}${fenceChar}{${fenceLen},}[ \\t]*(?=\\n|$)`);
        const firstNl = src.indexOf('\n', i);
        let endIdx = n;
        if (firstNl >= 0) {
          const cm = closeRe.exec(src.slice(firstNl));
          if (cm) endIdx = firstNl + cm.index + cm[0].length;
        }
        flushPlain(i);
        out.push(src.slice(i, endIdx));
        i = endIdx;
        plainStart = i;
        continue;
      }
    }

    // 2. 行内反引号代码 `...` / ``...``
    if (src[i] === '`') {
      let tickLen = 1;
      while (i + tickLen < n && src[i + tickLen] === '`') tickLen++;
      const closer = '`'.repeat(tickLen);
      let closeIdx = src.indexOf(closer, i + tickLen);
      // 跨行不闭合的反引号不做行内保护，避免吞掉整篇文档
      while (closeIdx >= 0) {
        const segment = src.slice(i, closeIdx + tickLen);
        if (!segment.includes('\n\n') && src[closeIdx + tickLen] !== '`') {
          break;
        }
        if (src[closeIdx + tickLen] === '`') {
          // 跳过更长的反引号序列
          let k = closeIdx + tickLen;
          while (k < n && src[k] === '`') k++;
          closeIdx = src.indexOf(closer, k);
        } else {
          closeIdx = -1;
        }
      }
      if (closeIdx >= 0) {
        flushPlain(i);
        out.push(src.slice(i, closeIdx + tickLen));
        i = closeIdx + tickLen;
        plainStart = i;
        continue;
      }
      i += tickLen;
      continue;
    }

    i++;
  }
  flushPlain(n);
  return out.join('');
}

/** 规范化单段非代码文本中的 `:::\n` 转义与单行粘连 `:::` */
function normalizeFenceChunk(chunk) {
  let s = chunk;

  // 修复字面量 `\n` / `\\n` 粘连在 ::: 围栏命令前后的情况（循环展开链式如 :::\nA\n:::\nB）
  for (let pass = 0; pass < 4; pass++) {
    const next = s
      // 围栏指令后面紧跟字面量 \n（如 `::: start\n` 或 `:::\n**智能体平台组**`）
      .replace(/(^|\n)([ \t]*:::[ \t]*(?:start|end|headStart|headEnd|mainStart|mainEnd)?)(?:\\+n)+/gi, '$1$2\n')
      // 围栏指令前面紧跟字面量 \n（如 `**公司A**\n:::` 或 `**2024**\n::: end`）
      .replace(/(?:\\+n)+([ \t]*:::[ \t]*(?:start|end|headStart|headEnd|mainStart|mainEnd)?)(?=[ \t]*(?:\\+n|\n|$))/gi, '\n$1');
    if (next === s) break;
    s = next;
  }

  // 逐行处理：规整 `:::start`、`:::end`、`::: headStart` 缺空格与单行粘连 `::: start A ::: B ::: end`
  const rawLines = s.split('\n');
  const normLines = [];
  for (const line of rawLines) {
    const trimmed = line.trim();
    // 纯围栏行
    const pureKw = trimmed.match(/^:::\s*(start|end|headStart|headEnd|mainStart|mainEnd)?$/i);
    if (pureKw) {
      const kw = pureKw[1] ? pureKw[1] : '';
      const canon = kw
        ? (kw.toLowerCase() === 'start' ? 'start'
          : kw.toLowerCase() === 'end' ? 'end'
          : kw.toLowerCase() === 'headstart' ? 'headStart'
          : kw.toLowerCase() === 'headend' ? 'headEnd'
          : kw.toLowerCase() === 'mainstart' ? 'mainStart'
          : 'mainEnd')
        : '';
      normLines.push(canon ? `::: ${canon}` : ':::');
      continue;
    }

    // 单行粘连，例如 `::: start **公司** ::: **岗位** ::: end` 或 `::: start **公司**`
    if (/^:::\s*start(?=\s|$)/i.test(trimmed)) {
      const rest = trimmed.replace(/^:::\s*start\s*/i, '');
      normLines.push('::: start');
      if (rest) {
        const hasEnd = /\s*:::\s*end\s*$/i.test(rest);
        const core = rest.replace(/\s*:::\s*end\s*$/i, '');
        const parts = core.split(/\s+:::(?:\s+|$)/);
        parts.forEach((p, idx) => {
          if (p.trim()) normLines.push(p.trim());
          if (idx < parts.length - 1) normLines.push(':::');
        });
        if (hasEnd) normLines.push('::: end');
      }
      continue;
    }

    // 行尾粘连 `::: end`（如 `**2024.03-至今** ::: end`）
    const tailEnd = trimmed.match(/^(.+?)\s+:::\s*end\s*$/i);
    if (tailEnd) {
      normLines.push(tailEnd[1]);
      normLines.push('::: end');
      continue;
    }

    // 行首/行尾粘连 `:::` 分栏符（如 `::: **智能体平台组**`）
    const leadCol = trimmed.match(/^:::\s+(.+)$/);
    if (leadCol && !/^(?:start|end|headStart|headEnd|mainStart|mainEnd)\b/i.test(leadCol[1])) {
      normLines.push(':::');
      normLines.push(leadCol[1]);
      continue;
    }

    normLines.push(line);
  }
  return normLines.join('\n');
}

/**
 * Resume DSL 正文规范化（写入落盘前 & 渲染前置共用）：
 * 1. 去 UTF-8 BOM + 统一 \n
 * 2. 修复非代码区 `:::\n` 字面量与粘连多栏指令
 * 3. 自动闭合未关闭的 `::: start`、剥离孤立的 `::: end`，防止吞并模块或泄露围栏源码
 */
export function normalizeResumeDsl(raw) {
  let s = String(raw ?? '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  s = mapOutsideCode(s, normalizeFenceChunk);

  // 围栏配对平衡（跳过 ``` 代码块）
  const lines = s.split('\n');
  const out = [];
  let inCode = false;
  let codeFence = '';
  let flexDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!inCode) {
      const fm = trimmed.match(/^(`{3,}|~{3,})/);
      if (fm) {
        inCode = true;
        codeFence = fm[1][0].repeat(fm[1].length);
        out.push(line);
        continue;
      }
    } else {
      if (trimmed.startsWith(codeFence) && new RegExp(`^${codeFence[0]}{${codeFence.length},}$`).test(trimmed)) {
        inCode = false;
        codeFence = '';
      }
      out.push(line);
      continue;
    }

    if (/^:::\s*start$/i.test(trimmed)) {
      if (flexDepth > 0) {
        // 前一个块忘写 ::: end，自动补齐
        out.push('::: end');
        flexDepth = 0;
      }
      flexDepth = 1;
      out.push('::: start');
      continue;
    }

    if (/^:::\s*end$/i.test(trimmed)) {
      if (flexDepth > 0) {
        flexDepth = 0;
        out.push('::: end');
      }
      // 孤立无主的 ::: end 直接丢弃，防止漏进正文
      continue;
    }

    if (flexDepth > 0 && /^#{1,2}\s+/.test(trimmed)) {
      // 遇到新一级/二级模块标题仍未闭合多栏，先自动闭合
      out.push('::: end');
      flexDepth = 0;
    }

    out.push(line);
  }

  if (flexDepth > 0) {
    out.push('::: end');
  }
  return out.join('\n');
}

/**
 * 平衡括号替换 `!tag[...](arg)`（用于 `!bg` / `!c`）。
 * - 支持内容中嵌套 `[姓名待填]` 等方括号；
 * - 支持同一行连续出现多个标签（如 `!c[A](#c1)!c[B](#c2)`）；
 * - 严格跳过 `` `...` `` 行内代码，避免破坏示例代码；
 * - 支持空参数 `!c[text]()` 降级。
 */
export function replaceBalancedDslTag(text, tagName, replacer) {
  const prefix = `${tagName}[`;
  const src = String(text ?? '');
  return mapOutsideCode(src, (chunk) => {
    let out = '';
    let i = 0;
    const n = chunk.length;
    while (i < n) {
      if (chunk.startsWith(prefix, i)) {
        let j = i + prefix.length;
        let depth = 1;
        while (j < n && depth > 0) {
          const ch = chunk[j];
          if (ch === '\\' && j + 1 < n) {
            j += 2;
            continue;
          }
          if (ch === '\n') break; // !bg / !c 为行内语法，不跨行吞并
          if (ch === '[') depth++;
          else if (ch === ']') depth--;
          j++;
        }
        if (depth === 0) {
          const innerRaw = chunk.slice(i + prefix.length, j - 1);
          const rest = chunk.slice(j);
          const argMatch = rest.match(/^\(\s*(#[0-9a-fA-F]{3,8})?\s*\)/);
          if (argMatch) {
            const color = argMatch[1] || '';
            const inner = replaceBalancedDslTag(innerRaw, tagName, replacer);
            out += replacer(inner, color);
            i = j + argMatch[0].length;
            continue;
          }
        }
      }
      out += chunk[i];
      i++;
    }
    return out;
  });
}

/** 剥离 `!bg[...](#...)` 与 `!c[...](#...)` 提取纯文本（用于摘要、目录、体检） */
export function stripDslMarkers(text) {
  let s = String(text ?? '');
  s = replaceBalancedDslTag(s, '!bg', (inner) => inner);
  s = replaceBalancedDslTag(s, '!c', (inner) => inner);
  return s;
}
