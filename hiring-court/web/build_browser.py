#!/usr/bin/env python3
"""Build the no-install browser app into docs/app/ (served by GitHub Pages).

The browser app reuses the local app's screen (static/app.js, static/style.css) and adds
static/engine.js, which calls the Claude API with the user's own key instead of server.py.
Run this after changing anything in hiring-court/web/static/ or browser.html:

    python hiring-court/web/build_browser.py

tests/test_browser_build.py fails if docs/app/ is out of date.
"""
import os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(os.path.dirname(HERE)), "docs", "app")
# The trial rules and the SDK are copied in too, so the published app never loads them from another host:
# the rules always match the engine of the same commit, and no CDN can change the code that handles the API key.
FILES = [("browser.html", "index.html"), ("static/app.js", "app.js"), ("static/engine.js", "engine.js"), ("static/style.css", "style.css"),
         ("../skills/hiring-court/SKILL.md", "SKILL.md"), ("static/vendor/anthropic-sdk-0.137.0.js", "vendor/anthropic-sdk-0.137.0.js")]


def build():
    os.makedirs(OUT, exist_ok=True)
    for src, dst in FILES:
        os.makedirs(os.path.dirname(os.path.join(OUT, dst)), exist_ok=True)
        with open(os.path.join(HERE, src), "rb") as f:
            data = f.read().replace(b"\r\n", b"\n")  # same bytes on Windows and Linux checkouts
        with open(os.path.join(OUT, dst), "wb") as f:
            f.write(data)
    # GitHub Pages runs Jekyll by default, and Jekyll would rewrite SKILL.md (it has front matter). Serve files as they are.
    open(os.path.join(os.path.dirname(OUT), ".nojekyll"), "a").close()
    return [os.path.join(OUT, d) for _, d in FILES]


if __name__ == "__main__":
    for p in build():
        print("built", p)
