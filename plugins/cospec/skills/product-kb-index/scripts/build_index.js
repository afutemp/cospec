'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const SCHEMA_VERSION = '1.0.0';

// 元信息节：每份文档重复出现、非知识主体的章节标题模式。
// 命中的节在骨架中标为 kind:'meta'，渲染文档目录时默认折叠/跳过。
// 判定只看标题文字，保守匹配，不误伤真正的功能节。
// 注意：各类"总览/菜单基线"节一律保留为 content——它们是最有价值的导航入口，不过滤。
const META_HEADING_PATTERNS = [
  /文档定位/, /研究范围/, /结论口径/, /证据与抽象规则/,
  /覆盖率/, /覆盖结论/, /证据索引/, /证据台账/, /证据说明/,
  /风险记录与发布检查/, /操作边界与发布检查/, /风险操作与验证状态/,
  /当前结论/, /当前结论与限制/,
  /^(.*、)?待(确认|验证|细化)(问题|项|事项)?$/, /^(.*、)?冲突与待确认$/,
];

function fingerprint(content) {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex').slice(0, 16);
}

// 收集目录下全部 .md，跳过 .source、生成物 INDEX.md 与 README.md。
function markdownFiles(root) {
  const files = [];
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
      if (entry.name === '.source') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.md') && entry.name !== 'INDEX.md' && entry.name !== 'README.md') {
        files.push(path.relative(root, full).replace(/\\/g, '/'));
      }
    }
  }
  walk(root);
  return files.sort();
}

function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {description: '', title: '', lineSpan: 0};
  const body = match[1];
  const field = name => {
    const line = body.match(new RegExp(`^${name}:\\s*(.*)$`, 'm'));
    return line ? line[1].trim() : '';
  };
  // frontmatter 块占用的行数（含起止 ---），供后续解析跳过，避免字段被误判为 setext 标题
  const lineSpan = match[0].split(/\r?\n/).length;
  return {description: field('description'), title: field('name'), lineSpan};
}

// 标出每行是否处于围栏代码块内（含围栏行本身）。围栏内的 `## x` 不是标题。
// 未闭合围栏按 CommonMark 规则延续到文末。
function computeFenceMask(lines) {
  const mask = new Array(lines.length).fill(false);
  let inFence = false;
  for (let i = 0; i < lines.length; i += 1) {
    if (/^\s{0,3}(`{3,}|~{3,})/.test(lines[i])) { mask[i] = true; inFence = !inFence; continue; }
    mask[i] = inFence;
  }
  return mask;
}

// 返回某行（1-indexed）作为标题时的标题文字（ATX 或 setext），否则 null。
// 供 verify 用，风格无关。fenceMask 可选：提供则围栏内不认标题。
function headingTextAt(lines, lineNo, fenceMask) {
  const idx = lineNo - 1;
  const raw = lines[idx];
  if (raw == null) return null;
  if (fenceMask && fenceMask[idx]) return null;
  const atx = raw.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
  if (atx) return atx[2].trim();
  const next = lines[idx + 1];
  if (next != null && raw.trim() && !/^(#{1,6}\s|\||>|[-*]\s|\d+[.、]\s|`{3,}|~{3,})/.test(raw.trim())
      && (/^=+\s*$/.test(next) || /^-{2,}\s*$/.test(next))) {
    return raw.trim();
  }
  return null;
}

// 抽取全部标题（ATX 任意级 + setext 一/二级），跳过 frontmatter 与围栏。
function extractHeadings(lines, fenceMask, startIndex) {
  const heads = [];
  for (let i = startIndex; i < lines.length; i += 1) {
    if (fenceMask[i]) continue;
    const atx = lines[i].match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (atx) { heads.push({level: atx[1].length, text: atx[2].trim(), line: i + 1, index: i, style: 'atx'}); continue; }
    // setext：当前是普通文字行，下一行是 === 或 --- 下划线
    const next = lines[i + 1];
    if (next != null && !fenceMask[i + 1] && lines[i].trim()
        && !/^(#{1,6}\s|\||>|[-*]\s|\d+[.、]\s|`{3,}|~{3,})/.test(lines[i].trim())) {
      if (/^=+\s*$/.test(next)) { heads.push({level: 1, text: lines[i].trim(), line: i + 1, index: i, style: 'setext'}); continue; }
      if (/^-{2,}\s*$/.test(next)) { heads.push({level: 2, text: lines[i].trim(), line: i + 1, index: i, style: 'setext'}); continue; }
    }
  }
  return heads;
}

// 选定章节层级：优先 ##（level 2）。无 ## 时自适应回退到文档实际用的层级，
// 使更多不规范文档仍可导航。仅有单个 H1（标题）而无其它标题 → 返回 null（整篇一体）。
function pickSectionLevel(heads) {
  const byLevel = {};
  for (const h of heads) byLevel[h.level] = (byLevel[h.level] || 0) + 1;
  if (byLevel[2]) return 2;
  const levels = Object.keys(byLevel).map(Number).sort((a, b) => a - b);
  if (!levels.length) return null;
  if (levels.length === 1 && levels[0] === 1 && byLevel[1] === 1) return null;
  const deeper = levels.filter(l => l > 1);
  return deeper.length ? deeper[0] : levels[0];
}

// 抽正文摘要：标题后第一段非空、非结构、非围栏行。原样带出，截断到约 60 字。
function excerptFrom(lines, startIndex, endIndex, fenceMask) {
  for (let i = startIndex; i < endIndex; i += 1) {
    if (fenceMask && fenceMask[i]) continue;
    const raw = lines[i].trim();
    if (!raw) continue;
    if (/^(#{1,6}\s|\||>|[-*]\s|\d+[.、]\s|`{3,}|~{3,}|=+\s*$|-{2,}\s*$)/.test(raw)) continue;
    const clean = raw.replace(/`/g, '').replace(/^【[^】]*】\s*/, '').replace(/\s+/g, ' ').trim();
    if (clean) return clean.length > 60 ? `${clean.slice(0, 60)}…` : clean;
  }
  return '';
}

function isMetaHeading(text) {
  return META_HEADING_PATTERNS.some(pattern => pattern.test(text));
}

// 解析单文档：标题 + 章节（行号、子标题、摘要、kind、style）。
// 行号 1-indexed，直接取自标题行的实际位置——不推算。围栏内伪标题不计。
function parseDoc(relPath, content) {
  const lines = content.split(/\r?\n/);
  const fm = parseFrontmatter(content);
  const fenceMask = computeFenceMask(lines);
  const heads = extractHeadings(lines, fenceMask, fm.lineSpan);

  let h1 = fm.title || '';
  if (!h1) { const t = heads.find(h => h.level === 1); if (t) h1 = t.text; }

  const sectionLevel = pickSectionLevel(heads);
  const sections = [];
  if (sectionLevel != null) {
    const primary = heads.filter(h => h.level === sectionLevel);
    for (let n = 0; n < primary.length; n += 1) {
      const cur = primary[n];
      const nextIndex = n + 1 < primary.length ? primary[n + 1].index : lines.length;
      const subHeadings = heads
        .filter(h => h.level === sectionLevel + 1 && h.index > cur.index && h.index < nextIndex)
        .map(h => h.text.replace(/`[^`]*`/g, '').replace(/\s+/g, ' ').trim());
      sections.push({
        heading: cur.text,
        line: cur.line,
        style: cur.style,
        subHeadings,
        excerpt: excerptFrom(lines, cur.index + 1, nextIndex, fenceMask),
        kind: isMetaHeading(cur.text) ? 'meta' : 'content',
      });
    }
  }
  return {
    path: relPath,
    title: h1,
    description: fm.description,
    fingerprint: fingerprint(content),
    hasFrontmatter: fm.description !== '' || fm.title !== '',
    sectionLevel,
    sections,
  };
}

function buildSkeleton(root) {
  const docs = markdownFiles(root).map(rel => parseDoc(rel, fs.readFileSync(path.join(root, rel), 'utf8')));
  return {
    schemaVersion: SCHEMA_VERSION,
    root: path.resolve(root),
    generatedFrom: {docCount: docs.length},
    docs,
  };
}

// 行号自检：按骨架里每个节的行号读回该行，断言确为对应标题（ATX 或 setext）。
// 拦截 off-by-one 类漂移。返回不匹配清单（空数组即通过）。
function verifyLineNumbers(root, skeleton) {
  const mismatches = [];
  for (const doc of skeleton.docs) {
    const lines = fs.readFileSync(path.join(root, doc.path), 'utf8').split(/\r?\n/);
    for (const section of doc.sections) {
      const actual = headingTextAt(lines, section.line);
      if (actual == null || actual !== section.heading) {
        mismatches.push({path: doc.path, heading: section.heading, line: section.line, actual: (lines[section.line - 1] || '').trim()});
      }
    }
  }
  return mismatches;
}

// 渲染 INDEX.md 的文档目录部分（正排）。主题速查表由 skill 的 LLM 步骤注入 topicTable。
// 行号逐节取自骨架，绝不共用或顺延。
function renderIndex(skeleton, options = {}) {
  const {title = '知识库', subtitle = '', topicTable = '', updated = '', includeMeta = false} = options;
  const out = [];
  out.push(`# ${title} · 索引`, '');
  const finger = `源指纹：${skeleton.docs.length} 个文档${updated ? ` · 更新 ${updated}` : ''}`;
  out.push(`> ${finger} · **agent 请先读本文件，据"主题速查"定位到文档与章节，再按行号 Read 正文，避免整份大文档读入上下文。**`);
  if (subtitle) out.push(`> ${subtitle}`);
  out.push('', '---', '');

  if (topicTable) {
    out.push('## 🔎 主题速查（按意图找文档）', '', topicTable, '', '---', '');
  }

  out.push('## 📑 文档目录（按文件正排）', '');
  for (const doc of skeleton.docs) {
    out.push(`### ${doc.path}`);
    if (doc.description) out.push(`> ${doc.description}`);
    const shown = doc.sections.filter(s => includeMeta || s.kind === 'content');
    for (const s of shown) {
      // 清掉标题里的证据标记等反引号片段，保持索引清爽；骨架仍存原文供自检。
      const heading = s.heading.replace(/`[^`]*`/g, '').replace(/\s+/g, ' ').trim();
      // 瘦身：文档目录只给 §标题(行号)+短摘要，不再堆子标题（子标题仍在骨架 JSON 里供语义步骤用）。
      const excerpt = s.excerpt.length > 40 ? `${s.excerpt.slice(0, 40)}…` : s.excerpt;
      const tail = excerpt ? ` — ${excerpt}` : '';
      out.push(`- §${heading} (L${s.line})${tail}`);
    }
    // 无可导航章节的文档：优雅退化为文件级入口，明确标注而非静默留空。
    if (!shown.length) out.push('- _（本文档无可细分章节，整篇作为一个整体查阅）_');
    out.push('');
  }
  out.push('---', '', '_本文件为自动生成的导航索引，随知识库生成/更新重建，请勿手工维护。_', '');
  return out.join('\n');
}

// 最终校验：解析已渲染 INDEX.md 里每个 `§标题 (L行号)` 引用，回到源文档断言该行
// 确为对应标题（ATX 或 setext）。既拦脚本渲染错误，也拦 LLM 填速查表时误改行号，
// 并拦重名文档歧义。返回不匹配清单（空即通过）。
function verifyRenderedIndex(root, indexPath) {
  const text = fs.readFileSync(indexPath, 'utf8');
  const cache = new Map();
  const readLines = rel => {
    if (!cache.has(rel)) cache.set(rel, fs.readFileSync(path.join(root, rel), 'utf8').split(/\r?\n/));
    return cache.get(rel);
  };
  const mismatches = [];
  // 当前 ### 文档路径上下文，供文档目录条目定位归属文件
  let currentDoc = '';
  for (const line of text.split(/\r?\n/)) {
    const docMatch = line.match(/^###\s+(\S+\.md)\s*$/);
    if (docMatch) { currentDoc = docMatch[1]; continue; }
    // 主题速查表一行可含多份文档（跨文档倒排）：`文档A.md → §x(Ln) · 文档B.md → §y(Lm)`。
    // 按位置把每个 §标题(L行号) 归属到它前面最近的 .md；行内无 .md 时用文档目录上下文 currentDoc。
    const refs = [...line.matchAll(/§([^§(]+?)\s*\(L(\d+)\)/g)];
    if (!refs.length) continue;
    const docHits = [...line.matchAll(/([^\s`|]+?\.md)/g)].map(m => ({name: m[1], pos: m.index}));
    for (const ref of refs) {
      const heading = ref[1].replace(/`[^`]*`/g, '').trim();
      const lineNo = Number(ref[2]);
      const owning = docHits.filter(d => d.pos < ref.index).pop();
      const docName = owning ? owning.name : currentDoc;
      const docRel = resolveDocPath(root, docName);
      if (!docRel) {
        const base = path.basename((docName || '').replace(/\\/g, '/'));
        const dup = markdownFiles(root).filter(f => path.basename(f) === base);
        const reason = dup.length > 1 ? `文档名重名歧义（需写完整相对路径）：${dup.join(' | ')}` : `无法定位文档 ${docName}`;
        mismatches.push({heading, line: lineNo, actual: reason});
        continue;
      }
      const actual = headingTextAt(readLines(docRel), lineNo);
      if (actual == null || !actual.replace(/`[^`]*`/g, '').replace(/\s+/g, ' ').trim().startsWith(heading.replace(/\s+/g, ' '))) {
        mismatches.push({doc: docRel, heading, line: lineNo, actual: (readLines(docRel)[lineNo - 1] || '').trim()});
      }
    }
  }
  return mismatches;
}

// 把索引里的文档名解析为根下真实相对路径。优先完整相对路径；basename 回退仅在
// 全库唯一时启用；重名或找不到都返回 null（由调用方报歧义），绝不猜。
function resolveDocPath(root, name) {
  if (!name) return null;
  const rel = name.replace(/\\/g, '/').replace(/^\.\//, '');
  const abs = path.join(root, rel);
  if (fs.existsSync(abs) && fs.statSync(abs).isFile()) return rel;
  const base = path.basename(rel);
  const hits = markdownFiles(root).filter(f => path.basename(f) === base);
  return hits.length === 1 ? hits[0] : null;
}

// 主题速查表占位标记：脚本渲染时插入，LLM 步骤用真实速查表替换整块。
const TOPIC_PLACEHOLDER = '<!-- TOPIC-TABLE: 由 product-kb-index 的语义步骤填充；每个章节引用写成 §标题(L行号)，行号取自下方文档目录，不得自行推算 -->';

const README_POINTER = '> 🔎 快速定位见 [INDEX.md](./INDEX.md)';

// 在 README 顶部（YAML frontmatter 之后、正文之前）插入指向 INDEX.md 的指针。
// 幂等：已存在则不重复插入。正确处理 frontmatter 边界，不破坏 YAML。
// 返回 'inserted' | 'exists' | 'no-readme'。
function insertReadmePointer(root) {
  const readmePath = path.join(root, 'README.md');
  if (!fs.existsSync(readmePath)) return 'no-readme';
  const content = fs.readFileSync(readmePath, 'utf8');
  if (content.includes('INDEX.md')) return 'exists';
  const lines = content.split(/\r?\n/);
  let insertAt = 0;
  // 跳过起始 frontmatter 块
  if (lines[0] !== undefined && /^---\s*$/.test(lines[0])) {
    for (let i = 1; i < lines.length; i += 1) {
      if (/^---\s*$/.test(lines[i])) { insertAt = i + 1; break; }
    }
  }
  // 指针后接一个空行，与后续内容分隔
  lines.splice(insertAt, 0, README_POINTER, '');
  fs.writeFileSync(readmePath, lines.join('\n'));
  return 'inserted';
}

// 临时工作区：构建中间产物（骨架 + 草稿 INDEX）写在这里，位于知识库目录之外。
// 按「知识库路径哈希 / session」两级隔离：
//   - 知识库哈希做命名空间，天然隔离不同知识库；
//   - session（build 时生成的唯一 id）隔离同一知识库的并发运行，
//     两个任务同时给同一 KB 建索引也不会互相覆盖或误删。
// verify/finalize 通过 --session 复算出自己的工作区，无需传完整路径。
function workNamespaceFor(absRoot) {
  const key = crypto.createHash('sha256').update(absRoot, 'utf8').digest('hex').slice(0, 16);
  return path.join(os.tmpdir(), 'product-kb-index', key);
}

function workDirFor(absRoot, session) {
  // session 只允许安全字符，防止越界写/删
  const safe = String(session || '').replace(/[^a-zA-Z0-9_-]/g, '');
  if (!safe) throw new Error('缺少有效 session');
  return path.join(workNamespaceFor(absRoot), safe);
}

function newSession() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 16);
}

// 源健康度报告：把无法很好规范化处理的文档显式列出，让人先知道源有多脏，
// 而不是让索引静默地对脏数据尽力而为。纯只读，不改任何文件。
function buildHealthReport(root) {
  const files = markdownFiles(root);
  const parsed = files.map(rel => ({rel, doc: parseDoc(rel, fs.readFileSync(path.join(root, rel), 'utf8'))}));

  const noHeadings = [];   // 无任何可导航章节
  const emptyOrTiny = [];  // 空或极小（正文 < 40 字）
  const numberingIssues = []; // 章节编号断裂/乱序/重号
  for (const {rel, doc} of parsed) {
    if (!doc.sections.length) noHeadings.push(rel);
    const raw = fs.readFileSync(path.join(root, rel), 'utf8').replace(/^---[\s\S]*?---/, '').replace(/[#>|*`\-\s]/g, '');
    if (raw.length < 40) emptyOrTiny.push(rel);
    // 阿拉伯数字前缀的章节，检查是否严格递增
    const nums = doc.sections.map(s => { const m = s.heading.match(/^(\d+)[.、]/); return m ? Number(m[1]) : null; }).filter(n => n != null);
    if (nums.length >= 2) {
      const disordered = nums.some((n, i) => i > 0 && n <= nums[i - 1]);
      if (disordered) numberingIssues.push({path: rel, sequence: nums.join(',')});
    }
  }

  // 跨文档重名（basename 冲突）——会让速查表用裸文件名时归属失真
  const byBase = {};
  for (const rel of files) { const b = path.basename(rel); (byBase[b] = byBase[b] || []).push(rel); }
  const duplicateBasenames = Object.entries(byBase).filter(([, v]) => v.length > 1).map(([base, paths]) => ({base, paths}));

  const issues = noHeadings.length + emptyOrTiny.length + numberingIssues.length + duplicateBasenames.length;
  return {
    schemaVersion: SCHEMA_VERSION,
    docCount: files.length,
    healthy: issues === 0,
    noHeadings,
    emptyOrTiny,
    numberingIssues,
    duplicateBasenames,
  };
}

function argValue(argv, flag) {
  const i = argv.indexOf(flag);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : '';
}

function main(argv = process.argv.slice(2)) {
  const root = argv[0];
  if (!root) throw new Error('用法: build_index.js <root> [--report | --verify [--session id] | --finalize --session id | --readme-pointer]');
  const absRoot = path.resolve(root);

  if (argv.includes('--report')) {
    const report = buildHealthReport(absRoot);
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }

  if (argv.includes('--readme-pointer')) {
    const result = insertReadmePointer(absRoot);
    process.stdout.write(`${JSON.stringify({readmePointer: result})}\n`);
    return;
  }

  const session = argValue(argv, '--session');

  if (argv.includes('--verify')) {
    // 有 session → 校验该运行的临时草稿；否则回退校验已定稿的 <root>/INDEX.md（事后复核）
    let target;
    let kind;
    if (session) { target = path.join(workDirFor(absRoot, session), 'INDEX.draft.md'); kind = 'draft'; }
    else { target = path.join(absRoot, 'INDEX.md'); kind = 'committed'; }
    if (!fs.existsSync(target)) {
      throw new Error(session ? `未找到 session=${session} 的草稿，请确认构建时返回的 session` : '未找到已定稿 INDEX.md；定稿前校验请带 --session <构建返回的 id>');
    }
    const bad = verifyRenderedIndex(absRoot, target);
    if (bad.length) {
      console.error(`INDEX 行号校验失败，共 ${bad.length} 处：`);
      for (const m of bad) console.error(`  ${m.doc || ''} | §${m.heading} @L${m.line} | 实际: ${m.actual}`);
      process.exitCode = 1;
      return;
    }
    process.stdout.write(`${JSON.stringify({verify: 'ok', target: kind})}\n`);
    return;
  }

  if (argv.includes('--finalize')) {
    // 定稿必须带 session：校验通过后才把该运行的草稿落进知识库，随后插指针并只删自己的临时区
    if (!session) throw new Error('--finalize 必须带 --session <构建返回的 id>');
    const workDir = workDirFor(absRoot, session);
    const draftPath = path.join(workDir, 'INDEX.draft.md');
    if (!fs.existsSync(draftPath)) throw new Error(`未找到 session=${session} 的草稿，请先构建并填充主题速查表`);
    const bad = verifyRenderedIndex(absRoot, draftPath);
    if (bad.length) {
      console.error(`定稿前校验失败，共 ${bad.length} 处，未写入知识库：`);
      for (const m of bad) console.error(`  ${m.doc || ''} | §${m.heading} @L${m.line} | 实际: ${m.actual}`);
      process.exitCode = 1;
      return;
    }
    fs.writeFileSync(path.join(absRoot, 'INDEX.md'), fs.readFileSync(draftPath, 'utf8'));
    const readmePointer = insertReadmePointer(absRoot);
    fs.rmSync(workDir, {recursive: true, force: true}); // 只删本 session 的工作区，不影响其它并发运行
    process.stdout.write(`${JSON.stringify({finalized: true, session, index: path.join(absRoot, 'INDEX.md'), readmePointer, workDirRemoved: true})}\n`);
    return;
  }

  // 默认构建：为本次运行生成唯一 session，中间产物写进该 session 的独立临时工作区。
  // 同一知识库并发构建各自拥有独立 session，互不覆盖；知识库目录此刻零改动。
  const skeleton = buildSkeleton(absRoot);
  const mismatches = verifyLineNumbers(absRoot, skeleton);
  if (mismatches.length) {
    console.error(`行号自检失败，共 ${mismatches.length} 处漂移：`);
    for (const m of mismatches) console.error(`  ${m.path} | 期望 §${m.heading} @L${m.line} | 实际: ${m.actual}`);
    process.exitCode = 1;
    return;
  }

  const runSession = newSession();
  const workDir = workDirFor(absRoot, runSession);
  fs.mkdirSync(workDir, {recursive: true});
  const skeletonPath = path.join(workDir, 'index-skeleton.json');
  const draftPath = path.join(workDir, 'INDEX.draft.md');
  fs.writeFileSync(skeletonPath, `${JSON.stringify(skeleton, null, 2)}\n`);
  const draft = renderIndex(skeleton, {title: path.basename(absRoot), topicTable: TOPIC_PLACEHOLDER});
  fs.writeFileSync(draftPath, draft);

  const health = buildHealthReport(absRoot);
  process.stdout.write(`${JSON.stringify({
    docs: skeleton.docs.length,
    session: runSession,
    skeleton: skeletonPath,
    draftIndex: draftPath,
    lineCheck: 'ok',
    kbUntouched: true,
    health: {
      healthy: health.healthy,
      noHeadings: health.noHeadings.length,
      emptyOrTiny: health.emptyOrTiny.length,
      numberingIssues: health.numberingIssues.length,
      duplicateBasenames: health.duplicateBasenames.length,
    },
    next: '编辑 draftIndex 填主题速查表 → --verify --session <session> → --finalize --session <session>',
  })}\n`);
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(`构建索引失败: ${error.message}`); process.exitCode = 1; }
}

module.exports = {
  SCHEMA_VERSION, fingerprint, markdownFiles, parseFrontmatter, parseDoc,
  computeFenceMask, extractHeadings, headingTextAt, pickSectionLevel,
  buildSkeleton, verifyLineNumbers, verifyRenderedIndex, resolveDocPath,
  renderIndex, insertReadmePointer, buildHealthReport,
  workNamespaceFor, workDirFor, newSession, isMetaHeading, TOPIC_PLACEHOLDER, main,
};
