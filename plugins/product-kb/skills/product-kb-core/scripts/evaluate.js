'use strict';

const fs = require('node:fs');
const path = require('node:path');

const RED_LINE_CODES = {
  MISSING_IPD_SOURCE: 'R1', UNSOURCED_CLAIM: 'R2', FEATURE_COVERAGE_GAP: 'R3',
  UNMANAGED_FILE_CHANGED: 'R4', INVALID_JSON: 'R5', UNREAD_ATTACHMENT_CLAIM: 'R6',
};

function validateSemantic(semantic) {
  for (const dimension of semantic.dimensions || []) {
    if (!dimension.reason || !Array.isArray(dimension.evidence) || !dimension.evidence.length) throw new Error(`语义维度 ${dimension.id} 缺少证据或理由`);
    if (dimension.score < 0 || dimension.score > dimension.maxScore) throw new Error(`语义维度 ${dimension.id} 分数越界`);
    for (const evidence of dimension.evidence) if (!evidence.file || !Array.isArray(evidence.sourceIds)) throw new Error(`语义维度 ${dimension.id} 证据结构无效`);
  }
}

function grade(score) {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 65) return 'C';
  if (score >= 50) return 'D';
  return 'F';
}

function mergeEvaluation({validation, semantic, ruleScore}) {
  validateSemantic(semantic);
  const semanticEarned = (semantic.dimensions || []).reduce((sum, item) => sum + item.score, 0);
  const semanticApplicable = (semantic.dimensions || []).reduce((sum, item) => sum + item.maxScore, 0);
  const semanticScore = semanticApplicable ? Math.round(semanticEarned / semanticApplicable * 55) : 0;
  const total = Math.round((ruleScore ?? (validation.valid ? 45 : 0)) + semanticScore);
  const redLines = [...new Set((validation.errors || []).map(item => RED_LINE_CODES[item.code]).filter(Boolean))].sort();
  const findings = [...(validation.errors || []), ...(validation.warnings || []), ...(semantic.dimensions || []).flatMap(item => item.findings || [])]
    .sort((a, b) => (a.code || a.findingId || '').localeCompare(b.code || b.findingId || '') || (a.file || '').localeCompare(b.file || ''));
  const repairQueue = findings.filter(item => item.autoFixable !== false && item.code !== 'SOURCE_MISSING');
  const report = {schemaVersion:'1.0.0', rubricVersion:'1.0.0', valid:validation.valid, score:total, grade:redLines.length ? 'F' : grade(total), redLines, coverage:validation.stats || {}, ruleFindings:[...(validation.errors || []), ...(validation.warnings || [])], semanticDimensions:semantic.dimensions || [], repairQueue, blockedItems:findings.filter(item => item.autoFixable === false)};
  return report;
}

function writeEvaluation(root, report) {
  const jsonPath = path.join(root, '.source', 'evaluation-report.json');
  const markdownPath = path.join(root, '.source', 'evaluation-report.md');
  fs.mkdirSync(path.dirname(jsonPath), {recursive:true});
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(markdownPath, `# 产品知识库质量评估\n\n- 分数: ${report.score}\n- 等级: ${report.grade}\n- 红线: ${report.redLines.join(', ') || '无'}\n- 待修复: ${report.repairQueue.length}\n`);
  return {jsonPath, markdownPath};
}

module.exports = {mergeEvaluation, writeEvaluation};
