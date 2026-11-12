"""Tests for the local web app server (hiring-court/web/server.py). No Claude calls are made."""
import http.client
import json
import urllib.parse
import os
import sys
import tempfile
import threading
import time
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.environ["HIRING_COURT_HOME"] = tempfile.mkdtemp()  # keep test data out of the user's folders
sys.path.insert(0, os.path.join(ROOT, "hiring-court", "web"))
import server  # noqa: E402

# The prompt sections server.py slices out of SKILL.md. If SKILL.md is edited and one of these
# headings disappears, the web app would fail at run time; this test catches it first.
ANCHORS = [
    ("**직무 일치표 (서기가 직접", "**오탈자와 비문 점검"),
    ("### 배심원과 관점 후보", "## 4단계"),
    ("## 2단계", "## 3단계"),
    ("## 3단계", "### 배심원과 관점 후보"),
    ("**배심원마다 읽는 자료와 질문이 다르다", "**기준 구간은 임원진"),
    ("**서류 재판 판결문**", "**면접 대비 재판 판결문:**"),
    ("### 4-2. 조언", "### 4-3. 수정본"),
    ("### 0순위: 이 회사에 필요한 사람인가", "### 2. 포지셔닝"),
    ("### 4-3. 수정본", "### 4-4."),
    ("## 자소서 작성 기준", "## 모드"),
]


class TestPromptSources(unittest.TestCase):
    def test_skill_and_tool_are_found(self):
        self.assertTrue(os.path.isfile(server.SKILL_MD))
        self.assertTrue(os.path.isfile(server.TOOL))

    def test_every_prompt_section_exists(self):
        for start, end in ANCHORS:
            self.assertGreater(len(server.between(start, end)), 100, start)

    def test_prompt_templates_exist(self):
        self.assertIn("공방", server.codeblock(server.between("## 2단계", "## 3단계")))
        self.assertIn("배심원 <n>번", server.codeblock(server.between("## 3단계", "### 배심원과 관점 후보"), "배심원 <n>번"))


class TestHelpers(unittest.TestCase):
    def test_number_paragraphs(self):
        self.assertEqual(server.number_paragraphs(2, "첫 문단\n\n둘째 문단"), "(2-1) 첫 문단\n\n(2-2) 둘째 문단")

    def test_safe_name_strips_paths(self):
        self.assertEqual(server.safe_name("../../etc/passwd"), "passwd")
        self.assertEqual(server.safe_name('a<b>c?.pdf'), "a_b_c_.pdf")

    def test_parse_debate_builds_chat(self):
        md = ("## 검사 모두진술 (최대 800자)\n첫 말풍선\n\n둘째 말풍선\n\n## 변호인 모두진술 (최대 800자)\n변론\n\n"
              "## 검사 반박 (최대 400자)\n반박\n\n## 변호인 반박 (최대 400자)\n재반박\n\n## 핵심 쟁점\n- 쟁점 하나\n")
        msgs = server.parse_debate(md, {"company": "예시", "job": "직무"})
        sides = [m["t"] for m in msgs if m["t"] in ("L", "R")]
        self.assertEqual(sides, ["L", "L", "R", "L", "R"])
        self.assertEqual(msgs[-1]["items"], ["쟁점 하나"])
        self.assertIn("/ 800자", [m for m in msgs if m["t"] == "L"][1]["meta"])


class TestHttp(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.srv = server.ThreadingHTTPServer(("127.0.0.1", 0), server.H)
        cls.port = cls.srv.server_address[1]
        threading.Thread(target=cls.srv.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.srv.shutdown()

    def req(self, method, path, body=None, raw=None):
        c = http.client.HTTPConnection("127.0.0.1", self.port, timeout=30)
        data = raw if raw is not None else (json.dumps(body).encode("utf-8") if body is not None else None)
        c.request(method, path, body=data, headers={"Content-Type": "application/json"} if raw is None else {})
        r = c.getresponse()
        return r.status, r.read()

    def test_index_and_static_files(self):
        for path in ("/", "/app.js", "/style.css"):
            status, _ = self.req("GET", path)
            self.assertEqual(status, 200, path)
        self.assertEqual(self.req("GET", "/../server.py")[0], 404)

    def test_settings(self):
        status, body = self.req("GET", "/api/settings")
        self.assertEqual(status, 200)
        self.assertTrue(json.loads(body)["skill"])

    def test_trial_flow_without_claude(self):
        status, body = self.req("POST", "/api/trial")
        self.assertEqual(status, 200)
        tid = json.loads(body)["id"]
        resume = ("경력: 예시 회사 설비 엔지니어 3년. 장비 셋업과 고장 분석을 맡았다. " * 20).encode("utf-8")
        status, body = self.req("POST", "/api/trial/%s/upload?kind=evidence&name=resume.txt" % tid, raw=resume)
        t = json.loads(body)
        self.assertEqual(status, 200)
        self.assertEqual(t["evidence"][0]["kind"], "이력서")
        self.assertTrue(t["evidence"][0]["ok"])
        status, body = self.req("POST", "/api/trial/%s/evidence/kind" % tid, {"n": 1, "kind": "경력기술서"})
        self.assertEqual(json.loads(body)["evidence"][0]["kind"], "경력기술서")
        # Steps are locked until the previous one is done.
        self.assertEqual(self.req("POST", "/api/trial/%s/jd/confirm" % tid, {})[0], 409)
        self.assertEqual(self.req("POST", "/api/trial/%s/vote" % tid, {})[0], 409)
        self.assertEqual(self.req("GET", "/api/trial/%s/file?name=%s" % (tid, urllib.parse.quote("판결문.md")))[0], 404)
        self.assertEqual(self.req("GET", "/api/trial/nope")[0], 404)

    def test_posting_by_link_is_refused(self):
        # Postings come in as a screenshot, a file or pasted text. A link is refused before any Claude call.
        tid = json.loads(self.req("POST", "/api/trial")[1])["id"]
        self.assertEqual(self.req("POST", "/api/trial/%s/jd" % tid, {"mode": "link", "url": "https://example.com"})[0], 200)
        for _ in range(50):
            jd = json.loads(self.req("GET", "/api/trial/%s" % tid)[1])["jd"]
            if jd["status"] != "running":
                break
            time.sleep(0.1)
        self.assertEqual((jd["status"], jd["code"]), ("error", "mode"))
        self.assertEqual(jd["rows"][0]["st"], "error")


class TestClaudeProgress(unittest.TestCase):
    def test_tool_calls_become_progress_lines(self):
        self.assertEqual(server.describe("Read", {"file_path": "C:\\work\\공고_원문_정리.md"}), "공고_원문_정리.md 읽는 중")
        self.assertEqual(server.describe("Write", {"file_path": "/tmp/x/직무일치표.md"}), "직무일치표.md 쓰는 중")
        self.assertIn("웹에서 찾는 중", server.describe("WebSearch", {"query": "회사 과제"}))
        self.assertEqual(server.describe("Other", None), "")


if __name__ == "__main__":
    unittest.main()
