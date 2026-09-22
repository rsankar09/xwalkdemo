#!/usr/bin/env python3
"""Audit the extracted metadata and print the findings the skill's report needs."""
import json
import os
from collections import Counter, defaultdict

HERE = os.path.dirname(__file__)
d = json.load(open(os.path.join(HERE, "meta_extract.json"), encoding="utf-8"))
R = d["records"]
N = len(R)


def pct(n):
    return f"{n} / {N} ({100*n/N:.1f}%)"


print("=" * 72)
print("COVERAGE")
print("=" * 72)
for field in ("title", "description", "og_image", "og_title", "og_description",
              "canonical", "robots", "og_type", "twitter_card", "keywords"):
    have = sum(1 for r in R if r.get(field))
    print(f"  {field:18} {pct(have)}")

# ---- length analysis -------------------------------------------------------
print()
print("=" * 72)
print("LENGTH BUCKETS")
print("=" * 72)
for field, lo, hi, hard_hi in (("title", 20, 70, 60), ("description", 50, 170, 160)):
    vals = [(r["path"], len(r[field])) for r in R if r.get(field)]
    short = [v for v in vals if v[1] < lo]
    long_ = [v for v in vals if v[1] > hi]
    ok = len(vals) - len(short) - len(long_)
    ln = [v[1] for v in vals]
    print(f"  {field}: n={len(vals)} min={min(ln)} max={max(ln)} "
          f"median={sorted(ln)[len(ln)//2]}")
    print(f"    too short (<{lo}): {len(short)}   ok: {ok}   too long (>{hi}): {len(long_)}")
    for p, l in sorted(short, key=lambda x: x[1])[:8]:
        print(f"      SHORT {l:4}  {p}")
    for p, l in sorted(long_, key=lambda x: -x[1])[:8]:
        print(f"      LONG  {l:4}  {p}")

# ---- duplicates ------------------------------------------------------------
print()
print("=" * 72)
print("DUPLICATES")
print("=" * 72)
for field in ("title", "description", "og_image"):
    groups = defaultdict(list)
    for r in R:
        if r.get(field):
            groups[r[field].strip().lower()].append(r["path"])
    dupes = {k: v for k, v in groups.items() if len(v) > 1}
    affected = sum(len(v) for v in dupes.values())
    print(f"  {field}: {len(dupes)} duplicated values across {affected} pages")
    for k, v in sorted(dupes.items(), key=lambda x: -len(x[1]))[:6]:
        print(f"    x{len(v):4}  {k[:88]}")
        for p in v[:3]:
            print(f"            {p}")
        if len(v) > 3:
            print(f"            ... +{len(v)-3} more")

# ---- missing lists by section ---------------------------------------------
print()
print("=" * 72)
print("GAPS BY SECTION  (pages / no-title / no-desc / no-og:image / noindex)")
print("=" * 72)
sec = defaultdict(lambda: dict(n=0, nt=0, nd=0, ni=0, nx=0))
for r in R:
    s = sec[r["section"]]
    s["n"] += 1
    if not r["title"]:
        s["nt"] += 1
    if not r["description"]:
        s["nd"] += 1
    if not r["og_image"]:
        s["ni"] += 1
    if "noindex" in (r["robots"] or "").lower():
        s["nx"] += 1
for name, s in sorted(sec.items(), key=lambda x: -x[1]["n"]):
    flag = ""
    if s["nd"] == s["n"] and s["n"] > 1:
        flag += "  <-- ALL missing description"
    if s["ni"] == s["n"] and s["n"] > 1:
        flag += "  <-- ALL missing og:image"
    print(f"  {name:42} {s['n']:5} {s['nt']:5} {s['nd']:5} {s['ni']:5} {s['nx']:5}{flag}")

# ---- robots / noindex ------------------------------------------------------
print()
print("=" * 72)
print("ROBOTS VALUES")
print("=" * 72)
for v, c in Counter((r["robots"] or "(none)").lower() for r in R).most_common():
    print(f"  {c:5}  {v}")
print("  noindex pages:")
for r in R:
    if "noindex" in (r["robots"] or "").lower():
        print(f"      {r['path']}")

# ---- canonical mismatches --------------------------------------------------
print()
print("=" * 72)
print("CANONICAL MISMATCH (canonical path != page path)")
print("=" * 72)
from urllib.parse import urlsplit
mis = []
for r in R:
    if not r["canonical"]:
        continue
    cp = urlsplit(r["canonical"]).path.rstrip("/") or "/"
    if cp != (r["path"].rstrip("/") or "/"):
        mis.append((r["path"], r["canonical"]))
print(f"  {len(mis)} mismatches")
for p, c in mis[:15]:
    print(f"    {p}\n       -> {c}")

# ---- og:image host/value distribution --------------------------------------
print()
print("=" * 72)
print("TOP og:image VALUES")
print("=" * 72)
for v, c in Counter(r["og_image"] for r in R if r["og_image"]).most_common(10):
    print(f"  {c:5}  {v[:100]}")

# ---- title suffix pattern --------------------------------------------------
print()
print("=" * 72)
print("TITLE SUFFIX PATTERN")
print("=" * 72)
suf = Counter()
for r in R:
    t = r["title"]
    if "|" in t:
        suf["| " + t.rsplit("|", 1)[1].strip()] += 1
    elif " - " in t:
        suf["- " + t.rsplit(" - ", 1)[1].strip()] += 1
    else:
        suf["(no suffix)"] += 1
for v, c in suf.most_common(8):
    print(f"  {c:5}  {v[:80]}")

json.dump(R, open(os.path.join(HERE, "records.json"), "w"), indent=1)
