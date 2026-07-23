'use strict';

const path = require('node:path');

function productionApi() {
  return require(path.join(__dirname, '..', '..', '..', 'skills', 'qianliu-ipd', 'scripts', 'ipd_api.js'));
}

function createIpdAdapter({api} = {}) {
  const getApi = () => api || productionApi();
  return {
    adapterId: 'ipd',
    adapterVersion: '1.0.0',

    async describeSource(options) {
      return {
        mode: options.mode,
        query: {
          projectId: options.projectId || null,
          versionId: options.versionId || null,
          teamId: options.teamId || null,
          sprintId: options.sprintId || null,
          rootIssueIds: options.rootIssueIds || [],
        },
      };
    },

    async listIssues(options) {
      const result = await getApi().getIssuesByScope({
        projectId: options.projectId,
        planVersionId: options.versionId,
        teamVersionId: options.teamId,
        sprintId: options.sprintId,
        per: options.per || 50,
        page: options.page || 1,
      });
      const count = result.list?.length || 0;
      return {items: result.list || [], total: result.total || count, nextCursor: count && (options.page || 1) * (options.per || 50) < result.total ? (options.page || 1) + 1 : null};
    },

    async getIssue(issueId) {
      const result = await getApi().getIssue(issueId);
      return result.data || result;
    },

    async listChildren(issueId, context = {}) {
      return getApi().getSubIssues(issueId, {productId: context.productId});
    },

    async listComments(issueId) {
      const result = await getApi().getComments(issueId, {per: 100});
      return result.list || [];
    },

    async listAttachments(issueId) {
      return getApi().getIssueAttachments(issueId);
    },

    async downloadAttachment(attachmentId, destination, options) {
      return getApi().downloadAttachment(attachmentId, destination, options);
    },

    async collectLifecycle(options) {
      if (!options.projectId || !options.versionId) return {applicable: false, reason: 'projectId 和 versionId 未同时提供', stages: [], activities: []};
      const source = getApi();
      const stages = await source.getProjectStages(options.projectId, options.versionId);
      const activities = [];
      for (const stage of stages) {
        const normal = await source.getStageActivities(stage.id, options.versionId);
        const reviews = await source.getStageReviewActivities(stage.id, options.versionId);
        for (const activity of [...normal.map(item => ({...item, review: false})), ...reviews.map(item => ({...item, review: true}))]) {
          const [detail, qualityStandards, deliverables, dependencies, reviewRecords] = await Promise.all([
            source.getActivityDetail(activity.id),
            source.getActivityQualityStandards(activity.id, options.versionId),
            source.getActivityDeliverables(activity.id),
            source.getActivityDependencies(activity.id),
            activity.review ? source.getActivityReviewRecords(activity.id) : Promise.resolve(null),
          ]);
          activities.push({...activity, stageId: stage.id, detail, qualityStandards, deliverables, dependencies, reviewRecords});
        }
      }
      return {applicable: true, stages, activities};
    },
  };
}

module.exports = {createIpdAdapter};
