**KR** | [EN](README.md)

# 취업재판 · job hiring court (KR)

[![tests](https://github.com/LSH2007-tech/job-hiring-court-KR/actions/workflows/tests.yml/badge.svg)](https://github.com/LSH2007-tech/job-hiring-court-KR/actions/workflows/tests.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**내 자소서를 법정에 세워 보자.** 취업재판은 자기소개서를 채용 공고에 맞대어 채용 위원회처럼 따집니다. 탈락 위원과 합격 위원이 공방을 벌이고, 배심원 세 명(인사, 임원, 실무)이 서로의 표를 보지 못한 채 투표하고, 판사가 판결과 구체적인 수정 조언을 내립니다.

> **v1.6.3:** 보안 사항을 업데이트하였습니다.

> **계속 고치는 중입니다.** 실제 지원 결과를 보며 규칙, 화면, 점수 계산을 계속 고치고 있어 버전마다 달라질 수 있습니다. 현재 플러그인 버전: v1.6.4.

- **브라우저에서 바로 써 보기(설치 없음):** https://lsh2007-tech.github.io/job-hiring-court-KR/app/
- **소개와 설치 안내:** https://lsh2007-tech.github.io/job-hiring-court-KR/
- **스킬 설명:** [hiring-court/README.md](hiring-court/README.md)

## 쓰는 방법 두 가지

| | 브라우저 앱 | Claude Code 플러그인 |
|---|---|---|
| 설치 | 없음. 페이지를 열면 됩니다 | Claude Code(로그인) + Python 3.10 이상 |
| Claude 요금 | 내 **Claude API 키**로, 쓴 만큼 | 내 **Claude 구독** 안에서 |
| 돌아가는 곳 | 브라우저가 Claude API를 직접 부릅니다 | 내 PC의 로컬 서버(`localhost`)가 Claude Code를 부릅니다 |
| 지원자 기록 | 파일 올리기(이력서, 경력기술서, 기존 자소서) | 파일 올리기 또는 **노션** 연동(읽기 전용) |
| 저장 | 재판 기록을 ZIP으로 내려받기 | 내가 고른 폴더에 저장 |

두 방식 모두 운영 서버가 없습니다. 내 문서를 보는 것은 나와 Anthropic뿐입니다.

## 어떻게 돌아가나

```
0단계  공고 접수      캡처 / PDF나 Word / 붙여넣기 -> 공고 정리본, 직무 일치표
1단계  재판부와 사건   공고(와 웹 조사)로 배심원 3명을 세우고 자소서를 접수
2단계  공방          탈락 위원 대 합격 위원, 진술마다 800자 이내
3단계  배심 표결      인사, 임원, 실무가 각자 투표(동시에 호출)
4단계  판결과 조언    서류 예측 = 인사와 실무의 평균, 고칠 점 목록
5단계  전달          판결문, 조언, 수정본, 기록
6단계  재심 또는 제출
```

- **판단은 Claude가, 숫자는 코드가 셉니다.** 글자 수, 직무 일치도(직접 / 전이 / 공백), 표 검사와 집계는 플러그인에서는 `court_tool.py`가, 브라우저에서는 `engine.js`가 계산합니다. 모델이 세지 않습니다.
- **공고가 먼저입니다.** 잘 쓴 글이어도 공고와 맞지 않으면 집니다. 직무 일치도가 배심원이 투표할 수 있는 구간을 정합니다.
- **공고 속 숨은 지시문은 걸러 냅니다.** 배심원에게 가기 전에 뺍니다.
- 프롬프트와 채점 규칙은 일부러 한국어로 썼습니다. 한국 채용 서류를 다루기 때문입니다. 규칙은 [`SKILL.md`](hiring-court/skills/hiring-court/SKILL.md) 한 파일에 있고 두 방식이 같은 규칙을 씁니다.

```
플러그인:  브라우저(localhost:8765) -> web/server.py -> claude -p (내 로그인) -> court_tool.py
브라우저:  docs/app (GitHub Pages)  -> engine.js     -> Claude API (내 키)    -> 같은 규칙
```

## 플러그인 설치

```
/plugin marketplace add LSH2007-tech/job-hiring-court-KR
/plugin install hiring-court@lsh-skills
```

판마다 태그(`v1.6.4` 등)를 붙이고, 바뀐 내용은 [CHANGELOG](hiring-court/CHANGELOG.md)에 적습니다.

설치한 뒤 Claude Code에 `취업 재판 시작`이라고 말하면 웹 화면이 열리고, `서류 재판 열어 줘`라고 말하면 대화 안에서 재판이 진행됩니다.
PDF와 Word를 더 잘 읽으려면(선택): `python -m pip install "markitdown[pdf,docx,pptx,xlsx]"`.

## 개발

```
python -m unittest discover -s tests -v     # court_tool.py, 로컬 서버, 브라우저 빌드
node --test tests/engine.test.js            # 브라우저 엔진
python hiring-court/web/build_browser.py    # hiring-court/web이나 SKILL.md를 고친 뒤 docs/app 다시 만들기
```

CI는 우분투와 윈도우에서 Python 3.10과 3.13으로 두 테스트를 모두 돌립니다. 이슈와 풀 리퀘스트를 환영합니다.

| 경로 | 내용 |
|---|---|
| `hiring-court/skills/hiring-court/` | 재판 규칙(`SKILL.md`)과 계산 도구(`scripts/court_tool.py`) |
| `hiring-court/skills/court-web/` | 로컬 웹 화면을 여는 스킬 |
| `hiring-court/web/` | 로컬 앱: 표준 라이브러리 Python 서버, 공용 화면, 브라우저 엔진 |
| `docs/` | GitHub Pages: 소개 페이지와 브라우저 앱(`docs/app/`, `hiring-court/web/`과 `SKILL.md`에서 만듦) |
| `tests/` | Python과 Node 테스트 |

## 왜 만들었고 어떻게 시험했나

자소서를 Claude 한 명에게 평가받으면 결국 듣기 좋은 방향으로 모입니다. 그래서 서류를 재판에 올렸습니다. 따지는 사람(탈락 위원)과 지키는 사람(합격 위원)을 따로 세우고, 서로의 표를 보지 못하는 배심원 세 명이 각자 다른 질문으로 투표하게 했습니다. 판정에 쓰는 숫자는 모두 코드가 셉니다.

만든 사람이 2026년 하반기에 실제로 지원한 서류로 만들고 고쳤습니다. 결과가 나올 때마다 예측과 맞대어, 틀린 곳의 규칙을 바꿨습니다. 두 가지 예: 글 완성도가 판단을 흐린다는 것이 드러나 공고 적합(직무 일치)을 0순위로 올렸고, 서류 예측을 인사와 실무 배심원의 평균으로 바꿨습니다.

지금까지의 결과(한 사람의 2026년 지원 중 결과가 나온 것, 2026년 11월 기준):

| | 지원 | 서류 합격 | 합격률 |
|---|---|---|---|
| 취업재판을 거쳐 고친 뒤 제출 | 5 | 1 | 20% |
| 재판 없이 제출 | 15 | 1 | 약 7% |

표본이 아주 작고 공고도 서로 달라서, 이 차이가 도구 덕분이라고 말할 수는 없습니다. 판결의 %는 실제 합격률이 아니라, 고칠 곳을 찾기 위한 모의 배심의 추정으로 봐 주세요.

## 라이선스와 출처

- 이 프로젝트: [MIT 라이선스](LICENSE). 누구나 쓰고 고치고 나눌 수 있습니다.
- 재판 구조는 Alex Chen의 **court-skill**(MIT)을 바탕으로 했습니다: https://github.com/alexyc9381/court-skill. 전체 고지는 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)에 있습니다.
- 사용자가 설치하는 선택 라이브러리: [markitdown](https://github.com/microsoft/markitdown)(MIT, Microsoft), [pypdf](https://github.com/py-pdf/pypdf)(BSD-3-Clause). 브라우저 앱에는 [Anthropic TypeScript SDK](https://github.com/anthropics/anthropic-sdk-typescript)(MIT)가 함께 들어 있고, [JSZip](https://github.com/Stuk/jszip)(MIT)은 cdnjs에서 고정 버전과 무결성 해시로 받습니다. 자세한 내용은 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)에 있습니다.
