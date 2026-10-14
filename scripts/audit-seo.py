"""Read-only crawl of the site's sitemap and public HTML (Python standard library).

Usage: python scripts/audit-seo.py BASE_URL OUTPUT.json [--check]
No authentication, forms, private endpoints, or third-party links are requested.
"""
import concurrent.futures
import http.cookiejar
import json
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path


class RedirectHandler(urllib.request.HTTPRedirectHandler):
    # Python 3.10 does not otherwise follow Next.js permanent (308) redirects.
    http_error_308 = urllib.request.HTTPRedirectHandler.http_error_301

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return super().redirect_request(req, fp, 301 if code == 308 else code, msg, headers, newurl)


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.title = ""
        self.lang = ""
        self.meta = {}
        self.canonicals = []
        self.hreflang = []
        self.headings = []
        self.links = []
        self.ids = []
        self.schemas = []
        self.images_without_alt = []
        self.hidden_initially = 0
        self.main_count = 0
        self.words = []
        self.capture = None
        self.buffer = ""
        self.skip = 0

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "html": self.lang = a.get("lang", "")
        if tag == "meta": self.meta[a.get("name", a.get("property", ""))] = a.get("content", "")
        if tag == "link" and a.get("rel") == "canonical": self.canonicals.append(a.get("href"))
        if tag == "link" and a.get("hreflang"): self.hreflang.append(a)
        if tag == "a" and a.get("href"): self.links.append(a["href"])
        if "id" in a: self.ids.append(a["id"])
        if tag == "img" and "alt" not in a: self.images_without_alt.append(a.get("src"))
        if re.search(r"(?:^|;)\s*opacity:\s*0(?:;|$)", a.get("style", "")): self.hidden_initially += 1
        if tag == "main": self.main_count += 1
        if tag == "title" or re.fullmatch("h[1-6]", tag) or (tag == "script" and a.get("type") == "application/ld+json"):
            self.capture, self.buffer = tag, ""
        if tag in ("script", "style"): self.skip += 1

    def handle_data(self, data):
        if self.capture: self.buffer += data
        if not self.skip: self.words.extend(data.split())

    def handle_endtag(self, tag):
        if tag == self.capture:
            if tag == "title": self.title = self.buffer
            elif tag == "script":
                try: self.schemas.append(json.loads(self.buffer))
                except ValueError: self.schemas.append({"parse_error": True})
            else: self.headings.append([tag, self.buffer.strip()])
            self.capture = None
        if tag in ("script", "style"): self.skip = max(0, self.skip - 1)


def fetch(url):
    request = urllib.request.Request(url, headers={"User-Agent": "IBPA-SEO-Audit/1.0", "Accept": "text/html,application/xml,text/plain"})
    try:
        opener = urllib.request.build_opener(RedirectHandler(), urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
        with opener.open(request, timeout=45) as r:
            return r.status, r.url, dict(r.headers), r.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as e:
        return e.code, e.url, dict(e.headers), e.read().decode("utf-8", errors="replace")
    except Exception as e:
        return 0, url, {}, str(e)


def inspect(url):
    status, final, headers, html = fetch(url)
    p = Page()
    p.feed(html)
    return {"url": url, "status": status, "final_url": final, "cache_control": headers.get("Cache-Control"),
            "x_robots_tag": headers.get("X-Robots-Tag"), "html_bytes": len(html.encode()), "title": p.title,
            "lang": p.lang, "meta": p.meta, "canonical": p.canonicals, "hreflang": p.hreflang,
            "headings": p.headings, "word_count": len(p.words), "main_count": p.main_count,
            "hidden_initially": p.hidden_initially, "images_without_alt": p.images_without_alt,
            "schemas": p.schemas, "links": sorted(set(p.links)), "ids": p.ids}


def main():
    base, output = sys.argv[1:3]
    base = base.rstrip("/")
    sitemap = fetch(base + "/sitemap.xml")
    robots = fetch(base + "/robots.txt")
    locs = [n.text for n in ET.fromstring(sitemap[3]).iter() if n.tag.endswith("}loc")]
    paths = [urllib.parse.urlsplit(url).path for url in locs]
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        pages = list(pool.map(inspect, [base + path for path in paths]))
    extra = ["/seo-audit-missing-page", "/sign-in", "/team-invite", "/success", "/application/edit", "/profile-preview/seo-audit-missing", "/news/seo-audit-missing", "/events/seo-audit-missing"]
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        checks = list(pool.map(inspect, [base + path for path in extra]))
    errors = []
    if sitemap[0] != 200 or robots[0] != 200: errors.append("Sitemap and robots must return 200")
    if len(locs) != len(set(locs)): errors.append("Duplicate sitemap URLs")
    for p in pages:
        for failed, label in [(p["status"] != 200, "status"), (not p["title"], "title"),
                              (not p["meta"].get("description"), "description"), (len(p["canonical"]) != 1, "canonical"),
                              ("noindex" in p["meta"].get("robots", ""), "noindex"),
                              (sum(h[0] == "h1" for h in p["headings"]) != 1, "h1"),
                              (p["main_count"] != 1, "main landmark"), (bool(p["images_without_alt"]), "image alt"),
                              (any(s.get("parse_error") for s in p["schemas"] if isinstance(s, dict)), "JSON-LD")]:
            if failed: errors.append(p["url"] + ": " + label)
        if len(p["canonical"]) == 1 and urllib.parse.urlsplit(p["canonical"][0]).path.rstrip("/") != urllib.parse.urlsplit(p["url"]).path.rstrip("/"):
            errors.append(p["url"] + ": canonical path mismatch")
        for link in p["links"]:
            if link.startswith("#") and len(link) > 1 and urllib.parse.unquote(link[1:]) not in p["ids"]:
                errors.append(p["url"] + ": missing fragment " + link)
    if checks[0]["status"] != 404: errors.append("Missing URL must return 404")
    if any(p["status"] != 404 for p in checks[-2:]): errors.append("Missing news/events must return 404")
    for p in checks[1:]:
        if p["status"] == 200 and "noindex" not in p["meta"].get("robots", ""):
            errors.append(p["url"] + ": missing noindex")
    if len({p["title"] for p in pages}) != len(pages): errors.append("Duplicate titles")
    if len({p["meta"].get("description") for p in pages}) != len(pages): errors.append("Duplicate descriptions")
    result = {"checked_at": datetime.now(timezone.utc).isoformat(), "base": base,
              "sitemap_status": sitemap[0], "sitemap_urls": locs, "robots_status": robots[0],
              "robots": robots[3], "pages": pages, "additional_checks": checks, "errors": errors}
    Path(output).parent.mkdir(parents=True, exist_ok=True)
    Path(output).write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps({"pages": len(pages), "errors": errors, "output": output}))
    if "--check" in sys.argv and errors: raise SystemExit(1)


if __name__ == "__main__": main()
