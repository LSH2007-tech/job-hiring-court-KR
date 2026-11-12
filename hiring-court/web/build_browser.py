#!/usr/bin/env python3
"""Build the no-install browser app into docs/app/ (served by GitHub Pages).

The browser app reuses the local app's screen (static/app.js, static/style.css) and adds
static/engine.js, which calls the Claude API with the user's own key instead of server.py.
Run this after changing anything in hiring-court/web/static/ or browser.html:

    python hiring-court/web/build_browser.py

tests/test_browser_build.py fails if docs/app/ is out of date.
"""
import os
import shutil

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(os.path.dirname(HERE)), "docs", "app")
FILES = [("browser.html", "index.html"), ("static/app.js", "app.js"), ("static/engine.js", "engine.js"), ("static/style.css", "style.css")]


def build():
    os.makedirs(OUT, exist_ok=True)
    for src, dst in FILES:
        shutil.copyfile(os.path.join(HERE, src), os.path.join(OUT, dst))
    return [os.path.join(OUT, d) for _, d in FILES]


if __name__ == "__main__":
    for p in build():
        print("built", p)
