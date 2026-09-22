#!/usr/bin/env python3
"""Deduped audit: one record per final path (redirect sources collapsed)."""
import json
import os
from collections import Counter, defaultdict

HERE = os.path.dirname(__file__)
R = json.load(open(os.path.join(HERE, "records.json"), encoding="utf-8"))

# Collapse redirect sources: keep the record whose slug best matches the path.
by_path = defaultdict(list)
for r in R:
    by_path[r["path"]].append(r)
U = []
redirects = []
for path, group in by_path.items():
    if len(group) == 1:
        U.append(group[0])
        continue
    want = path.strip("/").replace("/", "-")
    best = next((g for g in group if g["slug"] == want), group[0])
    U.append(best)
    for g in group:
        if g is not best:
            redirects.append((g["slug"], path))
U.sort(key=lambda r: r["path"])
N = len(U)
print(f"unique pages: {N}   redirect source URLs collapsed: {len(redirects)}")

print()
print("== COVERAGE (deduped) ==")
for f in ("title", "description", "og_image", "og_title", "og_description",
          "canonical", "og_type", "keywords"):
    h = sum(1 for r in U if r.get(f))
    print(f"  {f:16} {h:5} / {N}  ({100*h/N:5.1f}%)   missing {N-h}")

print()
print("== TRUE DUPLICATE TITLES (distinct paths) ==")
for field in ("title", "description"):
    g = defaultdict(list)
    for r in U:
        if r.get(field):
            g[r[field].strip().lower()].append(r["path"])
    dupes = {k: v for k, v in g.items() if len(v) > 1}
    print(f"  {field}: {len(dupes)} values / {sum(len(v) for v in dupes.values())} pages")
    for k, v in sorted(dupes.items(), key=lambda x: -len(x[1]))[:10]:
        print(f"    x{len(v)}  {k[:78]}")
        for p in v:
            print(f"          {p}")

print()
print("== MISSING DESCRIPTION, by section ==")
sec = defaultdict(lambda: [0, 0])
for r in U:
    sec[r["section"]][0] += 1
    if not r["description"]:
        sec[r["section"]][1] += 1
for s, (n, m) in sorted(sec.items(), key=lambda x: -x[1][1]):
    if m:
        print(f"  {s:34} {m:4} of {n}")

print()
print("== LENGTH (deduped) ==")
for f, lo, hi in (("title", 20, 70), ("description", 50, 170)):
    v = [len(r[f]) for r in U if r.get(f)]
    s = sum(1 for x in v if x < lo)
    L = sum(1 for x in v if x > hi)
    print(f"  {f}: n={len(v)} short<{lo}={s} ok={len(v)-s-L} long>{hi}={L} median={sorted(v)[len(v)//2]}")

print()
print("== og:type values ==")
for v, c in Counter(r["og_type"] for r in U).most_common(6):
    print(f"  {c:5}  {v}")

print()
print("== SECTION SIZES (for pattern rules) ==")
for s, (n, m) in sorted(sec.items(), key=lambda x: -x[1][0]):
    img = sum(1 for r in U if r["section"] == s and r["og_image"])
    print(f"  /{s:38} pages={n:4}  have og:image={img}")

print()
print("== PAGES MISSING DESCRIPTION (full list) ==")
for r in U:
    if not r["description"]:
        print(f"  {r['path']}")

json.dump(U, open(os.path.join(HERE, "unique.json"), "w"), indent=1)
json.dump(redirects, open(os.path.join(HERE, "redirects.json"), "w"), indent=1)
