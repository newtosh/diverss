#!/usr/bin/env python3
"""Emit a human-reviewable directory suggestion artifact (agent discovery scaffold).

Does not modify data/directory.json. Write suggestions to stdout or --out file
for pasting into a PR/issue. Never auto-merge.
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable

DEFAULT_SCAN_URL = "https://gardenrss.newto.sh/api/scan"
SCAN_BATCH_SIZE = 25

# A candidate with no post inside this window is inactive noise, not signal.
MIN_ACTIVITY_DAYS = 30

ScanFn = Callable[[list[str], str], dict[str, dict]]


def scan_via_api(urls: list[str], scan_url: str) -> dict[str, dict]:
    """POST urls to the deployed Scan API, keyed by xmlUrl. Best-effort: a
    request failure yields {} so callers fall back to "could not verify"
    rather than crashing the whole suggestion run."""
    results: dict[str, dict] = {}
    for i in range(0, len(urls), SCAN_BATCH_SIZE):
        chunk = urls[i : i + SCAN_BATCH_SIZE]
        body = json.dumps({"urls": chunk}).encode("utf-8")
        req = urllib.request.Request(
            scan_url,
            data=body,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                parsed = json.loads(resp.read().decode("utf-8"))
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as e:
            print(
                f"warning: scan API unreachable ({e}); skipping freshness check",
                file=sys.stderr,
            )
            return {}
        for r in parsed.get("results", []):
            url = r.get("xmlUrl")
            if url:
                results[url] = r
    return results


def gate_by_freshness(
    candidates: list[dict], scan_url: str, scan_fn: ScanFn = scan_via_api
) -> tuple[list[dict], list[dict], list[dict]]:
    """Split candidates into (fresh, inactive, unverified), fresh sorted by
    most recent post first. A candidate with a post inside MIN_ACTIVITY_DAYS
    is fresh; a reachable feed with none is inactive; an unreachable feed (or
    scan API not configured) is unverified — reviewed by hand, not silently
    dropped."""
    if not candidates:
        return [], [], []
    urls = [c["xmlUrl"] for c in candidates]
    scanned = scan_fn(urls, scan_url)

    fresh, inactive, unverified = [], [], []
    for c in candidates:
        r = scanned.get(c["xmlUrl"])
        if r is None:
            unverified.append(c)
            continue
        last_dated_at = r.get("lastDatedAt")
        if r.get("health") != "ok" or not last_dated_at:
            inactive.append({**c, "_reason": r.get("reason", "no dated posts")})
            continue
        age_days = (
            datetime.now(timezone.utc)
            - datetime.fromisoformat(last_dated_at.replace("Z", "+00:00"))
        ).days
        if age_days > MIN_ACTIVITY_DAYS:
            inactive.append({**c, "_reason": f"last post {age_days}d ago"})
            continue
        fresh.append(
            {**c, "_lastDatedAt": last_dated_at, "_posts30d": r.get("posts30d") or 0}
        )

    # Volume first: a technically-active-but-sparse feed (e.g. a publisher's
    # secondary/legacy endpoint) should rank below its higher-cadence
    # sibling, not just get lost in recency ties.
    fresh.sort(key=lambda c: (c["_posts30d"], c["_lastDatedAt"]), reverse=True)
    return fresh, inactive, unverified


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--directory",
        type=Path,
        default=Path("data/directory.json"),
        help="path to directory.json",
    )
    parser.add_argument(
        "--categories",
        type=Path,
        default=Path("data/categories.json"),
        help="path to categories.json (validates candidate category ids)",
    )
    parser.add_argument(
        "--candidates",
        type=Path,
        help="optional JSON file of candidate feeds [{title,xmlUrl,htmlUrl?,category?,note?}]",
    )
    parser.add_argument(
        "--out", type=Path, help="write markdown suggestion to this path"
    )
    parser.add_argument(
        "--scan-url",
        default=DEFAULT_SCAN_URL,
        help="Scan API base for the freshness check (default: deployed prod API)",
    )
    parser.add_argument(
        "--no-verify",
        action="store_true",
        help="skip the freshness check (offline/testing)",
    )
    args = parser.parse_args()

    if not args.directory.is_file():
        print(f"directory not found: {args.directory}", file=sys.stderr)
        return 1

    directory = json.loads(args.directory.read_text(encoding="utf-8"))
    existing = {f.get("xmlUrl") for f in directory.get("feeds", []) if f.get("xmlUrl")}

    known_categories: set[str] = set()
    if args.categories.is_file():
        cat_doc = json.loads(args.categories.read_text(encoding="utf-8"))
        known_categories = {
            c.get("id") for c in cat_doc.get("categories", []) if c.get("id")
        }

    candidates = []
    if args.candidates and args.candidates.is_file():
        candidates = json.loads(args.candidates.read_text(encoding="utf-8"))
        if not isinstance(candidates, list):
            print("candidates must be a JSON array", file=sys.stderr)
            return 1

    new_items = []
    dupes = []
    bad_category = []
    for c in candidates:
        url = c.get("xmlUrl")
        if not url:
            continue
        if url in existing:
            dupes.append(c)
            continue
        cat = c.get("category")
        if known_categories and cat and cat not in known_categories:
            bad_category.append(c)
            continue
        new_items.append(c)

    if args.no_verify:
        fresh, inactive, unverified = new_items, [], []
    else:
        fresh, inactive, unverified = gate_by_freshness(new_items, args.scan_url)

    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    lines = [
        f"# GardenRSS directory suggestions ({now})",
        "",
        "Human review required. Do **not** auto-merge.",
        "",
        f"Current directory size: **{len(existing)}** feed(s).",
        "",
        "## Proposed adds",
        "",
    ]
    if not new_items:
        lines.append("_No new candidates (pass `--candidates` with a JSON array)._")
        lines.append("")
    elif not fresh:
        lines.append("_No candidates passed the freshness check (see below)._")
        lines.append("")
    else:
        for c in fresh:
            title = c.get("title", "(untitled)")
            url = c.get("xmlUrl")
            note = c.get("note", "")
            cat = c.get("category", "")
            extra = []
            if cat:
                extra.append(f"`{cat}`")
            if "_lastDatedAt" in c:
                extra.append(f"{c['_posts30d']} posts/30d · last {c['_lastDatedAt']}")
            if note:
                extra.append(note)
            suffix = (" — " + " · ".join(extra)) if extra else ""
            lines.append(f"- **{title}** — `{url}`{suffix}")
        lines.append("")
        lines.append(
            "Suggested `data/directory.json` feed objects (ranked by 30d volume, ties by recency):"
        )
        lines.append("")
        clean = [{k: v for k, v in c.items() if not k.startswith("_")} for c in fresh]
        lines.append("```json")
        lines.append(json.dumps(clean, indent=2))
        lines.append("```")
        lines.append("")

    if inactive:
        lines.append(f"## Skipped (no post in last {MIN_ACTIVITY_DAYS}d)")
        lines.append("")
        for c in inactive:
            lines.append(
                f"- {c.get('title', '')} `{c.get('xmlUrl')}` — {c.get('_reason', '')}"
            )
        lines.append("")

    if unverified:
        lines.append("## Could not verify (scan failed — review by hand)")
        lines.append("")
        for c in unverified:
            lines.append(f"- {c.get('title', '')} `{c.get('xmlUrl')}`")
        lines.append("")

    if dupes:
        lines.append("## Skipped (already present)")
        lines.append("")
        for c in dupes:
            lines.append(f"- {c.get('title', '')} `{c.get('xmlUrl')}`")
        lines.append("")

    if bad_category:
        lines.append("## Skipped (unknown category id)")
        lines.append("")
        lines.append(
            "Use an `id` from `data/categories.json`: "
            + ", ".join(sorted(known_categories))
            + "."
        )
        lines.append("")
        for c in bad_category:
            lines.append(
                f"- {c.get('title', '')} `{c.get('xmlUrl')}` "
                f"(category=`{c.get('category')}`)"
            )
        lines.append("")

    lines.append("## Review checklist")
    lines.append("")
    lines.append("- [ ] Feed parses and is actively maintained")
    lines.append("- [ ] Title and category id are accurate")
    lines.append("- [ ] Not spam / not a thin affiliate mirror")
    lines.append("")

    text = "\n".join(lines)
    if args.out:
        args.out.write_text(text, encoding="utf-8")
        print(f"wrote {args.out}", file=sys.stderr)
    else:
        sys.stdout.write(text)
    return 0


def _self_check() -> None:
    """Smallest runnable check for gate_by_freshness's branching: fresh vs
    inactive vs unverified, and volume-first ranking. Run with --self-check.
    The high-volume/low-volume pair mirrors the real daringfireball.net
    /feeds/main (48 posts/30d) vs /feeds/articles (8 posts/30d) case — both
    pass the activity gate, so volume has to be the tiebreaker."""
    from datetime import timedelta

    now = datetime.now(timezone.utc)

    def days_ago(n: int) -> str:
        return (
            (now.replace(microsecond=0) - timedelta(days=n))
            .isoformat()
            .replace("+00:00", "Z")
        )

    fixtures = {
        "https://high-volume.example/feed": {
            "xmlUrl": "https://high-volume.example/feed",
            "health": "ok",
            "posts30d": 48,
            "lastDatedAt": days_ago(2),
        },
        "https://low-volume.example/feed": {
            "xmlUrl": "https://low-volume.example/feed",
            "health": "ok",
            "posts30d": 8,
            "lastDatedAt": days_ago(0),
        },
        "https://dead.example/feed": {
            "xmlUrl": "https://dead.example/feed",
            "health": "ok",
            "posts30d": 0,
            "lastDatedAt": days_ago(90),
        },
        # "https://unreachable.example/feed" deliberately absent -> unverified
    }

    def fake_scan(urls: list[str], _scan_url: str) -> dict[str, dict]:
        return {u: fixtures[u] for u in urls if u in fixtures}

    candidates = [
        {"title": "Low Volume (newer)", "xmlUrl": "https://low-volume.example/feed"},
        {"title": "High Volume (older)", "xmlUrl": "https://high-volume.example/feed"},
        {"title": "Dead", "xmlUrl": "https://dead.example/feed"},
        {"title": "Unreachable", "xmlUrl": "https://unreachable.example/feed"},
    ]
    fresh, inactive, unverified = gate_by_freshness(
        candidates, "unused", scan_fn=fake_scan
    )

    # Volume beats recency: High Volume ranks first despite being 2 days
    # older than Low Volume — exactly the daringfireball.net case.
    assert [c["title"] for c in fresh] == [
        "High Volume (older)",
        "Low Volume (newer)",
    ], fresh
    assert [c["title"] for c in inactive] == ["Dead"], inactive
    assert [c["title"] for c in unverified] == ["Unreachable"], unverified
    assert gate_by_freshness([], "unused", scan_fn=fake_scan) == ([], [], [])
    print("self-check ok", file=sys.stderr)


if __name__ == "__main__":
    if "--self-check" in sys.argv:
        _self_check()
        raise SystemExit(0)
    raise SystemExit(main())
