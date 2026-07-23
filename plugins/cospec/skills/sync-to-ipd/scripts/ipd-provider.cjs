#!/usr/bin/env node
'use strict';

const fsp = require('node:fs/promises');
const path = require('node:path');

class ProviderError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'ProviderError';
    this.code = code;
    this.details = details;
  }
}

const SUPPORTED_ACTIONS = new Set([
  'getProducts',
  'getProductProjects',
  'getProjectVersions',
  'getTeamsByProject',
  'getProjectStages',
  'getStageActivities',
  'getActivityDeliverables',
  'syncManifest',
]);

function resolveProviderPaths() {
  const providerRoot = path.resolve(__dirname, '..', '..', 'qianliu-ipd', 'scripts');
  return {
    ipdApi: path.join(providerRoot, 'ipd_api.js'),
    syncManifest: path.join(providerRoot, 'sync_from_manifest.js'),
  };
}

function loadDependencies(action, injected = {}) {
  const providerPaths = resolveProviderPaths();
  const ipdApi = injected.ipdApi || require(providerPaths.ipdApi);
  const syncProvider = action === 'syncManifest'
    ? (injected.syncProvider || require(providerPaths.syncManifest))
    : injected.syncProvider;
  return { ipdApi, syncProvider };
}

function requiredText(params, key) {
  const value = params[key];
  if (typeof value !== 'string' || !value.trim()) {
    throw new ProviderError(`Missing required parameter: ${key}`, 'missing_parameter', { key });
  }
  return value.trim();
}

function requiredNumber(params, key) {
  const value = Number(params[key]);
  if (!Number.isFinite(value) || value <= 0) {
    throw new ProviderError(`Invalid numeric parameter: ${key}`, 'invalid_parameter', { key });
  }
  return value;
}

function optionalNumber(value) {
  if (value === undefined || value === null || value === '') return undefined;
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new ProviderError('Expected a numeric parameter.', 'invalid_parameter');
  }
  return number;
}

function compact(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
}

function buildRouting(params) {
  if (params.routing && typeof params.routing === 'object') return params.routing;

  const rootEpicArtifactId = requiredText(params, 'rootEpicArtifactId');
  const review = params.reviewDeliverableId
    ? {
        kind: 'deliverable',
        deliverableId: requiredNumber(params, 'reviewDeliverableId'),
        activityId: requiredNumber(params, 'reviewActivityId'),
      }
    : { kind: 'issueAttachment', rootEpicArtifactId };

  return {
    review,
    aiContext: { kind: 'issueAttachment', rootEpicArtifactId },
  };
}

async function executeSyncManifest(params, dependencies) {
  const mode = requiredText(params, 'mode');
  const input = {
    manifestPath: path.resolve(requiredText(params, 'manifestPath')),
    indexPath: path.resolve(requiredText(params, 'indexPath')),
    target: {
      productId: requiredNumber(params, 'productId'),
      projectId: requiredNumber(params, 'projectId'),
      versionId: requiredNumber(params, 'versionId'),
      teamId: requiredNumber(params, 'teamId'),
    },
    routing: buildRouting(params),
    expectedPlanHash: params.expectedPlanHash,
    ipdApi: dependencies.ipdApi,
  };

  if (mode === 'preview') {
    const plan = await dependencies.syncProvider.buildSyncPlan(input);
    if (params.previewFile) {
      const previewFile = path.resolve(params.previewFile);
      await fsp.mkdir(path.dirname(previewFile), { recursive: true });
      await fsp.writeFile(
        previewFile,
        dependencies.syncProvider.previewMarkdown(plan),
        'utf8',
      );
    }
    return plan;
  }

  if (mode === 'apply') {
    if (typeof params.expectedPlanHash !== 'string' || !params.expectedPlanHash.trim()) {
      throw new ProviderError(
        'Apply requires the exact plan hash from the confirmed preview.',
        'missing_plan_hash',
      );
    }
    return dependencies.syncProvider.applySyncPlan(input);
  }

  throw new ProviderError('Use mode preview or apply.', 'invalid_mode');
}

async function executeProviderAction(action, params = {}, injected = {}) {
  if (typeof action !== 'string' || !action) {
    throw new ProviderError('Missing provider action.', 'missing_action');
  }
  if (!SUPPORTED_ACTIONS.has(action)) {
    throw new ProviderError(`Unsupported provider action: ${action}`, 'unsupported_action', {
      action,
    });
  }
  const dependencies = loadDependencies(action, injected);
  const api = dependencies.ipdApi;

  switch (action) {
    case 'getProducts':
      return api.getProducts(String(params.keyword || ''));
    case 'getProductProjects':
      return api.getProductProjects(requiredNumber(params, 'productId'), compact({
        page: optionalNumber(params.page),
        per: optionalNumber(params.per),
        name: params.name,
        state: params.state,
        paginate: params.paginate,
      }));
    case 'getProjectVersions':
      return api.getProjectVersions(requiredNumber(params, 'projectId'));
    case 'getTeamsByProject':
      return api.getTeamsByProject(requiredNumber(params, 'projectId'));
    case 'getProjectStages':
      return api.getProjectStages(
        requiredNumber(params, 'projectId'),
        requiredNumber(params, 'versionId'),
      );
    case 'getStageActivities':
      return api.getStageActivities(
        requiredNumber(params, 'stageId'),
        requiredNumber(params, 'versionId'),
      );
    case 'getActivityDeliverables':
      return api.getActivityDeliverables(requiredNumber(params, 'activityId'));
    case 'syncManifest':
      return executeSyncManifest(params, dependencies);
    default:
      throw new ProviderError(`Unsupported provider action: ${action}`, 'unsupported_action');
  }
}

const CLI_KEYS = {
  action: 'action',
  keyword: 'keyword',
  'product-id': 'productId',
  'project-id': 'projectId',
  'version-id': 'versionId',
  'team-id': 'teamId',
  'stage-id': 'stageId',
  'activity-id': 'activityId',
  page: 'page',
  per: 'per',
  name: 'name',
  state: 'state',
  paginate: 'paginate',
  mode: 'mode',
  manifest: 'manifestPath',
  index: 'indexPath',
  'root-epic-artifact-id': 'rootEpicArtifactId',
  'review-deliverable-id': 'reviewDeliverableId',
  'review-activity-id': 'reviewActivityId',
  'preview-file': 'previewFile',
  'expected-plan-hash': 'expectedPlanHash',
};

const NUMERIC_KEYS = new Set([
  'productId',
  'projectId',
  'versionId',
  'teamId',
  'stageId',
  'activityId',
  'page',
  'per',
  'reviewDeliverableId',
  'reviewActivityId',
]);

function parseCliArgs(argv) {
  const params = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      throw new ProviderError(`Unexpected argument: ${token}`, 'invalid_argument');
    }
    const rawKey = token.slice(2);
    const key = CLI_KEYS[rawKey];
    if (!key) throw new ProviderError(`Unknown argument: ${token}`, 'invalid_argument');
    const value = argv[index + 1];
    if (value === undefined || value.startsWith('--')) {
      throw new ProviderError(`Missing value for ${token}`, 'invalid_argument');
    }
    index += 1;
    if (NUMERIC_KEYS.has(key)) params[key] = Number(value);
    else if (key === 'paginate') params[key] = value !== 'false';
    else params[key] = value;
  }
  return params;
}

function formatPublicError(error) {
  if (error instanceof ProviderError) {
    return { ok: false, code: error.code, message: error.message };
  }
  if (error?.code === 'MODULE_NOT_FOUND') {
    return {
      ok: false,
      code: 'missing_bundled_provider',
      message: 'The bundled qianliu IPD provider is unavailable. Update or reinstall cospec.',
    };
  }
  const message = String(error?.message || '');
  const status = message.match(/^API Error \((\d+)\):/);
  if (status) {
    return {
      ok: false,
      code: 'ipd_api_error',
      message: `IPD API request failed (${status[1]}).`,
    };
  }
  if (message.startsWith('网络错误:')) {
    return {
      ok: false,
      code: 'ipd_network_error',
      message: 'IPD network request failed.',
    };
  }
  if (message.includes('配置文件')) {
    return {
      ok: false,
      code: 'ipd_config_error',
      message: 'IPD configuration is unavailable or invalid.',
    };
  }
  return {
    ok: false,
    code: 'ipd_provider_error',
    message: 'IPD provider operation failed.',
  };
}

async function main() {
  const params = parseCliArgs(process.argv.slice(2));
  const result = await executeProviderAction(params.action, params);
  console.log(JSON.stringify(result, null, 2));
}

module.exports = {
  executeProviderAction,
  formatPublicError,
  parseCliArgs,
  ProviderError,
  resolveProviderPaths,
};

if (require.main === module) {
  main().catch((error) => {
    console.error(JSON.stringify(formatPublicError(error)));
    process.exitCode = 1;
  });
}
