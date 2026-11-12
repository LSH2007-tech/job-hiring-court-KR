"""The no-install browser app in docs/app/ must match the sources in hiring-court/web/."""
import filecmp
import os
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WEB = os.path.join(ROOT, "hiring-court", "web")
APP = os.path.join(ROOT, "docs", "app")
PAIRS = [("browser.html", "index.html"), ("static/app.js", "app.js"), ("static/engine.js", "engine.js"), ("static/style.css", "style.css")]


class TestBrowserBuild(unittest.TestCase):
    def test_docs_app_is_up_to_date(self):
        for src, dst in PAIRS:
            a, b = os.path.join(WEB, src), os.path.join(APP, dst)
            self.assertTrue(os.path.isfile(b), "%s missing: run python hiring-court/web/build_browser.py" % dst)
            with open(a, "rb") as fa, open(b, "rb") as fb:
                same = fa.read().replace(b"\r\n", b"\n") == fb.read().replace(b"\r\n", b"\n")
            self.assertTrue(same, "%s is stale: run python hiring-court/web/build_browser.py" % dst)

    def test_skill_url_points_at_the_public_repo(self):
        with open(os.path.join(WEB, "static", "engine.js"), encoding="utf-8") as f:
            self.assertIn("raw.githubusercontent.com/LSH2007-tech/job-hiring-court-KR/main/hiring-court/skills/hiring-court/SKILL.md", f.read())


if __name__ == "__main__":
    unittest.main()
