# Third-party notices (제3자 저작권 고지)

## court-skill (MIT)

The trial structure of this project (a debate between two sides, an independent jury vote, a verdict and a written record, and the principle that "counting is done by code, not by the model") is adapted from **court-skill** by Alex Chen.

이 프로젝트의 재판 구조(양측 공방, 서로의 표를 보지 않는 배심 투표, 판결과 기록, "표를 세는 것은 모델이 아니라 코드" 원칙)는 Alex Chen의 **court-skill**을 바탕으로 한국 취업 서류 심사에 맞게 다시 만든 것입니다.

- Source: https://github.com/alexyc9381/court-skill
- License: MIT

```
MIT License

Copyright (c) 2026 Alex Chen (@nocodealex, https://chen.media)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Optional dependencies (선택 의존성, 이 저장소에 포함하지 않음)

These are installed by the user with pip and are not redistributed here.

| Package | Use | License |
|---|---|---|
| [markitdown](https://github.com/microsoft/markitdown) (Microsoft) | PDF, Word, PowerPoint, Excel to Markdown | MIT |
| [pypdf](https://github.com/py-pdf/pypdf) | PDF text fallback | BSD-3-Clause |

## Services used at run time (실행할 때 쓰는 서비스)

- Claude Code (Anthropic): runs the trial on the user's own login. Governed by Anthropic's terms.
- Notion MCP (optional, read-only): reads the user's own Notion workspace. Governed by Notion's terms.
