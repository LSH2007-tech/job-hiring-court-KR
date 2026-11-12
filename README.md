# job hiring court (KR) · 취업재판

Put your Korean job application on trial. A **Claude Code plugin** that checks a 자기소개서 (cover letter) against a job posting: a prosecutor and a defender argue, three jurors (HR, executive, hiring manager) vote independently, and a judge returns a verdict with concrete revision advice.

내 자소서를 법정에 세워 보자. 공고 맞춤을 먼저 따지고, 탈락 위원과 합격 위원의 공방, 인사·임원·실무 배심의 독립 투표로 판결과 수정 조언을 받는 Claude Code 플러그인입니다.

> **Work in progress (계속 바뀌는 중).** 이 프로젝트는 지금도 실제 지원 결과를 보며 계속 고치고 있습니다. 재판 규칙, 화면, 예측 방식이 버전마다 달라질 수 있습니다. 현재 플러그인 v1.6.0. This project is under active development; rules, screens and scoring may change between versions.

- Intro and install guide (소개와 설치): https://lsh2007-tech.github.io/job-hiring-court-KR/
- Korean plugin guide (플러그인 설명): [hiring-court/README.md](hiring-court/README.md)

## 왜 만들었나 (Why)

자소서를 Claude 한 명에게 평가받으면 결국 듣기 좋은 방향으로 모입니다. 그래서 서류를 재판에 올렸습니다. 따지는 사람(탈락 위원)과 지키는 사람(합격 위원)을 따로 세우고, 서로의 표를 보지 못하는 배심원 세 명이 각자 다른 질문으로 투표하게 했습니다. 판정에 쓰는 숫자(글자 수, 직무 일치도, 표 집계)는 모델이 아니라 코드가 셉니다.

## 어떻게 시험했나 (How it was tested)

만든 사람이 2026년 하반기에 실제로 지원한 서류로 시험하며 고쳤습니다.
- 실제 결과가 나온 지원과 예측을 맞대어 보고, 어긋난 사례마다 원인을 분석해 규칙을 바꿨습니다. 예를 들어 글 완성도를 먼저 보던 판은 실제 결과와 반대로 예측한 사례가 쌓여, **공고가 찾는 사람인가(직무 일치)를 0순위**로 바꿨습니다.
- 예측 방식도 다수결에서, 서류를 실제로 거르는 인사와 실무 배심의 합격 가능성 평균으로 바꿨습니다.

## 지금까지의 결과 (Results so far)

만든 사람 한 명의 2026년 지원 기록입니다(결과가 나온 20건, 2026-11 기준).

| | 지원 | 서류 합격 | 서류 통과율 |
|---|---|---|---|
| 취업재판을 거쳐 고친 뒤 제출 | 5건 | 1건 | 20% |
| 재판 없이 제출 | 15건 | 1건 | 약 7% |

표본이 작고 공고도 제각각이라 이 차이를 스킬의 효과라고 단정할 수는 없습니다. 판결의 예측 %는 실제 합격률이 아니라 모의 배심의 추정이니, 무엇을 고칠지 찾는 용도로 써 주세요.

## Install (설치)

Requires Claude Code (logged in) and Python 3.10+.

```
/plugin marketplace add LSH2007-tech/job-hiring-court-KR
/plugin install hiring-court@lsh-skills
```

Then ask Claude Code: `취업재판 웹 열어 줘` (opens the web screen) or `서류 재판 열어 줘` (runs the trial in chat).

Optional, for better PDF/Word reading: `python -m pip install "markitdown[pdf,docx,pptx,xlsx]"`

## How it works (동작 방식)

```
Browser (localhost:8765)  ->  hiring-court/web/server.py  ->  claude -p (your own Claude Code login)
                                        |
                                        +-> hiring-court/skills/hiring-court/scripts/court_tool.py
                                            (text extraction, counting, job-match bands, vote tally)
```

- Everything runs on your machine with your own Claude subscription. There is no hosted server and no API key.
- Judgement is done by Claude; counting and checks are done by `court_tool.py` (no model arithmetic).
- The prompts and scoring rules are written in Korean on purpose: the tool targets Korean hiring documents.

## Repository layout

| Path | What |
|---|---|
| `hiring-court/skills/hiring-court/` | The trial skill (`SKILL.md`) and its tool (`scripts/court_tool.py`) |
| `hiring-court/skills/court-web/` | Skill that launches the local web screen |
| `hiring-court/web/` | Local web app (stdlib Python server + static front-end) |
| `docs/` | GitHub Pages intro and install page |

## Credits and licenses (저작권과 출처)

- **court-skill** by Alex Chen, MIT License: https://github.com/alexyc9381/court-skill
  The trial structure (two-sided debate, independent jury vote, verdict and record, "counting is done by code") is adapted from it for Korean job applications. Its full MIT notice is in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
  재판 구조(공방, 독립 배심 투표, 판결과 기록, 표는 코드가 센다)는 Alex Chen의 court-skill(MIT)을 바탕으로 한국 취업 서류에 맞게 다시 만들었습니다. 원작 저작권 고지 전문은 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)에 있습니다.
- Optional libraries installed by the user: [markitdown](https://github.com/microsoft/markitdown) (MIT, Microsoft), [pypdf](https://github.com/py-pdf/pypdf) (BSD-3-Clause).
- License of this project itself: not chosen yet (이 프로젝트 자체의 라이선스는 아직 정하지 않았습니다).
