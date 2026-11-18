/**
 * dsh-resume · 增强功能（纯函数，无 IO，便于单测）
 *
 * 提供：
 *   1. 模块结构操作：listSections / moveSection / applyEdit
 *   2. 简历体检：proofread（本地规则引擎，不联网）
 *   3. JD 匹配：matchJd（关键词覆盖度分析，不联网）
 *
 * 设计约束：所有函数只处理 markdown 字符串，不读写文件、不依赖 ctx，
 * 因此可以独立单测，也不会影响既有渲染/编辑链路。
 */

/* ------------------------------- 公共工具 ------------------------------- */

import { normalizeResumeDsl, stripDslMarkers } from './dsl.js';

const SECTION_RE = /^##\s+(.+?)\s*$/;
const TITLE_RE = /^#\s+(.+?)\s*$/;

/** 按行切分，保留原换行风格无关性（统一 \n 输出） */
function toLines(content) {
  return normalizeResumeDsl(content).split('\n');
}

/** 判断某行是否在 ::: 多栏块内（用于避免把单元格里的 ## 当成模块标题） */
function makeFenceTracker() {
  let depth = 0;
  let inCode = false;
  return (line) => {
    const t = String(line ?? '').trim();
    if (/^`{3,}|^~{3,}/.test(t)) { inCode = !inCode; return true; }
    if (inCode) return true;
    if (/^:::\s*(?:start|headStart|mainStart)\s*$/i.test(t)) { depth += 1; return true; }
    if (/^:::\s*(?:end|headEnd|mainEnd)\s*$/i.test(t)) { depth = Math.max(0, depth - 1); return true; }
    return depth > 0;
  };
}

/* ---------------------------- 1. 模块结构操作 ---------------------------- */

/**
 * 拆出「文档大标题 + 各模块」。
 * 返回 { preamble: string, sections: [{ title, index, lines, startLine, endLine }] }
 * preamble 是大标题及第一个模块之前的全部内容（含空行）。
 */
export function listSections(content) {
  const lines = toLines(content);
  const inFence = makeFenceTracker();
  const marks = [];
  lines.forEach((line, i) => {
    const fenced = inFence(line);
    if (fenced) return;
    const m = line.match(SECTION_RE);
    if (m) marks.push({ i, title: m[1] });
  });

  if (!marks.length) {
    return { preamble: lines.join('\n'), sections: [] };
  }

  const preamble = lines.slice(0, marks[0].i).join('\n');
  const sections = marks.map((mark, k) => {
    const end = k + 1 < marks.length ? marks[k + 1].i : lines.length;
    return {
      title: mark.title,
      index: k,
      startLine: mark.i,
      endLine: end - 1,
      lines: lines.slice(mark.i, end),
    };
  });
  return { preamble, sections };
}

/** 把 preamble + sections 重新拼回 markdown */
function joinSections(preamble, sections) {
  const head = preamble.replace(/\s+$/, '');
  const body = sections.map((s) => s.lines.join('\n').replace(/\s+$/, '')).join('\n\n');
  const out = [head, body].filter((x) => x !== '').join('\n\n');
  return out + (out.endsWith('\n') ? '' : '\n');
}

/**
 * 上移/下移一个模块。dir = -1 上移，+1 下移。
 * 越界时原样返回（并标记 moved:false），调用方无需特殊处理。
 */
export function moveSection(content, index, dir) {
  const { preamble, sections } = listSections(content);
  const from = Number(index);
  const step = dir === -1 ? -1 : dir === 1 ? 1 : 0;
  if (!step || !Number.isInteger(from) || from < 0 || from >= sections.length) {
    return { content: String(content ?? ''), moved: false, index: from, count: sections.length };
  }
  const to = from + step;
  if (to < 0 || to >= sections.length) {
    return { content: String(content ?? ''), moved: false, index: from, count: sections.length };
  }
  const next = sections.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return { content: joinSections(preamble, next), moved: true, index: to, count: next.length };
}

/**
 * 局部段替换：按模块标题定位，替换该模块标题下的正文。
 * title 支持精确匹配；找不到时退化到包含匹配（唯一命中才算）。
 */
export function applyEdit(content, title, newBody) {
  const { preamble, sections } = listSections(content);
  const want = String(title ?? '').trim();
  if (!want) throw new Error('section 不能为空');

  const clean = (t) => stripDslMarkers(t).replace(/[*_`~]+/g, '').trim();
  let hit = sections.find((s) => s.title === want || clean(s.title) === want);
  if (!hit) {
    const fuzzy = sections.filter((s) => {
      const ct = clean(s.title);
      return s.title.includes(want) || want.includes(s.title) || ct.includes(want) || want.includes(ct);
    });
    if (fuzzy.length === 1) hit = fuzzy[0];
    else if (fuzzy.length > 1) {
      throw new Error(`模块名「${want}」匹配到 ${fuzzy.length} 个，请写得更具体：${fuzzy.map((s) => s.title).join(' / ')}`);
    }
  }
  if (!hit) {
    throw new Error(`没找到模块「${want}」。现有模块：${sections.map((s) => s.title).join(' / ') || '（无）'}`);
  }

  const heading = `## ${hit.title}`;
  const bodyLines = toLines(newBody).filter((l, i, arr) => {
    // 去掉首尾空行
    const isEdge = arr.slice(0, i).every((x) => !x.trim()) || arr.slice(i + 1).every((x) => !x.trim());
    return !(isEdge && !l.trim());
  });
  const replaced = { ...hit, lines: [heading, ...bodyLines] };
  const next = sections.map((s) => (s === hit ? replaced : s));
  return {
    content: joinSections(preamble, next),
    section: hit.title,
    index: hit.index,
  };
}

/** 删除一个模块（按 index） */
export function removeSection(content, index) {
  const { preamble, sections } = listSections(content);
  const i = Number(index);
  if (!Number.isInteger(i) || i < 0 || i >= sections.length) {
    throw new Error(`模块序号越界：${index}（共 ${sections.length} 个）`);
  }
  const removed = sections[i];
  const next = sections.filter((_, k) => k !== i);
  return { content: joinSections(preamble, next), section: removed.title, count: next.length };
}

/* ------------------------------ 2. 简历体检 ------------------------------ */

const EMPTY_WORDS = [
  '认真负责', '积极主动', '吃苦耐劳', '团队合作', '团队精神', '沟通能力强',
  '学习能力强', '责任心强', '抗压能力强', '性格开朗', '善于沟通', '熟练使用办公软件',
];
const WEAK_VERBS = ['负责', '参与', '协助', '帮助', '配合', '跟进', '从事'];
const STRONG_HINT = ['主导', '设计', '搭建', '重构', '优化', '落地', '推动', '从 0 到 1', '从0到1'];

const hasDigit = (s) => /[0-9０-９]/.test(s);
const countCjk = (s) => (String(s).match(/[\u4e00-\u9fa5]/g) || []).length;

function eachBullet(content) {
  const out = [];
  toLines(content).forEach((line, i) => {
    const m = line.match(/^\s*[-*]\s+(.*)$/);
    if (m) out.push({ line: i + 1, text: m[1].trim() });
  });
  return out;
}

/**
 * 本地简历体检。纯规则，不联网，结果稳定可测。
 * 返回 { score, issues: [...], stats }
 */
export function proofread(content) {
  const text = String(content ?? '');
  const lines = toLines(text);
  const bullets = eachBullet(text);
  const { sections } = listSections(text);
  const issues = [];
  const push = (type, severity, message, extra = {}) => {
    issues.push({ type, severity, message, ...extra });
  };

  // 联系方式
  const hasEmail = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(text);
  // 手机号常见写法带分隔符（138-0000-0000 / 138 0000 0000 / +86 138…），
  // 先去分隔符再匹配，否则会把写了手机号的简历误判成「缺手机号」
  const phoneFlat = text.replace(/[\s\-()（）]/g, '');
  const hasPhone = /(\+?86)?1[3-9]\d{9}/.test(phoneFlat) || /0\d{2,3}\d{7,8}/.test(phoneFlat);
  if (!hasEmail) push('contact', 'high', '没找到邮箱地址，HR 无法联系你', { suggestion: '在抬头补一个 email，例如 name@example.com' });
  if (!hasPhone) push('contact', 'high', '没找到手机号', { suggestion: '在抬头补手机号，建议写成 138-0000-0000' });

  // 模块完整性
  const titles = sections.map((s) => s.title).join(' ');
  if (sections.length === 0) push('structure', 'high', '没有识别到任何「## 模块」', { suggestion: '用 ## 教育背景 / ## 实习经历 / ## 项目经历 组织内容' });
  if (!/教育|学历/.test(titles)) push('structure', 'medium', '缺少「教育背景」模块');
  if (!/实习|工作|经历/.test(titles)) push('structure', 'medium', '缺少「实习/工作经历」模块');
  if (!/项目|科研/.test(titles)) push('structure', 'low', '缺少「项目经历」模块');

  // 量化
  if (!hasDigit(text)) {
    push('quantify', 'high', '整份简历没有任何数字，成果无法感知', { suggestion: '把「提升了性能」改成「响应时间从 800ms 降到 200ms」' });
  } else {
    let flagged = 0;
    for (const b of bullets) {
      if (flagged >= 8) break;
      if (countCjk(b.text) >= 12 && !hasDigit(b.text)) {
        flagged += 1;
        push('quantify', 'medium', '这条描述没有数据支撑', {
          line: b.line, text: b.text.slice(0, 40),
          suggestion: '补一个数字：规模、时长、提升幅度、覆盖人数都可以',
        });
      }
    }
  }

  // 弱动词开头
  for (const b of bullets) {
    const head = b.text.replace(/^\*\*/, '').slice(0, 6);
    if (WEAK_VERBS.some((v) => head.startsWith(v)) && !STRONG_HINT.some((v) => b.text.includes(v))) {
      push('verb', 'low', '动词偏弱，读起来像「打杂」', {
        line: b.line, text: b.text.slice(0, 40),
        suggestion: '换成主导 / 设计 / 搭建 / 重构 / 优化',
      });
    }
  }

  // 空洞形容词
  for (const w of EMPTY_WORDS) {
    if (text.includes(w)) {
      push('cliche', 'low', `出现空话「${w}」，没有信息量`, { suggestion: '删掉，换成具体事实或成果' });
    }
  }

  // 过长条目
  for (const b of bullets) {
    if (b.text.length > 90) {
      push('length', 'low', '这一条太长，HR 会跳读', {
        line: b.line, text: b.text.slice(0, 40),
        suggestion: '拆成 2 条，或删到 50 字以内',
      });
    }
  }

  // 中英标点混用
  const cjkLines = lines.filter((l) => countCjk(l) > 6);
  const mixed = cjkLines.filter((l) => /[\u4e00-\u9fa5][,;:]/.test(l));
  if (mixed.length) {
    push('punct', 'low', `有 ${mixed.length} 行中英标点混用`, { suggestion: '中文句子用，。；：' });
  }

  const weight = { high: 12, medium: 6, low: 3 };
  const penalty = issues.reduce((sum, it) => sum + (weight[it.severity] || 3), 0);
  const score = Math.max(0, Math.min(100, 100 - penalty));

  return {
    score,
    issues,
    stats: {
      chars: countCjk(text) + (text.match(/[A-Za-z0-9]+/g) || []).length,
      sections: sections.length,
      bullets: bullets.length,
      quantifiedBullets: bullets.filter((b) => hasDigit(b.text)).length,
    },
  };
}

/* ------------------------------ 3. JD 匹配 ------------------------------ */

const STOP = new Set([
  'and', 'the', 'for', 'with', 'you', 'your', 'our', 'are', 'will', 'have', 'has', 'that', 'this',
  'from', 'not', 'but', 'all', 'can', 'any', 'use', 'using', 'work', 'team', 'job', 'role',
  '任职', '要求', '职责', '岗位', '工作', '我们', '公司', '负责', '能力', '经验', '熟悉', '了解',
  '掌握', '优先', '以上', '相关', '具备', '良好', '一定', '能够', '以及', '或者', '进行', '通过',
  '一个', '这个', '那个', '什么', '如何', '怎么', '可以', '需要', '要求', '参与', '完成', '支持',
]);

/** 英文技术词 + 中文术语抽取 */
function extractKeywords(text) {
  const freq = new Map();
  const add = (term, w = 1) => {
    const t = term.trim();
    if (!t) return;
    const key = t.toLowerCase();
    if (STOP.has(key) || t.length < 2) return;
    freq.set(key, (freq.get(key) || 0) + w);
  };

  // 英文/数字技术词
  const en = String(text).match(/[A-Za-z][A-Za-z0-9+#./-]{1,}/g) || [];
  for (const w of en) add(w, 2);

  // 中文：按标点切段，再按 2-4 字滑窗取高频片段
  const segs = String(text).split(/[\s，。；：、,.;:!?！？()（）\[\]【】\/|]+/).filter((s) => countCjk(s) >= 2);
  for (const seg of segs) {
    const chars = seg.replace(/[^\u4e00-\u9fa5A-Za-z0-9+#.]/g, '');
    for (let n = 2; n <= 4; n++) {
      for (let i = 0; i + n <= chars.length; i++) {
        const term = chars.slice(i, i + n);
        if (countCjk(term) < 2) continue;
        if (STOP.has(term)) continue;
        add(term, n === 2 ? 0.4 : n === 3 ? 0.7 : 1);
      }
    }
  }
  return freq;
}

/**
 * JD 匹配度。返回 { score, matched, missing, keywords }
 * 思路：从 JD 抽关键词（英文按词、中文按 2-4 字片段加权），
 * 再看这些词在简历正文里的覆盖率。纯本地，不联网。
 */
export function matchJd(content, jd) {
  const resume = String(content ?? '').toLowerCase();
  const jdText = String(jd ?? '');
  if (!jdText.trim()) throw new Error('JD 内容为空');

  const freq = extractKeywords(jdText);
  let entries = [...freq.entries()].map(([term, weight]) => ({ term, weight }));

  // 只保留权重较高的词，避免碎片噪声
  entries.sort((a, b) => b.weight - a.weight || a.term.length - b.term.length);
  const top = entries.slice(0, 40);

  // 去掉被更长词包含的短词（例如「数据」被「数据分析」覆盖）
  const kept = top.filter((e) => !top.some((o) => o.term !== e.term && o.term.length > e.term.length && o.term.includes(e.term) && o.weight >= e.weight));

  let totalWeight = 0;
  let hitWeight = 0;
  const matched = [];
  const missing = [];
  for (const e of kept) {
    totalWeight += e.weight;
    if (resume.includes(e.term.toLowerCase())) {
      hitWeight += e.weight;
      matched.push(e.term);
    } else {
      missing.push(e.term);
    }
  }
  const score = totalWeight > 0 ? Math.round((hitWeight / totalWeight) * 100) : 0;
  return {
    score,
    matched,
    missing,
    keywords: kept.map((e) => ({ term: e.term, weight: Math.round(e.weight * 10) / 10 })),
  };
}

export default { listSections, moveSection, applyEdit, removeSection, proofread, matchJd };
