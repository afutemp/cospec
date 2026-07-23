const assert = require('node:assert/strict');
const fs = require('node:fs');
const { mkdtemp, readFile, rm } = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  executeProviderAction,
  formatPublicError,
  parseCliArgs,
  ProviderError,
  resolveProviderPaths,
} = require('./ipd-provider.cjs');

test('resolves the bundled qianliu provider without an MCP tool', () => {
  const providerPaths = resolveProviderPaths();

  assert.equal(fs.existsSync(providerPaths.ipdApi), true);
  assert.equal(fs.existsSync(providerPaths.syncManifest), true);
  assert.match(providerPaths.ipdApi, /skills[\\/]qianliu-ipd[\\/]scripts[\\/]ipd_api\.js$/);
});

test('routes target discovery through the bundled IPD API', async () => {
  const calls = [];
  const ipdApi = {
    async getProductProjects(productId, options) {
      calls.push({ productId, options });
      return { total: 1, list: [{ id: 20, name: 'Project' }] };
    },
  };

  const result = await executeProviderAction('getProductProjects', {
    productId: 10,
    state: 'project_todo',
  }, { ipdApi });

  assert.deepEqual(result, { total: 1, list: [{ id: 20, name: 'Project' }] });
  assert.deepEqual(calls, [{
    productId: 10,
    options: { state: 'project_todo' },
  }]);
});

test('writes a local preview through the bundled manifest provider', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'cospec-ipd-provider-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const previewFile = path.join(root, 'preview.md');
  let received;
  const syncProvider = {
    async buildSyncPlan(input) {
      received = input;
      return { planHash: 'plan-123', counts: { create: 1, update: 0, upload: 2 } };
    },
    previewMarkdown(plan) {
      return `# Preview\n\n${plan.planHash}\n`;
    },
  };

  const result = await executeProviderAction('syncManifest', {
    mode: 'preview',
    manifestPath: '/tmp/manifest.json',
    indexPath: '/tmp/index.json',
    productId: 1,
    projectId: 2,
    versionId: 3,
    teamId: 4,
    rootEpicArtifactId: 'EPIC-001',
    previewFile,
  }, { ipdApi: { marker: true }, syncProvider });

  assert.equal(result.planHash, 'plan-123');
  assert.equal(received.ipdApi.marker, true);
  assert.deepEqual(received.routing, {
    review: { kind: 'issueAttachment', rootEpicArtifactId: 'EPIC-001' },
    aiContext: { kind: 'issueAttachment', rootEpicArtifactId: 'EPIC-001' },
  });
  assert.match(await readFile(previewFile, 'utf8'), /plan-123/);
});

test('refuses apply without the confirmed plan hash', async () => {
  await assert.rejects(
    executeProviderAction('syncManifest', {
      mode: 'apply',
      manifestPath: '/tmp/manifest.json',
      indexPath: '/tmp/index.json',
      productId: 1,
      projectId: 2,
      versionId: 3,
      teamId: 4,
      rootEpicArtifactId: 'EPIC-001',
    }, {
      ipdApi: {},
      syncProvider: {
        async applySyncPlan() {
          assert.fail('apply must not be called without a plan hash');
        },
      },
    }),
    (error) => {
      assert(error instanceof ProviderError);
      assert.equal(error.code, 'missing_plan_hash');
      return true;
    },
  );
});

test('parses the documented CLI flags into provider parameters', () => {
  assert.deepEqual(parseCliArgs([
    '--action', 'syncManifest',
    '--mode', 'preview',
    '--manifest', '/tmp/manifest.json',
    '--index', '/tmp/index.json',
    '--product-id', '1',
    '--project-id', '2',
    '--version-id', '3',
    '--team-id', '4',
    '--root-epic-artifact-id', 'EPIC-001',
  ]), {
    action: 'syncManifest',
    mode: 'preview',
    manifestPath: '/tmp/manifest.json',
    indexPath: '/tmp/index.json',
    productId: 1,
    projectId: 2,
    versionId: 3,
    teamId: 4,
    rootEpicArtifactId: 'EPIC-001',
  });
});

test('rejects actions outside the sync provider allowlist', async () => {
  await assert.rejects(
    executeProviderAction('deleteIssue', { issueId: 123 }, { ipdApi: {} }),
    (error) => {
      assert(error instanceof ProviderError);
      assert.equal(error.code, 'unsupported_action');
      return true;
    },
  );
});

test('does not expose raw IPD error responses', () => {
  const formatted = formatPublicError(
    new Error('API Error (500): response contains private-token-value'),
  );

  assert.deepEqual(formatted, {
    ok: false,
    code: 'ipd_api_error',
    message: 'IPD API request failed (500).',
  });
  assert.doesNotMatch(JSON.stringify(formatted), /private-token-value/);
});
