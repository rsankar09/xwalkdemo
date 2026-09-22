#!/usr/bin/env python3
"""Extract <head> metadata from every captured page bundle in capture/*/dom.json.

Writes .scratch/meta_extract.json: one record per page with the SEO-relevant
head fields plus the EDS target path derived from the source URL.
"""
import json
import os
import re
import sys
from html.parser import HTMLParser
from urllib.parse import urlsplit

CAPTURE = os.path.join(os.path.dirname(__file__), "..", "capture")
OUT = os.path.join(os.path.dirname(__file__), "meta_extract.json")


class HeadParser(HTMLParser):
    """Collect <title> and every <meta>/<link rel=canonical> inside <head>."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.in_title = False
        self.title_parts = []
        self.metas = []        # list of (name_or_property, content)
        self.canonical = None

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "title":
            self.in_title = True
        elif tag == "meta":
            key = a.get("name") or a.get("property") or a.get("http-equiv")
            if key:
                self.metas.append((key.lower().strip(), (a.get("content") or "").strip()))
        elif tag == "link":
            rel = (a.get("rel") or "").lower()
            if "canonical" in rel and self.canonical is None:
                self.canonical = (a.get("href") or "").strip()

    def handle_endtag(self, tag):
        if tag == "title":
            self.in_title = False

    def handle_data(self, data):
        if self.in_title:
            self.title_parts.append(data)


def head_slice(html):
    """Return just the <head> portion so we never parse megabytes of body."""
    m = re.search(r"</head\s*>", html, re.I)
    return html[: m.end()] if m else html[:200000]


def to_path(url):
    """Map a source URL to the EDS path it would migrate to."""
    p = urlsplit(url).path or "/"
    if p != "/" and p.endswith("/"):
        p = p.rstrip("/")
    if p in ("", "/"):
        return "/"
    # EDS serves extensionless paths
    p = re.sub(r"\.(html?|aspx)$", "", p, flags=re.I)
    return p


def main():
    dirs = sorted(
        d for d in os.listdir(CAPTURE)
        if os.path.isdir(os.path.join(CAPTURE, d))
    )
    records = []
    failures = []
    for i, slug in enumerate(dirs, 1):
        base = os.path.join(CAPTURE, slug)
        dom_p, meta_p = os.path.join(base, "dom.json"), os.path.join(base, "meta.json")
        if not os.path.exists(dom_p):
            failures.append({"slug": slug, "reason": "no dom.json"})
            continue
        try:
            with open(dom_p, encoding="utf-8") as f:
                html = json.load(f).get("html", "")
            side = {}
            if os.path.exists(meta_p):
                with open(meta_p, encoding="utf-8") as f:
                    side = json.load(f)
        except Exception as e:  # noqa: BLE001 - report and keep going
            failures.append({"slug": slug, "reason": f"{type(e).__name__}: {e}"})
            continue

        hp = HeadParser()
        try:
            hp.feed(head_slice(html))
        except Exception as e:  # noqa: BLE001
            failures.append({"slug": slug, "reason": f"parse: {type(e).__name__}: {e}"})

        mm = {}
        for k, v in hp.metas:
            # first occurrence wins; that is what crawlers honour
            mm.setdefault(k, v)

        url = side.get("final_url") or side.get("url") or ""
        records.append({
            "slug": slug,
            "url": url,
            "path": to_path(url) if url else "",
            "section": (to_path(url).strip("/").split("/")[0] or "(root)") if url else "",
            "http_status": side.get("http_status"),
            "title": " ".join("".join(hp.title_parts).split()),
            "description": mm.get("description", ""),
            "robots": mm.get("robots", ""),
            "canonical": hp.canonical or "",
            "og_title": mm.get("og:title", ""),
            "og_description": mm.get("og:description", ""),
            "og_image": mm.get("og:image", ""),
            "og_type": mm.get("og:type", ""),
            "twitter_card": mm.get("twitter:card", ""),
            "twitter_image": mm.get("twitter:image", ""),
            "keywords": mm.get("keywords", ""),
            "meta_count": len(hp.metas),
        })
        if i % 200 == 0:
            print(f"  ...{i}/{len(dirs)}", file=sys.stderr)

    with open(OUT, "w", encoding="utf-8") as f:
        json.dump({"records": records, "failures": failures}, f, indent=1)
    print(f"extracted={len(records)} failures={len(failures)} -> {OUT}")


if __name__ == "__main__":
    main()
