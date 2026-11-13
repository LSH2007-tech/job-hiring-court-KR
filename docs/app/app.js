'use strict';
/*
 * 취업재판 웹앱 화면.
 * 서버(/api)의 재판 상태 S를 1.5초마다 받아 화면을 다시 그린다.
 *
 * 이 파일의 구역 (화면이 진행되는 순서대로)
 *    1. 상태와 상수
 *    2. 작은 도구 (글자 처리, 알림, 사람 그림)
 *    3. 서버와 주고받기
 *    4. 처음 화면 (제목, 지원자 파일, Notion 연동)
 *    5. 공통 조각 (머리말, 서기 말풍선, 진행 표시, 오류 상자, 파일 미리보기)
 *    6. 0단계: 공고 접수
 *    7. 1단계: 재판부, 자기소개서 제출, AI 추천 초안
 *    8. 2단계: 공방
 *    9. 3단계: 배심 표결
 *   10. 4단계: 판결과 조언
 *   11. 5단계: 전달
 *   12. 6단계: 재심 또는 제출
 *   13. 화면 그리기 (render)
 *   14. 버튼 동작 (ACT)
 *   15. 입력 이벤트 연결
 *
 * 고칠 때: 화면의 글과 모양은 해당 단계 구역에서, 버튼을 눌렀을 때의 동작은 14번 구역에서 찾는다.
 * 고친 뒤에는 `node --test tests/app.test.js`로 모든 단계가 그려지는지 확인한다.
 */


// ============================================================
// 1. 상태와 상수
// ============================================================

// S: 서버가 준 재판 상태. last: 직전에 받은 상태(바뀌었을 때만 다시 그리려고 둔다).
var S = null, last = '';

// ui: 이 브라우저 화면에만 있는 상태(어느 단계를 보고 있는지, 입력 중인 글 등).
var ui = {
  started: false,       // START를 눌렀는가
  step: 0,              // 지금 보고 있는 단계 (0~6)

  // 처음 화면
  filesOpen: false,     // 지원자 파일 칸이 열려 있는가
  notionOpen: false,    // Notion 연동 칸이 열려 있는가
  notionSt: '',         // 노션 연결 상태: '', checking, opened, manual, connected
  notionHint: '',       // 노션에서 찾을 위치(사용자 입력)

  // 0단계
  input: 'image',       // 공고 입력 방식: image, file, paste
  paste: '',            // 붙여넣은 공고 본문
  extra: '',            // 공고에 덧붙일 정보

  // 1단계
  panelNote: '',        // 재판부 관점 수정 요청
  noteOpen: false,      // 수정 요청 칸이 열려 있는가
  clMode: 'write',      // 자기소개서 제출 방식: write, file
  qs: [{ q: '', limit: '', a: '' }],                  // 직접 작성하는 문항들
  dqs: [{ q: '', limit: '?', custom: false }],        // AI 추천 초안을 받을 문항들

  // 2~5단계
  chatN: 0,             // 공방에서 지금까지 보여 준 말풍선 수
  revealN: 0,           // 표결에서 공개한 배심원 수
  preview: null,        // 열어 본 파일의 이름
  previewText: '',      // 열어 본 파일의 내용
  savePath: '',         // 기록을 저장할 폴더

  toast: '',            // 화면 아래에 잠깐 뜨는 알림
  busy: false
};

var LABELS = ['공고 접수', '재판부와 사건 기록', '공방', '배심 표결', '판결과 조언', '전달', '재심 또는 제출'];

var SUBS = [
  '서기가 공고문을 확인합니다',
  '배심원이 입장합니다',
  '탈락 위원과 합격 위원이 해당 지원자를 어떻게 판단하는지 밝히고 합불을 공방합니다',
  '배심원이 각자 투표합니다',
  '판사가 판결하고 고칠 점을 알려 줍니다',
  '기록을 전달합니다',
  '다음 행동을 고릅니다'
];

// 다음 단계가 잠겨 있을 때 단계별로 보여 주는 안내
var LOCK_HINTS = [
  '공고 분석을 확정해야 다음 단계가 열립니다',
  '자기소개서를 넣고 사건 기록을 접수해야 합니다',
  '공방이 끝나야 다음 단계가 열립니다',
  '표결이 끝나야 다음 단계가 열립니다',
  '판결이 끝나야 다음 단계가 열립니다',
  '',
  ''
];

var JUROR_NAMES = ['인사담당자', '임원진', '실무 담당자'];
var COLORS = { '인사담당자': '#4E7A5A', '임원진': '#3B3846', '실무 담당자': '#A86A1F' };

// 회사가 흔히 정하는 자기소개서 글자 수(공백 포함). 추천 초안의 글자 수 목록에 나온다.
var LIMITS = [300, 500, 600, 700, 800, 1000, 1200, 1500, 2000];
var MAX_DRAFT_QUESTIONS = 6;

var app = document.getElementById('app');


// ============================================================
// 2. 작은 도구
// ============================================================

/** 글자를 HTML에 넣어도 안전하게 바꾼다. 화면에 넣는 모든 사용자 글과 AI 글에 쓴다. */
function h(s) {
  var map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return map[c]; });
}

/** 글 목록을 <li> 줄들로 바꾼다. */
function li(a) {
  return (a || []).map(function (x) { return '<li>' + h(x) + '</li>'; }).join('');
}

/** 파일 크기를 KB, MB로 적는다. */
function size(b) {
  if (b >= 1048576) return (b / 1048576).toFixed(1) + 'MB';
  return Math.max(1, Math.round(b / 1024)) + 'KB';
}

/** 화면 아래에 5초 동안 알림을 띄운다. */
function toast(m) {
  ui.toast = m;
  render();
  setTimeout(function () { ui.toast = ''; render(); }, 5000);
}

/** 사람 그림(SVG). body: 옷 색, hair: 머리 색, w: 너비, kind: 'clerk'(서기) 또는 'judge'(판사). */
function person(body, hair, w, kind) {
  var extra = '';

  if (kind === 'clerk') {   // 안경과 기록지
    extra = '<circle cx="41" cy="38" r="5" fill="none" stroke="#1E1D24" stroke-width="2"/>' +
      '<circle cx="55" cy="38" r="5" fill="none" stroke="#1E1D24" stroke-width="2"/>' +
      '<rect x="56" y="78" width="26" height="32" rx="2" fill="#fff" stroke="#1E1D24" stroke-width="2"/>' +
      '<path d="M61 86h16M61 92h16M61 98h10" stroke="#5B5866" stroke-width="2"/>';
  }
  if (kind === 'judge') {   // 판사봉
    extra = '<rect x="76" y="62" width="20" height="11" rx="3" transform="rotate(-30 86 67)" fill="#C08A4E" stroke="#1E1D24" stroke-width="2"/>' +
      '<path d="M84 73l-10 20" stroke="#F2B544" stroke-width="4" stroke-linecap="round"/>';
  }

  return '<svg width="' + w + '" height="' + Math.round(w * 1.25) + '" viewBox="0 0 96 120" aria-hidden="true">' +
    '<path d="M14 118C14 80 30 62 48 62s34 18 34 56z" fill="' + body + '" stroke="#1E1D24" stroke-width="2"/>' +
    '<path d="M40 62l8 10 8-10" fill="#fff" stroke="#1E1D24" stroke-width="2"/>' +
    '<circle cx="48" cy="36" r="20" fill="#F1D3B8" stroke="#1E1D24" stroke-width="2"/>' +
    '<path d="M28 33c1-13 9-19 20-19s19 6 20 19c-7-5-13-7-20-7s-13 2-20 7z" fill="' + hair + '" stroke="#1E1D24" stroke-width="2"/>' +
    '<circle cx="41" cy="38" r="2" fill="#1E1D24"/>' +
    '<circle cx="55" cy="38" r="2" fill="#1E1D24"/>' +
    '<path d="M43 47h10" stroke="#1E1D24" stroke-width="2" stroke-linecap="round"/>' +
    extra + '</svg>';
}


// ============================================================
// 3. 서버와 주고받기
// ============================================================
// 이 화면은 두 방식에서 같이 쓴다.
//   local   : 내 PC의 server.py와 주고받는다 (사용자의 Claude Code 로그인).
//   browser : GitHub Pages용. engine.js가 사용자의 API 키로 Claude API를 직접 부른다.

var MODE = window.HC_MODE || 'local';

function json(r) {
  return r.json().then(function (j) {
    if (!r.ok) throw new Error(j.error || '요청 실패');
    return j;
  });
}

var API = window.HC_ENGINE || {
  get: function (path) {
    return fetch(path).then(json);
  },
  post: function (path, body) {
    return fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {})
    }).then(json);
  },
  upload: function (id, kind, f) {
    var url = '/api/trial/' + id + '/upload?kind=' + kind + '&name=' + encodeURIComponent(f.name);
    return fetch(url, { method: 'POST', body: f }).then(json);
  },
  file: function (id, name) {
    return fetch('/api/trial/' + id + '/file?name=' + encodeURIComponent(name)).then(function (r) {
      if (!r.ok) throw new Error('아직 만들어지지 않은 파일이에요');
      return r.text();
    });
  }
};

function post(path, body) {
  return API.post(path, body);
}

/** 재판에 요청 하나를 보낸다(예: act('jd', {...})). 실패하면 알림을 띄우고 오류를 다시 던진다. */
function act(path, body) {
  return ensure()
    .then(function () { return post('/api/trial/' + S.id + '/' + path, body); })
    .then(function (j) { setS(j); return j; })
    .catch(function (e) { toast(e.message); throw e; });
}

/** 재판이 아직 없으면 새로 만든다. */
function ensure() {
  return S ? Promise.resolve() : post('/api/trial').then(setS);
}

/** 서버가 준 재판 상태를 받아 화면을 다시 그린다. */
function setS(j) {
  S = j;
  last = JSON.stringify(j);
  if (MODE === 'local') {
    try { localStorage.setItem('hc_trial', j.id); } catch (e) {}
  }
  if (!ui.savePath) ui.savePath = j.save_path;
  render();
}

/** 파일 여러 개를 하나씩 차례로 올린다. kind: evidence, jd, cover. */
function upload(kind, files) {
  var p = ensure();
  Array.prototype.forEach.call(files, function (f) {
    p = p.then(function () {
      return API.upload(S.id, kind, f).then(setS);
    });
  });
  return p.catch(function (e) { toast('파일을 올리지 못했어요: ' + e.message); });
}

// 이 브라우저가 하던 재판을 다시 불러온다(새로고침이나 서버 재시작 뒤).
// 그래야 노션이나 파일로 넣은 지원자 기록과 진행 상황이 사라지지 않는다.
if (MODE === 'local') {
  try {
    var savedTrial = localStorage.getItem('hc_trial');
    if (savedTrial) {
      API.get('/api/trial/' + savedTrial).then(setS).catch(function () {
        try { localStorage.removeItem('hc_trial'); } catch (e) {}
      });
    }
  } catch (e) {}
}

// 1.5초마다 재판 상태를 받아, 바뀌었을 때만 다시 그린다.
setInterval(function () {
  if (!S) return;
  API.get('/api/trial/' + S.id).then(function (j) {
    var s = JSON.stringify(j);
    if (s !== last) { S = j; last = s; render(); }
  }).catch(function () {});
}, 1500);


// ============================================================
// 4. 처음 화면 (제목, 지원자 파일, Notion 연동)
// ============================================================

function titleScreen() {
  var ev = S ? S.evidence : [];

  return '<main class="title">' +
    '<div class="sub">MOCK HIRING COURT</div><h1>취업재판</h1>' +
    '<p style="font-size:18px;color:#D5DBEC">내 자소서를 법정에 세워 보자</p>' +
    titleCast() +
    titleButtons(ev) +
    titleInfo() +
    (ui.notionOpen ? notionPanel() : '') +
    (ui.filesOpen ? evidencePanel(ev) : '') +
    '</main>';
}

/** 재판에 나오는 일곱 사람을 한 줄로 세운다. */
function titleCast() {
  // 옷 색, 머리 색, 너비, 종류, 이름
  var cast = [
    ['#8A3B12', '#1E1D24', 76, '', '검사<br>탈락 위원'],
    ['#4E7A5A', '#3A3442', 70, '', '인사담당자'],
    ['#5A5668', '#C9C6D2', 70, '', '임원진'],
    ['#0E1630', '#E9E6EF', 104, 'judge', '판사'],
    ['#3E6E73', '#2B2230', 70, 'clerk', '서기'],
    ['#A86A1F', '#3A3442', 70, '', '실무 담당자'],
    ['#2D6CC0', '#5A3A22', 76, '', '변호인<br>합격 위원']
  ];

  var people = cast.map(function (c, i) {
    return '<div style="animation-delay:' + (i * 0.25) + 's">' +
      person(c[0], c[1], c[2], c[3]) + '<span>' + c[4] + '</span></div>';
  }).join('');

  return '<div><div class="lineup">' + people + '</div>' +
    '<div class="bench" style="margin:6px auto 0"></div></div>';
}

/** START, Notion 연동, 지원자 파일 넣기, 새 재판 버튼. */
function titleButtons(ev) {
  var notionDone = S && S.notion.status === 'done';

  var startBtn = '<button class="start" data-act="start">' +
    (S && S.max_step > 0 ? '▶ 이어서 하기' : '▶ START') + '</button>';

  var notionBtn = '';
  if (MODE !== 'browser') {
    var notionLabel = notionDone ? (S.notion.confirmed ? '노션 연동됨' : '노션 확인 필요') : 'Notion 연동';
    notionBtn = '<button class="ghost' + (notionDone ? ' on' : '') + '" data-act="notion">' + notionLabel + '</button>';
  }

  var filesBtn = '<button class="ghost' + (ev.length ? ' on' : '') + '" data-act="toggleFiles">' +
    (ev.length ? '증거자료 ' + ev.length + '건' : '지원자 파일 넣기') + '</button>';

  // 하던 재판이 있을 때만 '새 재판' 버튼을 보인다.
  var hasWork = S && (S.max_step > 0 || S.jd.status !== 'idle' || S.notion.status === 'done' || ev.length);
  var freshBtn = MODE === 'local' && hasWork ? '<button class="ghost" data-act="fresh">새 재판</button>' : '';

  return '<div class="row center">' + startBtn + notionBtn + filesBtn + freshBtn + '</div>';
}

/** 처음 화면의 안내 글. */
function titleInfo() {
  // 이 재판이 무엇을 돕는지 먼저 알린다.
  var about = '<b>이 재판은</b><br>' +
    '채용 공고의 직무(JD)와 지원자의 스킬을 맞춰 보고, 어떤 직무가 맞는지, ' +
    '그 직무에 맞춰 자소서를 어떻게 완성해야 합격 가능성을 높일 수 있는지 돕는 AI입니다. ' +
    '요즘 채용은 직무 JD와 지원자 스킬의 매칭을 매우 중요하게 보기 때문에, 그 매칭부터 분석합니다.<br>';

  var files = '<br><b>지원자 파일 넣기</b><br>' +
    '가지고 있는 C.V 파일(이력서, 경력기술서, 기존 자소서)을 넣으면 서기가 경력과 이력을 조사해 ' +
    '지원자의 스킬이 직무의 스킬과 맞는지 매칭합니다. 넣지 않아도 START로 시작할 수 있어요.';

  var browser = '<br><b>브라우저 방식</b><br>' +
    '내 Claude API 키로 이 브라우저에서 바로 돌아갑니다. 사용한 만큼 내 API 계정에서 요금이 나가고, ' +
    '키는 이 브라우저에만 저장되어 Anthropic에만 보내집니다. 노션 연동은 Claude Code 방식에서 쓸 수 있어요. ' +
    '<button class="btn" style="margin-top:6px" data-act="changeKey">API 키 바꾸기</button>';

  var notion = '<br><b>Notion 연동</b><br>' +
    '노션에 정리된 지원자의 C.V, 즉 경력과 과거 지원 이력을 조사해 같은 방식으로 매칭합니다. ' +
    '노션은 읽기만 하고 아무것도 쓰지 않습니다.';

  // 내 구독 사용량을 쓰므로, 재판 한 번에 얼마나 드는지 미리 알린다.
  var usage = '<br><b>사용량</b><br>' +
    '재판 한 번(공고 분석부터 판결, 추천 초안까지)에 Claude를 10번 안팎 부릅니다. ' +
    'Pro 요금제에서 Opus 5.5(높은 연산 수준)로 시험했을 때 5시간 사용 한도의 약 20~30%를 썼어요. ' +
    '시작하기 전에 남은 사용량을 확인해 주세요.';

  var tail = MODE === 'browser' ? browser : notion + usage;
  return '<div class="info">' + about + files + tail + '</div>';
}

/** 지원자 파일(증거자료)을 넣고 목록을 보는 칸. */
function evidencePanel(ev) {
  var kinds = ['이력서', '경력기술서', '기존 자소서', '기타 자료'];

  var rows = ev.map(function (e) {
    var detail = size(e.size) +
      (e.chars ? ' · 글자 ' + e.chars.toLocaleString() + '자' : '') +
      (e.warn ? ' · ' + h(e.warn) : '');

    var options = kinds.map(function (k) {
      return '<option' + (k === e.kind ? ' selected' : '') + '>' + k + '</option>';
    }).join('');

    return '<div class="prow' + (e.ok ? '' : ' error') + '">' +
      '<span style="flex:1 1 auto;min-width:0"><b>' + h(e.name) + '</b><br><span class="small">' + detail + '</span></span>' +
      '<select style="width:auto" aria-label="자료 종류" data-kind="' + e.n + '">' + options + '</select>' +
      '<button class="btn" data-act="rmEvidence" data-n="' + e.n + '" aria-label="' + h(e.name) + ' 빼기">✕</button>' +
      '</div>';
  }).join('');

  var empty = '<div class="soft muted" style="text-align:center">아직 넣은 증거자료가 없습니다.</div>';

  return '<section class="panel col">' +
    '<div><div class="h3">지원자 파일 넣기</div>' +
    '<p class="muted" style="font-size:14px">이력서, 경력기술서, 기존에 지원했던 자기소개서를 여러 개 넣을 수 있어요. (PDF, Word, 한글 hwpx, 텍스트)</p></div>' +
    '<label class="drop" for="ev-files">파일을 눌러서 고르세요<span class="small">여러 개 가능</span></label>' +
    '<input id="ev-files" type="file" multiple accept=".pdf,.docx,.hwpx,.txt,.md,.pptx" data-up="evidence">' +
    '<div class="row between"><div class="h3">증거자료</div><span class="small">' + ev.length + '건</span></div>' +
    '<p class="small">재판에서 지원자의 경력과 이력을 확인하는 데 쓰는 자료입니다. 종류가 틀리면 바꿔 주세요.</p>' +
    (ev.length ? rows : empty) +
    '</section>';
}

/** Notion 연동 칸: 로그인, 가져오기, 가져온 기록이 내 것이 맞는지 확인. */
function notionPanel() {
  var n = S ? S.notion : { status: 'idle' };
  var st = ui.notionSt;
  var body;

  if (st === 'checking') {
    body = '<div class="soft"><span class="spin"></span> 노션 연결을 확인하는 중</div>';

  } else if (st === 'opened') {
    body = '<div class="good col"><b style="color:var(--blue)">브라우저에 노션 로그인 창을 열었습니다.</b>' +
      '<span style="font-size:14px">노션에 로그인하고 <b>액세스 허용</b>을 누르면 여기로 자동으로 이어집니다. 함께 뜬 검은 창은 승인이 끝나면 닫혀요.</span>' +
      '<span class="small"><span class="spin"></span> 승인을 기다리는 중…</span>' +
      '<button class="btn" data-act="notionConnect">창이 안 열렸어요, 다시 열기</button></div>';

  } else if (st === 'manual') {
    body = '<div class="warn col"><b>이 컴퓨터에서는 로그인 창을 자동으로 열 수 없어요.</b>' +
      '<span style="color:var(--ink);font-size:14px">터미널에서 아래 명령을 한 번 실행하고 브라우저에서 승인해 주세요.</span>' +
      '<div class="pre">claude mcp login notion</div>' +
      '<button class="btn" data-act="notionCheck">연결 다시 확인</button></div>';

  } else if (st === 'connected') {
    body = notionConnected(n);

  } else {
    body = '<button class="btn primary big" data-act="notionConnect">노션 로그인하기</button>';
  }

  return '<section class="panel col">' +
    '<div><div class="h3">Notion 연동</div>' +
    '<p class="muted" style="font-size:14px">내 노션에서 이력서, 경험 정리, 지원 현황, 자기소개서를 찾아 지원자 자료로 정리합니다. 노션은 읽기만 합니다.</p></div>' +
    body + '</section>';
}

/** 노션이 연결된 뒤의 화면: 가져오기 버튼과 가져온 결과. */
function notionConnected(n) {
  var run = '<label for="n-hint">노션의 어디에 이력과 자소서가 있나요? (선택)</label>' +
    '<input id="n-hint" type="text" data-bind="notionHint" value="' + h(ui.notionHint) + '" placeholder="예: 취준관리 페이지 아래에 있어요">' +
    '<button class="btn primary big" data-act="notionRun"' + (n.status === 'running' ? ' disabled' : '') + '>' +
    (n.status === 'done' ? '노션에서 다시 가져오기' : '노션에서 가져오기') + '</button>';

  if (n.status === 'running') {
    return '<div class="soft"><span class="spin"></span> 노션에서 경력과 지원 이력을 조사하는 중 <span class="small">(1~3분)</span></div>';
  }
  if (n.status === 'error') {
    return run + '<div class="warn"><b>' + h(n.error) + '</b></div>';
  }
  if (n.status === 'done') {
    return notionResult(n) + run;
  }
  return '<div class="good"><b style="color:var(--blue)">노션이 연결되었습니다.</b></div>' + run;
}

/** 노션에서 가져온 기록. 사용자가 "내 기록이 맞다"고 확인해야 재판에 쓴다. */
function notionResult(n) {
  var pages = n.pages || [], missing = n.missing || [], facts = n.facts || [];

  var title;
  if (n.confirmed) title = '확인된 내 기록';
  else if (n.space) title = '노션의 ‘' + h(n.space) + '’에서 가져왔어요. 내 기록이 맞나요?';
  else title = '노션에서 가져온 내용이 내 기록이 맞나요?';

  var factList = facts.length
    ? '<ul style="font-size:14px;margin:0;padding-left:18px">' + facts.map(function (x) { return '<li>' + h(x) + '</li>'; }).join('') + '</ul>'
    : '<span style="font-size:14px">' + h(n.summary) + '</span>';

  var pageList = '<details><summary class="small">읽은 페이지 ' + pages.length + '개' +
    (missing.length ? ', 찾지 못한 것 ' + missing.length + '개' : '') + '</summary>' +
    '<ul style="font-size:13px">' +
    pages.map(function (p) { return '<li><b>' + h(p.title) + '</b> ' + h(p.note) + '</li>'; }).join('') +
    '</ul>' +
    (missing.length ? '<span class="small">찾지 못한 것: ' + missing.map(h).join(', ') + '</span>' : '') +
    '</details>';

  var confirmButtons = n.confirmed ? '' :
    '<div class="grid2"><button class="btn primary big" data-act="notionOk">맞아요</button>' +
    '<button class="btn big" data-act="notionNo">아니에요, 다시 찾기</button></div>' +
    '<span class="small">아니라면 아래에 맞는 페이지 이름을 적고 다시 가져와 주세요.</span>';

  return '<div class="' + (n.confirmed ? 'good' : 'warn') + ' col" style="color:var(--ink)">' +
    '<b style="font-size:16px;color:var(--navy)">' + title + '</b>' +
    (n.person ? '<span style="font-size:14px">' + h(n.person) + '</span>' : '') +
    factList + pageList + confirmButtons +
    '</div>';
}


// ============================================================
// 5. 공통 조각
// ============================================================

/** 재판 화면 맨 위: 사건 이름, 지원자 기록 표시, 단계 이동 줄. */
function header() {
  var a = S.jd.analysis;

  var caseName = a && S.jd.status === 'done' ? '사건: ' + h(a.company) + ' ' + h(a.job) : '사건: 공고 접수 전';

  var record = [
    S.notion.status === 'done' ? '노션 연동됨' : '',
    S.evidence.length ? '증거자료 ' + S.evidence.length + '건' : ''
  ].filter(Boolean).join(' + ') || '지원자 기록 없음';

  var round = S.round === 1 ? '1심' : '재심 ' + (S.round - 1) + '회';

  var chips = LABELS.map(function (l, i) {
    var cls = i === ui.step ? ' cur' : i < ui.step ? ' done' : '';
    var locked = i > S.max_step ? ' disabled title="앞 단계를 마쳐야 열립니다"' : '';
    return '<button class="chip' + cls + '" data-act="go" data-n="' + i + '"' + locked + '>' +
      '<span class="n">' + i + '</span>' + l + '</button>';
  }).join('');

  return '<header class="row between">' +
    '<div><h1 style="font-size:24px;font-weight:900">취업 재판</h1><span class="small">' + caseName + '</span></div>' +
    '<div class="row"><span class="tag">' + record + '</span><span class="tag run">' + round + '</span>' +
    '<button class="btn" data-act="home">처음 화면</button></div>' +
    '</header>' +
    '<nav class="row" aria-label="재판 단계" style="margin:16px 0">' + chips + '</nav>';
}

/** 서기의 말풍선. */
function clerk(text) {
  return '<div class="row" style="align-items:flex-end">' + person('#3E6E73', '#2B2230', 84, 'clerk') +
    '<div class="bubble"><b>서기:</b> ' + text + '</div></div>';
}

// 오래 걸리는 작업이 멈춘 것처럼 보이지 않게, 지금 하는 일(job.act)과 지난 시간(job.since)을 함께 보인다.
function elapsed(since) {
  var s = Math.max(0, Math.round(Date.now() / 1000 - since));
  return '경과 ' + (s >= 60 ? Math.floor(s / 60) + '분 ' : '') + (s % 60) + '초';
}

function progress(job) {
  if (!job) return '';
  var doing = job.act ? '<br><span class="small">지금: ' + h(job.act) + '</span>' : '';
  var time = job.since ? ' <span class="small" data-since="' + job.since + '">' + elapsed(job.since) + '</span>' : '';
  return doing + time;
}

/** "~하는 중" 상자. */
function running(msg, job) {
  return '<div class="soft" role="status"><span class="spin"></span> ' + h(msg) +
    ' <span class="small">(1~3분 걸릴 수 있어요)</span>' + progress(job) + '</div>';
}

// 경과 시간을 1초마다 고쳐 쓴다(화면 전체를 다시 그리지 않고 숫자만).
setInterval(function () {
  Array.prototype.forEach.call(document.querySelectorAll('[data-since]'), function (el) {
    el.textContent = elapsed(+el.dataset.since);
  });
}, 1000);

/** 오류 상자. retry에 버튼 동작 이름을 주면 '다시 시도' 버튼을 붙인다. */
function errorBox(job, retry) {
  var button = retry ? '<br><button class="btn" style="margin-top:8px" data-act="' + retry + '">다시 시도</button>' : '';
  return '<div class="warn" role="alert"><b>문제가 생겼어요.</b> ' + h(job.error) + button + '</div>';
}

/** '열기'로 연 파일의 내용. */
function preview() {
  if (!ui.preview) return '';
  return '<div><div class="row between"><b>' + h(ui.preview) + '</b>' +
    '<button class="btn" data-act="closePreview">닫기</button></div>' +
    '<div class="pre">' + h(ui.previewText) + '</div></div>';
}


// ============================================================
// 6. 0단계: 공고 접수
// ============================================================

function step0() {
  var jd = S.jd, st = jd.status, a = jd.analysis;

  var line;
  if (st === 'idle') line = '본 판결에 앞서 서기가 공고문을 먼저 확인합니다. 캡처 이미지, 파일, 본문 붙여넣기 중 하나로 공고문을 주세요.';
  else if (st === 'running') line = '공고문을 읽고 있습니다. 아래 칸이 하나씩 채워집니다.';
  else if (st === 'error') line = '공고를 확인하지 못했습니다. 아래 안내를 봐 주세요.';
  else if (jd.confirmed) line = '공고 확인을 마쳤습니다. 다음은 재판부와 자기소개서입니다.';
  else line = '공고 분석을 마쳤습니다. 제가 이해한 내용이 맞는지 확인해 주세요.';

  var html = clerk(line) + jdInputCard(jd);
  if (jd.rows.length) html += jdProgressCard(jd);
  if (st === 'error') html += jdErrorBox(jd);
  if (st === 'done' && a) html += jdAnalysisCard(jd) + jdExtraCard(jd) + jdFilesCard(jd);
  return html;
}

/** 공고를 넣는 칸: 방식 고르기(이미지, 파일, 붙여넣기)와 접수 버튼. */
function jdInputCard(jd) {
  var st = jd.status;
  var modes = [['image', '이미지(캡처)'], ['file', '파일(PDF, Word)'], ['paste', '본문 붙여넣기']];

  var tabs = modes.map(function (x) {
    return '<button class="seg' + (ui.input === x[0] ? ' on' : '') + '" data-act="input" data-v="' + x[0] + '">' + x[1] + '</button>';
  }).join('');

  var inp;
  if (ui.input === 'paste') {
    inp = '<label for="jd-paste">공고 본문</label>' +
      '<textarea id="jd-paste" rows="6" placeholder="공고 페이지의 글을 복사해 붙여넣으세요" data-bind="paste">' + h(ui.paste) + '</textarea>';
  } else {
    var isImage = ui.input === 'image';

    var pdfHelp = '<div class="soft" style="font-size:13px"><b>공고 페이지를 PDF로 저장하는 법</b>' +
      '<ol style="margin:4px 0 0 18px">' +
      '<li>공고 페이지에서 <b>Ctrl+P</b>를 누릅니다 (Mac은 ⌘+P).</li>' +
      '<li>대상(프린터)을 <b>PDF로 저장</b>으로 바꿉니다.</li>' +
      '<li><b>저장</b>을 누르고, 저장된 파일을 위에 넣습니다.</li>' +
      '</ol></div>';

    var fileList = '<div class="small">넣은 파일: ' + jd.files.map(h).join(', ') +
      ' <button class="btn" data-act="clearJd">비우기</button></div>';

    inp = '<label class="drop" for="jd-file">' +
      (isImage ? '공고 캡처 이미지를 눌러서 고르세요 (여러 장 가능)' : '공고 파일을 눌러서 고르세요 (PDF, Word, hwpx)') + '</label>' +
      '<input id="jd-file" type="file" multiple accept="' + (isImage ? 'image/*' : '.pdf,.docx,.hwpx,.txt') + '" data-up="jd">' +
      (ui.input === 'file' ? pdfHelp : '') +
      (jd.files.length ? fileList : '');
  }

  var buttonText = st === 'running' ? '분석 중…' : st === 'done' ? '다른 공고로 다시 접수' : '공고 접수';

  return '<section class="card col">' +
    '<div class="row" role="group" aria-label="공고 입력 방식">' + tabs + '</div>' +
    inp +
    '<button class="btn primary big" data-act="jd"' + (st === 'running' ? ' disabled' : '') + '>' + buttonText + '</button>' +
    '</section>';
}

/** 서기가 공고를 확인하는 여섯 칸의 진행 상황. */
function jdProgressCard(jd) {
  var doneN = jd.rows.filter(function (r) { return r.st === 'done'; }).length;
  var tagText = { wait: '대기', run: '분석 중', done: '완료', error: '오류' };

  var rows = jd.rows.map(function (r, i) {
    return '<div class="prow ' + r.st + '"><span class="num">' + (i + 1) + '</span>' +
      '<span style="flex:1 1 auto;min-width:0"><b style="font-size:13px">' + r.key + '</b><br>' +
      '<span style="font-size:13px">' + h(r.st === 'run' ? '분석 중…' : r.val || '빈칸') + '</span></span>' +
      '<span class="tag ' + r.st + '">' + tagText[r.st] + '</span></div>';
  }).join('');

  var nowDoing = '';
  if (jd.status === 'running') {
    var msg = doneN < 2 ? '공고문을 받아 읽는 중' : doneN < 5 ? '공고를 분석하는 중' : '공고의 업무 줄마다 지원자 기록과 맞춰 보는 중';
    nowDoing = running(msg, jd);
  }

  return '<section class="card col">' +
    '<div class="row between"><div class="h3">서기의 공고 확인</div><span class="small">' + doneN + ' / 6 완료</span></div>' +
    rows + nowDoing + '</section>';
}

/** 공고를 읽지 못했을 때: 다른 방식으로 다시 달라는 안내. */
function jdErrorBox(jd) {
  var ways = [['image', '캡처 이미지', '여러 장 가능'], ['file', 'PDF 파일', 'Ctrl+P → PDF로 저장'], ['paste', '본문 붙여넣기', '드래그 → 복사']];

  var buttons = ways.map(function (x) {
    return '<button class="btn" data-act="input" data-v="' + x[0] + '"><b>' + x[1] + '</b><br><span class="small">' + x[2] + '</span></button>';
  }).join('');

  return '<div class="warn col" role="alert"><b>' + h(jd.error) + '</b>' +
    '<span>아래 방법 중 하나로 다시 주세요.</span><div class="grid3">' + buttons + '</div></div>';
}

/** 공고 분석 결과: 찾는 사람, 웹에서 찾은 정보, 하는 일, 자격, 내 경험과의 일치. */
function jdAnalysisCard(jd) {
  var a = jd.analysis, m = jd.match;
  var wants = a.wants || [], web = a.web || [], removed = a.removed || [];

  var wantsBox = '';
  if (wants.length) {
    wantsBox = '<div class="good col"><b style="color:var(--navy)">이 공고가 찾는 사람</b><ol style="margin:0;padding-left:20px">' +
      wants.map(function (w) {
        return '<li><b>' + h(w.point) + '</b>' +
          (w.basis ? '<br><span class="small">공고: “' + h(w.basis) + '”</span>' : '') + '</li>';
      }).join('') + '</ol></div>';
  }

  var webBox = '';
  if (web.length) {
    webBox = '<div class="soft col"><b class="small">웹에서 더 찾은 정보 (공고에는 없는 내용)</b><ul style="margin:0;padding-left:18px">' +
      web.map(function (w) {
        // 주소가 http(s)일 때만 링크로 만든다.
        var source = /^https?:\/\//.test(w.url)
          ? '<a href="' + h(w.url) + '" target="_blank" rel="noopener noreferrer">' + h(w.title) + '</a>'
          : h(w.title);
        return '<li>' + h(w.note) + '<br><span class="small">' + source + '</span></li>';
      }).join('') + '</ul></div>';
  }

  var targetAndMatch = '<div class="grid2">' +
    '<div class="soft"><span class="small">채용 대상</span><br><b>' + h(a.target) + '</b></div>' +
    '<div class="soft"><span class="small">직무 일치</span><br><b>' + (m ? h(m['직무 일치도']) : '자기소개서를 받은 뒤 계산') + '</b></div>' +
    '</div>';

  var duties = '<div><b class="small">이 직무가 하는 일</b><ul>' + li(a.duties) + '</ul></div>';

  var quals = '<div class="grid2">' +
    '<div><b class="small">꼭 필요한 것</b><ul>' + li(a.required) + '</ul></div>' +
    '<div><b class="small">있으면 좋은 것</b><ul>' + li(a.preferred) + '</ul></div>' +
    '</div>';

  var matchBox;
  if (m) {
    matchBox = '<div class="good col"><b class="small" style="color:var(--navy)">내 경험과 맞춰 보면 (주요 업무 ' + m['주요 업무'] + '줄)</b>' +
      '<div class="grid3">' +
      '<div class="soft"><b style="font-size:20px;color:var(--blue)">' + m['직접'] + '</b><br><span class="small">직접 해 본 일</span></div>' +
      '<div class="soft"><b style="font-size:20px;color:var(--navy)">' + m['전이'] + '</b><br><span class="small">비슷한 경험</span></div>' +
      '<div class="soft"><b style="font-size:20px;color:var(--orange)">' + m['공백'] + '</b><br><span class="small">비어 있는 곳</span></div>' +
      '</div></div>';
  } else {
    matchBox = '<div class="soft muted">내 경험과 맞춰 보는 일은 자기소개서를 받은 뒤에 합니다.</div>';
  }

  var removedBox = removed.length
    ? '<div><b class="small">정리하며 걸러낸 것</b><ul class="small">' + li(a.removed) + '</ul></div>'
    : '';

  return '<section class="card col">' +
    '<div class="row between"><div class="h3" style="font-size:17px">공고 분석</div><span class="tag run">서기가 이해한 내용</span></div>' +
    '<p style="font-size:16px;font-weight:700">' + h(a.summary) + '</p>' +
    (a.caution ? '<p class="warn"><b>주의</b> ' + h(a.caution) + '</p>' : '') +
    wantsBox + webBox + targetAndMatch + duties + quals + matchBox + removedBox +
    '</section>';
}

/** 공고에 정보를 보태거나, 분석을 확정하는 칸. */
function jdExtraCard(jd) {
  var questions = jd.analysis.questions || [];

  var confirmed = '<div class="good row between">' +
    '<b style="color:var(--blue)">공고 분석을 확정했습니다. 이 공고에 맞춰 재판부를 세웁니다.</b>' +
    '<button class="btn primary" data-act="go" data-n="1">재판부 보러 가기</button></div>';

  return '<section class="card strong col">' +
    '<div class="h3">추가할 수 있는 정보가 또 있을까요?</div>' +
    '<p style="font-size:14px">서기가 공고를 잘못 이해했을 수 있어요. 빠진 내용이나, 공고에는 없지만 알고 있는 정보를 적어 주세요.</p>' +
    (questions.length ? '<div class="soft"><b class="small">서기가 확인하고 싶은 것</b><ul>' + li(jd.analysis.questions) + '</ul></div>' : '') +
    '<label for="jd-extra">추가 정보 (선택)</label>' +
    '<textarea id="jd-extra" rows="3" data-bind="extra" placeholder="예: 이 팀은 주로 이런 일을 한다고 들었어요">' + h(ui.extra) + '</textarea>' +
    '<div class="grid2"><button class="btn big" data-act="reanalyze">다시 분석하기</button>' +
    '<button class="btn primary big" data-act="confirmJd"' + (jd.confirmed ? ' disabled' : '') + '>' +
    (jd.confirmed ? '분석 확정됨' : '이대로 분석 마치기') + '</button></div>' +
    (jd.confirmed ? confirmed : '') +
    '</section>';
}

/** 이 단계에서 만든 파일 목록(열어 볼 수 있다). */
function jdFilesCard(jd) {
  var m = jd.match;

  // 이름, 파일, 설명, 열 수 있는가
  var files = [
    ['공고 원문', '공고_원문.txt', '받은 그대로', true],
    ['공고 정리', '공고_원문_정리.md', '숨은 문장을 걸러낸 정리본', true],
    ['직무 일치표', '직무일치표.md', m ? '공고의 업무 줄마다 내 경험과 맞춰 본 표' : '자기소개서를 받은 뒤 만듭니다', !!m],
    ['지원자 자료', '지원자자료.md', S.has_profile ? '증거자료에서 정리한 경력과 이력' : '증거자료를 넣으면 만들어집니다', S.has_profile]
  ];

  var rows = files.map(function (f) {
    return '<tr><td><b>' + f[0] + '</b></td><td>' + f[2] + '</td>' +
      '<td><button class="btn" data-act="open" data-f="' + f[1] + '" data-t="' + f[0] + '"' + (f[3] ? '' : ' disabled') + '>열기</button></td></tr>';
  }).join('');

  return '<section class="card col"><div class="h3">이 단계에서 정리한 내용</div>' +
    '<table><thead><tr><th>항목</th><th>내용</th><th>확인</th></tr></thead><tbody>' + rows + '</tbody></table>' +
    preview() + '</section>';
}


// ============================================================
// 7. 1단계: 재판부, 자기소개서 제출, AI 추천 초안
// ============================================================

function step1() {
  return panelPart() + coverCard() + limitChoices() + draftCard();
}

/** 글자 수 제한 칸에서 고를 수 있는 숫자 목록(직접 작성 문항의 입력 칸이 쓴다). */
function limitChoices() {
  return '<datalist id="lims">' + LIMITS.map(function (n) { return '<option value="' + n + '">'; }).join('') + '</datalist>';
}

// ---------- 7-1. 재판부 ----------

/** 배심원 세 명의 성격과 관점. 사용자가 맞는지 확인한다. */
function panelPart() {
  var p = S.panel;

  if (p.status === 'running' || p.status === 'idle') {
    return '<div class="h3">JD에 맞춰 재판부를 세우는 중…</div>' +
      running('회사의 당면 과제와 현직자 자료를 찾아 배심원 세 명의 관점을 세우고 있습니다', p);
  }
  if (p.status === 'error') {
    return errorBox(p, 'redoPanel');
  }

  var cards = p.jurors.map(function (j) {
    var c = COLORS[j.role] || '#26365E';
    return '<article class="jcard" style="border-top:6px solid ' + c + '">' +
      person(c, '#3A3442', 80) +
      '<b style="font-size:16px">' + h(j.role) + '</b>' +
      '<span class="tag" style="background:' + c + ';color:#fff">' + h(j.focus) + '</span>' +
      '<div style="width:100%;text-align:left;font-size:14px" class="col">' +
      '<div><span class="small"><b>성격</b></span><br>' + h(j.persona) + '</div>' +
      '<div><span class="small"><b>이렇게 봅니다</b></span><br><b>' + h(j.view) + '</b></div>' +
      '<div><span class="small"><b>이 관점의 근거</b></span><br><span class="muted" style="font-size:13px">' + h(j.basis) + '</span></div>' +
      '</div></article>';
  }).join('');

  var noteBox = '';
  if (ui.noteOpen) {
    noteBox = '<label for="p-note">어떻게 고칠까요?</label>' +
      '<textarea id="p-note" rows="2" data-bind="panelNote" placeholder="예: 실무 담당자는 현장 정비 경험을 더 중요하게 봐요">' + h(ui.panelNote) + '</textarea>' +
      '<button class="btn" data-act="redoPanel">이 내용으로 다시 세우기</button>';
  }

  return '<div><div class="h3">재판부가 입장했습니다</div>' +
    '<span class="small">공고 분석을 바탕으로 이 회사에 맞는 배심원 세 명을 세웠습니다.</span></div>' +
    '<div class="grid3">' + cards + '</div>' +
    '<div class="card strong col">' +
    '<span><b>서기:</b> 세 배심원의 성격과 관점이 이 회사에 맞나요? 맞으면 판사님께 알리고 재판을 엽니다.</span>' +
    '<div class="row"><button class="btn' + (p.confirmed ? ' primary' : '') + '" data-act="confirmPanel">' +
    (p.confirmed ? '관점 확인됨' : '관점이 맞아요') + '</button>' +
    '<button class="btn" data-act="toggleNote">관점을 고칠게요</button></div>' +
    noteBox + '</div>';
}

// ---------- 7-2. 자기소개서 제출 ----------

/** 재판에 올릴 자기소개서: 직접 쓰거나 파일로 넣는다. */
function coverCard() {
  var p = S.panel;
  var cnt = ui.qs.filter(function (q) { return q.a.trim(); }).length;
  var ready = ui.clMode === 'write' ? cnt > 0 : S.cover.files.length > 0;
  var okPanel = p.status === 'done' && p.confirmed;
  var busy = S.debate.status === 'running';

  var modeTabs = '<div class="row">' +
    '<button class="seg' + (ui.clMode === 'write' ? ' on' : '') + '" data-act="clMode" data-v="write">직접 작성</button>' +
    '<button class="seg' + (ui.clMode === 'file' ? ' on' : '') + '" data-act="clMode" data-v="file">파일 넣기 (PDF, Word)</button>' +
    '</div>';

  // 접수 버튼 옆에 지금 무엇이 필요한지 한 줄로 알린다.
  var status;
  if (!okPanel) status = '재판부 관점을 먼저 확인해 주세요';
  else if (ready) status = ui.clMode === 'write' ? '답변 ' + cnt + '개 준비됨' : '파일 ' + S.cover.files.length + '개 준비됨';
  else status = ui.clMode === 'write' ? '답변을 하나 이상 써 주세요' : 'PDF나 Word 파일을 넣어 주세요';

  return '<section class="card col" id="cover">' +
    '<div><div class="h3" style="font-size:17px">자기소개서 제출</div>' +
    '<p style="font-size:14px">재판에 올릴 자기소개서입니다. 여기서 직접 쓰거나, 써 둔 PDF나 Word 파일을 넣어 주세요.</p></div>' +
    modeTabs +
    (ui.clMode === 'write' ? coverWrite() : coverFile()) +
    '<div class="row between" style="border-top:1px solid #E6E2D9;padding-top:14px">' +
    '<span class="small"><b>' + status + '</b></span>' +
    '<button class="btn primary big" data-act="case"' + (ready && okPanel && !busy ? '' : ' disabled') + '>사건 기록 접수하고 공방 열기</button>' +
    '</div></section>';
}

/** 직접 작성: 문항, 글자 수 제한, 답변. */
function coverWrite() {
  var questions = ui.qs.map(function (q, i) {
    var remove = ui.qs.length > 1 ? '<button class="btn" data-act="rmQ" data-n="' + i + '">지우기</button>' : '';

    return '<div class="soft col">' +
      '<div class="row between"><label for="q' + i + '" style="font-size:14px">문항 ' + (i + 1) + '</label>' + remove + '</div>' +
      '<input id="q' + i + '" type="text" data-q="' + i + '" data-f="q" value="' + h(q.q) + '" placeholder="예: 지원 동기와 입사 후 포부를 적어 주세요">' +
      '<div class="row"><label for="l' + i + '">글자 수 제한</label>' +
      '<input id="l' + i + '" type="number" min="0" step="50" style="width:120px" list="lims" data-q="' + i + '" data-f="limit" value="' + h(q.limit) + '" placeholder="예: 1000">' +
      '<span class="small">자 (공백 포함)</span></div>' +
      '<label for="a' + i + '">답변</label>' +
      '<textarea id="a' + i + '" rows="8" data-q="' + i + '" data-f="a" placeholder="자기소개서 답변을 쓰거나 붙여넣어 주세요">' + h(q.a) + '</textarea>' +
      '<span class="small" style="align-self:flex-end" id="c' + i + '">' + countText(q) + '</span>' +
      '</div>';
  }).join('');

  return questions + '<button class="btn" style="border-style:dashed" data-act="addQ">+ 문항 추가</button>';
}

/** 파일 넣기: 써 둔 자기소개서 파일. */
function coverFile() {
  var list = S.cover.files.length
    ? '<div class="small">넣은 파일: ' + S.cover.files.map(h).join(', ') + ' <button class="btn" data-act="clearCover">비우기</button></div>'
    : '';

  return '<label class="drop" for="cl-file">자기소개서 파일을 눌러서 고르세요<span class="small">PDF, Word, hwpx · 여러 개 가능</span></label>' +
    '<input id="cl-file" type="file" multiple accept=".pdf,.docx,.hwpx,.txt" data-up="cover">' + list;
}

/** 답변의 글자 수 표시(예: "480 / 500자", 넘으면 "· 20자 넘음"). */
function countText(q) {
  var lim = parseInt(q.limit, 10), c = q.a.length;
  var text = lim > 0 ? c + ' / ' + lim + '자' : c + '자';
  if (lim > 0 && c > lim) text += ' · ' + (c - lim) + '자 넘음';
  return text;
}

// ---------- 7-3. AI 추천 초안 ----------
// 지원자 기록(노션, 지원자 파일)이 있을 때만 서기가 문항마다 추천 예시를 쓴다.
// 결과부터 말하는 두괄식으로, X 문제 → Y 해결 → Z 수치 결과 순서다.
// 기록이 없으면 쓰지 않고, 위 '자기소개서 제출'에서 직접 쓰게 한다.

function draftCard() {
  var dr = S.draft || { status: 'idle' };   // 초안 기능이 생기기 전에 저장된 재판에는 draft가 없다

  var head = '<section class="card col" id="draft"><div class="row between">' +
    '<div class="h3" style="font-size:17px">AI 추천 초안 (선택)</div>' +
    '<span class="tag run">써 둔 자기소개서가 없을 때</span></div>';

  if (!S.can_draft) return head + draftNoRecord() + '</section>';

  var html = head + draftIntro() + draftQuestions() + draftButtons(dr);
  if (dr.status === 'running') html += running(dr.msg || '서기가 추천 초안을 쓰는 중', dr);
  if (dr.status === 'error') html += errorBox(dr);
  if (dr.status === 'done' && (dr.items || []).length) html += draftResult(dr.items);
  return html + '</section>';
}

/** 지원자 기록이 없을 때: 초안을 쓰지 않는 이유와 기록을 넣는 방법. */
function draftNoRecord() {
  return '<div class="soft col"><b>지원자 기록이 없어서 추천 초안은 쓸 수 없어요.</b>' +
    '<span style="font-size:14px">추천 초안은 Notion 연동이나 지원자 파일(이력서, 경력기술서, 기존 자소서)로 넣은 내 기록의 경험으로만 씁니다. ' +
    '기록이 없으면 지어낼 수밖에 없어서 쓰지 않아요. 위 <b>자기소개서 제출</b>에서 직접 써 주세요.</span>' +
    '<span class="small">기록을 넣으려면 처음 화면에서 Notion 연동이나 지원자 파일 넣기를 한 뒤 이 단계로 돌아오세요.</span>' +
    '<div><button class="btn" data-act="home">처음 화면에서 기록 넣기</button></div></div>';
}

/** 추천 초안이 무엇인지 알리는 글. */
function draftIntro() {
  var src = [
    S.notion.status === 'done' ? '노션 기록' : '',
    S.evidence.length ? '지원자 파일 ' + S.evidence.length + '건' : ''
  ].filter(Boolean).join(', ') || '지원자 기록';

  return '<p style="font-size:14px">문항과 회사가 정한 글자 수를 알려 주면, 서기가 <b>' + h(src) + '</b>의 경험으로 ' +
    '"이렇게 쓸 수 있다"는 추천 예시를 씁니다. 결과부터 말하는 두괄식으로, <b>X 문제 → Y 해결 → Z 수치 결과</b> 순서로 씁니다.</p>' +
    '<div class="warn" style="color:var(--ink);font-size:13px"><b>AI가 추천해 준 예시입니다.</b> ' +
    '기록에 있는 사실을 사용했지만 사실과 다를 수 있어요. ' +
    '사실과 DATA를 접목시키고, 자연스럽지 않은 부분은 사용자의 문장으로 바꿔서 사용해 주세요.</div>';
}

/** 초안을 받을 문항과, 문항마다 회사가 정한 글자 수를 고르는 칸. */
function draftQuestions() {
  return ui.dqs.map(function (q, i) {
    var chosen = q.custom ? 'custom' : q.limit;   // '?': 아직 안 고름, '0': 제한 없음, 'custom': 직접 입력
    var remove = ui.dqs.length > 1 ? '<button class="btn" data-act="rmDq" data-n="' + i + '">지우기</button>' : '';

    var presets = LIMITS.map(function (n) {
      return '<option value="' + n + '"' + (chosen === String(n) ? ' selected' : '') + '>' + n.toLocaleString() + '자</option>';
    }).join('');

    var select = '<select id="ds' + i + '" style="width:auto" data-dqsel="' + i + '">' +
      '<option value="?"' + (chosen === '?' ? ' selected' : '') + ' disabled>글자 수 선택</option>' +
      presets +
      '<option value="custom"' + (chosen === 'custom' ? ' selected' : '') + '>직접 입력</option>' +
      '<option value="0"' + (chosen === '0' ? ' selected' : '') + '>제한 없음 (700자 안팎)</option>' +
      '</select>';

    var customInput = q.custom
      ? '<input id="dl' + i + '" type="number" min="100" max="5000" step="50" style="width:120px" aria-label="글자 수 직접 입력" data-dq="' + i + '" data-f="limit" value="' + h(q.limit) + '" placeholder="예: 900">'
      : '';

    return '<div class="soft col">' +
      '<div class="row between"><label for="dq' + i + '" style="font-size:14px">초안 문항 ' + (i + 1) + '</label>' + remove + '</div>' +
      '<input id="dq' + i + '" type="text" data-dq="' + i + '" data-f="q" value="' + h(q.q) + '" placeholder="예: 지원 동기와 입사 후 포부를 적어 주세요">' +
      '<div class="row"><label for="ds' + i + '">회사가 정한 글자 수</label>' + select + customInput +
      '<span class="small">공백 포함 · 고른 글자 수의 95~100%로 씁니다</span></div>' +
      '</div>';
  }).join('');
}

/** 문항 추가 버튼과 초안 쓰기 버튼. */
function draftButtons(dr) {
  var run = dr.status === 'running';
  var label = run ? '쓰는 중…' : dr.status === 'done' ? '추천 초안 다시 쓰기' : '추천 초안 쓰기';

  return '<div class="row between">' +
    '<button class="btn" style="border-style:dashed" data-act="addDq"' + (ui.dqs.length >= MAX_DRAFT_QUESTIONS ? ' disabled' : '') + '>+ 초안 문항 추가</button>' +
    '<button class="btn primary big" data-act="draft"' + (run || !S.jd.confirmed ? ' disabled' : '') + '>' + label + '</button>' +
    '</div>';
}

/** 서기가 쓴 추천 초안: 문항마다 뼈대(X, Y, Z), 전문, 쓴 기록, 확인이 필요한 것. */
function draftResult(items) {
  var cards = items.map(function (it) {
    // 제한을 넘었거나 90%에 못 미치면 글자 수를 빨갛게 표시한다.
    var offLimit = it.limit && (it.chars > it.limit || it.chars < it.limit * 0.9);
    var count = it.chars.toLocaleString() + '자' +
      (it.limit ? ' / ' + it.limit.toLocaleString() + '자 (' + Math.round(it.chars * 100 / it.limit) + '%)' : ' · 제한 없음');

    var bones = [['X 문제와 목표', it.x], ['Y 해결과 이유', it.y], ['Z 수치 결과', it.z], ['입사 후 쓰임', it.insight]];
    var boneBoxes = bones.map(function (b) {
      return '<div class="good"><b class="small" style="color:var(--navy)">' + b[0] + '</b><br>' +
        '<span style="font-size:13px">' + h(b[1]) + '</span></div>';
    }).join('');

    var used = (it.used || []).length
      ? '<details><summary class="small">쓴 기록 ' + it.used.length + '개</summary><ul style="font-size:13px">' + li(it.used) + '</ul></details>'
      : '';

    var check = (it.check || []).length
      ? '<div class="warn"><b class="small" style="color:var(--orange)">확인이 필요한 것</b><ul style="font-size:13px;color:var(--ink)">' + li(it.check) + '</ul></div>'
      : '';

    return '<article class="soft col" style="background:#fff">' +
      '<div class="row between"><b style="font-size:15px">문항 ' + it.n + '. ' + h(it.q) + '</b>' +
      '<span class="tag ' + (offLimit ? 'error' : 'done') + '">' + count + '</span></div>' +
      (it.line ? '<span class="small"><b>채우는 공고 줄</b> ' + h(it.line) + '</span>' : '') +
      '<div class="grid2">' + boneBoxes + '</div>' +
      '<div class="pre">' + h(it.a) + '</div>' +
      used + check + '</article>';
  }).join('');

  return '<div class="h3">서기가 쓴 추천 초안</div>' + cards +
    '<div class="row between">' +
    '<span class="small">답변 칸에 넣은 뒤 고쳐서 재판에 올릴 수 있어요. 전체 기록은 5단계의 ‘추천 초안’에서도 열 수 있습니다.</span>' +
    '<button class="btn primary big" data-act="useDraft">이 초안을 답변 칸에 넣고 고치기</button></div>';
}


// ============================================================
// 8. 2단계: 공방
// ============================================================

/** 공방의 말 하나. t: 'sys'(안내), 'S'(서기의 쟁점 정리), 'L'(탈락 위원), 'R'(합격 위원). */
function bubbleHtml(m) {
  if (m.t === 'sys') {
    return '<div class="sys">' + h(m.text) + '</div>';
  }
  if (m.t === 'S') {
    return '<div class="card" style="border:2px solid var(--teal);align-self:center;width:min(100%,560px)">' +
      '<b style="color:var(--teal);font-size:13px">서기 · 핵심 쟁점 정리</b><ol>' + li(m.items) + '</ol>' +
      '<span class="small">이 쟁점들을 배심원에게 넘깁니다.</span></div>';
  }

  var L = m.t === 'L';
  return '<div class="msg ' + m.t + '">' +
    '<div class="av" style="background:' + (L ? '#8A3B12' : '#2D6CC0') + '">' + (L ? '탈락' : '합격') + '</div>' +
    '<div><div class="who">' + (L ? '검사 · 지원자 탈락 위원' : '변호인 · 지원자 합격 위원') + '</div>' +
    '<p>' + h(m.text) + '</p>' +
    (m.meta ? '<div class="meta">' + h(m.meta) + '</div>' : '') +
    '</div></div>';
}

function step2() {
  var d = S.debate;

  if (d.status === 'running') return running(d.msg || '공방을 준비하는 중', d);
  if (d.status === 'error') return errorBox(d) + '<button class="btn" data-act="go" data-n="1">자기소개서 단계로 돌아가기</button>';
  if (d.status !== 'done') return '<div class="soft muted">자기소개서를 접수하면 공방이 열립니다.</div>';

  var ms = d.messages;
  var done = ui.chatN >= ms.length;   // 모든 말풍선을 보여 줬는가

  // 지금 어느 국면(모두진술 0, 반박 1, 핵심 쟁점 2)까지 왔는지
  var phase = -1;
  ms.slice(0, ui.chatN).forEach(function (m) {
    if (typeof m.phase === 'number') phase = m.phase;
  });

  var phaseTags = ['모두진술', '반박', '핵심 쟁점'].map(function (l, i) {
    var cls = done || i < phase ? 'run' : i === phase ? 'done' : '';
    return '<span class="tag ' + cls + '">' + l + '</span>';
  }).join('');

  // 다음 말이 위원의 진술이면 "쓰는 중"을 보인다.
  var next = ms[ui.chatN];
  var typing = '';
  if (!done && next && (next.t === 'L' || next.t === 'R')) {
    typing = '<div class="sys" style="align-self:' + (next.t === 'L' ? 'flex-start' : 'flex-end') + '">' +
      (next.t === 'L' ? '탈락 위원' : '합격 위원') + '이 쓰는 중 <span class="blink">…</span></div>';
  }

  return '<div class="row between"><div class="row">' + phaseTags + '</div>' +
    '<span class="small">진술마다 800자 안에서 핵심만 말합니다</span></div>' +
    '<div class="log" id="log" role="log" aria-live="polite">' + ms.slice(0, ui.chatN).map(bubbleHtml).join('') + typing + '</div>' +
    '<div class="row between"><span class="small">' + (done ? '공방이 끝났습니다' : '공방이 진행 중입니다') + '</span>' +
    '<div class="row"><button class="btn" data-act="chatRestart">처음부터</button>' +
    '<button class="btn" data-act="chatAll">한 번에 보기</button></div></div>' +
    (done ? '<button class="btn primary big" data-act="toVote">배심원 표결로 넘어가기</button>' : '');
}


// ============================================================
// 9. 3단계: 배심 표결
// ============================================================

function step3() {
  var v = S.vote, js = v.jurors || [];

  // 맨 위 버튼: 표결 시작 또는 표결 공개
  var topButton = '';
  if (v.status === 'done') {
    var revealing = ui.revealN > 0 && ui.revealN < 3;
    var label = ui.revealN === 0 ? '표결 공개' : ui.revealN < 3 ? '공개 중…' : '다시 가리기';
    topButton = '<button class="btn primary" data-act="reveal"' + (revealing ? ' disabled' : '') + '>' + label + '</button>';
  } else if (v.status === 'idle') {
    topButton = '<button class="btn primary" data-act="startVote">표결 시작</button>';
  }

  var html = '<div class="row between">' +
    '<span style="font-size:14px">세 배심원은 서로의 표를 보지 못한 채 각자 투표합니다.</span>' + topButton + '</div>';

  if (v.status === 'running') html += running(v.msg || '배심원 세 명이 각자 투표하는 중', v);
  if (v.status === 'error') html += errorBox(v, 'startVote');

  html += voteCards(v, js);

  if (v.status === 'done' && ui.revealN >= 3) {
    var passN = js.filter(function (j) { return j.pass; }).length;
    var failN = js.filter(function (j) { return !j.pass; }).length;
    html += '<div class="card row center" role="status"><b>표결 결과</b>' +
      '<b style="color:var(--blue)">합격 ' + passN + '</b>' +
      '<b style="color:var(--orange)">불합격 ' + failN + '</b></div>';
  }

  if (v.status === 'done' && ui.revealN > 0) html += voteReasons(js);
  if (v.status === 'done' && ui.revealN >= 3) html += '<button class="btn primary big" data-act="toVerdict">판사의 판결 듣기</button>';
  return html;
}

/** 배심원 세 명의 표. 공개 전에는 '?'로 가린다. */
function voteCards(v, js) {
  var cards = JUROR_NAMES.map(function (name, i) {
    var j = js[i];
    var open = j && i < ui.revealN;
    var c = COLORS[name];

    var result = open ? (j.pass ? '합격' : '불합격') : '?';
    var sub = open ? '합격 가능성 ' + j.pct + '%' : v.status === 'done' ? '투표 완료' : '투표 중';

    return '<div class="jcard" style="border-top:6px solid ' + c + '">' +
      '<div class="vote' + (open ? (j.pass ? ' pass' : ' fail') : '') + '"><b>' + result + '</b>' +
      '<span style="font-size:13px">' + sub + '</span></div>' +
      person(c, '#3A3442', 76) + '<b>' + name + '</b></div>';
  }).join('');

  return '<div class="grid3">' + cards + '</div>';
}

/** 공개된 배심원의 판단 이유. */
function voteReasons(js) {
  var cards = js.slice(0, ui.revealN).map(function (j) {
    return '<article class="card col" style="border-left:6px solid ' + COLORS[j.name] + '">' +
      '<div class="row between"><b style="font-size:16px">' + j.name + '</b>' +
      '<span class="tag ' + (j.pass ? 'done' : 'error') + '">' + (j.pass ? '합격' : '불합격') + ' · ' + j.pct + '%</span></div>' +
      '<p style="font-size:14px;font-weight:700">' + h(j.key) + '</p>' +
      '<div class="grid2">' +
      '<div class="good"><b class="small" style="color:var(--blue)">합격 원인</b><br><span style="font-size:14px">' + h(j.pros) + '</span></div>' +
      '<div class="warn"><b class="small" style="color:var(--orange)">탈락 원인</b><br><span style="font-size:14px;color:var(--ink)">' + h(j.cons) + '</span></div>' +
      '</div>' +
      '<p class="small"><b>결정적 근거</b> ' + h(j.basis) + '</p>' +
      '<p style="font-size:13px"><b>이러면 표가 바뀝니다</b> ' + h(j.flip) + '</p>' +
      '</article>';
  }).join('');

  return '<div class="h3" style="font-size:17px">배심원별 판단</div>' + cards;
}


// ============================================================
// 10. 4단계: 판결과 조언
// ============================================================

function step4() {
  var vd = S.verdict, tl = S.vote.tally || {};

  var html = verdictProgress(vd, tl);
  if (vd.status === 'idle') html += '<button class="btn primary big" data-act="startVerdict">판결 시작</button>';
  if (vd.status === 'running') html += running('판사와 서기가 판결문과 조언을 쓰는 중', vd);
  if (vd.status === 'error') html += errorBox(vd, 'startVerdict');
  if (vd.status !== 'done') return html;

  var d = vd.data;
  return html +
    verdictCard(d, tl) +
    '<div class="row center"><b style="color:var(--navy)">이기려면 이렇게 고치세요</b></div>' +
    '<section class="card" style="background:var(--navy);color:#fff">' +
    '<span class="small" style="color:#C9D2EA"><b>수정 전략 한 줄</b></span>' +
    '<div style="font-size:18px;font-weight:900">' + h(d.strategy) + '</div></section>' +
    adviceCards(d) +
    '<div class="grid2">' +
    '<section class="card"><div class="h3" style="font-size:15px">비어 있는 곳 메우기</div><p style="font-size:14px">' + h(d.gaps) + '</p></section>' +
    '<section class="card"><div class="h3" style="font-size:15px">쓰지 말 것</div><ul style="font-size:14px">' + li(d.avoid) + '</ul></section>' +
    '</div>' +
    '<section class="warn"><b>솔직한 판단</b><p style="font-size:14px;color:var(--ink)">' + h(d.honest) + '</p></section>' +
    '<div class="grid2">' +
    '<button class="btn big" style="border:2px solid var(--navy)" data-act="retrial">수정해서 재심 청구</button>' +
    '<button class="btn primary big" data-act="go" data-n="5">재판 기록 받기</button>' +
    '</div>';
}

/** 판결까지의 네 걸음(표결 모으기, 서류 예측, 사유 정리, 선고). */
function verdictProgress(vd, tl) {
  var n = vd.status === 'done' ? 4 : (vd.rows || 0);   // 끝난 걸음 수

  // 누가, 무엇을 했나, 결과
  var rows = [
    ['서기', '표결을 모았습니다', tl['다수결']],
    ['서기', '서류 예측을 계산했습니다', '인사와 실무의 평균 ' + tl['서류 예측 %'] + '% · 임원 시선 ' + tl['임원 시선 %'] + '%는 따로'],
    ['서기', '탈락 사유와 합격 조건을 정리했습니다', '배심과 공방에서 겹친 약점을 묶었습니다'],
    ['판사', '선고합니다', tl['서류 판결']]
  ];

  var lines = rows.map(function (r, i) {
    var st = i < n ? 'done' : i === n && vd.status === 'running' ? 'run' : 'wait';
    var title = st === 'done' ? r[1] : st === 'run' ? '정리하는 중…' : '대기';

    return '<div class="prow ' + st + '">' +
      '<span class="tag" style="background:' + (r[0] === '판사' ? 'var(--navy)' : 'var(--teal)') + ';color:#fff">' + r[0] + '</span>' +
      '<span><b style="font-size:14px">' + title + '</b>' +
      (st === 'done' ? '<br><span style="font-size:13px">' + h(r[2]) + '</span>' : '') +
      '</span></div>';
  }).join('');

  return '<section class="card col"><div class="h3">판결 진행</div>' + lines + '</section>';
}

/** 판사의 판결: 결과, 서류 예측, 탈락 사유, 합격 조건, 선고. */
function verdictCard(d, tl) {
  var res = tl['서류 판결'], pct = tl['서류 예측 %'];
  var col = res === '합격' ? 'var(--blue)' : res === '탈락' ? 'var(--orange)' : 'var(--mute)';
  var m = S.jd.match || {};

  var headline = '<div class="row">' + person('#26365E', '#E9E6EF', 96, 'judge') +
    '<div><span class="small"><b>판사의 판결</b></span>' +
    '<div style="font-size:40px;font-weight:900;color:' + col + ';line-height:1.1">' + h(res) + '</div>' +
    '<span style="font-size:14px">배심 ' + h(tl['다수결']) + ' · 직무 일치 ' + h(m['직무 일치도']) + '</span></div></div>';

  var gauge = '<div>' +
    '<div class="row between" style="font-size:13px"><b>서류 예측 ' + pct + '%</b>' +
    '<span class="muted">인사와 실무의 평균 · 임원 시선 ' + tl['임원 시선 %'] + '%는 따로</span></div>' +
    '<div class="gauge" role="img" aria-label="서류 예측 ' + pct + '퍼센트">' +
    '<i style="width:' + pct + '%;background:' + col + '"></i><s style="left:45%"></s><s style="left:55%"></s></div>' +
    '<div class="row between small"><span>탈락 (45 이하)</span><span>합격 (55 이상)</span></div>' +
    '</div>';

  var reasons = (d.reasons || []).map(function (r) {
    return '<li>' + h(r.text) + ' <span class="small">(' + h(r.who) + ')</span></li>';
  }).join('');

  var reasonsAndDefense = '<div class="grid2">' +
    '<div class="warn"><b style="color:var(--orange)">인정된 탈락 사유</b><ol style="color:var(--ink);font-size:14px">' + reasons + '</ol></div>' +
    '<div class="good"><b style="color:var(--blue)">합격 위원이 옳았던 점</b><ul style="font-size:14px">' + li(d.defense) + '</ul></div>' +
    '</div>';

  var conditions = (d.conditions || []).map(function (c, i) {
    return '<div class="soft"><b class="small" style="color:var(--navy)">조건 ' + (i + 1) + '</b><br>' +
      '<span style="font-size:14px">' + h(c) + '</span></div>';
  }).join('');

  var sentence = '<div class="good"><b class="small" style="color:var(--navy)">선고</b><br><b>' + h(d.sentence) + '</b><br>' +
    '<span class="small">예측 %는 결과가 쌓이기 전까지 다른 회사와 견주는 상대 비교로만 봐 주세요.</span></div>';

  return '<section class="card strong col" style="gap:18px">' +
    headline + gauge + reasonsAndDefense +
    '<div><b style="font-size:14px">합격 조건</b><div class="grid3" style="margin-top:8px">' + conditions + '</div></div>' +
    sentence + '</section>';
}

/** 고칠 점들: 지금 문제, 이렇게 고치기, 쓸 경험, 문장 예시. */
function adviceCards(d) {
  return (d.advice || []).map(function (a, i) {
    return '<article class="card col">' +
      '<div class="row between"><b style="font-size:16px">' + (i + 1) + '. ' + h(a.title) + '</b><span class="tag run">' + h(a.target) + '</span></div>' +
      '<div class="grid2">' +
      '<div class="warn"><b class="small" style="color:var(--orange)">지금 문제</b><br><span style="font-size:14px;color:var(--ink)">' + h(a.problem) + '</span></div>' +
      '<div class="good"><b class="small" style="color:var(--blue)">이렇게 고치기</b><br><span style="font-size:14px">' + h(a.fix) + '</span></div>' +
      '</div>' +
      '<div><b class="small">쓸 경험 (내 기록 근거)</b><ul style="font-size:14px">' + li(a.use) + '</ul></div>' +
      '<div class="soft" style="border-left:4px solid var(--navy)"><b class="small" style="color:var(--navy)">문장 예시</b><br>' +
      '<span style="font-size:14px">' + h(a.sample) + '</span></div>' +
      '</article>';
  }).join('');
}


// ============================================================
// 11. 5단계: 전달
// ============================================================

function step5() {
  var tl = S.vote.tally || {}, m = S.jd.match || {};

  var summary = [['판결', tl['서류 판결']], ['서류 예측', tl['서류 예측 %'] + '%'], ['배심 표결', tl['다수결']], ['직무 일치', m['직무 일치도']]];
  var summaryCard = '<section class="card grid4">' + summary.map(function (x) {
    return '<div><span class="small">' + x[0] + '</span><br><b style="font-size:18px">' + h(x[1]) + '</b></div>';
  }).join('') + '</section>';

  var compare = S.round > 1
    ? '재심 ' + (S.round - 1) + '회차입니다. 이전 판결의 기록은 저장한 폴더에서 견주어 볼 수 있습니다.'
    : '첫 재판입니다. 수정본으로 재심을 열면 표결과 서류 예측이 어떻게 움직였는지 견주어 볼 수 있습니다.';

  return clerk('판사님의 판결과 재판 기록을 모두 정리했습니다. 아래에서 열어 보고, 내 PC에 저장할 위치를 정해 주세요.') +
    summaryCard +
    recordsCard() +
    saveCard() +
    '<section class="soft" style="border-style:dashed"><b>이전 재판과 비교</b><br><span style="font-size:14px">' + compare + '</span></section>' +
    '<button class="btn primary big" data-act="go" data-n="6">재심 또는 제출 정하기</button>';
}

/** 재판 기록 파일 목록. 수정본은 여기서 만들 수 있다. */
function recordsCard() {
  var rv = S.revision;

  var rows = S.files.map(function (f) {
    var btn;
    if (f.ready) {
      btn = '<button class="btn" data-act="open" data-f="' + h(f.file) + '" data-t="' + h(f.name) + '">열기</button>';
    } else if (f.file === '수정본.md') {
      btn = '<button class="btn primary" data-act="revision"' + (rv.status === 'running' ? ' disabled' : '') + '>' +
        (rv.status === 'running' ? '쓰는 중…' : '수정본 만들기') + '</button>';
    } else {
      btn = '<button class="btn" disabled>없음</button>';
    }
    return '<tr><td><b>' + h(f.name) + '</b></td><td>' + h(f.desc) + '</td><td>' + btn + '</td></tr>';
  }).join('');

  return '<section class="card col"><div class="h3">재판 기록</div>' +
    '<table><thead><tr><th>항목</th><th>내용</th><th>확인</th></tr></thead><tbody>' + rows + '</tbody></table>' +
    (rv.status === 'running' ? running('서기가 합격 조건을 반영해 수정본을 쓰는 중', rv) : '') +
    (rv.status === 'error' ? errorBox(rv) : '') +
    preview() + '</section>';
}

/** 기록 저장: 내 PC의 폴더(local) 또는 ZIP 내려받기(browser). */
function saveCard() {
  var saved = S.saved ? '<b style="color:var(--blue)" role="status">저장했습니다: ' + h(S.saved) + '</b>' : '';

  if (MODE === 'browser') {
    return '<section class="card col"><div class="h3">기록 파일 받기</div>' +
      '<p style="font-size:14px">재판 기록을 ZIP 파일 하나로 내려받습니다. 브라우저를 닫으면 화면의 기록은 사라지니 꼭 받아 두세요.</p>' +
      '<button class="btn primary big" data-act="save">ZIP으로 받기</button>' + saved + '</section>';
  }

  return '<section class="card col"><div class="h3">내 PC에 저장</div>' +
    '<p style="font-size:14px">이 PC의 폴더에 파일로 저장합니다. 노션에는 아무것도 쓰지 않습니다.</p>' +
    '<label for="save-path">저장 위치</label>' +
    '<div class="row"><input id="save-path" type="text" style="flex:1 1 260px;width:auto;font-family:ui-monospace,Consolas,monospace;font-size:13px" data-bind="savePath" value="' + h(ui.savePath) + '">' +
    '<button class="btn" data-act="pick">폴더 고르기</button></div>' +
    '<button class="btn primary big" data-act="save">내 PC에 저장하기</button>' + saved + '</section>';
}


// ============================================================
// 12. 6단계: 재심 또는 제출
// ============================================================

function step6() {
  if (S.submitted) {
    return '<section class="card strong"><div style="font-size:20px;font-weight:900;color:var(--blue)">제출하기로 기록했습니다</div>' +
      '<p style="font-size:14px">결과가 나오면 다시 열어 예측과 견주어 보세요. 수고하셨습니다.</p></section>';
  }

  var judge = '<div class="row" style="align-items:flex-end">' + person('#26365E', '#E9E6EF', 84, 'judge') +
    '<div class="bubble" style="border-color:var(--navy)"><b>판사:</b> 판결과 조언을 보고 정하세요. ' +
    '자기소개서를 고쳐 다시 재판을 열 수도 있고, 이대로 제출할 수도 있습니다.</div></div>';

  var retrial = '<button class="card strong" style="text-align:left;min-height:120px" data-act="retrial">' +
    '<b style="font-size:18px;color:var(--navy)">재심 청구</b><br>' +
    '<span class="small">같은 공고, 같은 재판부로 1단계부터 다시 엽니다. 고친 자기소개서를 넣어 주세요.</span></button>';

  var submit = '<button class="card" style="text-align:left;min-height:120px;background:var(--blue);border-color:var(--blue);color:#fff" data-act="submit">' +
    '<b style="font-size:18px">이대로 제출</b><br>' +
    '<span style="font-size:12px;color:#E3ECF8">이 서류로 제출하기로 하고 재판을 마칩니다.</span></button>';

  return judge + '<div class="grid2">' + retrial + submit + '</div>';
}


// ============================================================
// 13. 화면 그리기
// ============================================================

var STEPS = [step0, step1, step2, step3, step4, step5, step6];

/** 지금 상태(S, ui)로 화면 전체를 다시 그린다. 입력 중이던 칸의 커서와 공방 창의 스크롤 위치는 지킨다. */
function render() {
  // 1) 다시 그리기 전에 커서와 스크롤 위치를 적어 둔다.
  var keep = document.activeElement;
  var id = keep && keep.id;
  var pos = id && keep.selectionStart != null ? [keep.selectionStart, keep.selectionEnd] : null;
  var logTop = document.getElementById('log') ? document.getElementById('log').scrollTop : null;

  // 2) 그린다.
  if (!ui.started || !S) {
    app.innerHTML = titleScreen();
  } else {
    app.innerHTML = trialScreen();
  }
  if (ui.toast) {
    app.insertAdjacentHTML('beforeend', '<div class="toast" role="alert">' + h(ui.toast) + '</div>');
  }

  // 3) 커서와 스크롤 위치를 되돌린다.
  if (id) {
    var el = document.getElementById(id);
    if (el) {
      el.focus();
      if (pos && el.setSelectionRange) {
        try { el.setSelectionRange(pos[0], pos[1]); } catch (e) {}
      }
    }
  }
  var log = document.getElementById('log');
  if (log) log.scrollTop = chatPlaying ? log.scrollHeight : (logTop == null ? log.scrollHeight : logTop);

  tickChat();
}

/** 재판 화면: 머리말, 지금 단계, 이전과 다음 버튼. */
function trialScreen() {
  var locked = ui.step >= 6 || ui.step + 1 > S.max_step;   // 다음 단계로 갈 수 없는가
  var hint = LOCK_HINTS[ui.step];

  return '<div class="wrap">' + header() +
    '<div class="stagehead"><b>' + LABELS[ui.step] + '</b><span style="font-size:12px;color:#C9D2EA">' + SUBS[ui.step] + '</span></div>' +
    '<div class="stage">' + STEPS[ui.step]() + '</div>' +
    '<div class="row" style="margin-top:16px">' +
    '<button class="btn big" style="flex:1 1 0" data-act="prev">이전</button>' +
    '<button class="btn primary big" style="flex:2 1 0" data-act="next"' + (locked ? ' disabled' : '') + '>' +
    (ui.step >= 6 ? '마지막 단계' : '다음: ' + LABELS[ui.step + 1]) + '</button></div>' +
    (locked && hint ? '<p class="small" style="text-align:center;color:#8A3B12;margin-top:8px" role="status">' + hint + '</p>' : '') +
    '</div>';
}

// ---------- 노션 로그인 승인을 기다리기 ----------
var notionTimer = null;

/** 노션 로그인 창을 연 뒤, 3초마다 연결됐는지 본다(최대 100번). */
function notionWait() {
  clearInterval(notionTimer);
  var tries = 0;

  notionTimer = setInterval(function () {
    if (ui.notionSt !== 'opened' || ++tries > 100) return clearInterval(notionTimer);

    API.get('/api/notion/status').then(function (j) {
      if (j.status === 'connected') {
        clearInterval(notionTimer);
        ui.notionSt = 'connected';
        render();
      }
    }).catch(function () {});
  }, 3000);
}

// ---------- 공방 말풍선을 하나씩 보여 주기 ----------
var chatTimer = null, chatPlaying = false;

/** 공방 단계에서 다음 말풍선을 잠시 뒤에 보여 준다. 긴 말일수록 조금 더 기다린다. */
function tickChat() {
  var d = S && S.debate;
  var playing = ui.started && ui.step === 2 && d && d.status === 'done' && ui.chatN < d.messages.length;
  if (!playing) { chatPlaying = false; return; }
  if (chatTimer) return;

  chatPlaying = true;
  var m = d.messages[ui.chatN];
  var wait = m.t === 'L' || m.t === 'R' ? 900 + Math.min(m.text.length * 6, 1800) : 600;

  chatTimer = setTimeout(function () {
    chatTimer = null;
    ui.chatN++;
    render();
  }, wait);
}

/** n단계로 간다(열려 있는 단계만). */
function go(n) {
  if (!S || n > S.max_step) return;

  ui.step = n;
  ui.preview = null;
  if (n === 2) ui.chatN = 0;
  render();
  window.scrollTo(0, 0);
}


// ============================================================
// 14. 버튼 동작
// ============================================================
// 버튼의 data-act 값이 여기 이름과 같으면 그 함수가 불린다. (연결은 15번 구역)

var ACT = {

  // ---------- 처음 화면 ----------

  start: function () {
    // 노션에서 가져온 기록은 사용자가 확인한 뒤에야 재판에 쓴다.
    if (S && S.notion.status === 'done' && !S.notion.confirmed) {
      ui.notionOpen = true;
      ui.filesOpen = false;
      if (!ui.notionSt) ui.notionSt = 'connected';
      toast('노션에서 가져온 내용이 내 기록이 맞는지 먼저 확인해 주세요');
      return;
    }
    ensure().then(function () {
      ui.started = true;
      ui.step = (S && S.max_step > 0) ? Math.min(S.max_step, 6) : 0;
      render();
    });
  },

  home: function () {
    ui.started = false;
    render();
  },

  fresh: function () {
    if (!confirm('지금 재판을 닫고 새 재판을 시작할까요? 넣어 둔 지원자 기록과 공고는 새 재판에 따라오지 않습니다.')) return;
    try { localStorage.removeItem('hc_trial'); } catch (e) {}
    S = null;
    last = '';
    ui.started = false;
    ui.step = 0;
    ui.notionOpen = false;
    ui.filesOpen = false;
    render();
  },

  toggleFiles: function () {
    ui.filesOpen = !ui.filesOpen;
    ui.notionOpen = false;
    render();
  },

  rmEvidence: function (e) {
    act('evidence/remove', { n: +e.dataset.n });
  },

  changeKey: function () {
    if (window.HC_SHOW_KEY) window.HC_SHOW_KEY();
  },

  // ---------- Notion 연동 ----------

  notion: function () {
    ui.notionOpen = !ui.notionOpen;
    ui.filesOpen = false;
    render();
    if (ui.notionOpen && ui.notionSt !== 'connected') ACT.notionCheck(true);
  },

  // auto가 true면(칸을 열 때) 연결이 안 되어 있을 때 바로 로그인 창을 연다.
  notionCheck: function (auto) {
    ui.notionSt = 'checking';
    render();
    API.get('/api/notion/status').then(function (j) {
      if (j.status === 'connected' || auto !== true) {
        ui.notionSt = j.status === 'connected' ? 'connected' : '';
        render();
      } else {
        ACT.notionConnect();
      }
    }).catch(function () {
      ui.notionSt = '';
      render();
    });
  },

  notionConnect: function () {
    ui.notionSt = 'checking';
    render();
    post('/api/notion/connect').then(function (j) {
      ui.notionSt = j.status;
      render();
      if (j.status === 'opened') notionWait();
    }).catch(function (e) {
      ui.notionSt = '';
      toast(e.message);
    });
  },

  notionRun: function () {
    ensure().then(function () {
      return act('notion', { hint: ui.notionHint });
    }).catch(function () {});
  },

  notionOk: function () {
    act('notion/confirm').then(function () {
      ui.notionOpen = false;
      render();
    }).catch(function () {});
  },

  notionNo: function () {
    var el = document.getElementById('n-hint');
    if (el) {
      el.focus();
      el.scrollIntoView({ block: 'center' });
    }
    toast('맞는 노션 페이지 이름을 적고 ‘노션에서 다시 가져오기’를 눌러 주세요');
  },

  // ---------- 단계 이동 ----------

  go: function (e) { go(+e.dataset.n); },
  prev: function () { go(Math.max(0, ui.step - 1)); },
  next: function () { go(Math.min(6, ui.step + 1)); },

  // ---------- 0단계: 공고 접수 ----------

  input: function (e) {
    ui.input = e.dataset.v;
    render();
  },

  clearJd: function () {
    act('clear-files', { kind: 'jd' });
  },

  jd: function () {
    act('jd', { mode: ui.input, text: ui.paste });
  },

  reanalyze: function () {
    act('jd/reanalyze', { extra: ui.extra }).then(function () { ui.extra = ''; });
  },

  confirmJd: function () {
    act('jd/confirm');
  },

  // ---------- 1단계: 재판부 ----------

  confirmPanel: function () {
    act('panel/confirm');
  },

  toggleNote: function () {
    ui.noteOpen = !ui.noteOpen;
    render();
  },

  redoPanel: function () {
    act('panel/redo', { note: ui.panelNote }).then(function () {
      ui.noteOpen = false;
      ui.panelNote = '';
    });
  },

  // ---------- 1단계: 자기소개서 제출 ----------

  clMode: function (e) {
    ui.clMode = e.dataset.v;
    render();
  },

  addQ: function () {
    ui.qs.push({ q: '', limit: '', a: '' });
    render();
  },

  rmQ: function (e) {
    ui.qs.splice(+e.dataset.n, 1);
    render();
  },

  clearCover: function () {
    act('clear-files', { kind: 'cover' });
  },

  'case': function () {
    act('case', { mode: ui.clMode, items: ui.qs }).then(function () {
      ui.chatN = 0;
      ui.revealN = 0;
      ui.step = 2;
      render();
      window.scrollTo(0, 0);
    });
  },

  // ---------- 1단계: AI 추천 초안 ----------

  addDq: function () {
    if (ui.dqs.length < MAX_DRAFT_QUESTIONS) ui.dqs.push({ q: '', limit: '?', custom: false });
    render();
  },

  rmDq: function (e) {
    ui.dqs.splice(+e.dataset.n, 1);
    render();
  },

  // 문항과 글자 수를 확인한 뒤 서버에 초안을 맡긴다.
  draft: function () {
    var items = [], bad = '';

    ui.dqs.forEach(function (q, i) {
      if (!q.q.trim() || bad) return;   // 문항 글이 없는 칸은 건너뛴다

      var n = parseInt(q.limit, 10);
      var missing = q.custom ? !(n >= 100 && n <= 5000) : q.limit === '?';
      if (missing) {
        bad = '초안 문항 ' + (i + 1) + '의 글자 수를 ' + (q.custom ? '100~5,000자 사이로 적어 주세요' : '골라 주세요');
      }

      // 서버에는 숫자 글자만 보낸다. 제한 없음('0')은 빈 값으로 보낸다.
      var limit = q.custom ? String(n) : q.limit === '0' ? '' : q.limit;
      items.push({ q: q.q, limit: limit });
    });

    if (bad) return toast(bad);
    if (!items.length) return toast('초안을 쓸 문항을 하나 이상 적어 주세요');
    act('draft', { items: items }).catch(function () {});
  },

  // 추천 초안을 '직접 작성'의 답변 칸에 옮긴다. 사용자가 고친 뒤 재판에 올린다.
  useDraft: function () {
    var items = (S.draft && S.draft.items) || [];
    if (!items.length) return;

    var hasAnswers = ui.qs.some(function (q) { return q.a.trim(); });
    if (hasAnswers && !confirm('답변 칸에 써 둔 내용이 추천 초안으로 바뀝니다. 계속할까요?')) return;

    ui.qs = items.map(function (it) {
      return { q: it.q, limit: it.limit ? String(it.limit) : '', a: it.a };
    });
    ui.clMode = 'write';
    ui.ready = true;
    render();

    var el = document.getElementById('cover');
    if (el) el.scrollIntoView({ block: 'start' });
    toast('추천 초안을 답변 칸에 넣었어요. 사실과 수치를 확인하고 내 말로 고쳐 주세요');
  },

  // ---------- 2단계: 공방 ----------

  chatRestart: function () {
    ui.chatN = 0;
    render();
  },

  chatAll: function () {
    clearTimeout(chatTimer);
    chatTimer = null;
    ui.chatN = S.debate.messages.length;
    render();
  },

  toVote: function () {
    ui.revealN = 0;
    go(3);
    if (S.vote.status === 'idle') act('vote');
  },

  // ---------- 3단계: 배심 표결 ----------

  startVote: function () {
    ui.revealN = 0;
    act('vote');
  },

  // 표를 0.9초마다 한 명씩 공개한다. 모두 공개된 뒤에 누르면 다시 가린다.
  reveal: function () {
    if (ui.revealN >= 3) {
      ui.revealN = 0;
      return render();
    }
    var t = setInterval(function () {
      ui.revealN++;
      render();
      if (ui.revealN >= 3) clearInterval(t);
    }, 900);
    ui.revealN = 1;
    render();
  },

  toVerdict: function () {
    go(4);
    if (S.verdict.status === 'idle') act('verdict');
  },

  // ---------- 4단계: 판결 ----------

  startVerdict: function () {
    act('verdict');
  },

  // ---------- 5단계: 전달 ----------

  revision: function () {
    act('revision');
  },

  open: function (e) {
    API.file(S.id, e.dataset.f).then(function (t) {
      ui.preview = e.dataset.t;
      ui.previewText = t;
      render();
    }).catch(function (x) { toast(x.message); });
  },

  closePreview: function () {
    ui.preview = null;
    render();
  },

  pick: function () {
    post('/api/pick-folder').then(function (j) {
      if (j.path) {
        ui.savePath = j.path;
        render();
      }
    }).catch(function (e) { toast(e.message); });
  },

  save: function () {
    act('save', { path: ui.savePath });
  },

  // ---------- 6단계: 재심 또는 제출 ----------

  retrial: function () {
    if (!confirm('같은 공고와 재판부로 재심을 엽니다. 고친 자기소개서를 다시 넣어 주세요.')) return;
    act('retrial').then(function () {
      ui.step = 1;
      ui.chatN = 0;
      ui.revealN = 0;
      render();
      window.scrollTo(0, 0);
    });
  },

  submit: function () {
    act('submit');
  }
};


// ============================================================
// 15. 입력 이벤트 연결
// ============================================================

// 버튼: data-act 값과 같은 이름의 ACT 함수를 부른다.
app.addEventListener('click', function (ev) {
  var el = ev.target.closest('[data-act]');
  if (el && !el.disabled && ACT[el.dataset.act]) ACT[el.dataset.act](el);
});

// 글 입력: 입력한 값을 ui에 적어 둔다. (칸마다 다시 그리면 커서가 튀므로 꼭 필요할 때만 그린다)
app.addEventListener('input', function (ev) {
  var el = ev.target;

  // data-bind="이름": ui.이름에 그대로 적는다 (공고 본문, 추가 정보, 저장 위치 등)
  if (el.dataset.bind) ui[el.dataset.bind] = el.value;

  // data-dq: 추천 초안 문항의 글과 직접 입력한 글자 수
  if (el.dataset.dq != null) ui.dqs[+el.dataset.dq][el.dataset.f] = el.value;

  // data-q: 직접 작성 문항의 글, 글자 수 제한, 답변
  if (el.dataset.q != null) {
    var q = ui.qs[+el.dataset.q];
    q[el.dataset.f] = el.value;

    // 글자 수 표시만 바로 고친다.
    var c = document.getElementById('c' + el.dataset.q);
    if (c) c.textContent = countText(q);

    // 답변이 처음 생기거나 모두 사라졌을 때만 다시 그린다(접수 버튼이 켜지고 꺼진다).
    var ready = ui.qs.some(function (x) { return x.a.trim(); });
    if (ready !== ui.ready) {
      ui.ready = ready;
      render();
    }
  }
});

// 고르기와 파일 넣기
app.addEventListener('change', function (ev) {
  var el = ev.target;

  // data-up: 파일을 올린다 (evidence, jd, cover)
  if (el.dataset.up && el.files.length) upload(el.dataset.up, el.files);

  // data-kind: 증거자료의 종류를 바꾼다
  if (el.dataset.kind) act('evidence/kind', { n: +el.dataset.kind, kind: el.value });

  // data-dqsel: 추천 초안 문항의 글자 수를 고른다 ('직접 입력'을 고르면 숫자 칸이 나온다)
  if (el.dataset.dqsel != null) {
    var dq = ui.dqs[+el.dataset.dqsel];
    dq.custom = el.value === 'custom';
    dq.limit = dq.custom ? '' : el.value;
    render();
  }

  // 직접 작성 문항을 고친 뒤 칸을 벗어나면 다시 그린다
  if (el.dataset.q != null && ui.step === 1) render();
});

render();
