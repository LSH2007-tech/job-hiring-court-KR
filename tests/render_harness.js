// Loads the screen code (hiring-court/web/static/app.js) in Node without a browser,
// so tests can draw each step from a made-up trial state and look at the HTML it produces.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const APP_JS = path.join(__dirname, '..', 'hiring-court', 'web', 'static', 'app.js');

/**
 * Start the screen code with a stand-in for the page. Returns the script's globals plus the #app element.
 * mode 'browser' draws the no-install version (the one that calls the Claude API with the user's own key).
 */
function loadApp(mode) {
  const app = {
    innerHTML: '',
    addEventListener() {},
    insertAdjacentHTML(where, html) { this.innerHTML += html; }
  };

  const ctx = {
    window: { scrollTo() {} },
    document: {
      activeElement: null,
      getElementById(id) { return id === 'app' ? app : null; },
      querySelectorAll() { return []; }
    },
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    fetch() { return Promise.reject(new Error('no network in tests')); },
    setInterval() { return 0; },
    clearInterval() {},
    setTimeout() { return 0; },
    clearTimeout() {},
    confirm() { return true; },
    console
  };

  if (mode === 'browser') {
    ctx.window.HC_MODE = 'browser';
    ctx.window.HC_ENGINE = { get() {}, post() {}, upload() {}, file() {} };
  }

  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(APP_JS, 'utf8'), ctx, { filename: 'app.js' });
  ctx.app = app;
  return ctx;
}

/** Draw one step of the trial screen for the given state and return its HTML. */
function drawStep(ctx, state, step, uiPatch) {
  ctx.S = JSON.parse(JSON.stringify(state));
  Object.assign(ctx.ui, { started: true, step: step, toast: '' }, uiPatch || {});
  ctx.render();
  return ctx.app.innerHTML;
}

/** Draw the title screen (before START) and return its HTML. */
function drawTitle(ctx, state, uiPatch) {
  ctx.S = state ? JSON.parse(JSON.stringify(state)) : null;
  Object.assign(ctx.ui, { started: false, toast: '' }, uiPatch || {});
  ctx.render();
  return ctx.app.innerHTML;
}

/** A finished example trial with every step filled in. Tests copy it and change what they need. */
function exampleState() {
  const jurorNames = ['인사담당자', '임원진', '실무 담당자'];
  return {
    id: '20260101-000000-test', round: 1, max_step: 6, saved: null, submitted: false,
    has_profile: true, can_draft: true, save_path: 'C:\\records',
    evidence: [{ n: 1, name: 'resume.pdf', size: 20480, kind: '이력서', ok: true, warn: '', chars: 1200 }],
    notion: { status: 'idle' },
    jd: {
      status: 'done', confirmed: true, files: [],
      rows: ['공고문 받기', '숨은 문장 정리', '공고 대상', '주요 업무', '자격 요건과 우대', '직무 일치도']
        .map((key) => ({ key: key, st: 'done', val: '확인' })),
      analysis: {
        company: '예시 회사', job: '설비 엔지니어', summary: '장비를 바로 셋업할 사람을 찾습니다',
        wants: [{ point: '셋업을 해 본 사람', basis: '장비 셋업 경험' }],
        web: [{ title: '채용 페이지', url: 'https://example.com/jobs', note: '신규 라인 증설' }],
        target: '경력 3년 이상', duties: ['장비 셋업', '고장 분석'], required: ['관련 경력'], preferred: ['영어'],
        removed: [], questions: ['근무지는 어디인가요?'], missing: [], caution: null
      },
      match: { '직접': 1, '전이': 1, '공백': 0, '주요 업무': 2, '직무 일치도': '높음', '기준 구간': [45, 80] }
    },
    panel: {
      status: 'done', confirmed: true, sources: [],
      jurors: jurorNames.map((role) => ({ role: role, focus: '직무 적합', persona: '꼼꼼하다', view: '해 본 일을 본다', basis: '공고 기준' }))
    },
    cover: { files: [] },
    draft: {
      status: 'done', msg: '',
      items: [{
        n: 1, q: '지원 동기', limit: 500, chars: 485, a: '셋업 시간을 30% 줄였습니다\n\n본문입니다.',
        line: '장비 셋업', x: '셋업이 늦었다', y: '순서를 바꿨다', z: '30% 단축', insight: '신규 라인 셋업에 쓰인다',
        used: ['경력: 이력서'], check: ['수치 출처를 확인해 주세요']
      }]
    },
    debate: {
      status: 'done', msg: '',
      messages: [
        { t: 'sys', text: '공방을 시작합니다.' },
        { t: 'sys', text: '모두진술', phase: 0 },
        { t: 'L', phase: 0, text: '직무 경험이 모자랍니다.', meta: '모두진술 · 12 / 800자' },
        { t: 'R', phase: 0, text: '셋업을 직접 해 봤습니다.', meta: '모두진술 · 12 / 800자' },
        { t: 'sys', text: '핵심 쟁점', phase: 2 },
        { t: 'S', phase: 2, items: ['셋업 경험의 깊이'] }
      ]
    },
    vote: {
      status: 'done', msg: '',
      jurors: jurorNames.map((name, i) => ({
        name: name, pass: i !== 1, pct: i === 1 ? 40 : 60, key: '해 본 일이 보인다',
        basis: '2-1 문단', pros: '셋업 경험', cons: '수치 부족', flip: '수치를 넣으면'
      })),
      tally: { '다수결': '합격 2 대 탈락 1', '서류 예측 %': 60, '서류 판결': '합격', '임원 시선 %': 40, '서류 범위': [40, 60], '표시': [] }
    },
    verdict: {
      status: 'done', rows: 4,
      data: {
        reasons: [{ text: '수치 근거가 약하다', who: '임원' }], defense: ['셋업을 직접 했다'],
        conditions: ['수치를 넣는다'], sentence: '수정 후 제출', strategy: '첫 문장에 결과를 둔다',
        advice: [{ title: '수치 넣기', target: '임원진의 표', problem: '결과가 흐리다', fix: '30%를 앞에', use: ['셋업 30% 단축'], sample: '셋업 시간을 30% 줄였습니다.' }],
        gaps: '영어 경험', avoid: ['열정'], honest: '직무는 맞다'
      }
    },
    revision: { status: 'idle' },
    files: [
      { name: '추천 초안', file: '초안.md', desc: '추천 예시', ready: true },
      { name: '판결문', file: '판결문.md', desc: '판결', ready: true },
      { name: '수정본', file: '수정본.md', desc: '수정본', ready: false }
    ]
  };
}

module.exports = { loadApp, drawStep, drawTitle, exampleState };
