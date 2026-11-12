'use strict';
// 취업재판 웹앱 화면. 서버(/api)의 재판 상태 S를 1.5초마다 받아 그린다.
var S = null, last = '';
var ui = { started: false, step: 0, filesOpen: false, notionOpen: false, notionSt: '', notionHint: '', input: 'image', paste: '', extra: '', panelNote: '', noteOpen: false,
  clMode: 'write', qs: [{ q: '', limit: '', a: '' }], chatN: 0, revealN: 0, preview: null, previewText: '', savePath: '', toast: '', busy: false };
var LABELS = ['공고 접수', '재판부와 사건 기록', '공방', '배심 표결', '판결과 조언', '전달', '재심 또는 제출'];
var SUBS = ['서기가 공고문을 확인합니다', '배심원이 입장합니다', '탈락 위원과 합격 위원이 다툽니다', '배심원이 각자 투표합니다', '판사가 판결하고 고칠 점을 알려 줍니다', '기록을 전달합니다', '다음 행동을 고릅니다'];
var COLORS = { '인사담당자': '#4E7A5A', '임원진': '#3B3846', '실무 담당자': '#A86A1F' };
var app = document.getElementById('app');

function h(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function li(a) { return (a || []).map(function (x) { return '<li>' + h(x) + '</li>'; }).join(''); }
function size(b) { return b >= 1048576 ? (b / 1048576).toFixed(1) + 'MB' : Math.max(1, Math.round(b / 1024)) + 'KB'; }
function toast(m) { ui.toast = m; render(); setTimeout(function () { ui.toast = ''; render(); }, 5000); }

function person(body, hair, w, kind) {
  var extra = '';
  if (kind === 'clerk') extra = '<circle cx="41" cy="38" r="5" fill="none" stroke="#1E1D24" stroke-width="2"/><circle cx="55" cy="38" r="5" fill="none" stroke="#1E1D24" stroke-width="2"/><rect x="56" y="78" width="26" height="32" rx="2" fill="#fff" stroke="#1E1D24" stroke-width="2"/><path d="M61 86h16M61 92h16M61 98h10" stroke="#5B5866" stroke-width="2"/>';
  if (kind === 'judge') extra = '<rect x="76" y="62" width="20" height="11" rx="3" transform="rotate(-30 86 67)" fill="#C08A4E" stroke="#1E1D24" stroke-width="2"/><path d="M84 73l-10 20" stroke="#F2B544" stroke-width="4" stroke-linecap="round"/>';
  return '<svg width="' + w + '" height="' + Math.round(w * 1.25) + '" viewBox="0 0 96 120" aria-hidden="true"><path d="M14 118C14 80 30 62 48 62s34 18 34 56z" fill="' + body + '" stroke="#1E1D24" stroke-width="2"/><path d="M40 62l8 10 8-10" fill="#fff" stroke="#1E1D24" stroke-width="2"/><circle cx="48" cy="36" r="20" fill="#F1D3B8" stroke="#1E1D24" stroke-width="2"/><path d="M28 33c1-13 9-19 20-19s19 6 20 19c-7-5-13-7-20-7s-13 2-20 7z" fill="' + hair + '" stroke="#1E1D24" stroke-width="2"/><circle cx="41" cy="38" r="2" fill="#1E1D24"/><circle cx="55" cy="38" r="2" fill="#1E1D24"/><path d="M43 47h10" stroke="#1E1D24" stroke-width="2" stroke-linecap="round"/>' + extra + '</svg>';
}

// ---------- 뒤쪽(backend) ----------
// Two modes share this screen. Local mode talks to server.py (the user's Claude Code login);
// browser mode (GitHub Pages) uses engine.js, which calls the Claude API with the user's own key.
var MODE = window.HC_MODE || 'local';
function json(r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || '요청 실패'); return j; }); }
var API = window.HC_ENGINE || {
  get: function (path) { return fetch(path).then(json); },
  post: function (path, body) { return fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) }).then(json); },
  upload: function (id, kind, f) { return fetch('/api/trial/' + id + '/upload?kind=' + kind + '&name=' + encodeURIComponent(f.name), { method: 'POST', body: f }).then(json); },
  file: function (id, name) { return fetch('/api/trial/' + id + '/file?name=' + encodeURIComponent(name)).then(function (r) { if (!r.ok) throw new Error('아직 만들어지지 않은 파일이에요'); return r.text(); }); }
};
function post(path, body) { return API.post(path, body); }
function act(path, body) {
  return ensure().then(function () { return post('/api/trial/' + S.id + '/' + path, body); })
    .then(function (j) { setS(j); return j; }).catch(function (e) { toast(e.message); throw e; });
}
function ensure() { return S ? Promise.resolve() : post('/api/trial').then(setS); }
function setS(j) { S = j; last = JSON.stringify(j); if (!ui.savePath) ui.savePath = j.save_path; render(); }
function upload(kind, files) {
  var p = ensure();
  Array.prototype.forEach.call(files, function (f) {
    p = p.then(function () {
      return API.upload(S.id, kind, f).then(setS);
    });
  });
  return p.catch(function (e) { toast('파일을 올리지 못했어요: ' + e.message); });
}
setInterval(function () {
  if (!S) return;
  API.get('/api/trial/' + S.id).then(function (j) {
    var s = JSON.stringify(j);
    if (s !== last) { S = j; last = s; render(); }
  }).catch(function () {});
}, 1500);

// ---------- 화면 ----------
function titleScreen() {
  var ev = S ? S.evidence : [];
  var cast = [['#8A3B12', '#1E1D24', 76, '', '검사<br>탈락 위원'], ['#4E7A5A', '#3A3442', 70, '', '인사담당자'], ['#5A5668', '#C9C6D2', 70, '', '임원진'],
    ['#0E1630', '#E9E6EF', 104, 'judge', '판사'], ['#3E6E73', '#2B2230', 70, 'clerk', '서기'], ['#A86A1F', '#3A3442', 70, '', '실무 담당자'], ['#2D6CC0', '#5A3A22', 76, '', '변호인<br>합격 위원']];
  return '<main class="title"><div class="sub">MOCK HIRING COURT</div><h1>취업재판</h1>' +
    '<p style="font-size:18px;color:#D5DBEC">내 자소서를 법정에 세워 보자</p>' +
    '<div><div class="lineup">' + cast.map(function (c, i) { return '<div style="animation-delay:' + (i * 0.25) + 's">' + person(c[0], c[1], c[2], c[3]) + '<span>' + c[4] + '</span></div>'; }).join('') + '</div><div class="bench" style="margin:6px auto 0"></div></div>' +
    '<div class="row center"><button class="start" data-act="start">▶ START</button>' +
    (MODE === 'browser' ? '' : '<button class="ghost' + (S && S.notion.status === 'done' ? ' on' : '') + '" data-act="notion">' + (S && S.notion.status === 'done' ? '노션 연동됨' : 'Notion 연동') + '</button>') +
    '<button class="ghost' + (ev.length ? ' on' : '') + '" data-act="toggleFiles">' + (ev.length ? '증거자료 ' + ev.length + '건' : '지원자 파일 넣기') + '</button></div>' +
    '<div class="info"><b>지원자 파일 넣기</b><br>가지고 있는 C.V 파일(이력서, 경력기술서, 기존 자소서)을 넣으면 서기가 경력과 이력을 조사해 지원자의 스킬이 직무의 스킬과 맞는지 매칭합니다. 넣지 않아도 START로 시작할 수 있어요.' + (MODE === 'browser' ? '<br><b>브라우저 방식</b><br>내 Claude API 키로 이 브라우저에서 바로 돌아갑니다. 사용한 만큼 내 API 계정에서 요금이 나가고, 키는 이 브라우저에만 저장되어 Anthropic에만 보내집니다. 노션 연동은 Claude Code 방식에서 쓸 수 있어요. <button class="btn" style="margin-top:6px" data-act="changeKey">API 키 바꾸기</button>' :
      '<br><b>Notion 연동</b><br>노션에 정리된 지원자의 C.V, 즉 경력과 과거 지원 이력을 조사해 같은 방식으로 매칭합니다. 노션은 읽기만 하고 아무것도 쓰지 않습니다.') + '</div>' +
    (ui.notionOpen ? notionPanel() : '') +
    (ui.filesOpen ? '<section class="panel col"><div><div class="h3">지원자 파일 넣기</div><p class="muted" style="font-size:14px">이력서, 경력기술서, 기존에 지원했던 자기소개서를 여러 개 넣을 수 있어요. (PDF, Word, 한글 hwpx, 텍스트)</p></div>' +
      '<label class="drop" for="ev-files">파일을 눌러서 고르세요<span class="small">여러 개 가능</span></label><input id="ev-files" type="file" multiple accept=".pdf,.docx,.hwpx,.txt,.md,.pptx" data-up="evidence">' +
      '<div class="row between"><div class="h3">증거자료</div><span class="small">' + ev.length + '건</span></div>' +
      '<p class="small">재판에서 지원자의 경력과 이력을 확인하는 데 쓰는 자료입니다. 종류가 틀리면 바꿔 주세요.</p>' +
      (ev.length ? ev.map(function (e) {
        return '<div class="prow' + (e.ok ? '' : ' error') + '"><span style="flex:1 1 auto;min-width:0"><b>' + h(e.name) + '</b><br><span class="small">' + size(e.size) + (e.chars ? ' · 글자 ' + e.chars.toLocaleString() + '자' : '') + (e.warn ? ' · ' + h(e.warn) : '') + '</span></span>' +
          '<select style="width:auto" aria-label="자료 종류" data-kind="' + e.n + '">' + ['이력서', '경력기술서', '기존 자소서', '기타 자료'].map(function (k) { return '<option' + (k === e.kind ? ' selected' : '') + '>' + k + '</option>'; }).join('') + '</select>' +
          '<button class="btn" data-act="rmEvidence" data-n="' + e.n + '" aria-label="' + h(e.name) + ' 빼기">✕</button></div>';
      }).join('') : '<div class="soft muted" style="text-align:center">아직 넣은 증거자료가 없습니다.</div>') + '</section>' : '') +
    '</main>';
}

function notionPanel() {
  var n = S ? S.notion : { status: 'idle' }, st = ui.notionSt, body = '';
  if (st === 'checking') body = '<div class="soft"><span class="spin"></span> 노션 연결을 확인하는 중</div>';
  else if (st === 'opened') body = '<div class="good col"><b style="color:var(--blue)">브라우저에 노션 로그인 창을 열었습니다.</b><span style="font-size:14px">노션에 로그인하고 <b>액세스 허용</b>을 누르면 여기로 자동으로 이어집니다. 함께 뜬 검은 창은 승인이 끝나면 닫혀요.</span><span class="small"><span class="spin"></span> 승인을 기다리는 중…</span><button class="btn" data-act="notionConnect">창이 안 열렸어요, 다시 열기</button></div>';
  else if (st === 'manual') body = '<div class="warn col"><b>이 컴퓨터에서는 로그인 창을 자동으로 열 수 없어요.</b><span style="color:var(--ink);font-size:14px">터미널에서 아래 명령을 한 번 실행하고 브라우저에서 승인해 주세요.</span><div class="pre">claude mcp login notion</div><button class="btn" data-act="notionCheck">연결 다시 확인</button></div>';
  else if (st === 'connected') {
    var run = '<label for="n-hint">노션의 어디에 이력과 자소서가 있나요? (선택)</label><input id="n-hint" type="text" data-bind="notionHint" value="' + h(ui.notionHint) + '" placeholder="예: 취준관리 페이지 아래에 있어요">' +
      '<button class="btn primary big" data-act="notionRun"' + (n.status === 'running' ? ' disabled' : '') + '>' + (n.status === 'done' ? '노션에서 다시 가져오기' : '노션에서 가져오기') + '</button>';
    if (n.status === 'running') body = '<div class="soft"><span class="spin"></span> 노션에서 경력과 지원 이력을 조사하는 중 <span class="small">(1~3분)</span></div>';
    else if (n.status === 'error') body = run + '<div class="warn"><b>' + h(n.error) + '</b></div>';
    else if (n.status === 'done') body = '<div class="good col"><b style="color:var(--blue)">' + h(n.summary) + '</b><ul style="font-size:13px">' + (n.pages || []).map(function (p) { return '<li><b>' + h(p.title) + '</b> ' + h(p.note) + '</li>'; }).join('') + '</ul>' + ((n.missing || []).length ? '<span class="small">찾지 못한 것: ' + n.missing.map(h).join(', ') + '</span>' : '') + '</div>' + run;
    else body = '<div class="good"><b style="color:var(--blue)">노션이 연결되었습니다.</b></div>' + run;
  } else body = '<button class="btn primary big" data-act="notionConnect">노션 로그인하기</button>';
  return '<section class="panel col"><div><div class="h3">Notion 연동</div><p class="muted" style="font-size:14px">내 노션에서 이력서, 경험 정리, 지원 현황, 자기소개서를 찾아 지원자 자료로 정리합니다. 노션은 읽기만 합니다.</p></div>' + body + '</section>';
}

function header() {
  var a = S.jd.analysis;
  return '<header class="row between"><div><h1 style="font-size:24px;font-weight:900">취업 재판</h1><span class="small">' + (a && S.jd.status === 'done' ? '사건: ' + h(a.company) + ' ' + h(a.job) : '사건: 공고 접수 전') + '</span></div>' +
    '<div class="row"><span class="tag">' + ([S.notion.status === 'done' ? '노션 연동됨' : '', S.evidence.length ? '증거자료 ' + S.evidence.length + '건' : ''].filter(Boolean).join(' + ') || '지원자 기록 없음') + '</span><span class="tag run">' + (S.round === 1 ? '1심' : '재심 ' + (S.round - 1) + '회') + '</span><button class="btn" data-act="home">처음 화면</button></div></header>' +
    '<nav class="row" aria-label="재판 단계" style="margin:16px 0">' + LABELS.map(function (l, i) {
      var cls = i === ui.step ? ' cur' : i < ui.step ? ' done' : '';
      return '<button class="chip' + cls + '" data-act="go" data-n="' + i + '"' + (i > S.max_step ? ' disabled title="앞 단계를 마쳐야 열립니다"' : '') + '><span class="n">' + i + '</span>' + l + '</button>';
    }).join('') + '</nav>';
}

function clerk(text) { return '<div class="row" style="align-items:flex-end">' + person('#3E6E73', '#2B2230', 84, 'clerk') + '<div class="bubble"><b>서기:</b> ' + text + '</div></div>'; }
// 오래 걸리는 작업이 멈춘 것처럼 보이지 않게: 지금 하는 일(job.act)과 지난 시간(job.since)을 함께 보인다.
function elapsed(since) { var s = Math.max(0, Math.round(Date.now() / 1000 - since)); return '경과 ' + (s >= 60 ? Math.floor(s / 60) + '분 ' : '') + (s % 60) + '초'; }
function progress(job) {
  if (!job) return '';
  return (job.act ? '<br><span class="small">지금: ' + h(job.act) + '</span>' : '') + (job.since ? ' <span class="small" data-since="' + job.since + '">' + elapsed(job.since) + '</span>' : '');
}
function running(msg, job) { return '<div class="soft" role="status"><span class="spin"></span> ' + h(msg) + ' <span class="small">(1~3분 걸릴 수 있어요)</span>' + progress(job) + '</div>'; }
setInterval(function () {
  Array.prototype.forEach.call(document.querySelectorAll('[data-since]'), function (el) { el.textContent = elapsed(+el.dataset.since); });
}, 1000);
function errorBox(job, retry) { return '<div class="warn" role="alert"><b>문제가 생겼어요.</b> ' + h(job.error) + (retry ? '<br><button class="btn" style="margin-top:8px" data-act="' + retry + '">다시 시도</button>' : '') + '</div>'; }
function preview() { return ui.preview ? '<div><div class="row between"><b>' + h(ui.preview) + '</b><button class="btn" data-act="closePreview">닫기</button></div><div class="pre">' + h(ui.previewText) + '</div></div>' : ''; }

function step0() {
  var jd = S.jd, st = jd.status, a = jd.analysis, m = jd.match;
  var line = st === 'idle' ? '본 판결에 앞서 서기가 공고문을 먼저 확인합니다. 캡처 이미지, 파일, 본문 붙여넣기 중 하나로 공고문을 주세요.' : st === 'running' ? '공고문을 읽고 있습니다. 아래 칸이 하나씩 채워집니다.' : st === 'error' ? '공고를 확인하지 못했습니다. 아래 안내를 봐 주세요.' : jd.confirmed ? '공고 확인을 마쳤습니다. 다음은 재판부와 자기소개서입니다.' : '공고 분석을 마쳤습니다. 제가 이해한 내용이 맞는지 확인해 주세요.';
  var modes = [['image', '이미지(캡처)'], ['file', '파일(PDF, Word)'], ['paste', '본문 붙여넣기']];
  var inp = ui.input === 'paste' ? '<label for="jd-paste">공고 본문</label><textarea id="jd-paste" rows="6" placeholder="공고 페이지의 글을 복사해 붙여넣으세요" data-bind="paste">' + h(ui.paste) + '</textarea>' :
    '<label class="drop" for="jd-file">' + (ui.input === 'image' ? '공고 캡처 이미지를 눌러서 고르세요 (여러 장 가능)' : '공고 파일을 눌러서 고르세요 (PDF, Word, hwpx)') + '</label><input id="jd-file" type="file" multiple accept="' + (ui.input === 'image' ? 'image/*' : '.pdf,.docx,.hwpx,.txt') + '" data-up="jd">' +
    (ui.input === 'file' ? '<div class="soft" style="font-size:13px"><b>공고 페이지를 PDF로 저장하는 법</b><ol style="margin:4px 0 0 18px"><li>공고 페이지에서 <b>Ctrl+P</b>를 누릅니다 (Mac은 ⌘+P).</li><li>대상(프린터)을 <b>PDF로 저장</b>으로 바꿉니다.</li><li><b>저장</b>을 누르고, 저장된 파일을 위에 넣습니다.</li></ol></div>' : '') +
    (jd.files.length ? '<div class="small">넣은 파일: ' + jd.files.map(h).join(', ') + ' <button class="btn" data-act="clearJd">비우기</button></div>' : '');
  var html = clerk(line) +
    '<section class="card col"><div class="row" role="group" aria-label="공고 입력 방식">' + modes.map(function (x) { return '<button class="seg' + (ui.input === x[0] ? ' on' : '') + '" data-act="input" data-v="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div>' + inp +
    '<button class="btn primary big" data-act="jd"' + (st === 'running' ? ' disabled' : '') + '>' + (st === 'running' ? '분석 중…' : st === 'done' ? '다른 공고로 다시 접수' : '공고 접수') + '</button></section>';
  if (jd.rows.length) {
    var doneN = jd.rows.filter(function (r) { return r.st === 'done'; }).length;
    html += '<section class="card col"><div class="row between"><div class="h3">서기의 공고 확인</div><span class="small">' + doneN + ' / 6 완료</span></div>' +
      jd.rows.map(function (r, i) {
        return '<div class="prow ' + r.st + '"><span class="num">' + (i + 1) + '</span><span style="flex:1 1 auto;min-width:0"><b style="font-size:13px">' + r.key + '</b><br><span style="font-size:13px">' + h(r.st === 'run' ? '분석 중…' : r.val || '빈칸') + '</span></span><span class="tag ' + r.st + '">' + { wait: '대기', run: '분석 중', done: '완료', error: '오류' }[r.st] + '</span></div>';
      }).join('') + (st === 'running' ? running(doneN < 2 ? '공고문을 받아 읽는 중' : doneN < 5 ? '공고를 분석하는 중' : '공고의 업무 줄마다 지원자 기록과 맞춰 보는 중', jd) : '') + '</section>';
  }
  if (st === 'error') {
    html += '<div class="warn col" role="alert"><b>' + h(jd.error) + '</b><span>아래 방법 중 하나로 다시 주세요.</span><div class="grid3">' +
      [['image', '캡처 이미지', '여러 장 가능'], ['file', 'PDF 파일', 'Ctrl+P → PDF로 저장'], ['paste', '본문 붙여넣기', '드래그 → 복사']].map(function (x) { return '<button class="btn" data-act="input" data-v="' + x[0] + '"><b>' + x[1] + '</b><br><span class="small">' + x[2] + '</span></button>'; }).join('') + '</div></div>';
  }
  if (st === 'done' && a) {
    html += '<section class="card col"><div class="row between"><div class="h3" style="font-size:17px">공고 분석</div><span class="tag run">서기가 이해한 내용</span></div>' +
      '<p style="font-size:16px;font-weight:700">' + h(a.summary) + '</p>' + (a.caution ? '<p class="warn"><b>주의</b> ' + h(a.caution) + '</p>' : '') +
      '<div class="grid2"><div class="soft"><span class="small">채용 대상</span><br><b>' + h(a.target) + '</b></div><div class="soft"><span class="small">직무 일치</span><br><b>' + (m ? h(m['직무 일치도']) : '자기소개서를 받은 뒤 계산') + '</b></div></div>' +
      '<div><b class="small">이 직무가 하는 일</b><ul>' + li(a.duties) + '</ul></div>' +
      '<div class="grid2"><div><b class="small">꼭 필요한 것</b><ul>' + li(a.required) + '</ul></div><div><b class="small">있으면 좋은 것</b><ul>' + li(a.preferred) + '</ul></div></div>' +
      (m ? '<div class="good col"><b class="small" style="color:var(--navy)">내 경험과 맞춰 보면 (주요 업무 ' + m['주요 업무'] + '줄)</b><div class="grid3"><div class="soft"><b style="font-size:20px;color:var(--blue)">' + m['직접'] + '</b><br><span class="small">직접 해 본 일</span></div><div class="soft"><b style="font-size:20px;color:var(--navy)">' + m['전이'] + '</b><br><span class="small">비슷한 경험</span></div><div class="soft"><b style="font-size:20px;color:var(--orange)">' + m['공백'] + '</b><br><span class="small">비어 있는 곳</span></div></div></div>' :
        '<div class="soft muted">내 경험과 맞춰 보는 일은 자기소개서를 받은 뒤에 합니다.</div>') +
      ((a.removed || []).length ? '<div><b class="small">정리하며 걸러낸 것</b><ul class="small">' + li(a.removed) + '</ul></div>' : '') + '</section>' +
      '<section class="card strong col"><div class="h3">추가할 수 있는 정보가 또 있을까요?</div><p style="font-size:14px">서기가 공고를 잘못 이해했을 수 있어요. 빠진 내용이나, 공고에는 없지만 알고 있는 정보를 적어 주세요.</p>' +
      ((a.questions || []).length ? '<div class="soft"><b class="small">서기가 확인하고 싶은 것</b><ul>' + li(a.questions) + '</ul></div>' : '') +
      '<label for="jd-extra">추가 정보 (선택)</label><textarea id="jd-extra" rows="3" data-bind="extra" placeholder="예: 이 팀은 주로 이런 일을 한다고 들었어요">' + h(ui.extra) + '</textarea>' +
      '<div class="grid2"><button class="btn big" data-act="reanalyze">다시 분석하기</button><button class="btn primary big" data-act="confirmJd"' + (jd.confirmed ? ' disabled' : '') + '>' + (jd.confirmed ? '분석 확정됨' : '이대로 분석 마치기') + '</button></div>' +
      (jd.confirmed ? '<div class="good row between"><b style="color:var(--blue)">공고 분석을 확정했습니다. 이 공고에 맞춰 재판부를 세웁니다.</b><button class="btn primary" data-act="go" data-n="1">재판부 보러 가기</button></div>' : '') + '</section>' +
      '<section class="card col"><div class="h3">이 단계에서 정리한 내용</div><table><thead><tr><th>항목</th><th>내용</th><th>확인</th></tr></thead><tbody>' +
      [['공고 원문', '공고_원문.txt', '받은 그대로'], ['공고 정리', '공고_원문_정리.md', '숨은 문장을 걸러낸 정리본'], ['직무 일치표', '직무일치표.md', m ? '공고의 업무 줄마다 내 경험과 맞춰 본 표' : '자기소개서를 받은 뒤 만듭니다'], ['지원자 자료', '지원자자료.md', S.has_profile ? '증거자료에서 정리한 경력과 이력' : '증거자료를 넣으면 만들어집니다']].map(function (f) {
        var ok = f[1] !== '직무일치표.md' && f[1] !== '지원자자료.md' || (f[1] === '직무일치표.md' ? !!m : S.has_profile);
        return '<tr><td><b>' + f[0] + '</b></td><td>' + f[2] + '</td><td><button class="btn" data-act="open" data-f="' + f[1] + '" data-t="' + f[0] + '"' + (ok ? '' : ' disabled') + '>열기</button></td></tr>';
      }).join('') + '</tbody></table>' + preview() + '</section>';
  }
  return html;
}

function step1() {
  var p = S.panel, html = '';
  if (p.status === 'running' || p.status === 'idle') html += '<div class="h3">JD에 맞춰 재판부를 세우는 중…</div>' + running('회사의 당면 과제와 현직자 자료를 찾아 배심원 세 명의 관점을 세우고 있습니다', p);
  else if (p.status === 'error') html += errorBox(p, 'redoPanel');
  else {
    html += '<div><div class="h3">재판부가 입장했습니다</div><span class="small">공고 분석을 바탕으로 이 회사에 맞는 배심원 세 명을 세웠습니다.</span></div><div class="grid3">' +
      p.jurors.map(function (j) {
        var c = COLORS[j.role] || '#26365E';
        return '<article class="jcard" style="border-top:6px solid ' + c + '">' + person(c, '#3A3442', 80) + '<b style="font-size:16px">' + h(j.role) + '</b><span class="tag" style="background:' + c + ';color:#fff">' + h(j.focus) + '</span>' +
          '<div style="width:100%;text-align:left;font-size:14px" class="col"><div><span class="small"><b>성격</b></span><br>' + h(j.persona) + '</div><div><span class="small"><b>이렇게 봅니다</b></span><br><b>' + h(j.view) + '</b></div><div><span class="small"><b>이 관점의 근거</b></span><br><span class="muted" style="font-size:13px">' + h(j.basis) + '</span></div></div></article>';
      }).join('') + '</div>' +
      '<div class="card strong col"><span><b>서기:</b> 세 배심원의 성격과 관점이 이 회사에 맞나요? 맞으면 판사님께 알리고 재판을 엽니다.</span>' +
      '<div class="row"><button class="btn' + (p.confirmed ? ' primary' : '') + '" data-act="confirmPanel">' + (p.confirmed ? '관점 확인됨' : '관점이 맞아요') + '</button><button class="btn" data-act="toggleNote">관점을 고칠게요</button></div>' +
      (ui.noteOpen ? '<label for="p-note">어떻게 고칠까요?</label><textarea id="p-note" rows="2" data-bind="panelNote" placeholder="예: 실무 담당자는 현장 정비 경험을 더 중요하게 봐요">' + h(ui.panelNote) + '</textarea><button class="btn" data-act="redoPanel">이 내용으로 다시 세우기</button>' : '') + '</div>';
  }
  var cnt = ui.qs.filter(function (q) { return q.a.trim(); }).length, ready = ui.clMode === 'write' ? cnt > 0 : S.cover.files.length > 0;
  var okPanel = p.status === 'done' && p.confirmed, busy = S.debate.status === 'running';
  html += '<section class="card col"><div><div class="h3" style="font-size:17px">자기소개서 제출</div><p style="font-size:14px">재판에 올릴 자기소개서입니다. 여기서 직접 쓰거나, 써 둔 PDF나 Word 파일을 넣어 주세요.</p></div>' +
    '<div class="row"><button class="seg' + (ui.clMode === 'write' ? ' on' : '') + '" data-act="clMode" data-v="write">직접 작성</button><button class="seg' + (ui.clMode === 'file' ? ' on' : '') + '" data-act="clMode" data-v="file">파일 넣기 (PDF, Word)</button></div>';
  if (ui.clMode === 'write') {
    html += ui.qs.map(function (q, i) {
      return '<div class="soft col"><div class="row between"><label for="q' + i + '" style="font-size:14px">문항 ' + (i + 1) + '</label>' + (ui.qs.length > 1 ? '<button class="btn" data-act="rmQ" data-n="' + i + '">지우기</button>' : '') + '</div>' +
        '<input id="q' + i + '" type="text" data-q="' + i + '" data-f="q" value="' + h(q.q) + '" placeholder="예: 지원 동기와 입사 후 포부를 적어 주세요">' +
        '<div class="row"><label for="l' + i + '">글자 수 제한</label><input id="l' + i + '" type="number" min="0" step="50" style="width:120px" data-q="' + i + '" data-f="limit" value="' + h(q.limit) + '" placeholder="예: 1000"><span class="small">자 (공백 포함)</span></div>' +
        '<label for="a' + i + '">답변</label><textarea id="a' + i + '" rows="8" data-q="' + i + '" data-f="a" placeholder="자기소개서 답변을 쓰거나 붙여넣어 주세요">' + h(q.a) + '</textarea><span class="small" style="align-self:flex-end" id="c' + i + '">' + countText(q) + '</span></div>';
    }).join('') + '<button class="btn" style="border-style:dashed" data-act="addQ">+ 문항 추가</button>';
  } else {
    html += '<label class="drop" for="cl-file">자기소개서 파일을 눌러서 고르세요<span class="small">PDF, Word, hwpx · 여러 개 가능</span></label><input id="cl-file" type="file" multiple accept=".pdf,.docx,.hwpx,.txt" data-up="cover">' +
      (S.cover.files.length ? '<div class="small">넣은 파일: ' + S.cover.files.map(h).join(', ') + ' <button class="btn" data-act="clearCover">비우기</button></div>' : '');
  }
  html += '<div class="row between" style="border-top:1px solid #E6E2D9;padding-top:14px"><span class="small"><b>' + (!okPanel ? '재판부 관점을 먼저 확인해 주세요' : ready ? (ui.clMode === 'write' ? '답변 ' + cnt + '개 준비됨' : '파일 ' + S.cover.files.length + '개 준비됨') : (ui.clMode === 'write' ? '답변을 하나 이상 써 주세요' : 'PDF나 Word 파일을 넣어 주세요')) + '</b></span>' +
    '<button class="btn primary big" data-act="case"' + (ready && okPanel && !busy ? '' : ' disabled') + '>사건 기록 접수하고 공방 열기</button></div></section>';
  return html;
}
function countText(q) { var lim = parseInt(q.limit, 10), c = q.a.length; return (lim > 0 ? c + ' / ' + lim + '자' : c + '자') + (lim > 0 && c > lim ? ' · ' + (c - lim) + '자 넘음' : ''); }

function bubbleHtml(m) {
  if (m.t === 'sys') return '<div class="sys">' + h(m.text) + '</div>';
  if (m.t === 'S') return '<div class="card" style="border:2px solid var(--teal);align-self:center;width:min(100%,560px)"><b style="color:var(--teal);font-size:13px">서기 · 핵심 쟁점 정리</b><ol>' + li(m.items) + '</ol><span class="small">이 쟁점들을 배심원에게 넘깁니다.</span></div>';
  var L = m.t === 'L';
  return '<div class="msg ' + m.t + '"><div class="av" style="background:' + (L ? '#8A3B12' : '#2D6CC0') + '">' + (L ? '탈락' : '합격') + '</div><div><div class="who">' + (L ? '검사 · 지원자 탈락 위원' : '변호인 · 지원자 합격 위원') + '</div><p>' + h(m.text) + '</p>' + (m.meta ? '<div class="meta">' + h(m.meta) + '</div>' : '') + '</div></div>';
}
function step2() {
  var d = S.debate;
  if (d.status === 'running') return running(d.msg || '공방을 준비하는 중', d);
  if (d.status === 'error') return errorBox(d) + '<button class="btn" data-act="go" data-n="1">자기소개서 단계로 돌아가기</button>';
  if (d.status !== 'done') return '<div class="soft muted">자기소개서를 접수하면 공방이 열립니다.</div>';
  var ms = d.messages, done = ui.chatN >= ms.length, phase = -1;
  ms.slice(0, ui.chatN).forEach(function (m) { if (typeof m.phase === 'number') phase = m.phase; });
  var next = ms[ui.chatN];
  return '<div class="row between"><div class="row">' + ['모두진술', '반박', '핵심 쟁점'].map(function (l, i) { return '<span class="tag ' + (done || i < phase ? 'run' : i === phase ? 'done' : '') + '">' + l + '</span>'; }).join('') + '</div><span class="small">진술마다 800자 안에서 핵심만 말합니다</span></div>' +
    '<div class="log" id="log" role="log" aria-live="polite">' + ms.slice(0, ui.chatN).map(bubbleHtml).join('') +
    (!done && next && (next.t === 'L' || next.t === 'R') ? '<div class="sys" style="align-self:' + (next.t === 'L' ? 'flex-start' : 'flex-end') + '">' + (next.t === 'L' ? '탈락 위원' : '합격 위원') + '이 쓰는 중 <span class="blink">…</span></div>' : '') + '</div>' +
    '<div class="row between"><span class="small">' + (done ? '공방이 끝났습니다' : '공방이 진행 중입니다') + '</span><div class="row"><button class="btn" data-act="chatRestart">처음부터</button><button class="btn" data-act="chatAll">한 번에 보기</button></div></div>' +
    (done ? '<button class="btn primary big" data-act="toVote">배심원 표결로 넘어가기</button>' : '');
}

function step3() {
  var v = S.vote, js = v.jurors || [];
  var html = '<div class="row between"><span style="font-size:14px">세 배심원은 서로의 표를 보지 못한 채 각자 투표합니다.</span>' +
    (v.status === 'done' ? '<button class="btn primary" data-act="reveal"' + (ui.revealN > 0 && ui.revealN < 3 ? ' disabled' : '') + '>' + (ui.revealN === 0 ? '표결 공개' : ui.revealN < 3 ? '공개 중…' : '다시 가리기') + '</button>' : v.status === 'idle' ? '<button class="btn primary" data-act="startVote">표결 시작</button>' : '') + '</div>';
  if (v.status === 'running') html += running(v.msg || '배심원 세 명이 각자 투표하는 중', v);
  if (v.status === 'error') html += errorBox(v, 'startVote');
  html += '<div class="grid3">' + ['인사담당자', '임원진', '실무 담당자'].map(function (name, i) {
    var j = js[i], open = j && i < ui.revealN, c = COLORS[name];
    return '<div class="jcard" style="border-top:6px solid ' + c + '"><div class="vote' + (open ? (j.pass ? ' pass' : ' fail') : '') + '"><b>' + (open ? (j.pass ? '합격' : '불합격') : '?') + '</b><span style="font-size:13px">' + (open ? '합격 가능성 ' + j.pct + '%' : v.status === 'done' ? '투표 완료' : '투표 중') + '</span></div>' + person(c, '#3A3442', 76) + '<b>' + name + '</b></div>';
  }).join('') + '</div>';
  if (v.status === 'done' && ui.revealN >= 3) {
    html += '<div class="card row center" role="status"><b>표결 결과</b><b style="color:var(--blue)">합격 ' + js.filter(function (j) { return j.pass; }).length + '</b><b style="color:var(--orange)">불합격 ' + js.filter(function (j) { return !j.pass; }).length + '</b></div>';
  }
  if (v.status === 'done' && ui.revealN > 0) {
    html += '<div class="h3" style="font-size:17px">배심원별 판단</div>' + js.slice(0, ui.revealN).map(function (j) {
      return '<article class="card col" style="border-left:6px solid ' + COLORS[j.name] + '"><div class="row between"><b style="font-size:16px">' + j.name + '</b><span class="tag ' + (j.pass ? 'done' : 'error') + '">' + (j.pass ? '합격' : '불합격') + ' · ' + j.pct + '%</span></div>' +
        '<p style="font-size:14px;font-weight:700">' + h(j.key) + '</p><div class="grid2"><div class="good"><b class="small" style="color:var(--blue)">합격 원인</b><br><span style="font-size:14px">' + h(j.pros) + '</span></div><div class="warn"><b class="small" style="color:var(--orange)">탈락 원인</b><br><span style="font-size:14px;color:var(--ink)">' + h(j.cons) + '</span></div></div>' +
        '<p class="small"><b>결정적 근거</b> ' + h(j.basis) + '</p><p style="font-size:13px"><b>이러면 표가 바뀝니다</b> ' + h(j.flip) + '</p></article>';
    }).join('');
  }
  if (v.status === 'done' && ui.revealN >= 3) html += '<button class="btn primary big" data-act="toVerdict">판사의 판결 듣기</button>';
  return html;
}

function step4() {
  var vd = S.verdict, tl = S.vote.tally || {}, n = vd.status === 'done' ? 4 : (vd.rows || 0);
  var rows = [['서기', '표결을 모았습니다', tl['다수결']], ['서기', '서류 예측을 계산했습니다', '인사와 실무의 평균 ' + tl['서류 예측 %'] + '% · 임원 시선 ' + tl['임원 시선 %'] + '%는 따로'], ['서기', '탈락 사유와 합격 조건을 정리했습니다', '배심과 공방에서 겹친 약점을 묶었습니다'], ['판사', '선고합니다', tl['서류 판결']]];
  var html = '<section class="card col"><div class="h3">판결 진행</div>' + rows.map(function (r, i) {
    var st = i < n ? 'done' : i === n && vd.status === 'running' ? 'run' : 'wait';
    return '<div class="prow ' + st + '"><span class="tag" style="background:' + (r[0] === '판사' ? 'var(--navy)' : 'var(--teal)') + ';color:#fff">' + r[0] + '</span><span><b style="font-size:14px">' + (st === 'done' ? r[1] : st === 'run' ? '정리하는 중…' : '대기') + '</b>' + (st === 'done' ? '<br><span style="font-size:13px">' + h(r[2]) + '</span>' : '') + '</span></div>';
  }).join('') + '</section>';
  if (vd.status === 'idle') html += '<button class="btn primary big" data-act="startVerdict">판결 시작</button>';
  if (vd.status === 'running') html += running('판사와 서기가 판결문과 조언을 쓰는 중', vd);
  if (vd.status === 'error') html += errorBox(vd, 'startVerdict');
  if (vd.status !== 'done') return html;
  var d = vd.data, res = tl['서류 판결'], pct = tl['서류 예측 %'], col = res === '합격' ? 'var(--blue)' : res === '탈락' ? 'var(--orange)' : 'var(--mute)';
  var m = S.jd.match || {};
  html += '<section class="card strong col" style="gap:18px"><div class="row">' + person('#26365E', '#E9E6EF', 96, 'judge') + '<div><span class="small"><b>판사의 판결</b></span><div style="font-size:40px;font-weight:900;color:' + col + ';line-height:1.1">' + h(res) + '</div><span style="font-size:14px">배심 ' + h(tl['다수결']) + ' · 직무 일치 ' + h(m['직무 일치도']) + '</span></div></div>' +
    '<div><div class="row between" style="font-size:13px"><b>서류 예측 ' + pct + '%</b><span class="muted">인사와 실무의 평균 · 임원 시선 ' + tl['임원 시선 %'] + '%는 따로</span></div><div class="gauge" role="img" aria-label="서류 예측 ' + pct + '퍼센트"><i style="width:' + pct + '%;background:' + col + '"></i><s style="left:45%"></s><s style="left:55%"></s></div><div class="row between small"><span>탈락 (45 이하)</span><span>합격 (55 이상)</span></div></div>' +
    '<div class="grid2"><div class="warn"><b style="color:var(--orange)">인정된 탈락 사유</b><ol style="color:var(--ink);font-size:14px">' + (d.reasons || []).map(function (r) { return '<li>' + h(r.text) + ' <span class="small">(' + h(r.who) + ')</span></li>'; }).join('') + '</ol></div><div class="good"><b style="color:var(--blue)">합격 위원이 옳았던 점</b><ul style="font-size:14px">' + li(d.defense) + '</ul></div></div>' +
    '<div><b style="font-size:14px">합격 조건</b><div class="grid3" style="margin-top:8px">' + (d.conditions || []).map(function (c, i) { return '<div class="soft"><b class="small" style="color:var(--navy)">조건 ' + (i + 1) + '</b><br><span style="font-size:14px">' + h(c) + '</span></div>'; }).join('') + '</div></div>' +
    '<div class="good"><b class="small" style="color:var(--navy)">선고</b><br><b>' + h(d.sentence) + '</b><br><span class="small">예측 %는 결과가 쌓이기 전까지 다른 회사와 견주는 상대 비교로만 봐 주세요.</span></div></section>' +
    '<div class="row center"><b style="color:var(--navy)">이기려면 이렇게 고치세요</b></div>' +
    '<section class="card" style="background:var(--navy);color:#fff"><span class="small" style="color:#C9D2EA"><b>수정 전략 한 줄</b></span><div style="font-size:18px;font-weight:900">' + h(d.strategy) + '</div></section>' +
    (d.advice || []).map(function (a, i) {
      return '<article class="card col"><div class="row between"><b style="font-size:16px">' + (i + 1) + '. ' + h(a.title) + '</b><span class="tag run">' + h(a.target) + '</span></div><div class="grid2"><div class="warn"><b class="small" style="color:var(--orange)">지금 문제</b><br><span style="font-size:14px;color:var(--ink)">' + h(a.problem) + '</span></div><div class="good"><b class="small" style="color:var(--blue)">이렇게 고치기</b><br><span style="font-size:14px">' + h(a.fix) + '</span></div></div>' +
        '<div><b class="small">쓸 경험 (내 기록 근거)</b><ul style="font-size:14px">' + li(a.use) + '</ul></div><div class="soft" style="border-left:4px solid var(--navy)"><b class="small" style="color:var(--navy)">문장 예시</b><br><span style="font-size:14px">' + h(a.sample) + '</span></div></article>';
    }).join('') +
    '<div class="grid2"><section class="card"><div class="h3" style="font-size:15px">비어 있는 곳 메우기</div><p style="font-size:14px">' + h(d.gaps) + '</p></section><section class="card"><div class="h3" style="font-size:15px">쓰지 말 것</div><ul style="font-size:14px">' + li(d.avoid) + '</ul></section></div>' +
    '<section class="warn"><b>솔직한 판단</b><p style="font-size:14px;color:var(--ink)">' + h(d.honest) + '</p></section>' +
    '<div class="grid2"><button class="btn big" style="border:2px solid var(--navy)" data-act="retrial">수정해서 재심 청구</button><button class="btn primary big" data-act="go" data-n="5">재판 기록 받기</button></div>';
  return html;
}

function step5() {
  var tl = S.vote.tally || {}, m = S.jd.match || {}, rv = S.revision;
  return clerk('판사님의 판결과 재판 기록을 모두 정리했습니다. 아래에서 열어 보고, 내 PC에 저장할 위치를 정해 주세요.') +
    '<section class="card grid4">' + [['판결', tl['서류 판결']], ['서류 예측', tl['서류 예측 %'] + '%'], ['배심 표결', tl['다수결']], ['직무 일치', m['직무 일치도']]].map(function (x) { return '<div><span class="small">' + x[0] + '</span><br><b style="font-size:18px">' + h(x[1]) + '</b></div>'; }).join('') + '</section>' +
    '<section class="card col"><div class="h3">재판 기록</div><table><thead><tr><th>항목</th><th>내용</th><th>확인</th></tr></thead><tbody>' + S.files.map(function (f) {
      var btn = f.ready ? '<button class="btn" data-act="open" data-f="' + h(f.file) + '" data-t="' + h(f.name) + '">열기</button>' :
        f.file === '수정본.md' ? '<button class="btn primary" data-act="revision"' + (rv.status === 'running' ? ' disabled' : '') + '>' + (rv.status === 'running' ? '쓰는 중…' : '수정본 만들기') + '</button>' : '<button class="btn" disabled>없음</button>';
      return '<tr><td><b>' + h(f.name) + '</b></td><td>' + h(f.desc) + '</td><td>' + btn + '</td></tr>';
    }).join('') + '</tbody></table>' + (rv.status === 'running' ? running('서기가 합격 조건을 반영해 수정본을 쓰는 중', rv) : '') + (rv.status === 'error' ? errorBox(rv) : '') + preview() + '</section>' +
    (MODE === 'browser' ? '<section class="card col"><div class="h3">기록 파일 받기</div><p style="font-size:14px">재판 기록을 ZIP 파일 하나로 내려받습니다. 브라우저를 닫으면 화면의 기록은 사라지니 꼭 받아 두세요.</p>' +
      '<button class="btn primary big" data-act="save">ZIP으로 받기</button>' :
    '<section class="card col"><div class="h3">내 PC에 저장</div><p style="font-size:14px">이 PC의 폴더에 파일로 저장합니다. 노션에는 아무것도 쓰지 않습니다.</p>' +
    '<label for="save-path">저장 위치</label><div class="row"><input id="save-path" type="text" style="flex:1 1 260px;width:auto;font-family:ui-monospace,Consolas,monospace;font-size:13px" data-bind="savePath" value="' + h(ui.savePath) + '"><button class="btn" data-act="pick">폴더 고르기</button></div>' +
    '<button class="btn primary big" data-act="save">내 PC에 저장하기</button>') + (S.saved ? '<b style="color:var(--blue)" role="status">저장했습니다: ' + h(S.saved) + '</b>' : '') + '</section>' +
    '<section class="soft" style="border-style:dashed"><b>이전 재판과 비교</b><br><span style="font-size:14px">' + (S.round > 1 ? '재심 ' + (S.round - 1) + '회차입니다. 이전 판결의 기록은 저장한 폴더에서 견주어 볼 수 있습니다.' : '첫 재판입니다. 수정본으로 재심을 열면 표결과 서류 예측이 어떻게 움직였는지 견주어 볼 수 있습니다.') + '</span></section>' +
    '<button class="btn primary big" data-act="go" data-n="6">재심 또는 제출 정하기</button>';
}

function step6() {
  if (S.submitted) return '<section class="card strong"><div style="font-size:20px;font-weight:900;color:var(--blue)">제출하기로 기록했습니다</div><p style="font-size:14px">결과가 나오면 다시 열어 예측과 견주어 보세요. 수고하셨습니다.</p></section>';
  return '<div class="row" style="align-items:flex-end">' + person('#26365E', '#E9E6EF', 84, 'judge') + '<div class="bubble" style="border-color:var(--navy)"><b>판사:</b> 판결과 조언을 보고 정하세요. 자기소개서를 고쳐 다시 재판을 열 수도 있고, 이대로 제출할 수도 있습니다.</div></div>' +
    '<div class="grid2"><button class="card strong" style="text-align:left;min-height:120px" data-act="retrial"><b style="font-size:18px;color:var(--navy)">재심 청구</b><br><span class="small">같은 공고, 같은 재판부로 1단계부터 다시 엽니다. 고친 자기소개서를 넣어 주세요.</span></button>' +
    '<button class="card" style="text-align:left;min-height:120px;background:var(--blue);border-color:var(--blue);color:#fff" data-act="submit"><b style="font-size:18px">이대로 제출</b><br><span style="font-size:12px;color:#E3ECF8">이 서류로 제출하기로 하고 재판을 마칩니다.</span></button></div>';
}

function render() {
  var keep = document.activeElement, id = keep && keep.id, pos = id && keep.selectionStart != null ? [keep.selectionStart, keep.selectionEnd] : null;
  var logTop = document.getElementById('log') ? document.getElementById('log').scrollTop : null;
  if (!ui.started || !S) app.innerHTML = titleScreen();
  else {
    var locked = ui.step >= 6 || ui.step + 1 > S.max_step;
    var hint = ['공고 분석을 확정해야 다음 단계가 열립니다', '자기소개서를 넣고 사건 기록을 접수해야 합니다', '공방이 끝나야 다음 단계가 열립니다', '표결이 끝나야 다음 단계가 열립니다', '판결이 끝나야 다음 단계가 열립니다', '', ''][ui.step];
    app.innerHTML = '<div class="wrap">' + header() + '<div class="stagehead"><b>' + LABELS[ui.step] + '</b><span style="font-size:12px;color:#C9D2EA">' + SUBS[ui.step] + '</span></div><div class="stage">' +
      [step0, step1, step2, step3, step4, step5, step6][ui.step]() + '</div>' +
      '<div class="row" style="margin-top:16px"><button class="btn big" style="flex:1 1 0" data-act="prev">이전</button><button class="btn primary big" style="flex:2 1 0" data-act="next"' + (locked ? ' disabled' : '') + '>' + (ui.step >= 6 ? '마지막 단계' : '다음: ' + LABELS[ui.step + 1]) + '</button></div>' +
      (locked && hint ? '<p class="small" style="text-align:center;color:#8A3B12;margin-top:8px" role="status">' + hint + '</p>' : '') + '</div>';
  }
  if (ui.toast) app.insertAdjacentHTML('beforeend', '<div class="toast" role="alert">' + h(ui.toast) + '</div>');
  if (id) { var el = document.getElementById(id); if (el) { el.focus(); if (pos && el.setSelectionRange) { try { el.setSelectionRange(pos[0], pos[1]); } catch (e) {} } } }
  var log = document.getElementById('log');
  if (log) log.scrollTop = chatPlaying ? log.scrollHeight : (logTop == null ? log.scrollHeight : logTop);
  tickChat();
}

var notionTimer = null;
function notionWait() {
  clearInterval(notionTimer);
  var tries = 0;
  notionTimer = setInterval(function () {
    if (ui.notionSt !== 'opened' || ++tries > 100) return clearInterval(notionTimer);
    API.get('/api/notion/status').then(function (j) {
      if (j.status === 'connected') { clearInterval(notionTimer); ui.notionSt = 'connected'; render(); }
    }).catch(function () {});
  }, 3000);
}
var chatTimer = null, chatPlaying = false;
function tickChat() {
  var d = S && S.debate;
  if (!ui.started || ui.step !== 2 || !d || d.status !== 'done' || ui.chatN >= d.messages.length) { chatPlaying = false; return; }
  if (chatTimer) return;
  chatPlaying = true;
  var m = d.messages[ui.chatN];
  chatTimer = setTimeout(function () { chatTimer = null; ui.chatN++; render(); }, m.t === 'L' || m.t === 'R' ? 900 + Math.min(m.text.length * 6, 1800) : 600);
}
function go(n) { if (S && n <= S.max_step) { ui.step = n; ui.preview = null; if (n === 2) ui.chatN = 0; render(); window.scrollTo(0, 0); } }

var ACT = {
  start: function () { ensure().then(function () { ui.started = true; ui.step = 0; render(); }); },
  notion: function () { ui.notionOpen = !ui.notionOpen; ui.filesOpen = false; render(); if (ui.notionOpen && ui.notionSt !== 'connected') ACT.notionCheck(true); },
  notionCheck: function (auto) {
    ui.notionSt = 'checking'; render();
    API.get('/api/notion/status').then(function (j) {
      if (j.status === 'connected' || auto !== true) { ui.notionSt = j.status === 'connected' ? 'connected' : ''; render(); }
      else ACT.notionConnect();
    }).catch(function () { ui.notionSt = ''; render(); });
  },
  notionConnect: function () {
    ui.notionSt = 'checking'; render();
    post('/api/notion/connect').then(function (j) { ui.notionSt = j.status; render(); if (j.status === 'opened') notionWait(); })
      .catch(function (e) { ui.notionSt = ''; toast(e.message); });
  },
  notionRun: function () { ensure().then(function () { return act('notion', { hint: ui.notionHint }); }).catch(function () {}); },
  toggleFiles: function () { ui.filesOpen = !ui.filesOpen; ui.notionOpen = false; render(); },
  rmEvidence: function (e) { act('evidence/remove', { n: +e.dataset.n }); },
  home: function () { ui.started = false; render(); },
  go: function (e) { go(+e.dataset.n); },
  prev: function () { go(Math.max(0, ui.step - 1)); },
  next: function () { go(Math.min(6, ui.step + 1)); },
  input: function (e) { ui.input = e.dataset.v; render(); },
  clearJd: function () { act('clear-files', { kind: 'jd' }); },
  clearCover: function () { act('clear-files', { kind: 'cover' }); },
  jd: function () {
    act('jd', { mode: ui.input, text: ui.paste });
  },
  reanalyze: function () { act('jd/reanalyze', { extra: ui.extra }).then(function () { ui.extra = ''; }); },
  confirmJd: function () { act('jd/confirm'); },
  confirmPanel: function () { act('panel/confirm'); },
  toggleNote: function () { ui.noteOpen = !ui.noteOpen; render(); },
  redoPanel: function () { act('panel/redo', { note: ui.panelNote }).then(function () { ui.noteOpen = false; ui.panelNote = ''; }); },
  clMode: function (e) { ui.clMode = e.dataset.v; render(); },
  addQ: function () { ui.qs.push({ q: '', limit: '', a: '' }); render(); },
  rmQ: function (e) { ui.qs.splice(+e.dataset.n, 1); render(); },
  'case': function () { act('case', { mode: ui.clMode, items: ui.qs }).then(function () { ui.chatN = 0; ui.revealN = 0; ui.step = 2; render(); window.scrollTo(0, 0); }); },
  chatRestart: function () { ui.chatN = 0; render(); },
  chatAll: function () { clearTimeout(chatTimer); chatTimer = null; ui.chatN = S.debate.messages.length; render(); },
  toVote: function () { ui.revealN = 0; go(3); if (S.vote.status === 'idle') act('vote'); },
  startVote: function () { ui.revealN = 0; act('vote'); },
  reveal: function () {
    if (ui.revealN >= 3) { ui.revealN = 0; return render(); }
    var t = setInterval(function () { ui.revealN++; render(); if (ui.revealN >= 3) clearInterval(t); }, 900);
    ui.revealN = 1; render();
  },
  toVerdict: function () { go(4); if (S.verdict.status === 'idle') act('verdict'); },
  startVerdict: function () { act('verdict'); },
  retrial: function () { if (confirm('같은 공고와 재판부로 재심을 엽니다. 고친 자기소개서를 다시 넣어 주세요.')) act('retrial').then(function () { ui.step = 1; ui.chatN = 0; ui.revealN = 0; render(); window.scrollTo(0, 0); }); },
  submit: function () { act('submit'); },
  revision: function () { act('revision'); },
  open: function (e) {
    API.file(S.id, e.dataset.f).then(function (t) { ui.preview = e.dataset.t; ui.previewText = t; render(); }).catch(function (x) { toast(x.message); });
  },
  closePreview: function () { ui.preview = null; render(); },
  pick: function () { post('/api/pick-folder').then(function (j) { if (j.path) { ui.savePath = j.path; render(); } }).catch(function (e) { toast(e.message); }); },
  save: function () { act('save', { path: ui.savePath }); },
  changeKey: function () { if (window.HC_SHOW_KEY) window.HC_SHOW_KEY(); }
};
app.addEventListener('click', function (ev) {
  var el = ev.target.closest('[data-act]');
  if (el && !el.disabled && ACT[el.dataset.act]) ACT[el.dataset.act](el);
});
app.addEventListener('input', function (ev) {
  var el = ev.target;
  if (el.dataset.bind) ui[el.dataset.bind] = el.value;
  if (el.dataset.q != null) {
    var q = ui.qs[+el.dataset.q]; q[el.dataset.f] = el.value;
    var c = document.getElementById('c' + el.dataset.q); if (c) c.textContent = countText(q);
    var ready = ui.qs.some(function (x) { return x.a.trim(); });
    if (ready !== ui.ready) { ui.ready = ready; render(); }
  }
});
app.addEventListener('change', function (ev) {
  var el = ev.target;
  if (el.dataset.up && el.files.length) upload(el.dataset.up, el.files);
  if (el.dataset.kind) act('evidence/kind', { n: +el.dataset.kind, kind: el.value });
  if (el.dataset.q != null && ui.step === 1) render();
});
render();
