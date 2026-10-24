"""Build docs/plan/plan.html from the Markdown plan docs.

Usage: python3 docs/plan/tools/build_page.py docs/plan docs/plan/plan.html docs/plan/tools/page-template.html
Needs pandoc. Re-run after editing any plan doc.
"""
import html, re, subprocess, sys
from pathlib import Path

SRC = Path(sys.argv[1])
OUT = Path(sys.argv[2])

docs = sorted(p for p in SRC.glob("*.md") if p.name != "README.md")
order = [SRC / "README.md"] + docs


def convert(path, prefix):
    out = subprocess.run(
        ["pandoc", "-f", "gfm", "-t", "html", "--no-highlight", "--wrap=none", f"--id-prefix={prefix}-", str(path)],
        check=True, capture_output=True, text=True,
    ).stdout
    return out


def key_for(name):
    return "overview" if name == "README.md" else "s" + name[:2]


sections = []
for path in order:
    key = key_for(path.name)
    body = convert(path, key)
    m = re.search(r"<h1[^>]*>(.*?)</h1>", body, re.S)
    raw_title = re.sub(r"<[^>]+>", "", m.group(1)).strip() if m else path.stem
    body = body[m.end():] if m else body
    num, _, title = raw_title.partition(" — ")
    if not title:
        num, title = "", raw_title
    # internal links between docs
    body = re.sub(r'href="(\d\d)-[^"#]*\.md"', lambda mm: f'href="#s{mm.group(1)}"', body)
    # placeholder pills
    body = re.sub(r"(?:<strong>)?<code>\[PLACEHOLDER([^\]]*)\]</code>(?:</strong>)?",
                  lambda mm: f'<span class="ph">placeholder{mm.group(1)}</span>', body)
    # interactive task checkboxes with owner pills
    counter = [0]

    def box(mm):
        counter[0] += 1
        o = mm.group(1) or ""
        pill = f'<span class="owner o-{o.lower()}" title="Owner {o}">{o}</span>' if o else ""
        return (f'<li class="task-item" data-owner="{o}"><label><input type="checkbox" class="task" '
                f'id="{key}-t{counter[0]}">{pill}<span class="tt">')

    body = re.sub(r'<li><label><input type="checkbox"[^>]*/>(?:<strong>\[([ABC])\]</strong>\s*)?', box, body)
    body = body.replace("</label></li>", "</span></label></li>")
    # owner tags in prose (README key, team split)
    body = re.sub(r"<strong>\[([ABC])\]</strong>", lambda mm: f'<span class="owner o-{mm.group(1).lower()}">{mm.group(1)}</span>', body)
    # wrap h2 blocks by kind
    parts = re.split(r"(?=<h2)", body)
    wrapped = []
    for part in parts:
        hm = re.match(r"<h2[^>]*>(.*?)</h2>", part, re.S)
        if not hm:
            wrapped.append(part)
            continue
        label = re.sub(r"<[^>]+>", "", hm.group(1)).lower()
        kind = ("decisions" if label.startswith("decisions") else
                "open" if label.startswith("open questions") else
                "accept" if label.startswith("acceptance") else
                "tasks" if label.startswith("tasks") or label.startswith("setup tasks") else "plain")
        wrapped.append(f'<div class="block block-{kind}">{part}</div>')
    body = "".join(wrapped)
    # tables + code scroll containers
    body = re.sub(r"<table>", '<div class="scroll"><table>', body).replace("</table>", "</table></div>")
    sections.append(dict(key=key, num=num if num.isdigit() else "", title=title, body=body, tasks=counter[0]))

nav = []
for s in sections:
    label = s["title"] if s["key"] != "overview" else "Overview"
    num = f'<span class="nav-num">{s["num"]}</span>' if s["num"] else '<span class="nav-num">··</span>'
    count = f'<span class="nav-count" data-for="{s["key"]}"></span>' if s["tasks"] else ""
    short = label.split(":")[0]
    nav.append(f'<li><a href="#{s["key"]}">{num}<span class="nav-label">{short}</span>{count}</a></li>')

secs = []
for s in sections:
    head_num = f'<span class="sec-num">{s["num"]}</span>' if s["num"] else ""
    title = "Project plan" if s["key"] == "overview" else s["title"]
    progress = (f'<div class="progress" data-for="{s["key"]}"><div class="bar"><span></span></div><span class="ptext"></span></div>'
                if s["tasks"] else "")
    secs.append(f'<section id="{s["key"]}" class="doc" data-key="{s["key"]}"><header class="sec-head">{head_num}<h2 class="sec-title">{title}</h2></header>{progress}<div class="prose">{s["body"]}</div></section>')

template = Path(sys.argv[3]).read_text()
page = template.replace("{{NAV}}", "\n".join(nav)).replace("{{SECTIONS}}", "\n".join(secs))
head, _, body = page.partition('<div class="wrap">')
OUT.write_text(
    '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
    + head + '</head>\n<body>\n<div class="wrap">' + body + '</body>\n</html>\n'
)
print("sections", len(sections), "tasks", sum(s["tasks"] for s in sections))
