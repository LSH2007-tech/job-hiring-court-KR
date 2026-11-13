// Node tests for the screen (hiring-court/web/static/app.js): every step must draw without an error.
// Run: node --test tests/app.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { loadApp, drawStep, drawTitle, exampleState } = require('./render_harness.js');

test('title screen draws with and without a trial', () => {
  const ctx = loadApp();
  assert.ok(drawTitle(ctx, null).includes('취업재판'));
  assert.ok(drawTitle(ctx, exampleState(), { filesOpen: true }).includes('resume.pdf'));
});

test('every step of a finished trial draws', () => {
  const ctx = loadApp();
  const marks = ['공고 분석', '재판부가 입장했습니다', '공방', '표결', '판사의 판결', '재판 기록', '재심 청구'];
  marks.forEach((mark, step) => {
    const html = drawStep(ctx, exampleState(), step, { revealN: 3, chatN: 99 });
    assert.ok(html.includes(mark), 'step ' + step + ' should show: ' + mark);
  });
});

test('steps draw while a job is running or has failed', () => {
  const ctx = loadApp();
  const jobs = ['jd', 'panel', 'debate', 'vote', 'verdict'];
  jobs.forEach((key, step) => {
    const running = exampleState();
    running[key] = Object.assign({}, running[key], { status: 'running', since: 1, act: '읽는 중', msg: '' });
    assert.ok(drawStep(ctx, running, step).length > 100, key + ' running');

    const failed = exampleState();
    failed[key] = Object.assign({}, failed[key], { status: 'error', error: '문제가 생겼어요 예시' });
    assert.ok(drawStep(ctx, failed, step).includes('문제가 생겼어요 예시'), key + ' error');
  });
});

test('recommended draft shows the result when there is an applicant record', () => {
  const ctx = loadApp();
  const html = drawStep(ctx, exampleState(), 1);
  assert.ok(html.includes('AI 추천 초안'));
  assert.ok(html.includes('485자 / 500자 (97%)'));
  assert.ok(html.includes('X 문제와 목표'));
  assert.ok(html.includes('이 초안을 답변 칸에 넣고 고치기'));
  assert.ok(html.includes('<option value="1000">1,000자</option>'));   // the company's length is picked from a list
});

test('recommended draft is closed when there is no applicant record', () => {
  const ctx = loadApp();
  const state = exampleState();
  state.can_draft = false;
  state.draft = { status: 'idle' };
  const html = drawStep(ctx, state, 1);
  assert.ok(html.includes('지원자 기록이 없어서 추천 초안은 쓸 수 없어요'));
  assert.ok(!html.includes('data-act="draft"'));
  assert.ok(html.includes('자기소개서 제출'));       // the user can still write it themself
});

test('a trial saved before the draft feature still draws', () => {
  const ctx = loadApp();
  const state = exampleState();
  delete state.draft;
  assert.ok(drawStep(ctx, state, 1).includes('추천 초안 쓰기'));
});
