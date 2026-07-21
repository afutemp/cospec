import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import {
  mkdir,
  mkdtemp,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  buildDemoUrl,
  createDemoSignature,
  DemoGenerationError,
  HANDOFF_PATH,
  MAX_DOCUMENT_BYTES,
  prepareDemoRequest,
  runDemoGeneration,
} from './generate-demo.mjs';

const configuredEnv = {
  FRIEREN_DEMO_BASE_URL: 'http://ui.sangfor.com.cn/',
  FRIEREN_DEMO_HMAC_SECRET: 'test-secret',
};

async function createWorkspace(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'cospec-generate-demo-'));
  await mkdir(path.join(root, '.git'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

async function writeMarkdown(root, name, content) {
  const filePath = path.join(root, name);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, 'utf8');
  return filePath;
}

test('normalizes a trailing-slash base URL', () => {
  assert.equal(
    buildDemoUrl('http://ui.sangfor.com.cn/'),
    'http://ui.sangfor.com.cn/api/integrations/workflows/handoff',
  );
});

test('creates the BattleFlow-compatible canonical HMAC signature', () => {
  assert.equal(createDemoSignature({
    timestamp: '1700000000000',
    rawBody: '{"externalWorkflowId":"wf-1001"}',
    secret: 'test-secret',
  }), '5b5ea43b1caab91a502a81604fc56557a4d6d8376cda4344e162a4abd46ea678');
});

test('derives titles and stable identifiers without exposing local paths', async (t) => {
  const root = await createWorkspace(t);
  const first = await writeMarkdown(root, 'docs/review.md', '# Review Title\n\nBody');
  const second = await writeMarkdown(root, 'docs/context.md', 'No heading');

  const forward = await prepareDemoRequest({
    documentPaths: [first, second],
    cwd: root,
    env: configuredEnv,
  });
  const reversed = await prepareDemoRequest({
    documentPaths: [second, first],
    cwd: root,
    env: configuredEnv,
  });

  assert.equal(forward.payload.title, 'Review Title');
  assert.equal(forward.payload.documents[1].title, 'context');
  assert.equal(forward.payload.externalProjectKey, reversed.payload.externalProjectKey);
  assert.equal(forward.payload.externalWorkflowId, reversed.payload.externalWorkflowId);
  assert.equal(forward.payload.externalWorkflowVersion, reversed.payload.externalWorkflowVersion);
  assert.equal(forward.payload.externalProjectKey.includes(root), false);
  assert.equal(JSON.stringify(forward.payload).includes(root), false);
});

test('dry-run validates configuration and never calls fetch', async (t) => {
  const root = await createWorkspace(t);
  const document = await writeMarkdown(root, 'review.md', '# Review\n');
  let called = false;

  const result = await runDemoGeneration({
    documentPaths: [document],
    cwd: root,
    env: configuredEnv,
    fetchFn: async () => {
      called = true;
      throw new Error('fetch must not run');
    },
  });

  assert.equal(called, false);
  assert.equal(result.mode, 'dry-run');
  assert.equal(result.documentCount, 1);
  assert.equal(result.secureTransport, false);
  assert.equal(result.warnings.length, 1);
  assert.deepEqual(Object.keys(result.documents[0]).sort(), ['bytes', 'id', 'path', 'title']);
});

test('sends one signed request and resolves returned relative URLs', async (t) => {
  const root = await createWorkspace(t);
  const document = await writeMarkdown(root, 'review.md', '# Review\n\nDemo input');
  let callCount = 0;

  const result = await runDemoGeneration({
    documentPaths: [document],
    cwd: root,
    env: configuredEnv,
    send: true,
    now: () => 1700000000000,
    fetchFn: async (url, init) => {
      callCount += 1;
      assert.equal(url, 'http://ui.sangfor.com.cn/api/integrations/workflows/handoff');
      assert.equal(init.method, 'POST');
      assert.equal(init.headers['x-frieren-timestamp'], '1700000000000');
      const expected = createHmac('sha256', 'test-secret')
        .update(`1700000000000.POST.${HANDOFF_PATH}.${init.body}`)
        .digest('hex');
      assert.equal(init.headers['x-frieren-signature'], `sha256=${expected}`);
      return new Response(JSON.stringify({
        ok: true,
        data: {
          handoffId: 'handoff-1',
          status: 'ready',
          projectId: 'project-1',
          workspaceId: 'workspace-1',
          studioUrl: 'handoff/handoff-1?token=abc',
          directStudioUrl: 'studio/project-1',
        },
      }), { status: 200 });
    },
  });

  assert.equal(callCount, 1);
  assert.equal(result.mode, 'send');
  assert.equal(result.status, 'ready');
  assert.equal(result.studioUrl, 'http://ui.sangfor.com.cn/handoff/handoff-1?token=abc');
  assert.equal(result.directStudioUrl, 'http://ui.sangfor.com.cn/studio/project-1');
});

test('handles plain-text HTTP failures without exposing the response body', async (t) => {
  const root = await createWorkspace(t);
  const document = await writeMarkdown(root, 'review.md', '# Review\n');

  await assert.rejects(runDemoGeneration({
    documentPaths: [document],
    cwd: root,
    env: configuredEnv,
    send: true,
    fetchFn: async () => new Response('404 Not Found: # Review', { status: 404 }),
  }), (error) => {
    assert(error instanceof DemoGenerationError);
    assert.equal(error.code, 'request_failed');
    assert.equal(error.status, 404);
    assert.equal(error.message, 'Demo handoff request failed with status 404.');
    assert.equal(error.message.includes('Review'), false);
    return true;
  });
});

test('times out one request without retrying', async (t) => {
  const root = await createWorkspace(t);
  const document = await writeMarkdown(root, 'review.md', '# Review\n');
  let callCount = 0;

  await assert.rejects(runDemoGeneration({
    documentPaths: [document],
    cwd: root,
    env: configuredEnv,
    send: true,
    timeoutMs: 5,
    fetchFn: async (_url, init) => {
      callCount += 1;
      return new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
      });
    },
  }), { code: 'request_timeout' });

  assert.equal(callCount, 1);
});

test('rejects an invalid success response', async (t) => {
  const root = await createWorkspace(t);
  const document = await writeMarkdown(root, 'review.md', '# Review\n');

  await assert.rejects(runDemoGeneration({
    documentPaths: [document],
    cwd: root,
    env: configuredEnv,
    send: true,
    fetchFn: async () => new Response(JSON.stringify({ ok: true, data: {} }), { status: 200 }),
  }), { code: 'invalid_response_data' });
});

test('uses bundled Frieren configuration when environment variables are missing', async (t) => {
  const root = await createWorkspace(t);
  const document = await writeMarkdown(root, 'review.md', '# Review\n');

  const prepared = await prepareDemoRequest({
    documentPaths: [document],
    cwd: root,
    env: {},
  });

  assert.equal(prepared.baseUrl, 'http://ui.sangfor.com.cn/');
  assert.equal(prepared.requestUrl, 'http://ui.sangfor.com.cn/api/integrations/workflows/handoff');
  assert.equal(prepared.secret.length > 0, true);
});

test('environment variables override bundled Frieren configuration', async (t) => {
  const root = await createWorkspace(t);
  const document = await writeMarkdown(root, 'review.md', '# Review\n');

  const prepared = await prepareDemoRequest({
    documentPaths: [document],
    cwd: root,
    env: {
      FRIEREN_DEMO_BASE_URL: 'https://demo.example.com/',
      FRIEREN_DEMO_HMAC_SECRET: 'override-secret',
    },
  });

  assert.equal(prepared.baseUrl, 'https://demo.example.com/');
  assert.equal(prepared.secret, 'override-secret');
});

test('rejects invalid file selections', async (t) => {
  const root = await createWorkspace(t);
  const empty = await writeMarkdown(root, 'empty.md', '');
  const textFile = path.join(root, 'notes.txt');
  await writeFile(textFile, 'notes', 'utf8');
  const source = await writeMarkdown(root, 'source.md', '# Source\n');
  const linked = path.join(root, 'linked.md');
  await symlink(source, linked);

  await assert.rejects(prepareDemoRequest({
    documentPaths: [empty], cwd: root, env: configuredEnv,
  }), { code: 'empty_document' });
  await assert.rejects(prepareDemoRequest({
    documentPaths: [textFile], cwd: root, env: configuredEnv,
  }), { code: 'unsupported_document_type' });
  await assert.rejects(prepareDemoRequest({
    documentPaths: [linked], cwd: root, env: configuredEnv,
  }), { code: 'document_symlink' });
  await assert.rejects(prepareDemoRequest({
    documentPaths: [source, source], cwd: root, env: configuredEnv,
  }), { code: 'duplicate_document' });
  await assert.rejects(prepareDemoRequest({
    documentPaths: Array.from({ length: 21 }, () => source), cwd: root, env: configuredEnv,
  }), { code: 'too_many_documents' });
});

test('enforces per-document and total byte limits', async (t) => {
  const root = await createWorkspace(t);
  const oversized = path.join(root, 'oversized.md');
  await writeFile(oversized, Buffer.alloc(MAX_DOCUMENT_BYTES + 1, 120));

  await assert.rejects(prepareDemoRequest({
    documentPaths: [oversized], cwd: root, env: configuredEnv,
  }), { code: 'document_too_large' });

  const documents = [];
  for (let index = 0; index < 6; index += 1) {
    const filePath = path.join(root, `part-${index}.md`);
    await writeFile(filePath, Buffer.alloc(MAX_DOCUMENT_BYTES, 120));
    documents.push(filePath);
  }
  await assert.rejects(prepareDemoRequest({
    documentPaths: documents, cwd: root, env: configuredEnv,
  }), { code: 'documents_too_large' });
});

test('rejects documents outside the detected project root', async (t) => {
  const root = await createWorkspace(t);
  const outsideRoot = await mkdtemp(path.join(os.tmpdir(), 'cospec-generate-demo-outside-'));
  t.after(() => rm(outsideRoot, { recursive: true, force: true }));
  const outside = await writeMarkdown(outsideRoot, 'outside.md', '# Outside\n');

  await assert.rejects(prepareDemoRequest({
    documentPaths: [outside], cwd: root, env: configuredEnv,
  }), { code: 'document_outside_project' });
});
