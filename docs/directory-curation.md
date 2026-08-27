# Directory curation & discovery sessions

GardenRSS keeps a **curated public directory** separate from any one user’s OPML.
Catalog in the SPA only shows **merged** `data/` published through CI — never
pending proposals.

## Sources of truth

| Path | Role |
|------|------|
| `data/categories.json` | Canonical category taxonomy (`id` + label) |
| `data/directory.json` | Curated feeds; each feed’s `category` **must** be a category `id` |
| `data/sources.json` | Opt-in upstream awesome/OPML sources (attribution + URLs) |
| `web/public/data/*` | Published copies for local Vite / Pages (CI overwrites on crawl) |

Schema: directory `schemaVersion` **2** references categories via slug ids.

## Two layers (do not conflate)

1. **Curated directory** (`directory.json`) — small, gardener-owned baseline. Shown in Catalog by default. Human merge only.
2. **Community sources** (`sources.json`) — transparent pointers to existing awesome lists / OPML bundles. **Never** auto-merged into the curated directory. Users (or discovery sessions) **opt in** to parse a source, then choose what to keep.

## Opt-in parsing of awesome / community lists

Goal: borrow breadth from the ecosystem without laundering someone else’s curation as GardenRSS’s own.

**Rules**

- Show **attribution** (project name + homepage) whenever a feed or pack came from a source.
- User must **explicitly enable** a source (or enable it for one discovery session) before we fetch/parse.
- Parsed results land in the **user’s local Catalog list** (browser storage),
  not silently into `data/directory.json`, and **not** into the OPML workspace.
  Adding a Catalog row to the workspace remains a separate action.
- Prefer **official site feeds** over RSSHub/proxy routes when both exist (reuse proxy-unwrap heuristics).
- Respect upstream **license / ToS**; keep `license` filled in `sources.json` before shipping a parser UI.
- Score after parse so opt-in packs can be pruned (Unhealthy / Stale) like any other OPML.

**Suggested UX**

- Catalog: **Community sources…** → pick an **entire collection** pack (default;
  category/section packs are Advanced-only) → browse sections → **Add to Catalog**.
- **Advanced…** can Add selected section packs straight into the Catalog; **Done**
  closes the wizard. Catalog list refreshes with the new count.
- From Catalog rows, **Add to workspace** is the only path into the user’s OPML.
- Attribution shown on community rows; curated `directory.json` stays gardener-owned.
- Discovery session: same registry as input; emit candidates with `sourceId`.

Known upstreams registered in `data/sources.json` (entrypoints may need pinning):

- Plenary / awesome-RSS-feeds (category OPMLs)
- opml-news-feeds (topic/language bundles)
- awesome-rsshub-routes (official + RSSHub index — use carefully)

## Baseline seed

The initial directory is a **human-curated baseline** (not agent-generated):
Apple, EDC, Gadgets, Technology, Security, Open source, News, Design, Gaming,
Science. Grow it by PR; prune via crawl health over time. Community sources
are an **expansion path**, not a replacement for this baseline.

## Discovery session (outside Catalog)

A **discovery session** is a gardener/agent pass that surfaces candidates for
human review. It is **not** an in-app Catalog feature and does **not** write
`data/directory.json` directly.

Suggested loop:

1. **Inputs** — current `data/directory.json` + `data/categories.json`; optional
   personal OPML; optional **opt-in** `sources.json` packs; optional topic prompts.
2. **Automated probes** (session tooling, future scripts) — parse opted-in OPMLs,
   site HTML autodiscovery, well-known feed paths, Score Worker health checks.
   Prefer feeds that Score as Healthy (or intentionally Stale with a note).
3. **Emit** — candidate JSON array (include `sourceId` when from a community
   list) → `scripts/discover-suggest/suggest.py` → markdown PR/issue body.
   Never auto-merge.
4. **Human gate** — verify parse quality, category id, attribution, no spam/mirrors; merge.
5. **Publish** — crawl workflow copies data + writes `scores.json`; Catalog
   refreshes on next Pages deploy.

Workspace-side “suggestions while editing an OPML” (R7) can later consume the
**same published directory** (and crawl scores) without running discovery inside
the Catalog page.

## Agent scaffold today

```bash
python3 scripts/discover-suggest/suggest.py \
  --candidates scripts/discover-suggest/example-candidates.json \
  --out /tmp/gardenrss-suggestions.md
```

Extend candidates with real session output; keep category ids from
`data/categories.json`.
