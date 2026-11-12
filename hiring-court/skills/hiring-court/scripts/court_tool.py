#!/usr/bin/env python3
"""취업-재판 도구: 판단은 모델이, 세기와 검사는 이 코드가 한다.

  python3 재판도구.py extract <파일> [--out 텍스트파일]     PDF, Word, PowerPoint, Excel(markitdown 우선), 한글(hwpx), HTML, 텍스트에서 글자 뽑기
  python3 재판도구.py guard <공고파일> [--out 정리본]       공고문 정리: 숨은 글, 보이지 않는 문자, 지시문 형태 줄
  python3 재판도구.py count <파일> [--limit N] [--words]  섹션별 글자 수(공백 포함, '#' 제목 줄 제외), 영문은 --words
  python3 재판도구.py match <직무일치표.md>              직무 일치도와 기준 구간
  python3 재판도구.py check <배심파일> --role 인사|임원|실무|참조인|경쟁 --mode 서류|면접 [--band 45-80] [--pre]
  python3 재판도구.py tally <재판폴더> --mode 서류|면접 [--band 45-80] [--pre]   (참조인_경쟁.md가 있으면 따로 보고)
  python3 재판도구.py row <재판폴더> --date D --case "회사, 직무" --stage 서류|면접 --match 높음 [--post] [--retrial N]
  python3 재판도구.py migrate <예측기록.md>             옛 머리글을 새 머리글로(숫자는 그대로)
  python3 재판도구.py brier <예측기록.md> [--stage 서류|면접] [--force]

종료 코드: 0 정상, 1 검사에서 걸린 것 있음(extract 글자 부족, guard 주의, check/tally 오류), 2 입력 문제(파일, 옵션), 3 도구 내부 오류
"""
import json, os, re, sys, statistics, unicodedata, zipfile
from html.parser import HTMLParser
from xml.etree import ElementTree

VERSION = "1.3.2 (2026-11-13)"
# extract: 이보다 글자가 적으면 본문을 못 읽은 것으로 본다(자바스크립트로 본문을 불러오는 채용 사이트, 스캔 PDF).
MIN_TEXT = 200
# 링크(HTML)로 받은 공고에 본문이 있는지 보는 말. 하나도 없으면 껍데기 페이지로 본다.
POSTING_WORDS = r"자격|우대|업무|요건|담당|qualification|requirement|responsibilit"
# 기준 구간: 이 한 곳에서만 정의한다(가설, 결과가 쌓이면 갱신).
BANDS = {"높음": (45, 80), "중간": (20, 50), "낮음": (5, 25)}
LEVELS = ["낮음", "중간", "높음"]
PASS, FAIL = 55, 45
ROLES = {"1": "인사", "2": "임원", "3": "실무"}
ALL_ROLES = ("인사", "임원", "실무", "참조인", "경쟁")
MODES = ("서류", "면접")
COMPETITOR_FILE = "참조인_경쟁.md"


class InputError(Exception):
    """사용자가 고칠 수 있는 입력 문제(종료 코드 2)."""
HEADER = ["재판일", "회사, 직무", "모드", "예측 단계", "직무 일치", "인사 %", "임원 %", "실무 %",
          "예측 %", "예측 정의", "판결", "사후 여부", "실제 결과", "결과 확인일"]


def read(path):
    # utf-8-sig: PowerShell 5.1 Out-File 등이 붙이는 BOM을 떼고 읽는다.
    if not os.path.isfile(path):
        raise InputError("파일 없음: %s" % path)
    with open(path, encoding="utf-8-sig") as f:
        return f.read()


def field(text, name):
    m = re.search(r"^\s*\**%s\**\s*:\s*\**\s*(.+?)\s*$" % re.escape(name), text, re.M)
    return m.group(1).strip().strip("*").strip() if m else None


def pct(value):
    if value is None:
        return None
    m = re.match(r"\s*(\d+(?:\.\d+)?)", value)
    return float(m.group(1)) if m else None


def parse_band(s):
    if not s:
        return None
    m = re.fullmatch(r"\s*(\d+)\s*[-~]\s*(\d+)\s*%?\s*", s)
    if not m or int(m.group(1)) > int(m.group(2)):
        raise InputError("--band는 '45-80'처럼 작은 수-큰 수로 준다 (받은 값: %s)" % s)
    return int(m.group(1)), int(m.group(2))


# ---------- guard (공고문 정리) ----------
HIDDEN_STYLE = re.compile(r"display\s*:\s*none|visibility\s*:\s*hidden|font-size\s*:\s*0(?![.\d])|opacity\s*:\s*0(?![.\d])"
                          r"|color\s*:\s*(#fff(fff)?|white)\b|(?:height|width)\s*:\s*0(?:px)?\s*(;|$)", re.I)
VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"}
BLOCK = {"p", "div", "br", "li", "tr", "h1", "h2", "h3", "h4", "h5", "h6", "section", "article", "ul", "ol", "table"}
INJECTION = [
    (r"\b(ignore|disregard|forget)\b.{0,30}\b(previous|prior|above|earlier|all)\b.{0,20}\b(instructions?|prompts?|rules)", "지시 무시 요구(영문)"),
    (r"system\s*prompt|\bnew instructions?\b|hidden instructions?", "시스템 지시 언급(영문)"),
    (r"\b(you are|act as|as) an? (ai|assistant|language model|llm|chatbot)\b|\bif you are an? (ai|llm|language model)\b", "AI에게 말 걸기(영문)"),
    (r"\b(rate|score|rank|evaluate|recommend)\b.{0,40}\b(highly|10/10|top|maximum|strong(ly)? hire|perfect)", "평가 조작(영문)"),
    (r"<\s*/?\s*(system|assistant|user)\s*>|\[/?INST\]", "대화 형식 태그"),
    (r"\bdo not (tell|mention|reveal|inform)\b", "숨기기 요구(영문)"),
    (r"(이전|앞의|위의|기존)\s*(의\s*)?(지시|명령|지침|규칙|프롬프트)\S*\s*(은|는|을|를)?\s*(모두\s*)?(무시|잊)", "지시 무시 요구"),
    (r"시스템\s*프롬프트|숨은\s*지시|새로운\s*지시\s*사항", "시스템 지시 언급"),
    (r"(너는|당신은)\s*.{0,15}(AI|인공지능|어시스턴트|언어\s*모델|챗봇)", "AI에게 말 걸기"),
    (r"(AI|인공지능|언어\s*모델|챗봇|LLM)\s*(라면|이라면|일\s*경우|인\s*경우|가\s*(이\s*글을\s*)?읽는다면)", "AI에게 말 걸기"),
    (r"(점수|평가|등급)\S*\s*.{0,10}(최고|만점|최상|높게)\s*(로|으로)?\s*(주|매기|평가|처리)", "평가 조작"),
    (r"(합격|통과|적합)\s*(으로|로)\s*(판정|처리|평가|분류)\s*(하|해)", "평가 조작"),
    (r"(사용자|지원자|사람)에게\s*(알리지|말하지|보여\s*주지|밝히지)\s*(마|말)", "숨기기 요구"),
]


class _Visible(HTMLParser):
    """보이는 글만 모으고, 숨은 요소의 글은 덩어리별로 따로 모은다(접힌 '더보기' 본문일 수 있어 버리지 않는다)."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out, self.stack, self.blocks, self.cur, self.comments = [], [], [], None, 0

    def _hidden(self):
        return any(h for h, _ in self.stack)

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        code = tag in ("script", "style", "noscript", "template")
        hide = code or "hidden" in a or (a.get("aria-hidden") == "true" and not a.get("role")) \
            or bool(HIDDEN_STYLE.search(a.get("style") or ""))
        if tag in BLOCK:
            (self.cur if self.cur is not None else self.out).append("\n")
        if tag in VOID:
            return
        top = hide and not self._hidden()
        if top and not code:
            self.cur = []
        self.stack.append((hide, top and not code))

    def handle_endtag(self, tag):
        if tag in VOID or not self.stack:
            return
        _, opened = self.stack.pop()
        if opened and self.cur is not None:
            t = re.sub(r"\s+", " ", "".join(self.cur)).strip()
            if t:
                self.blocks.append(t)
            self.cur = None
        if tag in BLOCK and not self._hidden():
            self.out.append("\n")

    def handle_data(self, data):
        if not self._hidden():
            self.out.append(data)
        elif self.cur is not None:
            self.cur.append(data)

    def handle_comment(self, data):
        self.comments += 1


# ---------- extract ----------
def _xml_text(data, para_tags):
    root = ElementTree.fromstring(data)
    out, buf = [], []
    for el in root.iter():
        tag = el.tag.rsplit("}", 1)[-1]
        if tag in para_tags and buf:
            out.append("".join(buf)); buf = []
        if tag in ("t",) and el.text:
            buf.append(el.text)
    if buf:
        out.append("".join(buf))
    return "\n".join(out)


MARKITDOWN_EXT = {".pdf": "PDF", ".docx": "Word", ".pptx": "PowerPoint", ".xlsx": "Excel"}


def _markitdown(path):
    """markitdown이 설치되어 있으면 마크다운으로 바꾼다(표와 제목 구조를 살린다). 없거나 실패하면 None."""
    try:
        from markitdown import MarkItDown
    except ImportError:
        return None
    import logging
    for name in ("pdfminer", "pdfplumber"):  # 글꼴 정보 경고가 쪽마다 쏟아져 보고를 가린다
        logging.getLogger(name).setLevel(logging.ERROR)
    try:
        return MarkItDown(enable_plugins=False).convert_local(path).markdown
    except Exception:
        return None


def extract(path):
    """파일에서 글자를 뽑아 (텍스트, 보고)를 돌려준다. 판단 없이 글자만 꺼낸다.
    PDF, Word, PowerPoint, Excel은 markitdown을 먼저 쓰고, 없으면 pypdf와 내장 파서로 대신한다."""
    if not os.path.isfile(path):
        raise InputError("파일 없음: %s" % path)
    ext = os.path.splitext(path)[1].lower()
    rep = {"파일": os.path.basename(path), "경고": []}
    md = _markitdown(path) if ext in MARKITDOWN_EXT else None
    if md is not None and len(re.sub(r"\s", "", md)) >= MIN_TEXT:
        text = md
        rep.update({"형식": MARKITDOWN_EXT[ext], "엔진": "markitdown"})
        if ext == ".pdf":
            rep["경고"].append("PDF 글자 순서는 화면 배치와 다를 수 있다. 섹션이 어색할 때만 그 쪽을 Read로 확인한다")
    elif ext in (".pptx", ".xlsx"):
        if md is None:
            raise InputError("%s 파일은 markitdown이 필요하다: python -m pip install \"markitdown[pptx,xlsx]\"" % ext)
        text = md
        rep.update({"형식": MARKITDOWN_EXT[ext], "엔진": "markitdown"})
    elif ext == ".pdf":
        try:
            import pypdf
        except ImportError:
            raise InputError("PDF를 읽으려면 pypdf가 필요하다: python -m pip install pypdf")
        r = pypdf.PdfReader(path)
        pages = [(p.extract_text() or "") for p in r.pages]
        text = "\n".join(pages)
        rep.update({"형식": "PDF", "쪽수": len(pages), "엔진": "pypdf"})
        rep["경고"].append("PDF 글자 순서는 화면 배치와 다를 수 있다. 섹션이 어색할 때만 그 쪽을 Read로 확인한다")
    elif ext == ".docx":
        with zipfile.ZipFile(path) as z:
            text = _xml_text(z.read("word/document.xml"), {"p"})
        rep.update({"형식": "Word", "엔진": "내장"})
    elif ext == ".hwpx":
        with zipfile.ZipFile(path) as z:
            secs = sorted(n for n in z.namelist() if re.match(r"Contents/section\d+\.xml$", n))
            text = "\n".join(_xml_text(z.read(n), {"p"}) for n in secs)
        rep["형식"] = "한글(hwpx)"
    elif ext in (".hwp", ".doc"):
        raise InputError("%s 파일은 직접 읽지 못한다. 한글이나 Word에서 PDF 또는 %s로 저장해 다시 준다"
                         % (ext, "hwpx" if ext == ".hwp" else "docx"))
    elif ext in (".html", ".htm"):
        # guard와 같은 파서를 쓴다: 숨은 요소(흰 글씨, 크기 0, display:none)의 글은 뽑지 않는다.
        p = _Visible(); p.feed(read(path)); p.close()
        text = "".join(p.out)
        rep["형식"] = "HTML"
        if p.blocks:
            rep["숨은 요소 제외"] = len(p.blocks)
            rep["경고"].append("화면에 보이지 않는 요소 %d개의 글은 뽑지 않았다. 접힌 공고 본문('더보기')일 수 있으면 "
                              "원본 HTML에 guard를 돌려 보고에서 확인한다" % len(p.blocks))
    else:
        text = read(path)
        rep["형식"] = "텍스트"
    text = unicodedata.normalize("NFC", text)
    text = "\n".join(line.rstrip() for line in text.splitlines())
    text = re.sub(r"\n{3,}", "\n\n", text).strip() + "\n"
    n = len(re.sub(r"\s", "", text))
    rep["글자 수(공백 제외)"] = n
    hangul = len(re.findall(r"[가-힣]", text))
    spaces = text.count(" ")
    rep["띄어쓰기 손실"] = hangul >= 100 and spaces < hangul * 0.05
    if rep["띄어쓰기 손실"]:
        # 브라우저 '인쇄 → PDF' 같은 파일은 글자를 낱개로 배치해 공백이 사라진다. 공백 포함 글자 수가 틀려진다.
        rep["경고"].append("띄어쓰기가 거의 사라졌다(한글 %d자에 공백 %d개). 내용 파악에는 써도 되지만 "
                          "공백 포함 글자 수는 이 글로 세지 않는다. 자소서면 Word, hwpx, 붙여넣기로 다시 받는다" % (hangul, spaces))
    rep["본문 부족"] = n < MIN_TEXT
    if rep["본문 부족"]:
        rep["경고"].append("글자가 %d자뿐이다. 링크 페이지가 본문을 따로 불러오거나 스캔 파일일 수 있다. "
                          "캡처 이미지, PDF, 본문 붙여넣기로 다시 받는다" % n)
    elif rep["형식"] == "HTML" and not re.search(POSTING_WORDS, text, re.I):
        # 메뉴와 하단 정보만 있는 껍데기 페이지: 글자는 많아도 공고에 늘 나오는 말이 없다.
        rep["본문 부족"] = True
        rep["경고"].append("페이지에 메뉴와 하단 정보만 있고 공고 본문(자격, 우대, 업무)이 없다. "
                          "본문을 따로 불러오는 사이트로 보인다. 캡처 이미지, PDF, 본문 붙여넣기로 다시 받는다")
    return text, rep


def injection(line):
    return next((name for pat, name in INJECTION if re.search(pat, line, re.I)), None)


def guard(text):
    rep = {"입력 형식": "텍스트"}
    if re.search(r"<\s*(html|body|div|p|span|section|table|ul|li|br)\b", text, re.I):
        v = _Visible()
        v.feed(text)
        v.close()
        text = "".join(v.out)
        rep["입력 형식"] = "HTML"
        rep["숨은 요소"] = [{"번호": i, "글자": len(b), "지시문 형태": injection(b) or "아님", "앞부분": b[:160]}
                         for i, b in enumerate(v.blocks, 1)]
        rep["주석 제거"] = v.comments
    else:
        n = len(re.findall(r"<!--.*?-->", text, re.S))
        text = re.sub(r"<!--.*?-->", "", text, flags=re.S)
        rep["주석 제거"] = n
    before = text
    text = unicodedata.normalize("NFC", text)
    rep["한글 자모 합치기(NFC)"] = len(before) - len(text)
    inv = sp = 0
    buf = []
    for ch in text:
        cat = unicodedata.category(ch)
        if ch in "\n\t":
            buf.append(ch)
        elif cat in ("Cf", "Co", "Cc"):
            inv += 1
        elif cat == "Zs" and ch != " ":
            sp += 1
            buf.append(" ")
        else:
            buf.append(ch)
    text = "".join(buf)
    rep["보이지 않는 문자 제거"] = inv
    rep["특수 공백 정리"] = sp
    flagged, lines = [], []
    for i, line in enumerate(text.splitlines(), 1):
        hit = injection(line)
        if hit:
            flagged.append({"줄": i, "규칙": hit, "원문": line.strip()[:160]})
            lines.append("[지시문 형태 줄 제외: 정리 보고 %d번 줄]" % i)
        else:
            lines.append(line.rstrip())
    text = re.sub(r"\n{3,}", "\n\n", "\n".join(lines)).strip() + "\n"
    rep["지시문 형태 줄"] = flagged
    hidden = rep.get("숨은 요소", [])
    bad = [h for h in hidden if h["지시문 형태"] != "아님"]
    notes = []
    if flagged:
        notes.append("보이는 지시문 형태 줄 %d개를 정리본에서 뺐다. 사용자에게 원문을 보여 주고, 실제 공고 내용이면 확인 뒤 되살린다." % len(flagged))
    if bad:
        notes.append("숨은 요소 %d개가 지시문 형태다. 되살리지 않고 사용자에게 알린다." % len(bad))
    if len(hidden) > len(bad):
        notes.append("지시문 형태가 아닌 숨은 요소 %d개는 정리본에 넣지 않았다. 접힌 공고 본문('더보기')이면 서기가 되살리고 한 줄로 알린다." % (len(hidden) - len(bad)))
    rep["판단"] = " ".join(notes) or "정리할 것 없음"
    rep["주의 필요"] = bool(flagged or bad)
    return text, rep


# ---------- count ----------
def count(text, words=False):
    size = (lambda s: len(s.split())) if words else (lambda s: len(s.strip()))
    out, name, buf = [], "(전체 앞부분)", []
    for line in text.splitlines():
        if line.startswith("#"):
            if buf or name != "(전체 앞부분)":
                out.append((name, size("\n".join(buf))))
            name, buf = line.lstrip("# ").strip(), []
        else:
            buf.append(line)
    out.append((name, size("\n".join(buf))))
    return [(n, c) for n, c in out if c or n != "(전체 앞부분)"]


# ---------- match ----------
def table(text, heading):
    m = re.search(r"^##\s*%s.*?$(.*?)(?=^##\s|\Z)" % re.escape(heading), text, re.M | re.S)
    if not m:
        return []
    rows = [l for l in m.group(1).splitlines() if l.strip().startswith("|")]
    if len(rows) < 2:
        return []
    head = [c.strip() for c in rows[0].strip().strip("|").split("|")]
    body = []
    for r in rows[1:]:
        cells = [c.strip() for c in r.strip().strip("|").split("|")]
        if all(set(c) <= set("-: ") for c in cells):
            continue
        body.append(dict(zip(head, cells)))
    return body


def match(text):
    duties = table(text, "주요 업무")
    n = {"직접": 0, "전이": 0, "공백": 0}
    for r in duties:
        j = r.get("판정", "")
        for k in n:
            if k in j:
                n[k] += 1
                break
    total = sum(n.values())
    if total == 0:
        raise InputError("직무 일치표의 '주요 업무' 표에서 판정(직접/전이/공백)을 찾지 못했다")
    level = "높음" if n["직접"] * 2 >= total else "중간" if (n["직접"] + n["전이"]) * 2 >= total else "낮음"
    target = table(text, "공고 대상")
    misfit = [r.get("항목", "?") for r in target if "어긋" in r.get("판정", "")]
    if misfit and level != "낮음":
        level = LEVELS[LEVELS.index(level) - 1]
    return {"직접": n["직접"], "전이": n["전이"], "공백": n["공백"], "주요 업무": total,
            "공고 대상 어긋남": misfit, "직무 일치도": level, "기준 구간": list(BANDS[level])}


# ---------- check ----------
def check(text, role, mode, band=None, pre=False):
    errs, res = [], {"역할": role}

    def need(name):
        v = field(text, name)
        if v is None:
            errs.append("'%s:' 줄 없음" % name)
        return v

    def valid_pct(name, v):
        p = pct(v)
        if p is None:
            errs.append("%s: 숫자 없음" % name)
        elif p % 5 or p == 50 or not 5 <= p <= 95:
            errs.append("%s: %g는 5~95, 5 단위, 50 제외 규칙 위반" % (name, p))
        return p

    def band_check(p):
        if band is None or p is None:
            return
        reason = field(text, "구간 이탈 근거")
        out = not band[0] <= p <= band[1]
        res["구간 이탈"] = out
        if out and (reason is None or reason.strip() in ("", "없음")):
            errs.append("구간 %d~%d 밖(%g)인데 구간 이탈 근거 없음" % (band[0], band[1], p))

    main = "합격 가능성" if mode == "서류" else "면접 합격 가능성"
    if role == "경쟁":
        # 경쟁자 비교 참조인: 단독(이 서류만)과 경쟁 풀(전형적 경쟁자들 사이) 두 숫자. 표결, 평균에 들어가지 않는다.
        res["단독 %"] = valid_pct("단독 " + main, need("단독 " + main))
        res["경쟁 풀 %"] = valid_pct("경쟁 풀 " + main, need("경쟁 풀 " + main))
        for name in ["경쟁자 모습", "이유", "밀리는 줄", "앞서는 줄", "뒤집힐 조건"]:
            v = need(name)
            if v is not None:
                res[name] = v
        res["오류"] = errs
        return res
    if mode == "면접" and pre:
        res["서류 %"] = valid_pct("서류 합격 가능성", need("서류 합격 가능성"))
        if role in ("임원", "실무"):
            band_check(res["서류 %"])
    p = valid_pct(main, need(main))
    res["서류 %" if mode == "서류" else "면접 %"] = p
    if mode == "서류" and role in ("임원", "실무"):
        band_check(p)
    if role != "참조인":
        v = need("투표")
        vote = "합격" if v and "합격" in v else "탈락" if v and "탈락" in v else None
        res["투표"] = vote
        if p is not None and vote and ((p >= PASS) != (vote == "합격")):
            errs.append("투표(%s)와 %s(%g)가 맞지 않음" % (vote, main, p))
    lines = ["이유", "결정적 근거", "합격 원인", "탈락 원인", "끝까지 읽혔나", "뒤집힐 조건"] if mode == "서류" else \
            ["이유", "첫 질문", "파고들 지점", "듣고 싶은 답", "걸리는 표현"]
    if mode == "서류" and role == "실무":
        lines.append("6분 판정")
    for name in lines:
        v = need(name)
        if v is not None:
            res[name] = v
    res["오류"] = errs
    return res


# ---------- tally ----------
def tally(folder, mode, band=None, pre=False):
    j = {}
    for k, role in ROLES.items():
        path = os.path.join(folder, "배심_%s.md" % k)
        j[role] = check(read(path), role, mode, band, pre) if os.path.exists(path) else {"역할": role, "오류": ["파일 없음"]}
    key = "서류 %" if mode == "서류" else "면접 %"
    votes = [j[r].get("투표") for r in ("인사", "임원", "실무")]
    yes, no = votes.count("합격"), votes.count("탈락")
    out = {"모드": mode, "배심": j, "다수결": "합격 %d 대 탈락 %d" % (yes, no),
           "재실행 필요": [r for r in j if j[r]["오류"]], "표시": []}

    def avg(vals):
        vals = [v for v in vals if v is not None]
        return round(statistics.mean(vals), 1) if vals else None

    def verdict(p):
        return None if p is None else "합격" if p >= PASS else "탈락" if p <= FAIL else "보류(경계)"

    if mode == "서류" or pre:
        s = [j["인사"].get("서류 %"), j["실무"].get("서류 %")]
        out["서류 예측 %"] = avg(s)
        out["서류 판결"] = verdict(out["서류 예측 %"])
        out["임원 시선 %"] = j["임원"].get("서류 %")
        allv = [j[r].get("서류 %") for r in ("인사", "임원", "실무") if j[r].get("서류 %") is not None]
        if allv:
            out["서류 범위"] = [min(allv), max(allv)]
    if mode == "면접":
        m = [j[r].get("면접 %") for r in ("인사", "임원", "실무")]
        out["면접 예측 %"] = avg(m)
        out["면접 판정"] = "준비됨" if yes == 3 else "보완 필요" if yes == 2 else "위험"
        mv = [v for v in m if v is not None]
        if mv:
            out["면접 범위"] = [min(mv), max(mv)]
    rng = out.get("서류 범위") or out.get("면접 범위")
    if rng and rng[1] - rng[0] >= 40:
        out["표시"].append("의견 분산")
    vals = [j[r].get(key) for r in ("인사", "임원", "실무")]
    if None not in vals and len(set(vals)) == 1:
        out["표시"].append("의견 수렴(같은 모델 한계 가능)")
    if mode == "서류" and out.get("서류 판결") in ("합격", "탈락"):
        majority = "합격" if yes > no else "탈락" if no > yes else None
        if majority and majority != out["서류 판결"]:
            out["표시"].append("경계 사건(3인 다수결과 서류 예측이 다름)")
    comp = os.path.join(folder, COMPETITOR_FILE)
    if os.path.exists(comp):
        c = check(read(comp), "경쟁", mode)
        out["경쟁 참조인(표결 외)"] = c
        if c["오류"]:
            out["재실행 필요"].append("경쟁")
    return out


# ---------- 예측기록 ----------
def doc_rows(text):
    rows, head = [], None
    for line in text.splitlines():
        if not line.strip().startswith("|"):
            continue
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if all(set(c) <= set("-: ") for c in cells):
            continue
        if head is None:
            head = cells
            continue
        rows.append(dict(zip(head, cells)))
    return head, rows


def fmt(cells):
    return "| " + " | ".join(cells) + " |"


def migrate(text):
    head, rows = doc_rows(text)
    if head == HEADER:
        return text
    new =[fmt(HEADER), fmt(["---"] * len(HEADER))]
    for r in rows:
        new.append(fmt([r.get("재판일", ""), r.get("회사, 직무", ""), r.get("모드", ""), r.get("예측 단계", ""),
                        r.get("직무 일치", ""), r.get("인사 %", ""), r.get("임원 %", ""), r.get("실무 %", ""),
                        r.get("예측 %", r.get("평균 %", "")), r.get("예측 정의", "3명 평균(구)"),
                        r.get("판결", ""), r.get("사후 여부", ""), r.get("실제 결과", ""), r.get("결과 확인일", "")]))
    if head is None:
        raise InputError("예측기록에서 '|'로 시작하는 표를 찾지 못했다")
    lines = text.splitlines()
    first = next(i for i, l in enumerate(lines) if l.strip().startswith("|"))
    last = max(i for i, l in enumerate(lines) if l.strip().startswith("|"))
    return "\n".join(lines[:first] + new + lines[last + 1:]) + "\n"


def row(t, date, case, stage, level, post=False, retrial=None):
    j = t["배심"]
    if stage == "서류":
        vals = [j[r].get("서류 %") for r in ("인사", "임원", "실무")]
        p, how = t.get("서류 예측 %"), "인사+실무"
        # 면접 대비 재판의 다수결은 면접 표이므로 서류 줄에는 붙이지 않는다
        verdict = t.get("서류 판결") if t["모드"] == "면접" else "%s (%s)" % (t.get("서류 판결"), t["다수결"])
    else:
        vals = [j[r].get("면접 %") for r in ("인사", "임원", "실무")]
        p, how, verdict = t.get("면접 예측 %"), "3명 평균", "%s (%s)" % (t.get("면접 판정"), t["다수결"])
    mode = "서류 재판" if t["모드"] == "서류" else "면접 대비 재판"
    if retrial:
        mode += " (재심 %s차)" % retrial
    g = lambda v: "" if v is None else ("%g" % v)
    return fmt([date, case, mode, stage if stage == "서류" else "면접(서류 수준 기준)", level,
                g(vals[0]), g(vals[1]), g(vals[2]), g(p), how, verdict, "사후" if post else "사전", "", ""])


def brier(text, stage="서류", force=False):
    _, rows = doc_rows(text)
    use = []
    for r in rows:
        if r.get("사후 여부") != "사전" or not r.get("예측 단계", "").startswith(stage):
            continue
        y = re.match(r"\s*([01])\b", r.get("실제 결과", ""))
        if not y:
            continue
        p = pct(r.get("예측 %") or r.get("평균 %"))
        if p is None:
            continue
        use.append((p / 100, int(y.group(1)), r))
    n = len(use)
    res = {"단계": stage, "결과 나온 사전 예측": n}
    if n < 5 and not force:
        res["판단"] = "아직 판단할 수 없음 (5건 미만)"
        return res
    if n == 0:
        return res
    base = sum(y for _, y, _ in use) / n
    res["Brier"] = round(sum((p - y) ** 2 for p, y, _ in use) / n, 3)
    res["기준선 Brier(모든 건에 실제 합격률 %.2f 예측)" % base] = round(sum((base - y) ** 2 for _, y, _ in use) / n, 3)
    res["적중률(55% 이상=합격)"] = round(sum((p >= 0.55) == (y == 1) for p, y, _ in use) / n, 2)
    for col in ("인사 %", "임원 %", "실무 %"):
        pts = [(pct(r.get(col)) / 100, y) for _, y, r in use if pct(r.get(col)) is not None]
        if pts:
            res[col + " Brier"] = round(sum((p - y) ** 2 for p, y in pts) / len(pts), 3)
    by = {}
    for _, y, r in use:
        by.setdefault(r.get("직무 일치") or "(미기록)", []).append(y)
    res["직무 일치도별 실제 합격률"] = {k: "%d/%d" % (sum(v), len(v)) for k, v in by.items()}
    defs = {r.get("예측 정의", "3명 평균(구)") for _, _, r in use}
    if len(defs) > 1:
        res["주의"] = "예측 정의가 섞여 있음: %s" % ", ".join(sorted(defs))
    return res


def main(argv):
    # Windows 콘솔 기본 인코딩(cp949 등)에서 한글 출력이 깨지지 않도록 UTF-8로 고정한다.
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8")
        except (AttributeError, ValueError):
            pass
    try:
        return run(argv)
    except InputError as e:
        print("입력 문제: %s" % e, file=sys.stderr)
        return 2
    except Exception as e:  # 마지막 방어선: 서기가 읽을 수 있는 한 줄로
        print("도구 내부 오류(%s): %s" % (type(e).__name__, e), file=sys.stderr)
        return 3


def run(argv):
    if not argv or argv[0] in ("-h", "--help"):
        print(__doc__); return 0
    cmd, args = argv[0], argv[1:]

    def opt(k, d=None, choices=None):
        if k not in args:
            return d
        i = args.index(k) + 1
        if i >= len(args) or args[i].startswith("--"):
            raise InputError("%s 뒤에 값이 없다" % k)
        if choices and args[i] not in choices:
            raise InputError("%s 값은 %s 중 하나다 (받은 값: %s)" % (k, "|".join(choices), args[i]))
        return args[i]

    def need(k, choices=None):
        v = opt(k, choices=choices)
        if v is None:
            raise InputError("%s 옵션이 필요하다" % k)
        return v

    flag = lambda k: k in args
    if cmd in ("extract", "guard", "count", "match", "check", "tally", "row", "migrate", "brier") \
            and (not args or args[0].startswith("--")):
        raise InputError("%s 다음에 파일이나 폴더 경로가 필요하다" % cmd)
    if cmd == "version":
        print(VERSION)
    elif cmd == "extract":
        text, rep = extract(args[0])
        out = opt("--out") or os.path.splitext(args[0])[0] + "_추출.txt"
        with open(out, "w", encoding="utf-8") as f:
            f.write(text)
        rep["저장"] = out
        print(json.dumps(rep, ensure_ascii=False, indent=1))
        return 1 if rep["본문 부족"] else 0
    elif cmd == "guard":
        clean, rep = guard(read(args[0]))
        out = opt("--out") or os.path.splitext(args[0])[0] + "_정리.md"
        with open(out, "w", encoding="utf-8") as f:
            f.write(clean)
        rep["정리본"] = out
        print(json.dumps(rep, ensure_ascii=False, indent=1))
        return 1 if rep["주의 필요"] else 0
    elif cmd == "count":
        limit, words = opt("--limit"), flag("--words")
        if limit is not None and (not limit.isdigit() or int(limit) == 0):
            raise InputError("--limit은 1 이상의 정수다 (받은 값: %s)" % limit)
        for name, c in count(read(args[0]), words):
            extra = " (%d%%)" % round(c * 100 / int(limit)) if limit else ""
            print("%s: %d%s%s" % (name, c, "단어" if words else "자", extra))
    elif cmd == "match":
        print(json.dumps(match(read(args[0])), ensure_ascii=False, indent=1))
    elif cmd == "check":
        r = check(read(args[0]), need("--role", ALL_ROLES), need("--mode", MODES), parse_band(opt("--band")), flag("--pre"))
        print(json.dumps(r, ensure_ascii=False, indent=1))
        return 1 if r["오류"] else 0
    elif cmd == "tally":
        if not os.path.isdir(args[0]):
            raise InputError("재판 폴더 없음: %s" % args[0])
        t = tally(args[0], need("--mode", MODES), parse_band(opt("--band")), flag("--pre"))
        with open(os.path.join(args[0], "집계.json"), "w", encoding="utf-8") as f:
            json.dump(t, f, ensure_ascii=False, indent=1)
        print(json.dumps(t, ensure_ascii=False, indent=1))
        return 1 if t["재실행 필요"] else 0
    elif cmd == "row":
        t = json.loads(read(os.path.join(args[0], "집계.json")))
        print(row(t, need("--date"), need("--case"), need("--stage", MODES), need("--match", LEVELS),
                  flag("--post"), opt("--retrial")))
    elif cmd == "migrate":
        sys.stdout.write(migrate(read(args[0])))
    elif cmd == "brier":
        print(json.dumps(brier(read(args[0]), opt("--stage", "서류", MODES), flag("--force")), ensure_ascii=False, indent=1))
    else:
        print(__doc__); return 2
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
