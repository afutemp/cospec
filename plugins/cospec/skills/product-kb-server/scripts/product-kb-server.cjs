#!/usr/bin/env node
// product-kb-server — Manage kb-server knowledge bases: list, download, upload.
// Zero dependencies, Node.js 18+ built-ins only.

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execSync } = require('node:child_process');

const KB_SERVER_URL = (process.env.KB_SERVER_URL ?? 'http://10.6.100.230').replace(/\/$/, '');
const AUTH_TOKEN = process.env.KB_AUTH_TOKEN ?? '';

const USAGE = `Usage: product-kb-server <command> [options]

Commands:
  list                          List all knowledge bases
  check-update --kb <name>      Check if local KB is up to date
  download --kb <name> [--output <dir>] [--format tar.gz|zip]
  upload   --kb <name> --files <glob> [--token <tok>]

Options:
  --server <url>   kb-server URL (default: ${KB_SERVER_URL})
  --token  <tok>   API KEY or login token

Examples:
  product-kb-server list
  product-kb-server check-update --kb <kb-name-or-id>
  product-kb-server download --kb <kb-name-or-id>
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

// ════════════════════════════════════════════
// Global KB cache helpers
// ════════════════════════════════════════════
function getPluginRoot() {
  // scripts/ → product-kb-server/ → skills/ → cospec/
  return path.resolve(__dirname, '../../..');
}

function getPluginName() {
  return 'cospec';
}

function getGlobalKbRoot() {
  return path.join(os.homedir(), `.${getPluginName()}`, 'kb');
}

const VERSION_FILE = '.kb-version';

function getVersionFilePath(outputDir) {
  return path.join(outputDir, VERSION_FILE);
}

function readLocalVersion(outputDir) {
  const versionPath = getVersionFilePath(outputDir);
  try {
    return fs.readFileSync(versionPath, 'utf8').trim();
  } catch {
    return null;
  }
}

function writeLocalVersion(outputDir, version) {
  const versionPath = getVersionFilePath(outputDir);
  fs.writeFileSync(versionPath, `${version}\n`);
}

function sanitizeKbName(name) {
  if (!name) return 'unnamed-kb';
  let safe = name
    .replace(/[\/\\:?*"<\>\|\x00-\x1f\s]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '');
  if (!safe || safe === '.' || safe === '..') safe = 'unnamed-kb';
  return safe;
}

function getDefaultKbDir(kbName) {
  return path.join(getGlobalKbRoot(), sanitizeKbName(kbName));
}

function isManagedGlobalPath(targetPath) {
  const resolved = path.resolve(targetPath);
  const root = path.resolve(getGlobalKbRoot());
  return resolved === root || resolved.startsWith(root + path.sep);
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
  console.log('NAME\tDESCRIPTION');
  for (const kb of kbs) {
    console.log(`${kb.name}\t${kb.description ?? ''}`);
  }
}

// ════════════════════════════════════════════
// download
// ════════════════════════════════════════════
async function cmdDownload(opts) {
  const kb = await resolveKb(opts.server, opts.token, opts.kb);
  if (!kb) throw new Error(`KB '${opts.kb}' not found. Run 'list' to see available KBs.`);

  const outputDir = opts.output || getDefaultKbDir(kb.name);
  const serverVersion = kb.current_version_id ?? null;
  const localVersion = readLocalVersion(outputDir);

  if (serverVersion && localVersion && serverVersion === localVersion) {
    console.log(`[download] ${kb.name} is up to date (${localVersion}) — skipping`);
    const configResult = configureKbLocalPath(outputDir);
    if (configResult.ok) {
      console.log(`[config] updated ${configResult.file}`);
      console.log(`[config] kb.localPath = ${configResult.localPath}`);
    }
    return;
  }

  console.log(`[download] ${kb.name} (${kb.id}) → ${outputDir}`);
  if (localVersion && serverVersion) {
    console.log(`[download] updating ${localVersion} → ${serverVersion}`);
  } else if (serverVersion) {
    console.log(`[download] server version ${serverVersion}`);
  }

  const url = `${opts.server}/api/kb/${kb.id}/download?format=${opts.format}`;
  const res = await fetch(url, { headers: authHeaders(opts.token) });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Download failed (HTTP ${res.status}): ${err.error?.message ?? res.statusText}`);
  }

  const buf = Buffer.from(await res.arrayBuffer());
  const tmp = path.join(os.tmpdir(), `kb-dl-${kb.id}`);

  // For managed global directories, remove the existing copy so that a
  // re-download produces a clean overwrite and stale files are eliminated.
  if (isManagedGlobalPath(outputDir)) {
    fs.rmSync(outputDir, { recursive: true, force: true });
  }
  fs.mkdirSync(outputDir, { recursive: true });

  try {
    if (opts.format === 'zip') {
      const zipPath = path.join(tmp, '_archive.zip');
      fs.mkdirSync(tmp, { recursive: true });
      fs.writeFileSync(zipPath, buf);
      execSync(`unzip -o "${zipPath}" -d "${tmp}"`, { stdio: 'ignore' });
      fs.unlinkSync(zipPath);
    } else {
      fs.mkdirSync(tmp, { recursive: true });
      execSync(`tar -xzf - -C "${tmp}"`, { input: buf, stdio: ['pipe', 'ignore', 'ignore'] });
    }

    const kbRoot = detectKbRoot(tmp);
    copyDir(kbRoot, outputDir);

    if (serverVersion) {
      writeLocalVersion(outputDir, serverVersion);
    }

    const count = countFiles(outputDir);
    console.log(`[download] done — ${count} documents in ${outputDir}`);

    const configResult = configureKbLocalPath(outputDir);
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
// check-update
// ════════════════════════════════════════════
async function cmdCheckUpdate(opts) {
  const kb = await resolveKb(opts.server, opts.token, opts.kb);
  if (!kb) throw new Error(`KB '${opts.kb}' not found. Run 'list' to see available KBs.`);

  const outputDir = opts.output || getDefaultKbDir(kb.name);
  const serverVersion = kb.current_version_id ?? null;
  const localVersion = readLocalVersion(outputDir);

  if (!serverVersion) {
    console.log(`[check-update] ${kb.name}: server version unknown — cannot compare`);
    return;
  }

  if (!localVersion) {
    console.log(`[check-update] ${kb.name}: not downloaded locally (server: ${serverVersion})`);
    return;
  }

  if (serverVersion === localVersion) {
    console.log(`[check-update] ${kb.name}: up to date (${localVersion})`);
  } else {
    console.log(`[check-update] ${kb.name}: update available (${localVersion} → ${serverVersion})`);
  }
}

// ════════════════════════════════════════════
// KB root detection
// ════════════════════════════════════════════
function detectKbRoot(extractedDir) {
  // KB-server now returns archives exactly as they were uploaded:
  // no raw/ wrapper, no manifest.json. Use the extracted root as-is.
  return extractedDir;
}

// ════════════════════════════════════════════
// Auto-configure cospec.config.json
// ════════════════════════════════════════════
function configureKbLocalPath(outputDir) {
  const pluginRoot = getPluginRoot();
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
      case 'list':          await cmdList(opts); break;
      case 'check-update':  await cmdCheckUpdate(opts); break;
      case 'download':      await cmdDownload(opts); break;
      case 'upload':        await cmdUpload(opts); break;
      default: console.error(`Unknown command: ${opts.command}`); console.log(USAGE); process.exit(1);
    }
  } catch (e) {
    console.error(`Error: ${e.message}`);
    process.exit(1);
  }
}

main();
