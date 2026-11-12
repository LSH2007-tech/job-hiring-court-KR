# vendor

Third-party code kept in the repository so the browser app does not run scripts fetched from a CDN at run time.

| File | What | License |
|---|---|---|
| `anthropic-sdk-0.137.0.js` | Anthropic TypeScript SDK 0.137.0 (`@anthropic-ai/sdk`) with its dependencies, bundled into one ES module | MIT (bundled: `@opentelemetry/api` Apache-2.0, `standardwebhooks` MIT, `@stablelib/base64` MIT, `fast-sha256` Unlicense) |

How the file was made (run in an empty folder):

```
npm install @anthropic-ai/sdk@0.137.0 esbuild@0.25.10
echo "export { default, Anthropic } from '@anthropic-ai/sdk';" > entry.mjs
npx esbuild entry.mjs --bundle --format=esm --platform=browser --target=es2020 --minify --legal-comments=eof --outfile=anthropic-sdk-0.137.0.js
```

`tests/test_browser_build.py` holds the SHA-256 of this file. To update the SDK, rebuild, replace the file and the
hash, change the file name in `static/engine.js`, and run `python hiring-court/web/build_browser.py`.
