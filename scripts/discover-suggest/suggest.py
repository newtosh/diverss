#!/usr/bin/env python3
"""Emit a human-reviewable directory suggestion artifact (agent discovery scaffold).

Does not modify data/directory.json. Write suggestions to stdout or --out file
for pasting into a PR/issue. Never auto-merge.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--directory",
        type=Path,
        default=Path("data/directory.json"),
        help="path to curated directory JSON",
    )
    parser.add_argument(
        "--candidates",
        type=Path,
        help="optional JSON file of candidate feeds [{title,xmlUrl,htmlUrl?,category?,note?}]",
    )
    parser.add_argument("--out", type=Path, help="write markdown suggestion to this path")
    args = parser.parse_args()

    if not args.directory.is_file():
        print(f"directory not found: {args.directory}", file=sys.stderr)
        return 1

    directory = json.loads(args.directory.read_text(encoding="utf-8"))
    existing = {f.get("xmlUrl") for f in directory.get("feeds", []) if f.get("xmlUrl")}

    candidates = []
    if args.candidates and args.candidates.is_file():
        candidates = json.loads(args.candidates.read_text(encoding="utf-8"))
        if not isinstance(candidates, list):
            print("candidates must be a JSON array", file=sys.stderr)
            return 1

    new_items = []
    dupes = []
    for c in candidates:
        url = c.get("xmlUrl")
        if not url:
            continue
        if url in existing:
            dupes.append(c)
        else:
            new_items.append(c)

    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    lines = [
        f"# DiveRSS directory suggestions ({now})",
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
    else:
        for c in new_items:
            title = c.get("title", "(untitled)")
            url = c.get("xmlUrl")
            note = c.get("note", "")
            lines.append(f"- **{title}** — `{url}`" + (f" — {note}" if note else ""))
        lines.append("")
        lines.append("Suggested `data/directory.json` feed objects:")
        lines.append("")
        lines.append("```json")
        lines.append(json.dumps(new_items, indent=2))
        lines.append("```")
        lines.append("")

    if dupes:
        lines.append("## Skipped (already present)")
        lines.append("")
        for c in dupes:
            lines.append(f"- {c.get('title', '')} `{c.get('xmlUrl')}`")
        lines.append("")

    lines.append("## Review checklist")
    lines.append("")
    lines.append("- [ ] Feed parses and is actively maintained")
    lines.append("- [ ] Title and category are accurate")
    lines.append("- [ ] Not spam / not a thin affiliate mirror")
    lines.append("")

    text = "\n".join(lines)
    if args.out:
        args.out.write_text(text, encoding="utf-8")
        print(f"wrote {args.out}", file=sys.stderr)
    else:
        sys.stdout.write(text)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
