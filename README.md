[KR](README.ko.md) | **EN**

# job hiring court (KR) · 취업재판

[![tests](https://github.com/LSH2007-tech/job-hiring-court-KR/actions/workflows/tests.yml/badge.svg)](https://github.com/LSH2007-tech/job-hiring-court-KR/actions/workflows/tests.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**Put your Korean job application on trial.** job hiring court checks a 자기소개서 (Korean cover letter) against a job posting the way a hiring committee would: a prosecutor and a defender argue, three jurors (HR, executive, hiring manager) vote without seeing each other's votes, and a judge returns a verdict with concrete revision advice.

> **v1.6.3:** Security update.

> **Work in progress.** The rules, screens and scoring are still being tuned against real application results and may change between versions. Current plugin version: v1.6.4.

- **Try it in the browser (no install):** https://lsh2007-tech.github.io/job-hiring-court-KR/app/
- **Intro and install guide:** https://lsh2007-tech.github.io/job-hiring-court-KR/
- **About the skill:** [hiring-court/README.en.md](hiring-court/README.en.md)

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
Step 0  Posting intake   screenshot / PDF or Word / paste -> cleaned posting, job-match table
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

Each release is tagged (`v1.6.4`, ...), and what changed is in [CHANGELOG](hiring-court/CHANGELOG.md).

Then say `취업 재판 시작` to Claude Code (opens the web screen), or `서류 재판 열어 줘` to run the trial in chat.
Optional, for better PDF/Word reading: `python -m pip install "markitdown[pdf,docx,pptx,xlsx]"`.

## Development

```
python -m unittest discover -s tests -v     # court_tool.py, local server, browser build
node --test tests/engine.test.js            # browser engine logic
python hiring-court/web/build_browser.py    # rebuild docs/app after changing hiring-court/web or SKILL.md
```

CI runs both suites on Ubuntu and Windows with Python 3.10 and 3.13. Issues and pull requests are welcome.

| Path | What |
|---|---|
| `hiring-court/skills/hiring-court/` | The trial rules (`SKILL.md`) and the counting tool (`scripts/court_tool.py`) |
| `hiring-court/skills/court-web/` | Skill that launches the local web screen |
| `hiring-court/web/` | Local app: stdlib Python server, shared front-end, browser engine |
| `docs/` | GitHub Pages: intro page and the browser app (`docs/app/`, built from `hiring-court/web/` and `SKILL.md`) |
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
- Optional libraries installed by the user: [markitdown](https://github.com/microsoft/markitdown) (MIT, Microsoft), [pypdf](https://github.com/py-pdf/pypdf) (BSD-3-Clause). The browser app ships a bundled copy of the [Anthropic TypeScript SDK](https://github.com/anthropics/anthropic-sdk-typescript) (MIT) and loads [JSZip](https://github.com/Stuk/jszip) (MIT) from cdnjs at a fixed version with an integrity hash. Details are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
