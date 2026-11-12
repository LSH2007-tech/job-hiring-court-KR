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

## Bundled in this repository (이 저장소에 포함된 코드)

`hiring-court/web/static/vendor/anthropic-sdk-0.137.0.js` (copied to `docs/app/vendor/`) is a single-file build of the
packages below, made with esbuild. It is used only by the browser app. The build command is in
`hiring-court/web/static/vendor/README.md`. License comments from the packages are kept at the end of the file.

| Package | Version | License | Source |
|---|---|---|---|
| @anthropic-ai/sdk (Anthropic TypeScript SDK) | 0.137.0 | MIT | https://github.com/anthropics/anthropic-sdk-typescript |
| @opentelemetry/api | 1.10.0 | Apache-2.0 | https://github.com/open-telemetry/opentelemetry-js |
| standardwebhooks | 1.1.1 | MIT | https://github.com/standard-webhooks/standard-webhooks |
| @stablelib/base64 | 1.0.1 | MIT | https://github.com/StableLib/stablelib |
| fast-sha256 | 1.3.0 | Unlicense | https://github.com/dchest/fast-sha256-js |

Each package's full license text is in its source repository (Apache-2.0: https://www.apache.org/licenses/LICENSE-2.0).

## Loaded from a CDN by the browser app (브라우저 앱이 CDN에서 받는 것)

| Package | Version | License | How |
|---|---|---|---|
| [JSZip](https://github.com/Stuk/jszip) | 3.10.1 | MIT (dual MIT / GPLv3) | cdnjs, fixed version, Subresource Integrity hash |

## Optional dependencies (선택 의존성, 이 저장소에 포함하지 않음)

These are installed by the user with pip and are not redistributed here.

| Package | Use | License |
|---|---|---|
| [markitdown](https://github.com/microsoft/markitdown) (Microsoft) | PDF, Word, PowerPoint, Excel to Markdown | MIT |
| [pypdf](https://github.com/py-pdf/pypdf) | PDF text fallback | BSD-3-Clause |

## Services used at run time (실행할 때 쓰는 서비스)

- Claude Code (Anthropic): runs the trial on the user's own login. Governed by Anthropic's terms.
- Claude API (Anthropic): the browser app calls it with the user's own API key. Governed by Anthropic's terms.
- Notion MCP (optional, read-only): reads the user's own Notion workspace. Governed by Notion's terms.
