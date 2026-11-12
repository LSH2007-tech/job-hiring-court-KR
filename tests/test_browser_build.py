"""The no-install browser app in docs/app/ must match the sources in hiring-court/web/."""
import hashlib
import json
import os
import re
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WEB = os.path.join(ROOT, "hiring-court", "web")
APP = os.path.join(ROOT, "docs", "app")
SDK = "anthropic-sdk-0.137.0.js"
SDK_SHA256 = "9f03e3535ee3a870cb6a38dc893e81503553b0043bf0bb787c73266e6b43ffb2"
JSZIP_SRI = "sha512-XMVd28F1oH/O71fzwBnV7HucLxVwtxf26XV8P4wPk26EDxuGZ91N8bsOttmnomcCD3CS5ZMRL50H0GgOHvegtg=="
PAIRS = [("browser.html", "index.html"), ("static/app.js", "app.js"), ("static/engine.js", "engine.js"), ("static/style.css", "style.css"),
         ("static/vendor/" + SDK, "vendor/" + SDK)]


class TestBrowserBuild(unittest.TestCase):
    def test_docs_app_is_up_to_date(self):
        for src, dst in PAIRS:
            a, b = os.path.join(WEB, src), os.path.join(APP, dst)
            self.assertTrue(os.path.isfile(b), "%s missing: run python hiring-court/web/build_browser.py" % dst)
            with open(a, "rb") as fa, open(b, "rb") as fb:
                same = fa.read().replace(b"\r\n", b"\n") == fb.read().replace(b"\r\n", b"\n")
            self.assertTrue(same, "%s is stale: run python hiring-court/web/build_browser.py" % dst)

    def test_engine_loads_nothing_from_other_hosts(self):
        # The rules and the SDK ship with the app. A branch URL or a CDN here would let the published app change
        # (or break) without a release, and would let a third party alter the code that handles the user's API key.
        with open(os.path.join(WEB, "static", "engine.js"), encoding="utf-8") as f:
            src = f.read()
        for bad in ("raw.githubusercontent.com", "cdn.jsdelivr.net", "unpkg.com", "esm.sh", "cdnjs.cloudflare.com"):
            self.assertNotIn(bad, src)
        self.assertIn("vendor/" + SDK, src)
        self.assertEqual(re.findall(r"\bimport\(([^)]*)\)", src), ["SDK_URL"])

    def test_vendored_sdk_is_the_reviewed_file(self):
        with open(os.path.join(WEB, "static", "vendor", SDK), "rb") as f:
            data = f.read().replace(b"\r\n", b"\n")
        self.assertEqual(hashlib.sha256(data).hexdigest(), SDK_SHA256)
        self.assertEqual(re.findall(rb"\bfrom\s*[\"']https?://|\bimport\s*\(\s*[\"']https?://", data), [])  # self-contained

    def test_every_cdn_script_is_pinned_with_integrity(self):
        for page in (os.path.join(WEB, "browser.html"), os.path.join(WEB, "static", "index.html"), os.path.join(ROOT, "docs", "index.html")):
            with open(page, encoding="utf-8") as f:
                html = f.read()
            for tag in re.findall(r"<script\b[^>]*\bsrc=[\"']https?://[^>]*>", html):
                self.assertIn("integrity=\"sha", tag, page)
                self.assertIn("crossorigin=\"anonymous\"", tag, page)
                self.assertRegex(tag, r"/\d+\.\d+\.\d+/", page)  # an exact version, not "latest"
        with open(os.path.join(WEB, "browser.html"), encoding="utf-8") as f:
            self.assertIn(JSZIP_SRI, f.read())

    def test_rules_shipped_with_the_app_match_skill_md(self):
        # The browser app reads the rules from docs/app/skill.json. It must be the current SKILL.md, word for word.
        with open(os.path.join(ROOT, "hiring-court", "skills", "hiring-court", "SKILL.md"), encoding="utf-8-sig") as f:
            skill = f.read().replace("\r\n", "\n")
        path = os.path.join(APP, "skill.json")
        self.assertTrue(os.path.isfile(path), "skill.json missing: run python hiring-court/web/build_browser.py")
        with open(path, encoding="utf-8") as f:
            self.assertEqual(json.load(f)["skill"], skill, "skill.json is stale: run python hiring-court/web/build_browser.py")
        # A .md file with front matter would be turned into HTML by GitHub Pages and the app would get a 404.
        self.assertFalse(os.path.exists(os.path.join(APP, "SKILL.md")))


class TestReadmeLanguages(unittest.TestCase):
    """Every README comes in Korean and English. They must link to each other and name the same version."""
    # The public root READMEs live in publish/ in the development repo and at the root of the published repo.
    HOME = "publish" if os.path.isfile(os.path.join(ROOT, "publish", "README.ko.md")) else "."
    PAIRS = [(HOME + "/README.md", HOME + "/README.ko.md"), ("hiring-court/README.en.md", "hiring-court/README.md")]

    def test_both_languages_exist_and_link_to_each_other(self):
        for en, ko in self.PAIRS:
            with open(os.path.join(ROOT, en), encoding="utf-8") as f:
                en_text = f.read()
            with open(os.path.join(ROOT, ko), encoding="utf-8") as f:
                ko_text = f.read()
            self.assertTrue(en_text.startswith("[KR](%s) | **EN**" % os.path.basename(ko)), en)
            self.assertTrue(ko_text.startswith("**KR** | [EN](%s)" % os.path.basename(en)), ko)

    def test_both_languages_name_the_plugin_version(self):
        with open(os.path.join(ROOT, "hiring-court", ".claude-plugin", "plugin.json"), encoding="utf-8") as f:
            version = "v" + json.load(f)["version"]
        for pair in self.PAIRS:
            for path in pair:
                with open(os.path.join(ROOT, path), encoding="utf-8") as f:
                    self.assertIn(version, f.read(), "%s does not mention %s" % (path, version))


if __name__ == "__main__":
    unittest.main()
