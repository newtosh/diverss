---
title: "GardenRSS rebrand pivot - Plan"
type: feat
date: 2026-08-27
topic: gardenrss-rebrand
artifact_contract: ce-unified-plan/v1
artifact_readiness: requirements-only
product_contract_source: ce-brainstorm
execution: code
---

# GardenRSS rebrand pivot - Plan

## Goal Capsule

- **Objective:** Reposition the product from DiveRSS (dive / scuba metaphor) to **GardenRSS** — marketing and in-product language centered on curating growth and pruning weeds in an evergreen RSS subscription garden — without changing the OPML-first, not-a-reader product boundary.
- **Product authority:** Naming, voice, surface labels, docs, badges, and host/package identity. Feature behavior (Score, Catalog, Tools, filters) stays unless a rename clarifies the garden metaphor.
- **Open blockers:** Host cutover details and icon mark. Wordmark **GardenRSS**, **Garden** / **Deck** renames, and keeping **Catalog** / **Tools** are settled. Hosting: Vercel Hobby + `*.newto.sh`.

---

## Namespace check (2026-08-27)

| Surface | Status | Notes |
|---------|--------|--------|
| Exact GitHub user/org `gardenrss` | Free (404) | No `gardenRSS` user either |
| GitHub repos named `gardenrss` | None found | Search `total_count: 0` |
| npm `gardenrss` / `garden-rss` | Free | |
| PyPI / crates.io `gardenrss` | Free | |
| Public apex domains | **Out of scope** | Not registering `.com`/`.dev`/etc. this pivot |
| Live host | `gardenrss.newto.sh` | Cutover done; Vercel project + GitHub repo renamed `gardenrss` |

### Soft collisions (not blockers; shape messaging)

1. **arbowl/garden** — self-hosted LLM “garden” of RSS with AI personas. Same metaphor, different product (reader/community vs OPML workshop). Differentiate: *subscription garden / OPML garden*, never claim “AI garden reader.”
2. **Software Garden / ListGarden™** — legacy RSS *authoring* tool; footer claims “Garden” as a registered mark of Software Garden, Inc. Compound **GardenRSS** is distinct; still avoid standalone “Garden” as the product wordmark and don’t imply affiliation.
3. **garden.io** — DevOps Kubernetes tool. Unrelated; no RSS association.

**Verdict:** Exact `gardenrss` identifier looks clear for GitHub/npm. Ship identity on `gardenrss.newto.sh` under the existing newto.sh + Vercel Hobby setup. Metaphor is crowded enough that voice must stay specific (curate · prune · evergreen · OPML).

---

## Product Contract

### Summary

GardenRSS is the same calm, local-first OPML workspace — import, Score, prune, organize, stage via Outbox, export, sync to readers — framed as tending a **subscription garden**: plant healthy feeds, prune weeds (stale/unhealthy/blocked), keep an evergreen bed of sources. Not a feed reader. Hosted like DiveRSS: **Vercel Hobby** SPA + Edge APIs, public URL on **`gardenrss.newto.sh`**.

### Problem Frame

“DiveRSS” reads as adventure/reader-adjacent and underuses the product’s real loop (already described internally as list gardening). Garden language matches pruning, catalog planting, filter weeds, and long-lived OPML better than scuba.

### Key Decisions

- **KD1. Public name (settled):** `GardenRSS` (PascalCase wordmark) / `gardenrss` (package, repo, DNS label lowercase).
- **KD2. Subtitle (settled):** Category line **RSS feed manager**, plus a short garden tagline. In-app header uses:
  - `RSS feed manager · prune weeds, keep evergreen`
  - Replaces `OPML workspace · not a reader`. The “not a reader” boundary stays in product docs / longer view intros where needed, not the chrome subtitle.
- **KD3. Metaphor map** for surfaces (user-facing labels). **Workspace → Garden** and **Outbox → Deck** are hard renames (settled). **Catalog** and **Tools** keep their current names (settled).

| Today | GardenRSS direction | Rationale |
|-------|---------------------|-----------|
| Workspace | **Garden** (hard rename — settled) | Primary bed of feeds |
| Catalog | **Catalog** (keep — settled) | Sources to plant / browse |
| Outbox | **Deck** (hard rename — settled) | Holding deck before planting into Garden |
| Tools | **Tools** (keep — settled) | Reader sync + filters |
| Score | **Health check** / **Vitality** (keep Score as short label OK) | Evergreen signal |
| Prune | **Prune** (keep — already garden) | Weeds out |
| Filter packs / block | **Weeding** / **Weed filters** | Block/keep packs as weed control |
| Stale / Unhealthy / Blocked | **Wilting / Dead / Fenced** (optional; may keep clinical health terms for clarity) | Don’t sacrifice clarity for cute |

- **KD4. Iconography (settled):** Phosphor `ph:plant-fill` (Iconify) replaces scuba-mask.
- **KD5. Hosting (settled):** Stay on **Vercel Hobby** + **newto.sh subdomain**. No public apex domain purchase. Cutover complete: `gardenrss.newto.sh` is live; `diverss.newto.sh` CNAME + Vercel domain removed (no temporary redirect).
- **KD6. Identity cutover layers (phased):**
  1. **Voice + UI chrome** (titles, nav, copy, README, document title) — ship first.
  2. **Package / storage keys / CLI** — cutover in `2026-08-27-003` (wipe-accept rename).
  3. **DNS + Vercel project** — done: project `gardenrss`, host `gardenrss.newto.sh`.
  4. **GitHub repo** — done: `newtosh/gardenrss` (local filesystem path remains user-owned).

### Requirements

- **R1.** User-visible brand string is GardenRSS everywhere the UI shows a product name (header, `document.title`, export filenames where branded, empty states).
- **R2.** README + directory-curation docs + PR template speak GardenRSS; DiveRSS mentioned once as former name only if redirect copy needs it.
- **R3.** Nav and primary actions use the settled metaphor map (KD3); health pills may keep ok/stale/unhealthy for precision unless a voice pass proves garden synonyms clearer.
- **R4.** Badges (README shields, “not a reader”, license) updated; no DiveRSS left in user-facing markdown.
- **R5.** Filter / prune / catalog copy lean into plant–prune–weed language without renaming Miniflux-native block/keep (those stay technical).
- **R6.** Public URL is `https://gardenrss.newto.sh` (or confirmed label) on Vercel Hobby; Spaceship DNS CNAME on `newto.sh` only — **no apex domain registration**.
- **R7.** Repo rename and package rename are explicit follow-on tasks; UI/docs may land first on the existing `diverss` repo to avoid breaking CI mid-flight.
- **R8.** Do not change the product boundary: still not a reader; still local-first OPML; still Score + Catalog + Tools.

### Non-goals

- Registering or marketing a public apex domain (`.com` / `.dev` / etc.).
- Building an in-app “garden visualization” or timeline UI in this pivot.
- Competing with arbowl/garden’s AI persona reader.
- Full trademark registration in this pass (research only).
- Rewriting all historical plan filenames under `docs/plans/` (optional archive note).

### Success Criteria

- Cold visitor understands “garden your OPML / prune weeds” within the first viewport.
- Zero user-facing “DiveRSS” strings in SPA + README after Phase 1.
- `gardenrss.newto.sh` serves the SPA; old `diverss.newto.sh` redirects or is removed by choice.
- Existing Workspace/Catalog/Tools flows unchanged in behavior.

---

## Workstreams (scaffold only — HOW deferred to implementation plan)

1. **Voice kit** — wordmark, tagline, do/don’t metaphor glossary, icon choice.
2. **UI chrome pass** — `App.vue`, view titles, empty states, Tools status copy, filter contribute links.
3. **Docs + badges** — README, curation docs, PR template, filter-packs README.
4. **Storage/package migration design** — IndexedDB / localStorage key rename strategy (migrate vs reset).
5. **Subdomain cutover** — Spaceship `gardenrss` CNAME on `newto.sh` → Vercel; update Vercel domain aliases; optional redirect from `diverss`.
6. **Repo identity** — rename `newtosh/diverss` → `gardenrss` when Phase 1 is stable (optional).

---

## Decisions Needed

1. Whether IndexedDB wipe on package rename is acceptable for MVP users (likely yes — early dogfood).
2. ~~Redirect policy~~ — **settled:** delete old `diverss` record (no redirect).
3. ~~Iconography~~ — **settled:** Phosphor `ph:plant-fill`.

---

## Risks

- Metaphor collision with arbowl/garden → clarify OPML/subscription garden in every hero line.
- Soft trademark adjacency to Software Garden → prefer compound GardenRSS; avoid “Garden™” alone.
- Deep `diverss` identifiers in Go module paths / CI → phase mechanical renames after UI voice lands.
- Subdomain-only URL is fine for dogfood; revisit apex domain only if public launch needs it later.
