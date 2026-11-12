# job hiring court (KR) · 취업재판

[![tests](https://github.com/LSH2007-tech/job-hiring-court-KR/actions/workflows/tests.yml/badge.svg)](https://github.com/LSH2007-tech/job-hiring-court-KR/actions/workflows/tests.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**Put your Korean job application on trial.** job hiring court checks a 자기소개서 (Korean cover letter) against a job posting the way a hiring committee would: a prosecutor and a defender argue, three jurors (HR, executive, hiring manager) vote without seeing each other's votes, and a judge returns a verdict with concrete revision advice.

내 자소서를 법정에 세워 보자. 공고 맞춤을 먼저 따지고, 탈락 위원과 합격 위원의 공방, 인사·임원·실무 배심의 독립 투표로 판결과 수정 조언을 받습니다. [한국어 안내는 아래](#한국어-안내)에 있습니다.

> **Work in progress.** The rules, screens and scoring are still being tuned against real application results and may change between versions. Current plugin version: v1.6.0.

- **Try it in the browser (no install):** https://lsh2007-tech.github.io/job-hiring-court-KR/app/
- **Intro and install guide:** https://lsh2007-tech.github.io/job-hiring-court-KR/

## Two ways to run it

| | Browser app | Claude Code plugin |
|---|---|---|
| Install | Nothing. Open the page | Claude Code (logged in) + Python 3.10+ |
| Who pays for Claude | You, through your own **Claude API key** (pay per use) | You, through your own **Claude subscription** |
| Where it runs | Your browser calls the Claude API directly | A local server on your PC (`localhost`) drives Claude Code |
| Applicant records | Upload files (resume, career description, past cover letters) | Upload files, or read-only **Notion** link |
| Saving | Download a ZIP of the trial record | Saved to a folder you choose |

Neither mode has a hosted server: nobody but you and Anthropic sees your documents.

## How it works

```
Step 0  Posting intake   link / screenshot / PDF / paste  -> cleaned posting, job-match table
Step 1  Jury and case    3 jurors built from the posting (+ web research), cover letter filed
Step 2  Debate           prosecutor vs defender, every statement under 800 characters
Step 3  Jury vote        HR, executive, hiring manager vote independently (parallel calls)
Step 4  Verdict + advice paper-screen prediction = mean of HR and hiring manager; fix list
Step 5  Delivery         verdict, advice, revised cover letter, records
Step 6  Retrial / submit
```

- **Judgement is done by Claude, counting by code.** Character counts, job-match levels (direct / transferable / gap), vote validation and the tally are computed by `court_tool.py` in the plugin and by `engine.js` in the browser, never by the model.
- **The posting comes first.** A beautifully written letter for the wrong posting loses; the job-match level sets the range jurors may vote in.
- **Hidden instructions in postings are stripped** before anything reaches the jurors.
- Prompts and scoring rules are in Korean on purpose: the tool targets Korean hiring documents. The rules live in one file, [`SKILL.md`](hiring-court/skills/hiring-court/SKILL.md), which both modes read.

```
Plugin:   Browser (localhost:8765) -> web/server.py -> claude -p (your login) -> court_tool.py
Browser:  docs/app (GitHub Pages)  -> engine.js     -> Claude API (your key)  -> same rules
```

## Install the plugin

```
/plugin marketplace add LSH2007-tech/job-hiring-court-KR
/plugin install hiring-court@lsh-skills
```

Then ask Claude Code `취업재판 웹 열어 줘` (opens the web screen) or `서류 재판 열어 줘` (runs the trial in chat).
Optional, for better PDF/Word reading: `python -m pip install "markitdown[pdf,docx,pptx,xlsx]"`.

## Development

```
python -m unittest discover -s tests -v     # court_tool.py, local server, browser build
node --test tests/                          # browser engine logic
python hiring-court/web/build_browser.py    # rebuild docs/app after changing hiring-court/web
```

CI runs both suites on Ubuntu and Windows with Python 3.10 and 3.13. Issues and pull requests are welcome.

| Path | What |
|---|---|
| `hiring-court/skills/hiring-court/` | The trial rules (`SKILL.md`) and the counting tool (`scripts/court_tool.py`) |
| `hiring-court/skills/court-web/` | Skill that launches the local web screen |
| `hiring-court/web/` | Local app: stdlib Python server, shared front-end, browser engine |
| `docs/` | GitHub Pages: intro page and the browser app (`docs/app/`, built from `hiring-court/web/`) |
| `tests/` | Python and Node tests |

## Why it was built and how it was tested

A single model asked to review a cover letter drifts toward what sounds nice. Splitting the review into opposing sides and independent jurors, and moving every number into code, gives a harsher and more useful read.

The author built and tuned it on their own applications in the second half of 2026. Each time a real result came back, the prediction was compared with it and the rules were changed where they had been wrong. Two examples: the posting fit (job match) became the first criterion after writing quality turned out to mislead, and the paper-screen prediction became the mean of the HR and hiring-manager jurors.

Results so far (one person's 2026 applications with known results, as of 2026-11):

| | Applications | Passed paper screen | Pass rate |
|---|---|---|---|
| Revised through job hiring court before submitting | 5 | 1 | 20% |
| Submitted without a trial | 15 | 1 | about 7% |

The sample is tiny and the postings differ, so this does not prove the tool caused the difference. Treat the verdict's percentage as a mock jury's estimate for finding what to fix, not as a real pass rate.

## License and credits

- This project: [MIT License](LICENSE). Anyone may use, modify and share it.
- The trial structure is adapted from **court-skill** by Alex Chen (MIT): https://github.com/alexyc9381/court-skill. Its full notice is in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
- Optional libraries installed by the user: [markitdown](https://github.com/microsoft/markitdown) (MIT, Microsoft), [pypdf](https://github.com/py-pdf/pypdf) (BSD-3-Clause). The browser app loads [JSZip](https://github.com/Stuk/jszip) (MIT) and the [Anthropic TypeScript SDK](https://github.com/anthropics/anthropic-sdk-typescript) (MIT) from public CDNs.

---

## 한국어 안내

**왜 만들었나:** 자소서를 Claude 한 명에게 평가받으면 결국 듣기 좋은 방향으로 모입니다. 그래서 서류를 재판에 올렸습니다. 따지는 사람(탈락 위원)과 지키는 사람(합격 위원)을 따로 세우고, 서로의 표를 보지 못하는 배심원 세 명이 각자 다른 질문으로 투표하게 했습니다. 판정에 쓰는 숫자(글자 수, 직무 일치도, 표 집계)는 모델이 아니라 코드가 셉니다.

**쓰는 방법 두 가지**
- **브라우저(설치 없음):** [바로 열기](https://lsh2007-tech.github.io/job-hiring-court-KR/app/). 내 Claude API 키를 넣으면 이 브라우저에서 바로 돌아가고, 사용한 만큼 내 API 계정에서 요금이 나갑니다.
- **Claude Code 플러그인:** 위의 설치 명령 두 줄. 내 Claude 구독 안에서 돌고, 노션 연동(읽기 전용)을 쓸 수 있습니다.

**어떻게 시험했나:** 만든 사람이 2026년 하반기에 실제로 지원한 서류로 시험하며, 결과가 나올 때마다 예측과 맞대어 규칙을 고쳤습니다. 글 완성도보다 **공고가 찾는 사람인가(직무 일치)**를 0순위로 바꾼 것이 대표적입니다.

**지금까지의 결과:** 재판을 거쳐 고친 뒤 낸 5건 중 1건 서류 합격(20%), 재판 없이 낸 15건 중 1건(약 7%). 표본이 작아 스킬의 효과라고 단정할 수는 없습니다.

**계속 바뀌는 중:** 실제 지원 결과를 보며 계속 고치고 있습니다. 버전마다 규칙과 화면이 달라질 수 있습니다.

**라이선스:** MIT. 누구나 쓰고 고치고 나눌 수 있습니다. 재판 구조는 Alex Chen의 court-skill(MIT)을 바탕으로 했습니다.
