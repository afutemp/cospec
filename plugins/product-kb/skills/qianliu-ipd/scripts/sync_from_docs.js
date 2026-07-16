#!/usr/bin/env node
'use strict';

/**
 * IPD 批量同步脚本
 * 将本地需求文档（Epic→Feature→Story→Tech-系统级→Tech-服务级）同步到 IPD 系统
 *
 * 使用方式：
 *   node sync_from_docs.js <docsRoot> [options]
 *
 * 参数：
 *   docsRoot      - 需求文档根目录（包含 Epic-xxx 目录的路径）
 *
 * 选项：
 *   --productId     - 产品 ID（默认从环境变量或配置读取）
 *   --projectId     - 项目 ID（默认从环境变量或配置读取）
 *   --versionId     - 版本 ID（默认从环境变量或配置读取）
 *   --indexFile     - 索引文件输出路径（可选，默认 ipd_index.yaml）
 *   --dry-run       - 仅扫描不创建（预览模式）
 *
 * 目录结构支持：
 * - Epic-xxx/README.md
 * - Feature-xxx/README.md
 * - Story-xxx/README.md（如 Story1.1-将安全保密管理员更名为授权管理员）
 * - Tech-系统级-xxx/README.md
 * - Tech-服务级-xxx/README.md（目录形式，名称保留完整描述）
 * - Tech-服务级/名字.md（文件形式，去掉 .md 后缀）
 *
 * 输出：
 *   - 在 IPD 创建对应层级的需求条目
 *   - 生成 YAML 索引文件记录本地路径与 IPD ID 的映射，支持工作量字段
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

// ── 简易 YAML 解析器（无外部依赖）──────────────────────────────

/**
 * 简易 YAML 解析器，支持基本结构
 * 仅支持本项目所需的格式，不处理复杂 YAML 特性
 */
function parseYaml(content) {
  const lines = content.split('\n');
  const result = {};
  let currentObj = result;
  const stack = [{ obj: result, indent: -1 }];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    // 跳过空行和注释
    if (/^\s*#/.test(rawLine) || /^\s*$/.test(rawLine)) continue;

    const indent = rawLine.match(/^(\s*)/)[1].length;
    const line = rawLine.trim();

    // 根据缩进调整当前对象
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }
    currentObj = stack[stack.length - 1].obj;

    // 解析键值对
    const keyValueMatch = line.match(/^([a-z_][a-z0-9_]*):\s*(.*)$/i);
    if (keyValueMatch) {
      const [, key, valuePart] = keyValueMatch;
      const value = parseValue(valuePart);

      if (valuePart === '' || valuePart === null) {
        // 空值，创建对象或保持为空
        if (key === 'issues' || key === 'meta' || key === 'stats' || key === 'children') {
          currentObj[key] = key === 'issues' ? [] : {};
          stack.push({ obj: currentObj[key], indent });
        } else {
          currentObj[key] = value;
        }
      } else {
        currentObj[key] = value;
      }
      continue;
    }

    // 解析列表项
    if (line.startsWith('- ')) {
      const itemContent = line.slice(2).trim();
      const itemMatch = itemContent.match(/^([a-z_][a-z0-9_]*):\s*(.*)$/i);

      if (itemMatch) {
        const [, itemKey, itemValue] = itemMatch;
        const item = { [itemKey]: parseValue(itemValue) };

        if (Array.isArray(currentObj)) {
          currentObj.push(item);
          stack.push({ obj: item, indent: indent + 2 });
        }
      }
      continue;
    }

    // 处理列表项内的键值对
    const listKeyMatch = line.match(/^([a-z_][a-z0-9_]*):\s*(.*)$/i);
    if (listKeyMatch && stack.length > 1) {
      const [, key, valuePart] = listKeyMatch;
      const value = parseValue(valuePart);
      if (typeof currentObj === 'object' && currentObj !== null && !Array.isArray(currentObj)) {
        currentObj[key] = value;
      }
    }
  }

  return result;
}

function parseValue(valueStr) {
  const str = valueStr.trim();
  if (!str || str === 'null') return null;
  if (str === 'true') return true;
  if (str === 'false') return false;
  // 数字
  if (/^-?\d+(\.\d+)?$/.test(str)) return parseFloat(str);
  // 引号字符串
  if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
    return str.slice(1, -1);
  }
  // 普通字符串
  return str;
}

/**
 * 将对象序列化为 YAML 格式
 */
function stringifyYaml(obj, indent = 0) {
  const lines = [];
  const indentStr = '  '.repeat(indent);

  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) continue;

    if (key === 'children' && Array.isArray(value)) {
      lines.push(`${indentStr}children:`);
      for (const item of value) {
        if (typeof item === 'object' && item !== null) {
          lines.push(`${indentStr}  -`);
          const itemLines = stringifyYamlItem(item, indent + 2);
          for (const line of itemLines) {
            lines.push(line);
          }
        } else {
          lines.push(`${indentStr}  - ${formatValue(item)}`);
        }
      }
    } else if (Array.isArray(value)) {
      lines.push(`${indentStr}${key}:`);
      for (const item of value) {
        if (typeof item === 'object' && item !== null) {
          lines.push(`${indentStr}  -`);
          const itemLines = stringifyYamlItem(item, indent + 2);
          for (const line of itemLines) {
            lines.push(line);
          }
        } else {
          lines.push(`${indentStr}  - ${formatValue(item)}`);
        }
      }
    } else if (typeof value === 'object') {
      lines.push(`${indentStr}${key}:`);
      lines.push(stringifyYaml(value, indent + 1));
    } else {
      lines.push(`${indentStr}${key}: ${formatValue(value)}`);
    }
  }

  return lines.join('\n');
}

function formatValue(value) {
  if (value === null) return 'null';
  if (typeof value === 'string') {
    // 包含特殊字符时用引号
    if (/[#:{}[\],&*?|\-<>]/.test(value) || value.includes(' ')) {
      return `"${value.replace(/"/g, '\\"')}"`;
    }
    return value;
  }
  return String(value);
}

// ── 旧格式（Markdown）转换 ───────────────────────────────────

/**
 * 将旧的 ipd_index.md 转换为 ipd_index.yaml
 */
function convertMdToYaml(mdContent, config = {}) {
  const lines = mdContent.split('\n');
  const issues = [];
  let currentIssue = null;
  let parentIdStack = [];

  // 解析头部信息
  let projectId = config.projectId || null;
  let versionId = config.versionId || null;
  let teamId = config.teamId || null;

  const headerMatch = mdContent.match(/项目:\s*(\d+)/);
  if (headerMatch) projectId = parseInt(headerMatch[1], 10);
  const versionMatch = mdContent.match(/版本:\s*(\d+)/);
  if (versionMatch) versionId = parseInt(versionMatch[1], 10);
  const teamMatch = mdContent.match(/团队:\s*(\d+)/);
  if (teamMatch) teamId = parseInt(teamMatch[1], 10);

  // 解析需求列表
  const tableStart = lines.findIndex(l => l.includes('## 详细列表'));
  if (tableStart === -1) {
    // 尝试从层级结构解析
    for (const line of lines) {
      const epicMatch = line.match(/📘.*?(\d+).*?:\s*(.+)/);
      const featureMatch = line.match(/📗.*?(\d+).*?:\s*(.+)/);
      const storyMatch = line.match(/📙.*?(\d+).*?:\s*(.+)/);
      const techMatch = line.match(/📓.*?(\d+).*?:\s*(.+)/);

      if (epicMatch) {
        issues.push({
          id: parseInt(epicMatch[1], 10),
          type: 'epic',
          name: epicMatch[2].trim(),
          url: `https://ipd.atrust.sangfor.com/ipd/product/${config.productId || 6}/issue/${epicMatch[1]}`,
          local_path: '',
          estimated_day: null,
          children: []
        });
        parentIdStack = [issues.length - 1];
      } else if (featureMatch && parentIdStack.length > 0) {
        const parent = getNestedParent(issues, parentIdStack);
        if (parent) {
          parent.children = parent.children || [];
          parent.children.push({
            id: parseInt(featureMatch[1], 10),
            type: 'feature',
            name: featureMatch[2].trim(),
            url: `https://ipd.atrust.sangfor.com/ipd/product/${config.productId || 6}/issue/${featureMatch[1]}`,
            local_path: '',
            estimated_day: null,
            children: []
          });
          parentIdStack.push(parent.children.length - 1);
        }
      } else if (storyMatch && parentIdStack.length > 0) {
        const parent = getNestedParent(issues, parentIdStack);
        if (parent) {
          parent.children = parent.children || [];
          parent.children.push({
            id: parseInt(storyMatch[1], 10),
            type: 'story',
            name: storyMatch[2].trim(),
            url: `https://ipd.atrust.sangfor.com/ipd/product/${config.productId || 6}/issue/${storyMatch[1]}`,
            local_path: '',
            estimated_day: null,
            children: []
          });
          parentIdStack.push(parent.children.length - 1);
        }
      } else if (techMatch && parentIdStack.length > 0) {
        const parent = getNestedParent(issues, parentIdStack);
        if (parent) {
          parent.children = parent.children || [];
          const level = line.includes('系统级') ? '系统级' : '服务级';
          parent.children.push({
            id: parseInt(techMatch[1], 10),
            type: 'tech',
            level,
            name: techMatch[2].trim(),
            url: `https://ipd.atrust.sangfor.com/ipd/product/${config.productId || 6}/issue/${techMatch[1]}`,
            local_path: '',
            estimated_day: 1 // Tech 默认工作量 1 天
          });
        }
      }
    }
  } else {
    // 从表格解析
    for (let i = tableStart; i < lines.length; i++) {
      const line = lines[i];
      if (!line.includes('|')) continue;

      const cells = line.split('|').map(c => c.trim()).filter(c => c);
      if (cells.length >= 5 && cells[1] !== '类型') {
        const type = cells[1];
        const id = parseInt(cells[2], 10);
        const name = cells[3];
        const localPath = cells[5] || '';

        issues.push({
          id,
          type,
          name,
          url: `https://ipd.atrust.sangfor.com/ipd/product/${config.productId || 6}/issue/${id}`,
          local_path: localPath.replace(/`/g, ''),
          estimated_day: type === 'tech' ? 1 : null,
          children: []
        });
      }
    }
  }

  return {
    meta: {
      project_id: projectId,
      version_id: versionId,
      team_id: teamId,
      product_id: config.productId || 6,
      sync_time: new Date().toISOString(),
    },
    issues,
    stats: {
      epic: issues.filter(i => i.type === 'epic').length,
      feature: issues.filter(i => i.type === 'feature').length,
      story: issues.filter(i => i.type === 'story').length,
      tech: issues.filter(i => i.type === 'tech').length,
      total: issues.length,
    }
  };
}

function getNestedParent(issues, stack) {
  let current = issues[stack[0]];
  for (let i = 1; i < stack.length; i++) {
    if (current && current.children && current.children[stack[i]]) {
      current = current.children[stack[i]];
    } else {
      return null;
    }
  }
  return current;
}

// ── 参数解析 ─────────────────────────────────────────────────

function parseArgs(args) {
  const result = {
    docsRoot: null,
    productId: null,
    projectId: null,
    versionId: null,
    indexFile: null,
    dryRun: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--productId') {
      result.productId = parseInt(args[++i], 10);
    } else if (arg === '--projectId') {
      result.projectId = parseInt(args[++i], 10);
    } else if (arg === '--versionId') {
      result.versionId = parseInt(args[++i], 10);
    } else if (arg === '--indexFile') {
      result.indexFile = args[++i];
    } else if (arg === '--dry-run') {
      result.dryRun = true;
    } else if (!arg.startsWith('-') && !result.docsRoot) {
      result.docsRoot = arg;
    }
  }

  return result;
}

// ── Markdown 转 HTML ─────────────────────────────────

function markdownToHtml(md, filePath) {
  if (!md) return '';
  const _inline = (text) => inline(text, filePath);
  const code = [];
  const lines = md.replace(/\r\n?/g, '\n').replace(/^\d+\t/gm, '')
    .replace(/```([^\n`]*)\n([\s\S]*?)```/g, (_, lang, body) => {
      const cls = lang.trim() ? ` class="language-${escapeHtml(lang.trim())}"` : '';
      code.push(`<pre><code${cls}>${escapeHtml(body)}</code></pre>`);
      return `\u0000CODE${code.length - 1}\u0000`;
    }).split('\n');
  const out = [];
  const isSep = s => /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(s.trim());
  const isTable = i => lines[i] && lines[i].includes('|') && isSep(lines[i + 1] || '');
  const isList = s => /^\s*(?:[-*+]|\d+\.)\s+/.test(s);
  const isBlock = i => !lines[i] || /^\u0000CODE\d+\u0000$/.test(lines[i].trim()) || /^(#{1,6}\s+|---+$)/.test(lines[i].trim()) || isTable(i) || isList(lines[i]);

  for (let i = 0; i < lines.length;) {
    const line = lines[i], s = line.trim();
    if (!s) { i++; continue; }
    const token = s.match(/^\u0000CODE(\d+)\u0000$/);
    if (token) { out.push(code[+token[1]]); i++; continue; }
    const h = s.match(/^(#{1,6})\s+(.+)$/);
    if (h) { out.push(`<h${h[1].length}>${_inline(h[2])}</h${h[1].length}>`); i++; continue; }
    if (/^---+$/.test(s)) { out.push('<hr>'); i++; continue; }
    if (isTable(i)) {
      const rows = [lines[i++]]; i++;
      while (lines[i] && lines[i].includes('|')) rows.push(lines[i++]);
      out.push(renderTable(rows, filePath));
      continue;
    }
    if (isList(line)) {
      const tag = /^\s*\d+\./.test(line) ? 'ol' : 'ul', items = [];
      while (isList(lines[i] || '')) items.push(`<li>${_inline(lines[i++].replace(/^\s*(?:[-*+]|\d+\.)\s+/, ''))}</li>`);
      out.push(`<${tag}>${items.join('')}</${tag}>`);
      continue;
    }
    const para = [];
    while (lines[i] && !isBlock(i)) para.push(lines[i++].trim());
    out.push(`<p>${_inline(para.join('\u0000BR\u0000')).replace(/\u0000BR\u0000/g, '<br>')}</p>`);
  }
  return out.join('\n\n');
}

function renderTable(lines, filePath) {
  const cells = row => row.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
  const [head, ...body] = lines.map(cells);
  const tr = (row, tag) => `<tr>${row.map(c => `<${tag}>${inline(c, filePath)}</${tag}>`).join('')}</tr>`;
  return `<table>\n<thead>${tr(head, 'th')}</thead>\n<tbody>${body.map(r => tr(r, 'td')).join('\n')}</tbody>\n</table>`;
}

function inline(text, filePath) {
  /* 先提取图片和链接，替换为占位符，避免 escapeHtml 破坏语法 */
  const placeholders = [];
  const hold = (html) => { const id = `\u0000PH${placeholders.length}\u0000`; placeholders.push(html); return id; };
  let result = text;
  /* 图片必须在链接之前处理，否则 ![alt](url) 会被链接正则先匹配 */
  result = result.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, url) => {
    const resolvedUrl = resolveImageUrl(url, filePath);
    return hold(`<img src="${escapeHtml(resolvedUrl)}" alt="${escapeHtml(alt)}" style="max-width:100%;height:auto;">`);
  });
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, txt, url) => {
    return hold(`<a href="${escapeHtml(url)}" target="_blank">${escapeHtml(txt)}</a>`);
  });
  result = escapeHtml(result)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
  /* 还原占位符 */
  result = result.replace(/\u0000PH(\d+)\u0000/g, (_, i) => placeholders[parseInt(i)]);
  return result;
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── 仓库远程 URL 基础路径 ─────────────────────────────────

/** 缓存仓库远程基础路径，格式：https://git.sangfor.com/HCI/hci-7.0.0/start/-/raw/master */
let _repoBaseUrl = null;

function getRepoBaseUrl() {
  if (_repoBaseUrl !== null) return _repoBaseUrl;
  try {
    const raw = execSync('git remote get-url origin', { encoding: 'utf-8' }).trim();
    const https = raw.replace(/^git@([^:]+):(.+)\.git$/, 'https://$1/$2');
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
    _repoBaseUrl = `${https}/-/raw/${branch}`;
  } catch (_) {
    _repoBaseUrl = '';
  }
  return _repoBaseUrl;
}

/**
 * 将 Markdown 中的相对图片路径转换为仓库绝对 URL
 * @param {string} imgPath - 图片原始路径（可能是相对路径或绝对 URL）
 * @param {string} filePath - 当前 Markdown 文件的路径
 * @returns {string} 转换后的 URL
 */
function resolveImageUrl(imgPath, filePath) {
  if (!imgPath) return imgPath;
  // 已经是绝对 URL（http/https/data:）或以 / 开头的绝对路径，直接返回不做转换
  if (/^(https?:|data:|\/)/i.test(imgPath)) return imgPath;
  const base = getRepoBaseUrl();
  if (!base) return imgPath;
  // 基于 Markdown 文件所在目录解析相对路径
  const fileDir = path.dirname(path.resolve(filePath));
  const resolved = path.resolve(fileDir, imgPath);
  // 转为相对于仓库根目录的路径
  let repoRoot;
  try {
    repoRoot = execSync('git rev-parse --show-toplevel', { encoding: 'utf-8' }).trim();
  } catch (_) {
    return imgPath;
  }
  const relToRepo = path.relative(repoRoot, resolved).replace(/\\/g, '/');
  return `${base}/${relToRepo}`;
}

// ── 目录扫描 ────────────────────────────────────────────────

function listDirs(dirPath) {
  try {
    return fs.readdirSync(dirPath, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name)
      .sort(naturalSort);
  } catch {
    return [];
  }
}

function listFiles(dirPath) {
  try {
    return fs.readdirSync(dirPath, { withFileTypes: true })
      .filter(d => d.isFile())
      .map(d => d.name)
      .sort(naturalSort);
  } catch {
    return [];
  }
}

const collator = new Intl.Collator('zh-Hans-CN', { numeric: true, sensitivity: 'base' });
function naturalSort(a, b) { return collator.compare(a, b); }

/**
 * 提取名称（保留完整编号）
 * 支持灵活命名：
 *   Epic1-xxx → Epic1：xxx
 *   E04.xxx → E04.xxx（保留原样）
 *   Story1.1-xxx → Story1.1：xxx
 *   【Epic】xxx → 【Epic】xxx（保留原样）
 */
function extractName(dirName, prefix) {
  // 支持短编号格式 E04.xxx / F04.xxx / S04.xxx
  const shortPrefixMap = { 'Epic': 'E', 'Feature': 'F', 'Story': 'S' };
  const shortPrefix = shortPrefixMap[prefix];
  if (shortPrefix) {
    const shortMatch = dirName.match(new RegExp(`^(${shortPrefix}\\d+[.\\-_])(.*)$`, 'i'));
    if (shortMatch) {
      const [, head, tail] = shortMatch;
      if (!tail) return head.replace(/[._-]$/, '');
      return `${head.replace(/[._-]$/, '')}：${tail}`;
    }
  }
  // 支持中括号格式 【Epic】xxx / 【Feature】xxx / 【Story】xxx
  const bracketMatch = dirName.match(new RegExp(`^【${prefix}】\\s*(.*)$`, 'i'));
  if (bracketMatch) {
    return bracketMatch[1] ? `【${prefix}】${bracketMatch[1]}` : `【${prefix}】`;
  }
  // 原有逻辑：Epic1-xxx / Feature1.1-xxx / Story1.1.1-xxx
  const match = dirName.match(new RegExp(`^(${prefix}(?:\\d+(?:\\.\\d+)*)?)\\s*[–—\\-_ ]?\\s*(.*)$`, 'i'));
  if (match) {
    const [, head, tail] = match;
    if (!tail) return head;
    return /\d/.test(head) ? `${head}：${tail}` : tail;
  }
  return dirName;
}

/**
 * 提取 Tech 名称
 * 支持灵活命名：
 *   Tech-系统级-角色中心 → Tech-系统级-角色中心
 *   Tech-系统级-1.1.1.1-LACP状态采集服务 → Tech-系统级-1.1.1.1-LACP状态采集服务
 *   【系统级】角色中心 → 【系统级】角色中心
 */
function extractTechName(dirName, level) {
  // 支持中括号格式 【系统级】xxx / 【服务级】xxx
  const bracketMatch = dirName.match(new RegExp(`^【${level}】\\s*(.*)$`));
  if (bracketMatch) return bracketMatch[1] ? `Tech-${level}-${bracketMatch[1]}` : `Tech-${level}`;
  // 原有逻辑：Tech-系统级-xxx / Tech-服务级-xxx
  const match = dirName.match(new RegExp(`^Tech\\s*[–—\\-_ ]\\s*${level}\\s*[–—\\-_ ]?\\s*(.*)$`, 'i'));
  if (match) return match[1] ? `Tech-${level}-${match[1]}` : `Tech-${level}`;
  return dirName;
}

function readDescription(readmePath) {
  if (!fs.existsSync(readmePath)) return '';
  return markdownToHtml(fs.readFileSync(readmePath, 'utf-8'), readmePath);
}

/**
 * 根据目录名前缀和深度推断节点类型
 * 前缀优先匹配，无前缀时按深度推断：
 *   depth 0 = epic, 1 = feature, 2 = story, 3 = system-tech, 4+ = service-tech
 */
function nodeKind(name, depth) {
  // 前缀优先匹配（兼容带编号的目录名，如 Epic1-xxx、Feature1.1-xxx）
  if (/^Epic(?:\d+)?[-–—_\s]/i.test(name) || /^Epic\d+$/i.test(name)) return 'epic';
  // 短编号格式：E04.xxx / E04-xxx / E04 xxx
  if (/^E\d+[.–—_\s]/i.test(name)) return 'epic';
  if (/^Feature(?:\d+(?:\.\d+)*)?[-–—_\s]/i.test(name) || /^Feature\d+$/i.test(name)) return 'feature';
  // 短编号格式：F04.xxx / F04-xxx / F04 xxx
  if (/^F\d+[.–—_\s]/i.test(name)) return 'feature';
  if (/^Story(?:\d+(?:\.\d+)*)?[-–—_\s]/i.test(name) || /^Story\d+$/i.test(name)) return 'story';
  // 短编号格式：S04.xxx / S04-xxx / S04 xxx
  if (/^S\d+[.–—_\s]/i.test(name)) return 'story';
  if (/^Tech\s*[–—\-_]\s*系统级/i.test(name) || /^【UEDC】/i.test(name)) return 'system-tech';
  if (/^Tech\s*[–—\-_]\s*服务级/i.test(name)) return 'service-tech';
  // 无前缀时按深度推断（仅 depth 1~4，depth 0 不推断为 epic）
  const depthMap = { 1: 'feature', 2: 'story', 3: 'system-tech', 4: 'service-tech' };
  return depthMap[depth] || 'folder';
}

/**
 * 提取节点名称（兼容有前缀和无前缀两种情况）
 */
function extractNodeName(dirName, kind) {
  const prefixMap = {
    'epic': 'Epic',
    'feature': 'Feature',
    'story': 'Story',
  };
  const prefix = prefixMap[kind];
  if (prefix) return extractName(dirName, prefix);
  if (kind === 'system-tech' || kind === 'service-tech') {
    const level = kind === 'system-tech' ? '系统级' : '服务级';
    return extractTechName(dirName, level);
  }
  return dirName;
}

/**
 * 扫描需求目录结构（递归，基于深度+前缀推断类型）
 * @param {string} docsRoot - 文档根目录
 * @param {number} depth - 当前扫描深度（0=epic层）
 */
function scanRequirements(docsRoot) {
  const tree = { epics: [] };

  const entries = listDirs(docsRoot).filter(d => {
    // 跳过隐藏目录和索引文件
    if (d.startsWith('.')) return false;
    if (d === 'ipd_index.yaml' || d === 'ipd_index.md' || d === '系统需求分析总结.md') return false;
    return true;
  });

  for (const entry of entries) {
    const kind = nodeKind(entry, 0);
    if (kind === 'epic' || kind === 'feature' || kind === 'story' || kind === 'system-tech' || kind === 'service-tech') {
      const node = buildNode(docsRoot, entry, 0, kind);
      if (node) tree.epics.push(node);
    }
  }

  return tree;
}

/**
 * 递归构建节点
 * @param {string} parentPath - 父目录绝对路径
 * @param {string} dirName - 当前目录名
 * @param {number} depth - 当前深度
 * @param {string} kind - 节点类型
 */
function buildNode(parentPath, dirName, depth, kind) {
  const fullPath = path.join(parentPath, dirName);
  const name = extractNodeName(dirName, kind);

  if (kind === 'epic') {
    const node = {
      type: 'epic',
      kind: 'epic',
      dirName,
      name,
      readmePath: path.join(fullPath, 'README.md'),
      ipdId: null,
      estimatedDay: null,
      features: []
    };
    for (const child of scanChildren(fullPath, depth + 1)) {
      if (child.kind === 'feature') node.features.push(child);
      else if (child.kind === 'story') { node.features.push({ ...child, type: 'feature', stories: [child] }); }
      else if (child.kind === 'system-tech') { node.features.push({ type: 'feature', kind: 'feature', dirName, name: `${name}-隐含Feature`, readmePath: node.readmePath, ipdId: null, estimatedDay: null, stories: [{ type: 'story', kind: 'story', dirName, name: `${name}-隐含Story`, readmePath: node.readmePath, ipdId: null, estimatedDay: null, techs: [child] }] }); }
    }
    return node;
  }

  if (kind === 'feature') {
    const node = {
      type: 'feature',
      kind: 'feature',
      dirName,
      name,
      readmePath: path.join(fullPath, 'README.md'),
      ipdId: null,
      estimatedDay: null,
      stories: []
    };
    for (const child of scanChildren(fullPath, depth + 1)) {
      if (child.kind === 'story') node.stories.push(child);
      else if (child.kind === 'system-tech') {
        /* Tech 直接挂在 Feature 下，隐含 Story 层 */
        node.stories.push({
          type: 'story',
          kind: 'story',
          dirName,
          name: `${name}-隐含Story`,
          readmePath: node.readmePath,
          ipdId: null,
          estimatedDay: null,
          techs: [child]
        });
      }
    }
    return node;
  }

  if (kind === 'story') {
    const node = {
      type: 'story',
      kind: 'story',
      dirName,
      name,
      readmePath: path.join(fullPath, 'README.md'),
      ipdId: null,
      estimatedDay: null,
      techs: []
    };
    for (const child of scanChildren(fullPath, depth + 1)) {
      if (child.kind === 'system-tech') node.techs.push(child);
    }
    return node;
  }

  if (kind === 'system-tech') {
    const node = {
      type: 'tech',
      kind: 'system-tech',
      level: '系统级',
      dirName,
      name,
      readmePath: path.join(fullPath, 'README.md'),
      ipdId: null,
      estimatedDay: 1,
      subTechs: []
    };
    for (const child of scanChildren(fullPath, depth + 1)) {
      if (child.kind === 'service-tech') node.subTechs.push(child);
    }
    return node;
  }

  if (kind === 'service-tech') {
    return {
      type: 'tech',
      kind: 'service-tech',
      level: '服务级',
      dirName,
      name,
      readmePath: path.join(fullPath, 'README.md'),
      ipdId: null,
      estimatedDay: 1,
    };
  }

  return null;
}

/**
 * 扫描子目录，根据深度+前缀推断类型并构建节点
 */
function scanChildren(dirPath, depth) {
  const results = [];
  const entries = listDirs(dirPath).filter(d => {
    if (d.startsWith('.')) return false;
    return true;
  });

  for (const entry of entries) {
    const kind = nodeKind(entry, depth);
    if (kind !== 'folder') {
      const node = buildNode(dirPath, entry, depth, kind);
      if (node) results.push(node);
    }
  }

  // 也扫描服务级 .md 文件（和旧逻辑兼容）
  if (depth >= 3) {
    for (const mdFile of listFiles(dirPath).filter(f => /\.md$/i.test(f) && !/^README\.md$/i.test(f))) {
      results.push(makeServiceTech(path.join(dirPath, mdFile), mdFile, mdFile));
    }
  }

  return results;
}

/**
 * 判断目录名是否为指定层级
 * 支持：Epic-xxx / Epic1-xxx / E04.xxx / 【Epic】xxx
 *       Feature-xxx / Feature1-xxx / F04.xxx / 【Feature】xxx
 *       Story-xxx / Story1-xxx / S04.xxx / 【Story】xxx
 */
function isLevelDir(name, level) {
  const shortPrefixMap = { 'Epic': 'E', 'Feature': 'F', 'Story': 'S' };
  const shortPrefix = shortPrefixMap[level];
  // 短编号格式：E04.xxx / F04.xxx / S04.xxx
  if (shortPrefix && new RegExp(`^${shortPrefix}\\d+[.\\-_]`, 'i').test(name)) return true;
  // 中括号格式：【Epic】xxx / 【Feature】xxx / 【Story】xxx
  if (new RegExp(`^【${level}】`, 'i').test(name)) return true;
  // 原有格式：Epic-xxx / Epic1-xxx / Feature1.1-xxx 等
  return new RegExp(`^${level}(?:\\d+(?:\\.\\d+)*)?(?:\\s|[–—\\-_]|$)`, 'i').test(name);
}

/**
 * 判断目录名是否为指定层级的 Tech
 * 支持：Tech-系统级-xxx / Tech-系统级1.1-xxx / 【系统级】xxx
 *       Tech-服务级-xxx / Tech-服务级1.1-xxx / 【服务级】xxx
 */
function isTechDir(name, level) {
  // 中括号格式：【系统级】xxx / 【服务级】xxx
  if (new RegExp(`^【${level}】`, 'i').test(name)) return true;
  // 原有格式：Tech-系统级-xxx / Tech-服务级-xxx
  return new RegExp(`^Tech\\s*[–—\\-_ ]\\s*${level}(?:\\s|[–—\\-_]|$)`, 'i').test(name);
}

function findLevelDirs(root, level) {
  return listDirs(root).filter(d => isLevelDir(d, level));
}

function findTechDirs(root, level) {
  return listDirs(root).filter(d => isTechDir(d, level));
}

function scanServiceTechs(techSystemPath) {
  const result = [];
  for (const mdFile of listFiles(techSystemPath).filter(f => /\.md$/i.test(f) && !/^README\.md$/i.test(f))) {
    result.push(makeServiceTech(path.join(techSystemPath, mdFile), mdFile, mdFile));
  }
  for (const dir of findTechDirs(techSystemPath, '服务级')) {
    const dirPath = path.join(techSystemPath, dir);
    const mdFiles = listFiles(dirPath).filter(f => /\.md$/i.test(f));
    if (mdFiles.length) {
      for (const mdFile of mdFiles) {
        if (/^README\.md$/i.test(mdFile) && mdFiles.length > 1) continue;
        result.push(makeServiceTech(path.join(dirPath, mdFile), `${dir}/${mdFile}`, /^README\.md$/i.test(mdFile) ? serviceNameFromDir(dir) : mdFile));
      }
    } else {
      result.push(makeServiceTech(path.join(dirPath, 'README.md'), dir, serviceNameFromDir(dir)));
    }
  }
  return result;
}

function serviceNameFromDir(dir) {
  // 支持中括号格式：【服务级】xxx
  const bracketMatch = dir.match(new RegExp(`^【服务级】\\s*(.*)$`));
  if (bracketMatch) return bracketMatch[1] || dir;
  // 原有格式
  const name = extractTechName(dir, '服务级').replace(/^Tech-服务级-?/, '');
  return name || dir;
}

function makeServiceTech(readmePath, dirName, rawName) {
  // rawName 可能来自目录名（serviceNameFromDir）或文件名
  // 目录名不含扩展名，直接使用；文件名才需要去掉 .md
  const isFromDir = !rawName.endsWith('.md');
  const name = isFromDir ? rawName : path.basename(rawName, path.extname(rawName));
  return {
    type: 'tech',
    kind: 'service-tech',
    level: '服务级',
    dirName,
    name,
    fullName: `Tech-服务级：${name}`,
    readmePath,
    ipdId: null,
    estimatedDay: 1, // Tech-服务级 默认工作量 1 天
  };
}

// ── 辅助函数 ────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function countItems(tree) {
  let count = 0;
  for (const epic of tree.epics) {
    count++; // Epic
    for (const feature of epic.features) {
      count++; // Feature
      for (const story of feature.stories) {
        count++; // Story
        for (const tech of story.techs) {
          count++; // Tech-系统级
          count += tech.subTechs ? tech.subTechs.length : 0; // Tech-服务级
        }
      }
    }
  }
  return count;
}

/**
 * 从 YAML 索引加载工作量配置
 */
function loadYamlIndex(yamlPath) {
  if (!fs.existsSync(yamlPath)) return null;
  try {
    const content = fs.readFileSync(yamlPath, 'utf-8');
    return parseYaml(content);
  } catch (err) {
    console.warn(`⚠️  解析 YAML 索引失败: ${err.message}`);
    return null;
  }
}

/**
 * 从 YAML 索引获取工作量
 */
function getEstimatedDayFromYaml(yamlData, name, type) {
  if (!yamlData || !yamlData.issues) return undefined;
  return findEstimatedDayInIssues(yamlData.issues, name, type);
}

function findEstimatedDayInIssues(issues, name, type) {
  for (const issue of issues) {
    if (issue.name === name && issue.type === type) {
      return issue.estimated_day;
    }
    if (issue.children) {
      const found = findEstimatedDayInIssues(issue.children, name, type);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

/**
 * 生成 YAML 索引文件
 */
function generateYamlIndex(allItems, config) {
  // 先统计叶子节点
  const stats = {
    epic: 0,
    feature: 0,
    story: 0,
    tech: 0,
    total: 0,
    total_estimated_days: 0,  // 仅叶子节点 Tech
  };

  for (const item of allItems) {
    stats[item.type]++;
    stats.total++;
    // 只有叶子节点 Tech（没有子节点的 Tech）才统计工作量
    if (item.type === 'tech' && (!item.children || item.children.length === 0)) {
      stats.total_estimated_days += item.estimatedDay || 1;
    }
  }

  const lines = [];

  // 统计部分
  lines.push('stats:');
  lines.push(`  epic: ${stats.epic}`);
  lines.push(`  feature: ${stats.feature}`);
  lines.push(`  story: ${stats.story}`);
  lines.push(`  tech: ${stats.tech}`);
  lines.push(`  total: ${stats.total}`);
  lines.push(`  total_estimated_days: ${stats.total_estimated_days}`);

  // 元信息
  lines.push('meta:');
  lines.push(`  project_id: ${config.projectId}`);
  lines.push(`  version_id: ${config.versionId}`);
  lines.push(`  team_id: ${config.teamId}`);
  lines.push(`  product_id: ${config.productId}`);
  lines.push(`  sync_time: "${new Date().toISOString()}"`);

  // 需求列表
  lines.push('issues:');

  // 构建层级结构
  const itemMap = new Map();
  for (const item of allItems) {
    itemMap.set(item.ipdId, { ...item, children: [] });
  }

  for (const item of allItems) {
    if (item.parentId) {
      const parent = itemMap.get(item.parentId);
      if (parent) {
        parent.children.push(itemMap.get(item.ipdId));
      }
    }
  }

  // 根节点
  const rootItems = [];
  for (const item of allItems) {
    if (!item.parentId) {
      rootItems.push(itemMap.get(item.ipdId));
    }
  }

  // 递归生成 YAML
  for (const root of rootItems) {
    lines.push('  -');
    const itemLines = convertToYamlItemRecursive(root, 2);
    for (const line of itemLines) {
      lines.push(line);
    }
  }

  return lines.join('\n');
}

function convertToYamlItemRecursive(item, indent) {
  const lines = [];
  const indentStr = '  '.repeat(indent);

  lines.push(`${indentStr}id: ${item.ipdId}`);
  lines.push(`${indentStr}type: ${item.type}`);
  lines.push(`${indentStr}name: ${formatValue(item.name)}`);
  lines.push(`${indentStr}url: ${formatValue(item.ipdUrl)}`);
  lines.push(`${indentStr}local_path: ${formatValue(item.localPath)}`);

  if (item.type === 'tech') {
    if (item.level) {
      lines.push(`${indentStr}level: ${item.level}`);
    }
    // 只有叶子节点才写工作量
    if (!item.children || item.children.length === 0) {
      lines.push(`${indentStr}estimated_day: ${item.estimatedDay || 1}`);
    }
  }

  if (item.children && item.children.length > 0) {
    lines.push(`${indentStr}children:`);
    for (const child of item.children) {
      lines.push(`${indentStr}  -`);
      const childLines = convertToYamlItemRecursive(child, indent + 2);
      for (const line of childLines) {
        lines.push(line);
      }
    }
  }

  return lines;
}

/**
 * 生成 Markdown 索引（兼容旧格式）
 */
function generateIndexMd(items, config) {
  const lines = [];
  lines.push('# IPD 需求索引');
  lines.push('');
  lines.push(`> 同步时间: ${new Date().toISOString()}`);
  if (config.productId) lines.push(`> 产品 ID: ${config.productId}`);
  if (config.projectId) lines.push(`> 项目 ID: ${config.projectId}`);
  if (config.versionId) lines.push(`> 版本 ID: ${config.versionId}`);
  lines.push('');
  lines.push('## 统计');
  lines.push('');
  lines.push('| 类型 | 数量 |');
  lines.push('|------|------|');

  const stats = { epic: 0, feature: 0, story: 0, tech: 0 };
  for (const item of items) {
    stats[item.type] = (stats[item.type] || 0) + 1;
  }
  for (const [type, count] of Object.entries(stats)) {
    lines.push(`| ${type} | ${count} |`);
  }
  lines.push(`| **总计** | **${items.length}** |`);
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## 完整列表');
  lines.push('');
  lines.push('| 类型 | 层级 | 名称 | IPD ID | URL | 本地路径 | 预计工作量 |');
  lines.push('|------|------|------|--------|-----|----------|-----------|');

  for (const item of items) {
    const workLoad = item.type === 'tech' ? `${item.estimatedDay || 1}天` : '-';
    lines.push(`| ${item.type} | ${item.level || '-'} | ${item.name} | ${item.ipdId} | [链接](${item.ipdUrl}) | \`${item.localPath}\` | ${workLoad} |`);
  }

  return lines.join('\n');
}

// ── 导出模块 ────────────────────────────────────────────────

module.exports = {
  markdownToHtml,
  scanRequirements,
  extractName,
  extractTechName,
  readDescription,
  countItems,
  generateIndexMd,
  generateYamlIndex,
  parseYaml,
  convertMdToYaml,
  loadYamlIndex,
  getEstimatedDayFromYaml,
};

// ── 主同步函数 ──────────────────────────────────────────────

async function syncToIpd(options) {
  const {
    docsRoot,
    productId,
    projectId,
    versionId,
    indexFile,
    dryRun = false,
  } = options;
  let { ipdApi } = options; // 注入 IPD API 模块

  if (!docsRoot) {
    throw new Error('缺少必需参数: docsRoot');
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 IPD 同步脚本（支持工作量同步）');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📂 文档目录: ${docsRoot}`);
  if (dryRun) console.log('👁️  预览模式（仅扫描，不创建）');
  console.log('');

  // 检查并转换旧的 ipd_index.md
  const yamlPath = indexFile || path.join(docsRoot, 'ipd_index.yaml');
  const mdPath = path.join(docsRoot, 'ipd_index.md');

  let yamlIndex = null;
  if (fs.existsSync(yamlPath)) {
    console.log('📄 加载现有 YAML 索引...');
    yamlIndex = loadYamlIndex(yamlPath);
  } else if (fs.existsSync(mdPath)) {
    console.log('🔄 检测到旧格式 ipd_index.md，正在转换为 YAML...');
    const mdContent = fs.readFileSync(mdPath, 'utf-8');
    const yamlData = convertMdToYaml(mdContent, { productId, projectId, versionId });
    const yamlContent = stringifyYaml(yamlData);
    fs.writeFileSync(yamlPath, yamlContent, 'utf-8');
    console.log(`   ✅ 已转换: ${yamlPath}`);
    yamlIndex = yamlData;
  }

  // 扫描目录
  console.log('\n📂 扫描本地目录...');
  const tree = scanRequirements(docsRoot);
  const totalCount = countItems(tree);
  console.log(`   找到 ${tree.epics.length} 个 Epic，共 ${totalCount} 条需求`);
  for (const epic of tree.epics) {
    console.log(`   - ${epic.name}`);
  }

  if (dryRun) {
    console.log('\n预览完成，退出。');
    return { tree, items: [] };
  }

  if (!ipdApi) {
    const skillsBase = process.env.SKILLS_BASE_DIR
      || (process.env.CLAUDE_CONFIG_DIR
        ? path.join(process.env.CLAUDE_CONFIG_DIR, 'skills')
        : path.join(os.homedir(), '.claude', 'skills'));
    ipdApi = require(path.join(skillsBase, 'qianliu-ipd/scripts/ipd_api'));
  }

  // 获取团队信息
  let teamVersionId = null;
  if (projectId && versionId) {
    try {
      const teams = await ipdApi.getTeamsByProject(projectId);
      const targetTeam = teams.find(t => t.planVersionId === versionId);
      if (targetTeam) {
        teamVersionId = targetTeam.teamId;
        console.log(`\n👥 团队 ID: ${teamVersionId} (${targetTeam.teamName})`);
      }
    } catch (err) {
      console.warn(`⚠️  获取团队失败: ${err.message}`);
    }
  }

  // 查询现有条目
  console.log('\n🔍 查询现有 IPD 条目...');
  const existingResult = await ipdApi.getIssuesByScope({ projectId, per: 300 });
  const existingMap = new Map();
  for (const item of existingResult.list) {
    existingMap.set(item.name, item);
  }
  console.log(`   已有 ${existingResult.total} 条`);

  // 同步
  const baseOpts = { productId, ipdProjectId: projectId, planVersionId: versionId, teamVersionId };
  const allItems = [];

  for (const epic of tree.epics) {
    const epicPath = path.join(docsRoot, epic.dirName);

    console.log(`\n📘 Epic: ${epic.name}`);

    let epicItem = existingMap.get(epic.name);
    if (!epicItem) {
      const epicResult = await ipdApi.createIssue('epic', epic.name, {
        ...baseOpts,
        desc: readDescription(epic.readmePath),
      });
      console.log(`   ✅ 创建: ${epic.name} → ID: ${epicResult.id}`);
      epicItem = { id: epicResult.id, url: epicResult.url };
      await sleep(300);
    } else {
      console.log(`   ✓ 已存在: ${epic.name} (ID: ${epicItem.id})`);
      try {
        await ipdApi.updateIssue(epicItem.id, { desc: readDescription(epic.readmePath) });
      } catch { }
    }
    epic.ipdId = epicItem.id;
    allItems.push({ type: 'epic', name: epic.name, ipdId: epicItem.id, ipdUrl: epicItem.url, localPath: epic.dirName, estimatedDay: null });

    for (const feature of epic.features) {
      const featurePath = path.join(epicPath, feature.dirName);
      console.log(`  📗 Feature: ${feature.name}`);

      let featureItem = existingMap.get(feature.name);
      if (!featureItem) {
        const featureResult = await ipdApi.createIssue('feature', feature.name, {
          ...baseOpts,
          parentId: epic.ipdId,
          desc: readDescription(feature.readmePath),
        });
        console.log(`     ✅ 创建: ${feature.name} → ID: ${featureResult.id}`);
        featureItem = { id: featureResult.id, url: featureResult.url };
        await sleep(300);
      } else {
        console.log(`     ✓ 已存在: ${feature.name} (ID: ${featureItem.id})`);
        try {
          await ipdApi.updateIssue(featureItem.id, { desc: readDescription(feature.readmePath) });
        } catch { }
      }
      feature.ipdId = featureItem.id;
      allItems.push({ type: 'feature', name: feature.name, ipdId: featureItem.id, ipdUrl: featureItem.url, localPath: `${epic.dirName}/${feature.dirName}`, parentId: epic.ipdId, estimatedDay: null });

      for (const story of feature.stories) {
        const storyPath = path.join(featurePath, story.dirName);
        console.log(`    📙 Story: ${story.name}`);

        let storyItem = existingMap.get(story.name);
        if (!storyItem) {
          const storyResult = await ipdApi.createIssue('story', story.name, {
            ...baseOpts,
            parentId: feature.ipdId,
            desc: readDescription(story.readmePath),
          });
          console.log(`       ✅ 创建: ${story.name} → ID: ${storyResult.id}`);
          storyItem = { id: storyResult.id, url: storyResult.url };
          await sleep(300);
        } else {
          console.log(`       ✓ 已存在: ${story.name} (ID: ${storyItem.id})`);
          try {
            await ipdApi.updateIssue(storyItem.id, { desc: readDescription(story.readmePath) });
          } catch { }
        }
        story.ipdId = storyItem.id;
        allItems.push({ type: 'story', name: story.name, ipdId: storyItem.id, ipdUrl: storyItem.url, localPath: `${epic.dirName}/${feature.dirName}/${story.dirName}`, parentId: feature.ipdId, estimatedDay: null });

        for (const tech of story.techs) {
          const techPath = path.join(storyPath, tech.dirName);
          console.log(`      📓 Tech-${tech.level}: ${tech.name}`);

          // 从 YAML 索引获取工作量，否则使用默认值 1
          let estimatedDay = tech.estimatedDay || 1;
          if (yamlIndex) {
            const yamlDay = getEstimatedDayFromYaml(yamlIndex, tech.name, 'tech');
            if (yamlDay !== undefined) {
              estimatedDay = yamlDay;
            }
          }

          let techItem = existingMap.get(tech.name);
          if (!techItem) {
            const techResult = await ipdApi.createIssue('tech', tech.name, {
              ...baseOpts,
              parentId: story.ipdId,
              desc: readDescription(tech.readmePath),
              estimatedDay, // 传递工作量
            });
            console.log(`         ✅ 创建: ${tech.name} → ID: ${techResult.id}（工作量: ${estimatedDay}天）`);
            techItem = { id: techResult.id, url: techResult.url };
            await sleep(300);
          } else {
            console.log(`         ✓ 已存在: ${tech.name} (ID: ${techItem.id})`);
            try {
              // 更新工作量（仅 Tech）- 同时更新天数和分钟数
              const effortMinutes = estimatedDay * 480; // 1天 = 8小时 = 480分钟
              await ipdApi.updateIssue(techItem.id, {
                desc: readDescription(tech.readmePath),
                estimated_day: estimatedDay,
                effort_estimation: effortMinutes,
              });
              console.log(`         📝 已更新工作量: ${estimatedDay}天 (${effortMinutes}分钟)`);
            } catch { }
          }
          tech.ipdId = techItem.id;
          allItems.push({ type: 'tech', level: tech.level, name: tech.name, ipdId: techItem.id, ipdUrl: techItem.url, localPath: `${epic.dirName}/${feature.dirName}/${story.dirName}/${tech.dirName}`, parentId: story.ipdId, estimatedDay });

          // Tech-服务级
          if (tech.subTechs) {
            for (const subTech of tech.subTechs) {
              console.log(`        🔧 Tech-服务级: ${subTech.name}`);

              // 从 YAML 索引获取工作量
              let subEstimatedDay = subTech.estimatedDay || 1;
              if (yamlIndex) {
                const yamlDay = getEstimatedDayFromYaml(yamlIndex, subTech.name, 'tech');
                if (yamlDay !== undefined) {
                  subEstimatedDay = yamlDay;
                }
              }

              let subTechItem = existingMap.get(subTech.fullName);
              if (!subTechItem) {
                const subTechResult = await ipdApi.createIssue('tech', subTech.fullName, {
                  ...baseOpts,
                  parentId: tech.ipdId,
                  desc: readDescription(subTech.readmePath),
                  estimatedDay: subEstimatedDay,
                });
                console.log(`           ✅ 创建: ${subTech.name} → ID: ${subTechResult.id}（工作量: ${subEstimatedDay}天）`);
                subTechItem = { id: subTechResult.id, url: subTechResult.url };
                await sleep(300);
              } else {
                console.log(`           ✓ 已存在: ${subTech.name} (ID: ${subTechItem.id})`);
                try {
                  const subEffortMinutes = subEstimatedDay * 480; // 1天 = 8小时 = 480分钟
                  await ipdApi.updateIssue(subTechItem.id, {
                    desc: readDescription(subTech.readmePath),
                    estimated_day: subEstimatedDay,
                    effort_estimation: subEffortMinutes,
                  });
                  console.log(`           📝 已更新工作量: ${subEstimatedDay}天 (${subEffortMinutes}分钟)`);
                } catch { }
              }
              subTech.ipdId = subTechItem.id;
              allItems.push({ type: 'tech', level: '服务级', name: subTech.name, ipdId: subTechItem.id, ipdUrl: subTechItem.url, localPath: `${epic.dirName}/${feature.dirName}/${story.dirName}/${tech.dirName}/${subTech.dirName}`, parentId: tech.ipdId, estimatedDay: subEstimatedDay });
            }
          }
        }
      }
    }
  }

  // 生成索引
  const finalYamlPath = yamlPath;
  console.log('\n📝 生成 YAML 索引文件...');
  const yamlContent = generateYamlIndex(allItems, { productId, projectId, versionId, teamId: teamVersionId });
  fs.writeFileSync(finalYamlPath, yamlContent, 'utf-8');
  console.log(`   ✅ ${finalYamlPath}`);

  // 统计工作量
  const totalWorkload = allItems.filter(i => i.type === 'tech').reduce((sum, i) => sum + (i.estimatedDay || 0), 0);
  console.log(`\n📊 工作量统计: ${totalWorkload} 人天`);

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ 同步完成！共处理 ${allItems.length} 条需求`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  return { tree, items: allItems };
}

module.exports.syncToIpd = syncToIpd;

// ── CLI 入口 ────────────────────────────────────────────────

if (require.main === module) {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  if (!options.docsRoot) {
    console.error('用法: node sync_from_docs.js <docsRoot> [--productId <id>] [--projectId <id>] [--versionId <id>] [--indexFile <path>] [--dry-run]');
    process.exit(1);
  }

  if (options.dryRun) {
    syncToIpd(options).catch(err => {
      console.error('\n❌ 失败:', err.message);
      process.exit(1);
    });
    return;
  }

  // 加载 IPD API - 优先从当前脚本所在目录的父目录查找
  const scriptDir = __dirname;
  let skillsBase = path.dirname(scriptDir);  // skills/qianliu-ipd/scripts -> skills/qianliu-ipd

  // 检查 ipd_api.js 是否在同级目录
  let ipdApiPath = path.join(scriptDir, 'ipd_api.js');
  if (!fs.existsSync(ipdApiPath)) {
    // 尝试从环境变量指定的目录
    skillsBase = process.env.SKILLS_BASE_DIR
      || (process.env.CLAUDE_CONFIG_DIR
        ? path.join(process.env.CLAUDE_CONFIG_DIR, 'skills')
        : path.join(os.homedir(), '.claude', 'skills'));
    ipdApiPath = path.join(skillsBase, 'qianliu-ipd/scripts/ipd_api.js');
  }

  try {
    const ipdApi = require(ipdApiPath);
    syncToIpd({ ...options, ipdApi }).catch(err => {
      console.error('\n❌ 失败:', err.message);
      process.exit(1);
    });
  } catch (err) {
    console.error('❌ 无法加载 IPD API:', err.message);
    console.error('   尝试路径:', ipdApiPath);
    process.exit(1);
  }
}
