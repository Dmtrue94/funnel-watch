#!/usr/bin/env python3
# Funnel Watch · © 2026 Dzmitry · https://github.com/Dmtrue94/funnel-watch
# Licensed under CC BY-NC 4.0: credit the author and link the repo; no commercial use without permission.
"""Funnel Watch diff for scheduled sessions.

  python3 fw_diff.py grab TOOL_RESULT_FILE OUT.json                 # pull extractor JSON out of a saved browser tool result
  python3 fw_diff.py build OUT.json PART1.json [PART2.json ...]   # merge extractor outputs into one snapshot
  python3 fw_diff.py diff PREV_DIR_OR_FILE NEW.json OUT.json       # compare with previous snapshot (dir from ArtifactData out_dir is fine)
"""
import datetime as dt
import glob
import json
import os
import sys

NOISY = {"order", "screens_reached", "country", "entry_url", "stop_reason", "screens_walked", "final_path", "enrich_error"}


def load(p):
    if os.path.isdir(p):
        files = sorted(glob.glob(os.path.join(p, "**", "*.json"), recursive=True))
        if not files:
            return None
        p = files[-1]
    if not os.path.exists(p):
        return None
    d = json.load(open(p))
    return d.get("data", d) if isinstance(d, dict) and "data" in d and "competitor" not in d else d


def fmt(v, n=120):
    s = ", ".join(map(str, v)) if isinstance(v, list) else ("" if v is None else str(v))
    return s if len(s) <= n else s[: n - 1] + "…"


def by_key(items):
    return {str(i.get("key")): i for i in items or []}


def diff_list(old, new, section, truncate_old=False):
    out = []
    o, n = by_key(old), by_key(new)
    removed = o.keys() - n.keys()
    if truncate_old:  # Calm reveals screens progressively: a shorter walk is not a removal
        last = max((int(k) for k in n if k.isdigit()), default=0)
        removed = {k for k in removed if not (k.isdigit() and int(k) > last)}
    added = n.keys() - o.keys()
    # same position, new key = the screen's text changed (generic walker keys screens by their title)
    opos = {str(i.get("key")): x for x, i in enumerate(old or [])}
    npos = {str(i.get("key")): x for x, i in enumerate(new or [])}
    for ka in sorted(added, key=lambda k: npos.get(k, 0)):
        kr = next((k for k in removed if opos.get(k) == npos.get(ka)), None)
        if kr is not None and section == "steps":
            out.append({"section": section, "kind": "changed", "key": ka, "field": "title", "before": fmt(o[kr].get("title")), "after": fmt(n[ka].get("title")), "title": f"screen #{npos[ka] + 1}"})
            added = added - {ka}; removed = removed - {kr}
    for k in sorted(added):
        out.append({"section": section, "kind": "added", "key": k, "detail": fmt(n[k].get("title") or n[k].get("name") or n[k].get("page"))})
    for k in sorted(removed):
        out.append({"section": section, "kind": "removed", "key": k, "detail": fmt(o[k].get("title") or o[k].get("name") or o[k].get("page"))})
    for k in sorted(n.keys() & o.keys()):
        for f in sorted(set(n[k]) | set(o[k])):
            if f == "key":
                continue
            if n[k].get(f) != o[k].get(f):
                out.append({"section": section, "kind": "changed", "key": k, "field": f, "before": fmt(o[k].get(f)),
                            "after": fmt(n[k].get(f)), "title": fmt(n[k].get("title") or n[k].get("name") or n[k].get("page"), 70)})
    ok = [str(i.get("key")) for i in old or [] if str(i.get("key")) in n]
    nk = [str(i.get("key")) for i in new or [] if str(i.get("key")) in o]
    if ok != nk and sorted(ok) == sorted(nk):
        out.append({"section": section, "kind": "reordered", "key": "*", "detail": f"{sum(a != b for a, b in zip(ok, nk))} positions moved"})
    return out


def diff_dict(old, new, section, prefix=""):
    out = []
    for k in sorted(set(old or {}) | set(new or {})):
        if k in NOISY:
            continue
        a, b = (old or {}).get(k), (new or {}).get(k)
        if isinstance(a, dict) and isinstance(b, dict):
            out += diff_dict(a, b, section, prefix + k + ".")
        elif a != b:
            out.append({"section": section, "kind": "changed", "key": prefix + k, "before": fmt(a), "after": fmt(b)})
    return out


def diff_texts(old, new, section):
    o, n = set(old or []), set(new or [])
    return ([{"section": section, "kind": "added", "key": "text", "detail": fmt(t, 200)} for t in sorted(n - o)] +
            [{"section": section, "kind": "removed", "key": "text", "detail": fmt(t, 200)} for t in sorted(o - n)])


def build(out, parts):
    snap = {}
    for p in parts:
        d = json.load(open(p))
        for k, v in d.items():
            if k == "meta" and "meta" in snap:
                snap["meta"].update(v)
            else:
                snap[k] = v
    snap.setdefault("funnel_map", []); snap.setdefault("steps", []); snap.setdefault("products", []); snap.setdefault("paywall_texts", [])
    if "checkout_texts" in snap:
        snap["paywall_texts"] = snap.pop("checkout_texts")
    snap["date"] = dt.date.today().isoformat()
    snap["captured_at"] = dt.datetime.now(dt.timezone.utc).isoformat(timespec="minutes")
    json.dump(snap, open(out, "w"), ensure_ascii=False)
    print(f"snapshot {snap.get('competitor')} variant={snap.get('variant')} steps={len(snap['steps'])} products={len(snap['products'])} bytes={os.path.getsize(out)}")


def diff(prev_p, new_p, out):
    new = json.load(open(new_p))
    prev = load(prev_p)
    res = {"competitor": new.get("competitor"), "date": new.get("date"), "variant": new.get("variant"), "items": []}
    if not prev:
        res["status"] = "baseline"
    else:
        res["prev_date"] = prev.get("date")
        if prev.get("variant") != new.get("variant"):
            res["items"].append({"section": "variant", "kind": "changed", "key": "variant", "before": prev.get("variant"), "after": new.get("variant")})
        items = res["items"]
        items += diff_dict(prev.get("meta"), new.get("meta"), "meta")
        items += diff_list(prev.get("funnel_map"), new.get("funnel_map"), "funnel_map")
        items += diff_list(prev.get("steps"), new.get("steps"), "steps", truncate_old=new.get("platform") == "rise" or new.get("competitor") == "calm")
        items += diff_list(prev.get("products"), new.get("products"), "products")
        items += diff_texts(prev.get("paywall_texts"), new.get("paywall_texts"), "paywall_copy")
        res["status"] = "changed" if items else "unchanged"
    res["count"] = len(res["items"])
    json.dump(res, open(out, "w"), ensure_ascii=False)
    print(f"{res['competitor']}: {res['status']} ({res['count']} changes vs {res.get('prev_date')})")
    for it in res["items"][:40]:
        if it["kind"] == "changed":
            print(f"  ≠ [{it['section']}] {it.get('title') or it['key']} · {it.get('field', '')}: {it['before']} → {it['after']}")
        else:
            print(f"  {'+' if it['kind'] == 'added' else '−' if it['kind'] == 'removed' else '⇅'} [{it['section']}] {it.get('detail')}")


def grab(src, out):
    import re
    raw = open(src).read()
    try:
        raw = "".join(x.get("text", "") for x in json.loads(raw))
    except Exception:
        pass
    m = re.search(r"FWJSON<<(.*)>>FWJSON", raw, re.S)
    body = m.group(1) if m else raw
    try:
        d = json.loads(body)
    except Exception:
        d = json.loads(json.loads('"' + body + '"'))  # payload was double-encoded
    json.dump(d, open(out, "w"), ensure_ascii=False)
    print(f"grabbed {out}: {', '.join(f'{k}={len(v) if isinstance(v, (list, dict)) else v}' for k, v in d.items() if k in ('competitor', 'variant', 'steps', 'products', 'funnel_map'))}")


if __name__ == "__main__":
    cmd = sys.argv[1]
    if cmd == "grab":
        grab(sys.argv[2], sys.argv[3])
    if cmd == "build":
        build(sys.argv[2], sys.argv[3:])
    elif cmd == "diff":
        diff(sys.argv[2], sys.argv[3], sys.argv[4])
