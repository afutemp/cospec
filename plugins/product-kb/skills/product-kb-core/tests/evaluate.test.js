'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {mergeEvaluation} = require('../scripts/evaluate');

test('mergeEvaluation calculates weighted score and grade', () => {
  const validation = {valid: true, errors: [], warnings: []};
  const semantic = {dimensions: [
    {id:'strategy', score:8, maxScore:8, evidence:[{file:'a.md',sourceIds:['IPD-1']}], reason:'clear', findings:[]},
    {id:'users', score:8, maxScore:10, evidence:[{file:'b.md',sourceIds:['IPD-2']}], reason:'good', findings:[]},
  ]};
  const report = mergeEvaluation({validation, semantic, ruleScore: 45});
  assert.equal(report.score, 94);
  assert.equal(report.grade, 'A');
});

test('red lines force grade F', () => {
  const report = mergeEvaluation({validation:{valid:false,errors:[{code:'MISSING_IPD_SOURCE',file:'f.md'}],warnings:[]}, semantic:{dimensions:[]}, ruleScore:40});
  assert.equal(report.grade, 'F');
  assert.ok(report.redLines.includes('R1'));
});

test('semantic dimensions require evidence and reason', () => {
  assert.throws(() => mergeEvaluation({validation:{valid:true,errors:[],warnings:[]}, semantic:{dimensions:[{id:'x',score:1,maxScore:1,evidence:[],reason:''}]}}), /证据/);
});
