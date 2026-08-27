---
title: "GardenRSS identity cutover (keys, Go, docs) - Plan"
type: feat
date: 2026-08-27
topic: gardenrss-identity-cutover
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
origin: docs/plans/2026-08-27-002-feat-gardenrss-rebrand-plan.md (KD6 layer 2)
execution: code
---

# GardenRSS identity cutover (keys, Go, docs) - Plan

## Goal Capsule

- **Objective:** Finish the GardenRSS identity cutover in code and user-facing docs: no remaining runtime `diverss` / `DiveRSS` product identifiers except intentional historical plan archives. DNS `diverss` CNAME and local filesystem path are **out of scope** (operator-owned).
- **Product authority:** Package names, browser storage keys, download filenames, Go module / crawl CLI, Score User-Agents, CI paths, curation/data copy, and code comments. Does not change Score/Catalog/Tools behavior.
- **Origin:** Phase 1 chrome + host/repo rename already shipped (`2026-08-27-002`, PR #2). This plan is **KD6 layer 2** only.

---

## Settled decisions

| Decision | Choice |
|----------|--------|
| Storage / IndexedDB | **Accept wipe** — rename keys and Dexie DB name; no migrate helpers. Early dogfood only. |
| Go module | `github.com/newtosh/gardenrss` (matches GitHub) |
| Crawl CLI path | `cmd/diverss-crawl` → `cmd/gardenrss-crawl` |
| npm package names | root `gardenrss`; worker `gardenrss-score-worker` |
| Historical plan files | **Keep filenames**; add a one-line historical banner; **do not** mass-rewrite DiveRSS prose inside archived plans |
| User-facing docs / data JSON / code comments | Update to GardenRSS |
| DNS `diverss` CNAME | **Out** |
| Local clone directory rename | **Out** (operator) |

---

## Inventory (in scope)

### Browser storage → `gardenrss-*-v1`

| Current | New | File |
|---------|-----|------|
| `gardenrss-workspace-v1` (localStorage backup) | `gardenrss-workspace-v1` | `web/src/db/workspace.ts` |
| Dexie DB `gardenrss-workspace` | `gardenrss-workspace` | `web/src/db/workspace.ts` |
| `gardenrss-catalog-v1` | `gardenrss-catalog-v1` | `web/src/db/catalog.ts` |
| `gardenrss-outbox-v1` (sessionStorage) | `gardenrss-outbox-v1` | `web/src/outbox/store.ts` |
| `gardenrss-reader-connections-v1` | `gardenrss-reader-connections-v1` | `web/src/tools/connections.ts` |
| `gardenrss-filter-packs-v1` | `gardenrss-filter-packs-v1` | `web/src/tools/filters/localStore.ts` |
| `gardenrss-community-workspace-revert-v1` | `gardenrss-community-workspace-revert-v1` | `web/src/db/revertCommunityWorkspace.ts` |
| Download `gardenrss-export` / `gardenrss-filter-packs.json` | `gardenrss-export` / `gardenrss-filter-packs.json` | `web/src/opml/filename.ts`, `FilterPacksPanel.vue` |

Update matching specs (`*.spec.ts`) to assert new keys/filenames.

### Go + CI + packages

| Current | New |
|---------|-----|
| `module github.com/jonn/diverss` | `github.com/newtosh/gardenrss` |
| `cmd/diverss-crawl/` + imports | `cmd/gardenrss-crawl/` |
| DiveRSS UAs in `internal/score/*.go` | GardenRSS + `https://github.com/newtosh/gardenrss` |
| `.github/workflows/crawl-and-pages.yml` `go run ./cmd/diverss-crawl` | `./cmd/gardenrss-crawl` |
| root `package.json` `"name": "diverss"` | `gardenrss` |
| `workers/score` package name (+ lock) | `gardenrss-score-worker` |
| `scripts/dev-local.mjs` `[diverss]` logs | `[gardenrss]` |
| `web/vite.config.ts` legacy `/diverss/` comment | `/gardenrss/` or drop legacy note |

### Docs / data / comments (user-facing)

- `docs/directory-curation.md` — DiveRSS → GardenRSS; example out path
- `data/sources.json`, `web/public/data/sources.json` (and categories.json if branded)
- `data/categories.json` / `web/public/data/categories.json` if they say DiveRSS
- Filter comments: `compileMiniflux.ts`, `pullFromReader.ts`
- `ListFilterPanel.vue` depth-marker comment
- README layout row for crawl CLI path

### Historical plans (light touch only)

For each of:
`docs/plans/2026-08-24-001-feat-diverss-product-plan.md`,
`2026-08-24-002-…`, `2026-08-25-001-…`, `2026-08-26-001-…`, `2026-08-26-002-…`

Add under title (or YAML):  
`> Historical: written under the DiveRSS name; product is now GardenRSS.`

Do **not** rewrite bodies or rename files. Update `2026-08-27-002` KD6 layer 2 to “done” when this ships.

### Explicitly out

- Spaceship / `diverss.newto.sh` DNS
- Renaming the local checkout directory
- Renaming default git branch `feat/diverss-mvp`
- Route names (`outbox`, `#/outbox`) — internal; UI already says Deck
- `.playwright-mcp/` artifacts

---

## Implementation units

1. **Storage + downloads + specs** — rename constants; tests green; no migration code.
2. **Go module + crawl CLI + UAs + CI** — `go.mod` / imports / `git mv` cmd / workflow / `go test ./...`.
3. **npm package names + dev log prefix + vite comment** — mechanical.
4. **User-facing docs + data JSON + code comments** — GardenRSS wording.
5. **Historical plan banners + close KD6.2 on rebrand plan** — one-liners.

Execution direction: mechanical rename pass; run `web` unit tests + `go test ./...` + worker tests before PR. Expect empty Garden / cleared Tools connections after deploy for existing browsers (document in PR body).

---

## Success criteria

- Repo grep for runtime identifiers: no `diverss-*-v1`, no Dexie `gardenrss-workspace`, no `cmd/diverss-crawl`, no DiveRSS User-Agent, no `github.com/jonn/diverss` imports.
- User-facing markdown outside archived plan *bodies* speaks GardenRSS.
- CI crawl step still runs via `cmd/gardenrss-crawl`.
- Tests updated and passing.

## Risks

- Dogfooders lose local Garden / Deck / reader tokens / filter packs once (accepted).
- Go module path change requires CI to fetch the new module path (same repo; in-tree only — fine).
---

## Confidence

High — inventory is closed-set mechanical renames; wipe decision removes migration design risk.
