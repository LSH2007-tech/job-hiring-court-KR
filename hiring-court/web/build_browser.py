#!/usr/bin/env python3
"""Build the no-install browser app into docs/app/ (served by GitHub Pages).

The browser app reuses the local app's screen (static/app.js, static/style.css) and adds
static/engine.js, which calls the Claude API with the user's own key instead of server.py.
Run this after changing anything in hiring-court/web/static/ or browser.html:

    python hiring-court/web/build_browser.py

tests/test_browser_build.py fails if docs/app/ is out of date.
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(os.path.dirname(HERE)), "docs", "app")
# The trial rules and the SDK are copied in too, so the published app never loads them from another host:
# the rules always match the engine of the same commit, and no CDN can change the code that handles the API key.
FILES = [("browser.html", "index.html"), ("static/app.js", "app.js"), ("static/engine.js", "engine.js"), ("static/style.css", "style.css"),
         ("static/vendor/anthropic-sdk-0.137.0.js", "vendor/anthropic-sdk-0.137.0.js")]
SKILL = "../skills/hiring-court/SKILL.md"


def build():
    os.makedirs(OUT, exist_ok=True)
    for src, dst in FILES:
        os.makedirs(os.path.dirname(os.path.join(OUT, dst)), exist_ok=True)
        with open(os.path.join(HERE, src), "rb") as f:
            data = f.read().replace(b"\r\n", b"\n")  # same bytes on Windows and Linux checkouts
        with open(os.path.join(OUT, dst), "wb") as f:
            f.write(data)
    # The rules go in as JSON, not as SKILL.md: GitHub Pages (Jekyll) turns a .md file with front matter into HTML.
    with open(os.path.join(HERE, SKILL), encoding="utf-8-sig") as f:
        skill = f.read().replace("\r\n", "\n")
    with open(os.path.join(OUT, "skill.json"), "w", encoding="utf-8", newline="\n") as f:
        json.dump({"skill": skill}, f, ensure_ascii=False)
    return [os.path.join(OUT, d) for _, d in FILES] + [os.path.join(OUT, "skill.json")]


if __name__ == "__main__":
    for p in build():
        print("built", p)
