---
title: Tools Accordion and Filter Packs Workflow - Plan
type: feat
date: 2026-08-27
topic: tools-filters-workflow
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
product_contract_source: ce-brainstorm
execution: code
product_contract_preservation: "enriched-in-place"
---

# Tools Accordion and Filter Packs Workflow - Plan

## Goal Capsule

- **Objective:** Refactor Tools so each RSS service is an **accordion panel** (one open at a time), then add an **in-app filter-pack workflow** inside each live reader panel: browse and draft packs from a **repo schema**, apply via **Miniflux API** when connected, and **copy-paste** when API apply is unavailable (e.g. Current).
- **Product authority:** This plan owns Tools shell layout and the filter-pack product surface. Existing Miniflux/FreshRSS connect, push/pull, wipe, and proxy behavior stay as already shipped unless cited. Workspace/Catalog/Outbox/Score are out of scope. Surrounding ideas (visual filter builder, FreshRSS apply, hosted AI) are contextual only — not active requirements.
- **Execution profile:** SPA-first under `web/`; extend Miniflux adapter for feed `PUT` filter fields; ship packs as static JSON under `web/public/data/` (same pattern as Catalog directory data). Unit-test schema, compile/copy, and apply merge logic; smoke Tools accordion + Miniflux apply manually.
- **Stop conditions / open blockers:** None blocking. Deferred: Miniflux Settings-page **true global** filter API (if/when exposed); FreshRSS API apply; visual builder; LLM generation.
- **Tail ownership:** Implementer runs Verification Contract gates and leaves a clean diff.

---

## Product Contract

### Summary

Tools today stacks every reader as a full-height card. Users moving from Tapestry → Current (and self-hosted Miniflux) need a quieter shell and a way to **block signal noise** with the same kind of keyword/regex rules they already maintain in Current — without DiveRSS becoming a feed reader.

This work ships in two slices under one contract: (A) accordion Tools shell, then (B) filter packs as a first-class workflow inside each reader panel. Packs live in the repo with a simple schema so contributors can PR new packs. Apply prefers the connected reader’s API (Miniflux first). Copy-paste is the honest fallback for clients without API filter support.

### Problem Frame

Full-size reader cards make Tools hard to scan once multiple services and ops are live. Separately, noise filtering lives in client UIs (Current muffle/mute) or server rules (Miniflux block/keep), with no shared authoring surface and no reusable pack format. Users who already have strong Current/Tapestry regexes want those patterns preserved, applied to Miniflux when possible, and shareable via PR — without inventing a DiveRSS timeline or an LLM “assistant.”

### Key Decisions

- KD1. **One plan, Tools shell first** — accordion is a thin prerequisite; filters follow in the same product arc. (session-settled: user-directed — chosen over filters-only / shell-only)
- KD2. **Accordion = one reader panel open at a time.** (session-settled: user-directed — chosen over independent multi-open)
- KD3. **In-app filter workflow, not an LLM assistant** — browse, draft, apply, copy; no hosted generation in v1. (session-settled: user-directed — chosen over ChatGPT paste-only / user API key / DiveRSS-hosted AI)
- KD4. **Repo-stored packs + PR submissions** with a simple shared schema. (session-settled: user-directed)
- KD5. **Miniflux API apply first**; **copy-paste fallback** when API apply is unavailable or the target has no filter API. (session-settled: user-directed — chosen over Current-only / packs-only)
- KD6. **Pack scope: specific feeds and/or global.** (session-settled: user-directed)
- KD7. **Behavior intent is stored** (`muffle` | `mute`); **Miniflux apply maps both → block** for v1; per-target adapters stay flexible for later clients. (session-settled: user-directed — chosen over mute-only-on-server / Current-semantics-only)
- KD8. **Filters live inside each reader accordion panel**, not a separate nav area. (session-settled: user-directed)
- KD9. **Seed packs** from the user’s Tapestry/Current rules: iPhone SEO, Streaming Clickbait, Fortnite Chapter. (session-settled: user-directed)
- KD10. **Still not a feed reader; still no DiveRSS accounts** — packs and apply do not add article reading or hosted auth. Aligns with existing Tools product identity.

### Actors

- A1. **OPML / Tools user** — connects Miniflux (or FreshRSS), manages lists, wants less noise on the server or in Current.
- A2. **Pack contributor** — adds or edits filter packs via PR using the published schema.
- A3. **SPA visitor** — can browse shipped packs and copy fallback text without connecting a reader.

### Requirements

**Tools shell**

- R1. Tools presents each reader (live and stub) as a **collapsible panel**; **at most one panel is expanded** at a time.
- R2. Collapsed panels show enough identity to choose (reader name plus connection/summary hint when known).
- R3. Expanding a live reader reveals the existing connection and ops surfaces for that reader (connect, test, push/pull, wipe, empty categories) without requiring a second page.
- R4. Stub readers remain clearly non-live when collapsed or expanded.

**Filter packs**

- R5. DiveRSS ships a **versioned, documented pack schema** simple enough for PR review (name, behavior intent, match logic, field targets, optional feed URL selectors and/or global flag, human notes).
- R6. At least **three seed packs** check in matching the user’s Current/Tapestry rules: **iPhone SEO**, **Streaming Clickbait**, **Fortnite Chapter** (regex/keyword and title/body intent preserved in the schema).
- R7. Inside each **live** reader panel, the user can **browse** shipped packs and **draft/edit** a pack in-app using the same schema (workflow UI — not model chat).
- R8. When Miniflux is connected, the user can **Apply** a pack via API to the reader (per-feed and/or global according to pack scope and Miniflux capabilities).
- R9. Apply reports clear success or failure; failures do not pretend the reader was updated.
- R10. When API apply is unavailable (no connection, unsupported reader, or target without filter API), the UI offers **copy-paste** output suitable for Current-style rule entry (and remains usable for A3).
- R11. Miniflux apply maps pack behaviors `muffle` and `mute` to **block** semantics for v1; the pack retains original intent for copy-paste and future adapters.
- R12. FreshRSS (and stubs) may expose browse + copy-paste in v1; **API apply is Miniflux-first** unless planning finds a trivial equivalent.
- R13. Contributors can add packs via **repository PR**; the product documents the schema and contribution expectation.
- R14. Filter workflow does not turn DiveRSS into a reader of article content.

### Key Flows

- F1. Accordion navigation
  - **Trigger:** User opens Tools.
  - **Actors:** A1, A3
  - **Steps:** See collapsed reader list → expand one panel → prior panel collapses → use that reader’s tools.
  - **Outcome:** Only one reader surface open; ops stay reachable without scrolling a stack of full cards.
  - **Covered by:** R1–R4

- F2. Apply pack to Miniflux
  - **Trigger:** User expands Miniflux with a working connection and chooses Apply on a pack.
  - **Actors:** A1
  - **Steps:** Select pack (or draft) → confirm scope (feeds/global) → DiveRSS calls Miniflux filter APIs → show verified/failed summary.
  - **Outcome:** Matching noise is blocked on the server for future fetches; user sees an honest result.
  - **Covered by:** R5–R9, R11

- F3. Copy-paste fallback (Current)
  - **Trigger:** User needs rules on a client without filter API (or is not connected).
  - **Actors:** A1, A3
  - **Steps:** Open Filters in a reader panel (or browse packs) → Copy for Current → paste into Current Edit Rule.
  - **Outcome:** Same pack intent is usable outside Miniflux.
  - **Covered by:** R10, R11

- F4. Contribute a pack
  - **Trigger:** User (or A2) authors a useful rule set.
  - **Actors:** A2, A1
  - **Steps:** Draft in schema (in-app or file) → open PR → review → pack ships with the app.
  - **Outcome:** Shared library grows without DiveRSS hosting accounts or AI.
  - **Covered by:** R5, R6, R13

### Acceptance Examples

- AE1. Accordion exclusivity
  - **Covers:** R1
  - **Given:** Miniflux panel is open
  - **When:** User expands FreshRSS
  - **Then:** Miniflux collapses; only FreshRSS is expanded

- AE2. Seed pack present
  - **Covers:** R6
  - **Given:** Shipped app build
  - **When:** User opens Filters under Miniflux
  - **Then:** iPhone SEO, Streaming Clickbait, and Fortnite Chapter packs are listed with recognizable names

- AE3. Miniflux apply when connected
  - **Covers:** R8, R9, R11
  - **Given:** Valid Miniflux connection and a pack scoped to a feed URL that exists on the reader
  - **When:** User applies the pack
  - **Then:** Reader filter state reflects a block rule for that intent; UI reports success (or a specific failure if the API rejects)

- AE4. Fallback without API
  - **Covers:** R10
  - **Given:** No Miniflux connection (or stub reader)
  - **When:** User chooses copy for Current on Streaming Clickbait
  - **Then:** Clipboard/text includes the regex and field hints needed to recreate the rule in Current

- AE5. Identity preserved
  - **Covers:** R14, KD10
  - **Given:** Filter workflow is available
  - **When:** User completes apply or copy
  - **Then:** No article-reading surface was introduced; credentials remain browser-local as in existing Tools

### Scope Boundaries

**Deferred for later**

- Visual / guided **filter builder** UI beyond schema draft/edit.
- FreshRSS (or other servers) **API apply**.
- Hosted or in-app **LLM generation**.
- Perfect parity of Current **muffle** (collapse-in-timeline) on Miniflux.
- Separate top-nav Filters area.
- Writing Miniflux **Settings-page global** filters via API (not exposed in public REST docs for v1 — see KTD3).

**Outside this product’s identity**

- In-app unread river or article reading.
- DiveRSS user accounts or cloud sync of personal packs (repo PR remains the share path for v1).

### Success Criteria

- S1. Tools is usable with one open reader panel; existing Miniflux/FreshRSS ops still work from the expanded panel.
- S2. Seed packs from the user’s Tapestry/Current rules are browsable in-product.
- S3. A connected Miniflux user can apply a pack and see an honest success/failure outcome tied to server filter state.
- S4. A Current-only user can copy pack content without connecting a server.
- S5. A contributor can add a pack via PR against a documented simple schema.

---

## Planning Contract

### Key Technical Decisions

- KTD1. **Extract reader panels from `ToolsView.vue`** into small presentational components (`ReaderAccordion`, `MinifluxPanel`, `FreshRssPanel`, stub panel) so accordion state and Filters don’t explode the monolith further. Follow existing Tools slate/teal patterns and KeepAlive `onActivated` refresh.
- KTD2. **Packs as static JSON** under `web/public/data/filter-packs/` (+ `index.json` manifest), loaded like Catalog `directory.json`. Schema module + Zod-or-hand validators in `web/src/tools/filters/`. Contribution doc in `docs/` or a short README beside the packs.
- KTD3. **Miniflux apply = per-feed `PUT /v1/feeds/{id}` with `blocklist_rules`.** Read current rules, **merge** (append unique lines), write back. Pack `global: true` means “apply this block rule to **every feed** on the connected reader via per-feed API,” with UI copy that this is fan-out, not Miniflux Settings globals (Settings globals lack a documented public API today).
- KTD4. **Compile pack → Miniflux RE2 lines** in a pure function (`compilePackToMinifluxBlocklist`). Prefer `EntryTitle=` / `EntryContent=` style when targeting modern entry fields; fall back to title-oriented patterns for simple keyword packs. Strip Current-style `/.../` delimiters when compiling. Invalid empty patterns fail closed before any PUT.
- KTD5. **Apply merge policy = append-if-absent** (normalize whitespace; skip duplicate lines). Never wipe unrelated existing blocklist lines. Report counts: feeds touched, lines added, feeds skipped (no URL match), errors.
- KTD6. **Copy-paste formatter** emits a plain-text Current cheat sheet: Rule Name, Behavior, Match (Any/All), Fields, Pattern, Notes — clipboard via `navigator.clipboard.writeText` with textarea fallback.
- KTD7. **Draft edits are session-only** in v1 (in-memory / component state). Persistence path remains PR into `web/public/data/filter-packs/`.
- KTD8. **Extend `ReaderAdapter` optionally** with `supportsFilterApply` + `applyBlockRules?(...)` rather than forcing FreshRSS stubs to fake apply; Miniflux implements; FreshRSS returns unsupported → UI shows copy-only.
- KTD9. **FreshRSS API apply is out** — GReader API has no clean Miniflux-equivalent blocklist surface for v1 (R12).

### Technical Design

**Accordion:** `expandedId: LiveReaderId | StubReaderId | null`. Default: first connected live reader if any, else `null` (all collapsed) or `miniflux` if that was last — prefer **first connected**, else all collapsed. Header row: name, connected badge / feed count chip, chevron.

**Schema (directional — not final code):**

```text
FilterPack v1
  id: string                 # stable slug
  name: string
  behavior: muffle | mute
  match: any | all
  pattern: string            # keyword or regex body (no required /delimiters/)
  patternKind: keyword | regex
  fields: title | body | content_warning[]   # Current-oriented intent
  scope: { global: boolean, feedUrls?: string[] }
  notes?: string
  schemaVersion: 1
```

**Seed content (from user’s Current/Tapestry screens):**

| Pack | Pattern (intent) | Fields | Behavior |
|------|------------------|--------|----------|
| iPhone SEO | lookahead-style iPhone/iOS + feature/ability/trick | title | muffle |
| Streaming Clickbait | free/streaming/hit/10/10 style alternation | title, body, content_warning | muffle |
| Fortnite Chapter | keyword `Fortnite Chapter` | title | muffle |

Seed packs may ship with `feedUrls: []` + `global: false` and rely on Apply UI to pick feeds from `listFeeds()` when applying; or `global: true` for fan-out. Prefer **Apply UI feed multi-select** defaulting to pack `feedUrls` when present.

**Miniflux compile sketch (directional):** keyword → `(?i)literal`; regex → strip `/` wrappers; multi-field → multiple `EntryTitle=` / `EntryContent=` lines; `match: all` for multiple patterns is **out of v1 schema** (single `pattern` string; complex AND stays inside one regex as in iPhone SEO seed).

### Assumptions

- A1. Miniflux instances are ≥ 2.0.27 (blocklist_rules on feeds).
- A2. Existing `readerFetch` / proxy path is sufficient for `PUT /v1/feeds/{id}`.
- A3. Catalog-style static JSON under `web/public/data/` is acceptable for pack distribution on Vercel.
- A4. User accepts that Miniflux block is stronger than Current muffle (KD7).

### Dependencies and sequencing

1. U1 Accordion shell (unblocks readable Filters placement)
2. U2 Schema + seed packs + load/validate
3. U3 Compile + Current copy formatter
4. U4 Miniflux apply (adapter + merge + verify readback)
5. U5 Filters UI inside panels + contribution doc

U2–U3 can overlap after U1; U5 needs U2–U4.

---

## Implementation Units

### U1. Tools reader accordion shell

- **Goal:** One-open-at-a-time reader panels; preserve existing Miniflux/FreshRSS/stub behavior inside expanded bodies.
- **Files:** `web/src/views/ToolsView.vue`, `web/src/components/tools/ReaderAccordion.vue` (new), optional `web/src/components/tools/MinifluxPanel.vue` / `FreshRssPanel.vue` / `StubReaderPanel.vue`
- **Patterns:** Existing Tools slate/teal cards; KeepAlive `onActivated` connection refresh in ToolsView.
- **Test scenarios:**
  - Expanding B collapses A (unit or component test on accordion state helper).
  - Connected summary chips still render when collapsed (feed count if known).
- **Verification:** `cd web && npm run test:unit --` for any new accordion helper; manual Tools smoke for push/wipe still reachable.
- **Covered by:** R1–R4, F1, AE1, S1

### U2. Filter pack schema, seeds, and loader

- **Goal:** Versioned schema, three seed packs, manifest load + validate.
- **Files:** `web/src/tools/filters/types.ts`, `web/src/tools/filters/schema.ts`, `web/src/tools/filters/load.ts`, `web/src/tools/filters/schema.spec.ts`, `web/public/data/filter-packs/index.json`, `web/public/data/filter-packs/*.json`, short `web/public/data/filter-packs/README.md` (or `docs/filter-packs.md`)
- **Patterns:** Catalog `dataUrl('directory.json')` fetch; hand validation like other Tools modules if Zod not already in web deps — prefer no new dependency.
- **Test scenarios:**
  - Valid seed packs parse.
  - Invalid pack (missing name/pattern) rejected.
  - Manifest lists exactly the three seed ids.
- **Verification:** `cd web && npm run test:unit -- src/tools/filters`
- **Covered by:** R5, R6, R13, AE2, S2, S5

### U3. Compile to Miniflux blocklist + Current copy text

- **Goal:** Pure transforms from pack → Miniflux lines and → clipboard cheat sheet.
- **Files:** `web/src/tools/filters/compileMiniflux.ts`, `web/src/tools/filters/formatCurrentCopy.ts`, matching `*.spec.ts`
- **Patterns:** Keep RE2-oriented output; document field mapping in comments next to compile.
- **Test scenarios:**
  - Keyword Fortnite → case-insensitive block line.
  - Regex with `/.../` delimiters stripped.
  - iPhone SEO multi-lookahead preserved as single EntryTitle rule (or documented split).
  - Current copy includes name, behavior, fields, pattern.
  - Empty pattern throws / returns error result.
- **Verification:** unit tests above
- **Covered by:** R10, R11, AE4, S4

### U4. Miniflux filter apply (adapter + merge + readback)

- **Goal:** Apply compiled block lines to selected feeds via API; merge safely; report honest results.
- **Files:** `web/src/tools/types.ts`, `web/src/tools/readers/miniflux.ts`, `web/src/tools/readers/miniflux.spec.ts`, `web/src/tools/filters/apply.ts`, `web/src/tools/filters/apply.spec.ts`
- **Patterns:** Existing `createMinifluxAdapter` + `readerFetch`; wipe verify style (read after write).
- **Test scenarios:**
  - Merge appends new line when absent.
  - Merge skips duplicate line.
  - Global fan-out selects all listed feeds.
  - Specific `feedUrls` matches by normalized feed URL; unmatched URLs counted as skipped.
  - PUT failure surfaces per-feed error without claiming success.
  - FreshRSS adapter does not implement apply (unsupported).
- **Verification:** `cd web && npm run test:unit -- src/tools/readers/miniflux.spec.ts src/tools/filters/apply.spec.ts`
- **Covered by:** R8, R9, R11, R12, F2, AE3, S3

### U5. Filters section UI + contribution pointer

- **Goal:** Inside each live reader panel (and browse/copy on stubs as appropriate): list packs, draft fields, Apply (Miniflux), Copy for Current, link to contribution README.
- **Files:** `web/src/components/tools/FilterPacksPanel.vue` (new), wire into Miniflux/FreshRSS/stub panels; status/error reuse Tools page status line
- **Patterns:** WipeBackupModal confirm density; SelectionActionBar busy/status honesty.
- **Test scenarios:**
  - Apply disabled when Miniflux not ready; Copy still enabled.
  - After successful apply, status names feeds touched / lines added.
- **Verification:** `cd web && npm run type-check`; manual smoke on deployed Tools with Miniflux token
- **Covered by:** R7, R10, R13, F3, F4, AE4, AE5

---

## Verification Contract

| Gate | Command / action | Applies to |
|------|------------------|------------|
| Unit | `cd web && npm run test:unit -- src/tools/filters src/tools/readers/miniflux.spec.ts` | U2–U4 |
| Types | `cd web && npm run type-check` | U1, U5 |
| Manual | Tools accordion exclusivity; Miniflux Apply on one feed; Copy paste sample; wipe/push still work | U1, U4, U5 |

---

## Definition of Done

- [ ] Accordion: only one reader panel expanded; live ops unchanged in expanded body
- [ ] Three seed packs load in UI
- [ ] Miniflux Apply merges blocklist_rules and reports success/failure honestly
- [ ] Copy for Current produces usable cheat-sheet text
- [ ] Contribution README documents schema + PR path
- [ ] Unit + type-check gates green
- [ ] Product Contract requirements R1–R14 have an owning unit

---

## Appendix

### Research notes (Miniflux)

- Feed filters: `blocklist_rules` / `keeplist_rules` on feed create/update (`PUT /v1/feeds/{id}`), Miniflux ≥ 2.0.27.
- Newer entry-field syntax (`EntryTitle=`, etc.) documented for Settings/global and newer filtering; feed-level legacy regex still common — compile should prefer Entry* lines and be tested against a real instance during smoke.
- Settings-page **global** filters are productized in Miniflux UI; public API coverage for those globals was not found for v1 — hence KTD3 fan-out.

### Resolved brainstorm questions

- Q1 → KTD3/KTD5 (per-feed PUT, merge append, global = fan-out).
- Q2 → KTD6 (structured Current cheat sheet).
- Q3 → KTD7 (session-only drafts).
