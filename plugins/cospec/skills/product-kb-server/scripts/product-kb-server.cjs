#!/usr/bin/env node
// product-kb-server — Manage kb-server knowledge bases: list, download, upload.
// Zero dependencies, Node.js 18+ built-ins only.

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const zlib = require('node:zlib');

const KB_SERVER_URL = (process.env.KB_SERVER_URL ?? 'http://10.6.100.230').replace(/\/$/, '');
const AUTH_TOKEN = process.env.KB_AUTH_TOKEN ?? '';

const USAGE = `Usage: product-kb-server <command> [options]

Commands:
  list                          List all knowledge bases
  download --kb <name> --output <dir> [--format tar.gz|zip]
  upload   --kb <name> --files <glob> [--token <tok>]

Options:
  --server <url>   kb-server URL (default: ${KB_SERVER_URL})
  --token  <tok>   API KEY or login token

Examples:
  product-kb-server list
  product-kb-server download --kb <kb-name-or-id> --output ./docs
  product-kb-server upload --kb <kb-name-or-id> --files "./docs/*.md"
`;

function parseArgs(args) {
  const opts = { command: '', kb: '', output: '', files: '', format: 'tar.gz', server: KB_SERVER_URL, token: AUTH_TOKEN };
  let i = 0;
  opts.command = args[i++];
  while (i < args.length) {
    const k = args[i++];
    const v = args[i++] ?? '';
    if (k === '--kb') opts.kb = v;
    else if (k === '--output') opts.output = v;
    else if (k === '--files') opts.files = v;
    else if (k === '--format') opts.format = v;
    else if (k === '--server') opts.server = v;
    else if (k === '--token') opts.token = v;
  }
  return opts;
}

function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ── KB resolution ──
async function resolveKb(server, token, name) {
  const res = await fetch(`${server}/api/kb`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(`Failed to list KBs: HTTP ${res.status}`);
  const { kbs } = await res.json();
  return kbs.find(kb => kb.id === name || kb.name === name) ?? null;
}

// ════════════════════════════════════════════
// list
// ════════════════════════════════════════════
async function cmdList(opts) {
  const res = await fetch(`${opts.server}/api/kb`, { headers: authHeaders(opts.token) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const { kbs } = await res.json();
  console.log(`${'ID'.padEnd(20)} ${'NAME'.padEnd(24)} ${'STATUS'.padEnd(14)} VERSION`);
  console.log('-'.repeat(75));
  for (const kb of kbs) {
    const vid = (kb.current_version_id ?? '-').slice(0, 14);
    console.log(`${kb.id.padEnd(20)} ${kb.name.padEnd(24)} ${kb.status.padEnd(14)} ${vid}`);
  }
}

// ════════════════════════════════════════════
// download
// ════════════════════════════════════════════
async function cmdDownload(opts) {
  const kb = await resolveKb(opts.server, opts.token, opts.kb);
  if (!kb) throw new Error(`KB '${opts.kb}' not found. Run 'list' to see available KBs.`);

  console.log(`[download] ${kb.name} (${kb.id}) → ${opts.output}`);

  const url = `${opts.server}/api/kb/${kb.id}/download?format=${opts.format}`;
  const res = await fetch(url, { headers: authHeaders(opts.token) });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Download failed (HTTP ${res.status}): ${err.error?.message ?? res.statusText}`);
  }

  const buf = Buffer.from(await res.arrayBuffer());
  const tmp = path.join(os.tmpdir(), `kb-dl-${kb.id}`);
  fs.mkdirSync(opts.output, { recursive: true });

  try {
    if (opts.format === 'zip') {
      // Use system unzip (available on Linux/macOS; Windows users need unzip in PATH)
      const { execSync } = require('node:child_process');
      const zipPath = path.join(tmp, '_archive.zip');
      fs.mkdirSync(tmp, { recursive: true });
      fs.writeFileSync(zipPath, buf);
      execSync(`unzip -o "${zipPath}" -d "${tmp}"`, { stdio: 'ignore' });
      fs.unlinkSync(zipPath);
    } else {
      extractTarGz(buf, tmp);
    }

    // Flatten: find raw/ and copy contents to output
    const rawDir = findDir(tmp, 'raw');
    if (rawDir) {
      copyDir(rawDir, opts.output);
    } else {
      for (const e of fs.readdirSync(tmp, { withFileTypes: true })) {
        if (e.name === 'manifest.json') continue;
        copyDir(path.join(tmp, e.name), path.join(opts.output, e.name));
      }
    }

    const count = countFiles(opts.output);
    console.log(`[download] done — ${count} documents in ${opts.output}`);

    const configResult = configureKbLocalPath(opts.output);
    if (configResult.ok) {
      console.log(`[config] updated ${configResult.file}`);
      console.log(`[config] kb.localPath = ${configResult.localPath}`);
    } else {
      console.log(`[config] skipped — ${configResult.error}`);
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// ════════════════════════════════════════════
// Auto-configure cospec.config.json
// ════════════════════════════════════════════
function configureKbLocalPath(outputDir) {
  // Plugin root: scripts/ → product-kb-server/ → skills/ → cospec/
  const pluginRoot = path.resolve(__dirname, '../../..');
  const configPath = path.join(pluginRoot, 'cospec.config.json');

  let config = {};
  if (fs.existsSync(configPath)) {
    try {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (e) {
      return { ok: false, error: `failed to parse ${configPath}: ${e.message}` };
    }
  }

  if (!config.kb || typeof config.kb !== 'object') {
    config.kb = {};
  }

  if (!config.kb.skill) {
    config.kb.skill = 'product-kb-query';
  }

  const absPath = path.resolve(outputDir);
  config.kb.localPath = absPath;

  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
  } catch (e) {
    return { ok: false, error: `failed to write ${configPath}: ${e.message}` };
  }

  return { ok: true, file: configPath, localPath: absPath };
}

// ── Minimal tar.gz extraction (zero deps, USTAR format) ──
function extractTarGz(buf, dest) {
  const gunzip = zlib.gunzipSync(buf);
  let offset = 0;

  while (offset + 512 <= gunzip.length) {
    const header = gunzip.slice(offset, offset + 512);
    if (header.every(b => b === 0)) break;

    const name = readTarStr(header, 0, 100);
    if (!name) { offset += 512; continue; }

    const size = parseInt(readTarStr(header, 124, 12), 8) || 0;
    offset += 512;

    if (!name.endsWith('/') && size > 0) {
      const filePath = path.join(dest, name);
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, gunzip.slice(offset, offset + size));
    }
    offset += Math.ceil(size / 512) * 512;
  }
}

function readTarStr(buf, start, len) {
  let end = start;
  while (end < start + len && buf[end] !== 0) end++;
  return buf.slice(start, end).toString('utf8');
}

function findDir(root, name) {
  const queue = [root];
  while (queue.length) {
    const dir = queue.shift();
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (entry.name === name) return path.join(dir, entry.name);
        queue.push(path.join(dir, entry.name));
      }
    }
  }
  return null;
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      copyDir(path.join(src, entry.name), path.join(dest, entry.name));
    } else {
      fs.copyFileSync(path.join(src, entry.name), path.join(dest, entry.name));
    }
  }
}

function countFiles(dir) {
  let count = 0;
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) count += countFiles(path.join(dir, entry.name));
      else if (/\.(md|txt|pdf)$/i.test(entry.name)) count++;
    }
  } catch { /* dir may not exist */ }
  return count;
}

// ════════════════════════════════════════════
// upload
// ════════════════════════════════════════════
async function cmdUpload(opts) {
  const kb = await resolveKb(opts.server, opts.token, opts.kb);
  if (!kb) throw new Error(`KB '${opts.kb}' not found. Run 'list' to see available KBs.`);

  const files = expandGlob(opts.files);
  if (files.length === 0) throw new Error(`No files matched '${opts.files}'`);

  console.log(`[upload] ${kb.name} (${kb.id}) — ${files.length} file(s)`);

  // Build multipart/form-data manually (zero deps)
  const boundary = '----FormBoundary' + Math.random().toString(36).slice(2);
  const CRLF = '\r\n';
  const parts = [];
  for (const file of files) {
    const content = fs.readFileSync(file);
    const header = [
      `--${boundary}`,
      `Content-Disposition: form-data; name="files"; filename="${path.basename(file)}"`,
      'Content-Type: application/octet-stream',
      '',
      '',
    ].join(CRLF);
    parts.push(Buffer.concat([Buffer.from(header), content, Buffer.from(CRLF)]));
  }
  parts.push(Buffer.from(`--${boundary}--${CRLF}`));
  const body = Buffer.concat(parts);

  const res = await fetch(`${opts.server}/api/kb/${kb.id}/attachments`, {
    method: 'POST',
    headers: { ...authHeaders(opts.token), 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    body,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Upload failed (HTTP ${res.status}): ${err.error?.message ?? res.statusText}`);
  }

  const data = await res.json();
  for (const s of data.stored ?? []) {
    console.log(`  ✓ ${s.filename} (${s.size_bytes} bytes)`);
  }
  console.log(`[upload] done — ${(data.stored ?? []).length} files stored`);
}

function expandGlob(pattern) {
  const abs = path.resolve(pattern);
  const dir = path.dirname(abs);
  const name = path.basename(abs);

  if (!name.includes('*')) {
    try { fs.statSync(abs); return [abs]; } catch { return []; }
  }

  const regex = new RegExp('^' + name.replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
  try {
    return fs.readdirSync(dir)
      .filter(f => regex.test(f))
      .map(f => path.join(dir, f))
      .filter(f => { try { return fs.statSync(f).isFile(); } catch { return false; } });
  } catch {
    return [];
  }
}

// ════════════════════════════════════════════
// main
// ════════════════════════════════════════════
async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(USAGE);
    process.exit(0);
  }

  const opts = parseArgs(args);

  try {
    switch (opts.command) {
      case 'list':     await cmdList(opts); break;
      case 'download': await cmdDownload(opts); break;
      case 'upload':   await cmdUpload(opts); break;
      default: console.error(`Unknown command: ${opts.command}`); console.log(USAGE); process.exit(1);
    }
  } catch (e) {
    console.error(`Error: ${e.message}`);
    process.exit(1);
  }
}

main();
