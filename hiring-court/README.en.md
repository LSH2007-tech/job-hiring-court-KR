[KR](README.md) | **EN**

# Hiring Court (hiring-court · 취업 재판)

A Claude skill that puts a Korean cover letter (자기소개서) through a **mock trial**: several AI roles argue for and against it, vote independently, and return a **prediction of whether it passes the paper screen plus a ruling on what to fix**.

> **What this court is for:** it matches the posting's job description (JD) against the applicant's skills, shows which role fits, and helps finish the cover letter for that role so it has a better chance of passing. Hiring today puts heavy weight on how well the JD and the applicant's skills match, so that match is analysed first.

> A single AI reviewer drifts toward what sounds nice. Splitting the roles, and hiding each juror's vote from the others, is what reduces that drift.

The trial rules and prompts are written in Korean on purpose, because the skill judges Korean hiring documents. This page explains the skill in English.

## Install (Claude Code)

```
/plugin install hiring-court --marketplace LSH2007-tech/job-hiring-court-KR
```

Or in two steps:

```
/plugin marketplace add LSH2007-tech/job-hiring-court-KR
/plugin install hiring-court@lsh-skills
```

Then say `취업 재판 시작` ("start the hiring trial") to open the web screen, or `서류 재판 열어 줘` ("open a document trial") to run the trial in chat.

## The court

| Role | What it does |
|---|---|
| **Prosecutor** (검사, shown as "rejection member") | Looks for reasons to reject and attacks |
| **Defender** (변호인, shown as "acceptance member") | Defends with reasons to accept |
| **Three jurors** | HR manager (Sonnet), executive (Opus) and hiring manager (Sonnet) each vote without seeing the others' votes |
| **Judge and clerk** | Tally the vote, give the verdict, and write the revision or interview-preparation material |
| **Competitor witness** (optional) | Compares the applicant with a typical competing applicant and gives a "stand-alone %" and an "in the pool %". Not counted in the vote |

The viewpoints of the executive and the hiring manager are built from **material by people who work there, found on the web** (interviews with team leads, tech talks, employee reviews, company news), and the sources are kept in the record.

## Steps

0. **Intake**: collect career and experience data from Notion or from evidence files (resume, career description, earlier cover letters), check who the posting is for (new graduate or experienced, and so on), and build the **job-match table**
1. **Case record**: company, posting text, cover letter and career summary in one place
2. **Debate**: opening statements from the prosecutor and the defender (up to 800 characters each), rebuttals (up to 400 characters), then the key issue
3. **Jury vote**: the three jurors vote at the same time, independently
4. **Verdict**: pass / fail / hold (borderline), with a paper-screen pass prediction in %
5. **Output**: before submitting, a **revised cover letter**; after submitting, **expected interview questions and prepared answers**

### Modes

- **Document trial (before submitting)**: verdict, then a revised cover letter
- **Interview-preparation trial (after submitting)**: verdict, then interview answers (the submitted text is not changed)

## What is judged

- **Priority 0: fit to the job description.** "Is this the person the company is looking for?" comes first. An earlier version that looked at writing quality first kept predicting the opposite of the real results, so the order was changed.
- **Priority 1: storytelling.** Does it get read by a screener who reads hundreds of letters a day? The first sentence, a concrete scene, tension, and a change shown in numbers.
- Then: positioning, structure (conclusion first, subheadings), a STAR skeleton, facts and sources, style and length

### Verdict rules

- Paper-screen prediction % = **mean of the HR and hiring-manager jurors** (the executive's score is recorded separately as "executive view" and is not part of the prediction)
- **55% or more: pass**, **45% or less: fail**, in between: **hold (borderline)**
- The interview prediction is the mean of all three jurors, and the interview ruling is their majority vote

## The counting tool: `scripts/court_tool.py`

**The model judges, the code counts.** Every number and every format check goes through this tool.

| Command | What it does |
|---|---|
| `extract` | Pulls text out of PDF, Word, PowerPoint, Excel, hwpx, HTML and text files |
| `guard` | Cleans the posting (removes hidden text and prompt-injection lines) |
| `count` | Character count / word count |
| `match` | Job-match level (high / medium / low) and the reference range |
| `check` / `tally` | Format check of the juror files, and the tally |
| `row` | Builds one line of the prediction log |
| `brier` | Accuracy against real results (Brier score) |

Reference range by job-match level: **high 45~80% · medium 20~50% · low 5~25%**

## Usage cost

By default the skill uses **4** sub-agent calls (1 debate + 3 jurors). Re-run rules can raise that to 7~8, and each witness adds one (5 by default with the competitor witness).

**Token use of the web screen (measured once, 2026-11-14):** one trial (posting analysis, case record, debate, 3 jurors, verdict, recommended draft) called Claude 10 times. Opus 5.5 used about 95k output and 2.5M input tokens (mostly cache reads); Sonnet 5.5 about 3.5k output and 250k input tokens. On the Pro plan (Opus 5.5, high effort) that was about 20-30% of the 5-hour usage limit. First-time users should check their remaining usage before starting. Longer cover letters and retrials use more.

## Record store (Notion)

The court setup, prediction log, misjudgement analysis, per-company reference material and interview preparation are saved under a Notion page named `서류재판 기록` ("document trial records"). The same record continues whether the trial is opened in claude.ai or in Claude Code. When Notion cannot be written to, the records go to claude.ai project documents or to the working folder.

## Tool exit codes

`0` OK · `1` a check found something (format error, attention needed) · `2` input problem (file, option) · `3` internal tool error. Errors are printed as one line, not as a traceback.

## Files

```
hiring-court/
├── .claude-plugin/plugin.json   ← plugin manifest (v1.6.6)
└── skills/hiring-court/
    ├── SKILL.md                 ← the skill itself (the whole trial procedure and criteria, in Korean)
    └── scripts/court_tool.py    ← counting and checking tool (v1.3.4)
```

## Versions

- Plugin v1.6.6
- Skill edition 2026-11-13 (V15.2)
- Counting tool 1.3.4
- Change history: [CHANGELOG.md](CHANGELOG.md) (Korean)

## Requirements

- Python 3.10 or later
- Text extraction (recommended): `python -m pip install "markitdown[pdf,docx,pptx,xlsx]"`. It converts PDF, Word, PowerPoint and Excel to Markdown that keeps headings and tables. Without it, PDF falls back to `pypdf` (`python -m pip install pypdf`), and Word and hwpx use a built-in parser. PowerPoint and Excel need markitdown.

## Web screen (v1.6.6)

The `취업재판-시작` skill starts a local web screen on this PC (say `취업 재판 시작` to Claude Code). The server is `web/server.py`, and it prints its address when it starts: `http://localhost:8765/?k=<key>`. The screen walks through every step, from posting intake to verdict, advice and saving the record. To open it outside Claude Code, run `web/run.bat`.

- Judgement is done by the Claude Code logged in on this PC (`claude -p`), so it runs on the user's subscription. There is no hosted server and no API key.
- Applicant records: evidence files (resume, career description, earlier cover letters) or Notion (read-only). Notion must be registered in Claude Code under the name `notion` and logged in once.
- The posting is taken as a screenshot, a file (PDF, Word, hwpx) or pasted text. Links are not accepted, because most job sites do not return the posting body from a link alone. Use Ctrl+P and "Save as PDF" on the posting page and upload that file.
- Each step shows what Claude is doing now (the file it reads or writes) and the elapsed time.
- v1.6.3 and v1.6.6 were security updates.
- User data is kept outside the plugin folder (`~/.hiring-court/`; the default save folder is `Documents/취업재판`).
- Not available yet: interview-preparation mode, competitor witness, prediction log.
