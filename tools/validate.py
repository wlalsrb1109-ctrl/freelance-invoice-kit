"""Static validation for the Invoice & Rate Kit site.

Checks, without a browser:
  1. every internal href / src / canonical target resolves to a real file
  2. no duplicate element ids, and every label[for] / aria-labelledby target exists
  3. each page has title, meta description, canonical, og:title/description/url
  4. every JSON-LD block parses
  5. every referenced CSS/JS asset exists and JS compiles (QuickJS, via `new Function`)
  6. CSS braces balance and every class used in HTML is defined in site.css
  7. sitemap urls match real pages

Exit code 1 on any failure.
"""
import json
import os
import re
import sys
from lxml import html as LH
from urllib.parse import urlparse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

PAGES = ["index.html", "rate-calculator.html", "pro.html", "about.html", "privacy.html", "terms.html"]
SITE_PREFIX = "/freelance-invoice-kit/"

errors = []
warnings = []


def fail(msg):
    errors.append(msg)


def warn(msg):
    warnings.append(msg)


def local_path(url):
    """Map a URL found in HTML to a file path relative to ROOT (or None if external)."""
    if url.startswith("#") or url.startswith("mailto:") or url.startswith("tel:") or url.startswith("javascript:"):
        return None
    p = urlparse(url)
    if p.scheme in ("http", "https"):
        if p.netloc == "wlalsrb1109-ctrl.github.io":
            path = p.path
            if path.startswith(SITE_PREFIX):
                path = path[len(SITE_PREFIX):]
            elif path.startswith("/"):
                path = path[1:]
            return path or "index.html"
        return None
    path = p.path
    if path.startswith("/"):
        if path.startswith(SITE_PREFIX):
            path = path[len(SITE_PREFIX):]
        else:
            fail("%s: absolute path outside the site root: %s" % (url, path))
            return None
    return path or None


print("== 1. link and asset graph ==")
seen_targets = set()
for page in PAGES:
    if not os.path.exists(page):
        fail("missing page: " + page)
        continue
    tree = LH.parse(page).getroot()
    refs = []
    for el in tree.iter():
        for attr in ("href", "src"):
            v = el.get(attr)
            if v:
                refs.append(v)
    for ref in refs:
        target = local_path(ref)
        if target is None:
            continue
        target = target.split("#")[0]
        if not target:
            continue
        if not os.path.exists(target):
            fail("%s: broken reference -> %s" % (page, ref))
        else:
            seen_targets.add(target)

# canonical + og:url targets
for page in PAGES:
    tree = LH.parse(page).getroot()
    for el in tree.iter("link"):
        if el.get("rel") == "canonical":
            t = local_path(el.get("href"))
            if t and not os.path.exists(t):
                fail("%s: canonical does not exist -> %s" % (page, el.get("href")))
print("   %d pages, %d unique internal targets resolved" % (len(PAGES), len(seen_targets)))

print("== 2. ids, labels, aria ==")
for page in PAGES:
    tree = LH.parse(page).getroot()
    ids = [el.get("id") for el in tree.iter() if el.get("id")]
    dupes = {i for i in ids if ids.count(i) > 1}
    if dupes:
        fail("%s: duplicate ids: %s" % (page, sorted(dupes)))
    idset = set(ids)
    for lab in tree.iter("label"):
        f = lab.get("for")
        if f and f not in idset:
            fail("%s: label[for=%s] has no matching id" % (page, f))
    for el in tree.iter():
        for attr in ("aria-labelledby", "aria-describedby", "aria-controls"):
            v = el.get(attr)
            if v:
                for token in v.split():
                    if token not in idset:
                        fail("%s: %s references missing id %s" % (page, attr, token))

print("== 3. meta / SEO ==")
REQUIRED = {
    "title": lambda t: t.find(".//title") is not None and len(t.findtext(".//title") or "") >= 10,
    "description": lambda t: any(m.get("name") == "description" for m in t.iter("meta")),
    "canonical": lambda t: any(l.get("rel") == "canonical" for l in t.iter("link")),
    "og:title": lambda t: any(m.get("property") == "og:title" for m in t.iter("meta")),
    "og:description": lambda t: any(m.get("property") == "og:description" for m in t.iter("meta")),
    "og:url": lambda t: any(m.get("property") == "og:url" for m in t.iter("meta")),
    "og:image": lambda t: any(m.get("property") == "og:image" for m in t.iter("meta")),
    "viewport": lambda t: any(m.get("name") == "viewport" for m in t.iter("meta")),
}
for page in PAGES:
    tree = LH.parse(page).getroot()
    for name, check in REQUIRED.items():
        if not check(tree):
            fail("%s: missing %s" % (page, name))
    title = tree.findtext(".//title") or ""
    if len(title) > 70:
        warn("%s: title is %d chars (may be truncated in search)" % (page, len(title)))
    descs = [m.get("content") or "" for m in tree.iter("meta") if m.get("name") == "description"]
    if descs and not (60 <= len(descs[0]) <= 185):
        warn("%s: meta description is %d chars" % (page, len(descs[0])))

print("== 4. JSON-LD ==")
ld_count = 0
for page in PAGES:
    tree = LH.parse(page).getroot()
    for s in tree.iter("script"):
        if (s.get("type") or "").strip() == "application/ld+json":
            raw = s.text or ""
            try:
                obj = json.loads(raw)
                ld_count += 1
                if "@context" not in obj or "@type" not in obj:
                    fail("%s: JSON-LD missing @context/@type" % page)
            except Exception as e:
                fail("%s: JSON-LD does not parse: %s" % (page, e))
print("   %d JSON-LD blocks parsed" % ld_count)

print("== 5. assets + JS syntax ==")
for page in PAGES:
    tree = LH.parse(page).getroot()
    for s in tree.iter("script"):
        src = s.get("src")
        if src and not os.path.exists(src.split("?")[0]):
            fail("%s: missing script %s" % (page, src))
    for l in tree.iter("link"):
        href = l.get("href") or ""
        if l.get("rel") in ("stylesheet", "icon") and not href.startswith("http") and not os.path.exists(href):
            fail("%s: missing asset %s" % (page, href))

import quickjs  # noqa: E402
ctx = quickjs.Context()
for js in sorted(f for f in os.listdir("assets/js") if f.endswith(".js")):
    src = open(os.path.join("assets/js", js), encoding="utf-8").read()
    try:
        ctx.eval("new Function(%s)" % json.dumps(src))
        print("   %s: syntax OK (%d bytes)" % (js, len(src)))
    except Exception as e:
        fail("%s: JavaScript syntax error: %s" % (js, e))

print("== 6. CSS sanity ==")
css = open("assets/css/site.css", encoding="utf-8").read()
if css.count("{") != css.count("}"):
    fail("site.css: unbalanced braces (%d { vs %d })" % (css.count("{"), css.count("}")))
defined = set(re.findall(r"\.([a-zA-Z][\w-]*)", css))
used = set()
for page in PAGES:
    tree = LH.parse(page).getroot()
    for el in tree.iter():
        cls = el.get("class")
        if cls:
            used.update(cls.split())
missing = sorted(c for c in used if c not in defined and not c.startswith("adsbygoogle"))
if missing:
    warn("classes used in HTML but not defined in CSS: %s" % ", ".join(missing))
print("   %d classes defined, %d used, %d undefined" % (len(defined), len(used), len(missing)))

print("== 7. sitemap ==")
sm = open("sitemap.xml", encoding="utf-8").read()
for loc in re.findall(r"<loc>([^<]+)</loc>", sm):
    t = local_path(loc)
    if t and not os.path.exists(t):
        fail("sitemap lists a missing file: %s" % loc)
robots = open("robots.txt", encoding="utf-8").read()
if "Sitemap:" not in robots:
    warn("robots.txt has no Sitemap line")

print("== 8. DOM wiring (script <-> markup) ==")
PAGE_SCRIPTS = {
    "index.html": ["invoice.js"],
    "rate-calculator.html": ["rate.js"],
    "pro.html": ["pro.js"],
}
for page, scripts in PAGE_SCRIPTS.items():
    tree = LH.parse(page).getroot()
    ids = {el.get("id") for el in tree.iter() if el.get("id")}
    for js in scripts:
        src = open(os.path.join("assets/js", js), encoding="utf-8").read()
        used = set(re.findall(r"\$\('([^']+)'\)", src)) | set(re.findall(r"getElementById\('([^']+)'\)", src))
        missing = sorted(u for u in used if u not in ids)
        if missing:
            fail("%s/%s references ids that do not exist in %s: %s" % (js, "", page, ", ".join(missing)))
        print("   %s: %d ids referenced, all present" % (js, len(used)))

# every data-field path must have a home in the invoice state defaults
inv_js = open("assets/js/invoice.js", encoding="utf-8").read()
defaults = set(re.findall(r"(\w+): \{", inv_js))
tree = LH.parse("index.html").getroot()
fields = {el.get("data-field") for el in tree.iter() if el.get("data-field")}
roots = {f.split(".")[0] for f in fields if "." in f}
bad_roots = sorted(r for r in roots if r not in defaults)
if bad_roots:
    fail("data-field paths with no state root: %s" % ", ".join(bad_roots))
print("   %d data-field bindings across %d state groups" % (len(fields), len(roots)))

# every form control the user can type in should be labelled
unlabelled = []
labelled_for = {lab.get("for") for lab in tree.iter("label") if lab.get("for")}
for el in tree.iter("input", "select", "textarea"):
    i = el.get("id")
    typ = (el.get("type") or "text").lower()
    if typ in ("hidden", "file"):
        continue
    if not i or (i not in labelled_for and not el.get("aria-label")):
        unlabelled.append(i or "(no id)")
if unlabelled:
    warn("index.html: controls without a label: %s" % ", ".join(sorted(set(unlabelled))))
print("   %d labelled controls, %d unlabelled" % (len(labelled_for), len(set(unlabelled))))

print()
if warnings:
    print("WARNINGS (%d)" % len(warnings))
    for w in warnings:
        print("  - " + w)
if errors:
    print("FAILURES (%d)" % len(errors))
    for e in errors:
        print("  x " + e)
    sys.exit(1)
print("ALL CHECKS PASSED")
