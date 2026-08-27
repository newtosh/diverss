---
title: Catalog Outbox and Categories Naming - Plan
type: feat
date: 2026-08-25
topic: catalog-outbox
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
product_contract_source: ce-brainstorm
execution: code
product_contract_preservation: "enriched-in-place"
---

# Catalog Outbox and Categories Naming - Plan

## Goal Capsule

- **Objective:** Replace Catalog's one-at-a-time Workspace add with a session **Outbox** (stage → remap categories → bulk import), and rename user-facing **Sections** to **Categories** for consistency with Add Category and Catalog language.
- **Product authority:** This plan owns Catalog→Workspace import UX and Categories naming in the SPA. Catalog browse/score/prune and Score Worker behavior stay as they are unless cited below.
- **Execution profile:** Feature-bearing SPA work; unit-test domain helpers first (`web/src/outbox/*.spec.ts`, mutate helpers), then wire UI; verify with `npm run type-check` and `npm run test:unit` under `web/`.
- **Stop conditions / open blockers:** None.
- **Tail ownership:** Implementer runs Verification Contract gates and leaves a clean diff (no abandoned experiments).

---

## Product Contract

### Summary

Catalog no longer adds feeds directly to the Workspace. Users stage feeds into an **Outbox**, review category mapping in a right-hand drawer (expandable to a dedicated route), then mass-import. Defaults come from **community groups** when present; matches to existing Workspace categories are surfaced clearly; otherwise the collection group is proposed as new. Feeds without a group land **Ungrouped** and are highlighted for assignment. Outbox lasts for the browser session across Catalog ↔ Workspace, with Clear/Reset; refresh clears it. Already-in-workspace feeds may be staged and flagged, but import skips them (no duplicates). Across the app, user-facing **Section(s)** copy becomes **Category / Categories**.

### Problem Frame

Catalog today appends one feed at a time to the OPML root and ignores `category` / `groups`, so bulk discovery from community packs creates remapping debt. Workspace already says "Add a category" while list chrome still says "Sections," which drifts from Catalog's Category filter and confuses import language.

### Key Decisions

- KD1. **Outbox is the only Catalog→Workspace add path** — replace per-row Add. (session-settled: user-directed — chosen over keep-both / outbox-first-with-secondary-Add) Governs R1, R2.
- KD2. **Community groups drive default categories** — when a Catalog group matches a Workspace category, surface the match; otherwise default to the community group as a proposed new category. (session-settled: user-approved) Governs R5, R6, R7.
- KD3. **No community group → Ungrouped**, highlighted for assignment in review. Curated directory category is not a default section in v1. (session-settled: user-directed — chosen over category-default or require-before-import) Governs R8.
- KD4. **Session Outbox** — survives Catalog ↔ Workspace navigation; cleared on refresh; explicit Clear/Reset. (session-settled: user-directed — chosen over session-only-on-Catalog or localStorage) Governs R3, R4.
- KD5. **Badge button + right drawer**, expandable to a dedicated route. (session-settled: user-approved) Governs R9, R10.
- KD6. **Already-in-workspace: allow stage, flag, skip on import** — no force-duplicate in v1. (session-settled: user-directed) Governs R11, R14.
- KD7. **Rename/move existing Workspace feeds via Outbox deferred.** (session-settled: user-directed — chosen over v1 sync-to-defaults) Governs Scope Boundaries.
- KD8. **User-facing Sections → Categories** for consistency with Add Category and Catalog. (session-settled: user-directed) Governs R15.

### Requirements

**Staging**

- R1. Catalog does not offer a direct "Add to workspace" that mutates the OPML; the primary per-feed control stages into the Outbox (or removes from it).
- R2. Staging a feed that is not already in the Workspace adds it to the Outbox; staging again removes it (toggle) or an explicit remove control exists in the Outbox UI.
- R3. Outbox contents persist for the browser tab session across Catalog and Workspace routes and are discarded on full page refresh.
- R4. The user can Clear / Reset the entire Outbox without importing.

**Category defaults and review**

- R5. When a staged feed has a community group path, the Outbox proposes that path as the import category (nested labels preserved where the pack provides them).
- R6. If the proposed category label matches an existing Workspace category (same matching rules as today's group-presence logic), the UI labels it as already in the Workspace (e.g. "Matches workspace").
- R7. If the proposed category does not match any Workspace category, the UI labels it as new (e.g. "New category") and import may create it.
- R8. Staged feeds with no community group default to Ungrouped (document root); those rows are visually highlighted in review so the user can assign a category before import.
- R9. In review, the user can remap any staged feed (or group of feeds sharing a proposal) to an existing Workspace category, a new category name, or Ungrouped.
- R10. Outbox entry points: a Catalog control with a badge/counter; a right-hand drawer for review/remap/import; a way to expand into a dedicated route when the list is large.

**Import**

- R11. Feeds already present in the Workspace may be staged; they are flagged in the Outbox and are **not** appended again on import.
- R12. Import creates any needed new categories, then appends each non-skipped feed under its chosen category (or Ungrouped), then persists the Workspace and clears successfully imported items from the Outbox (skipped-already-present rows may remain until Clear — see KTD2).
- R13. Import reports a short status summary (added / skipped-already-present / categories created).

**Naming consistency**

- R15. User-visible SPA copy that currently says "Section(s)" for OPML folders becomes "Category / Categories" (Workspace expand/collapse chrome, remove-folder confirmations, prune empty-folder checkbox, empty-state hints, aria-labels, Add Category modal helper text that still says "section"). Internal code identifiers may stay; user-facing strings are required.

**Actors / empty**

- R14. Outbox empty state explains how to stage feeds from Catalog; Import is disabled when there is nothing to add (only already-present rows, or empty Outbox).

### Key Flows

- F1. Stage and import net-new feeds under a matching category
  - **Trigger:** User stages Catalog feeds whose community group matches a Workspace category.
  - **Steps:** Open Outbox drawer; confirm "Matches workspace"; Import.
  - **Outcome:** Feeds appended under that category; Outbox updated; status shows added count.
  - **Covered by:** R1, R5, R6, R12, R13

- F2. Stage pack group as new category
  - **Trigger:** User stages feeds whose community group is not in the Workspace.
  - **Steps:** Review shows "New category"; user keeps or renames; Import.
  - **Outcome:** Category created; feeds appended under it.
  - **Covered by:** R5, R7, R9, R12

- F3. Ungrouped highlighted assignment
  - **Trigger:** User stages curated (or other) feeds with no community group.
  - **Steps:** Review highlights Ungrouped; user remaps some or all; Import.
  - **Outcome:** Feeds land under chosen categories or remain Ungrouped if left as-is.
  - **Covered by:** R8, R9, R12

- F4. Already-present skip
  - **Trigger:** User stages feeds already in the Workspace.
  - **Steps:** Outbox flags them; Import runs.
  - **Outcome:** No duplicate OPML rows; status reports skipped count.
  - **Covered by:** R11, R13, R14

- F5. Clear Outbox
  - **Trigger:** User chooses Clear/Reset with items staged.
  - **Outcome:** Outbox empty; Workspace unchanged.
  - **Covered by:** R4

### Acceptance Examples

- AE1. Matching community group
  - **Covers:** R5, R6, R12
  - **Given:** Workspace has category "Apple"; Catalog community feed has groups `["Apple"]` and is not in Workspace
  - **When:** User stages it and imports without remapping
  - **Then:** Feed appears under Workspace "Apple"; Outbox no longer lists it as pending add

- AE2. New community group
  - **Covers:** R5, R7, R12
  - **Given:** No Workspace category "Cyber security"; staged feed has that community group
  - **When:** User imports with the proposed new category
  - **Then:** "Cyber security" exists in Workspace and contains the feed

- AE3. Ungrouped highlight
  - **Covers:** R8, R9
  - **Given:** Staged curated feed with no `groups`
  - **When:** User opens Outbox review
  - **Then:** Feed is under Ungrouped and visually highlighted relative to mapped rows

- AE4. Skip already present
  - **Covers:** R11, R13
  - **Given:** Feed URL already in Workspace; user stages it into Outbox
  - **When:** User imports
  - **Then:** Feed count in Workspace unchanged for that URL; status notes skip

- AE5. Sections renamed
  - **Covers:** R15
  - **Given:** Workspace with folders
  - **When:** User views expand/collapse controls and prune empty-folder option
  - **Then:** Visible labels say Categories (or Category), not Sections

### Scope Boundaries

- **In:** Catalog Outbox staging, session persistence, drawer + expandable route, category propose/remap/create, bulk import, skip-already-present, Sections→Categories user-facing rename.
- **Out:** Persisting Outbox across refresh; force-duplicate import; Outbox-driven rename/move of existing Workspace feeds; changing Catalog score/prune; Score Worker; using curated directory `category` as automatic default category in v1.
- **Deferred:** Optional "apply defaults to existing" (title reset / move category) for already-present Outbox rows.

### Success Criteria

- A user can stage many Catalog feeds, remap categories once, and land them in the Workspace in one import without using a direct Add button.
- Matching vs new vs Ungrouped states are obvious in the Outbox before import.
- No duplicate URLs are created for already-present feeds on import.
- SPA copy no longer presents OPML folders as "Sections" in user-visible chrome covered by R15.

### Outstanding Questions

- None blocking. Former OQ1–OQ3 resolved as KTD1–KTD3 below.

---

## Planning Contract

### Key Technical Decisions

- KTD1. **Match + resolve categories using today's `groupPresence` rules** — casefold full `›` label **or** leaf folder name against `listSectionOptions` / workspace folder texts. For import path resolution: prefer exact full-label match to a `listSectionOptions` entry; else if the leaf uniquely matches one folder path, use that path; else treat as new and create folders from label segments. (resolves OQ1) Governs R5, R6, R7, R12.
- KTD2. **After import, drop only successfully added Outbox rows**; leave skipped-already-present rows until Clear/Reset. Import stays disabled when every remaining row is already-present (R14). (resolves OQ2) Governs R12, R14.
- KTD3. **Shared `OutboxPanel` + hash route `#/outbox` (`name: 'outbox'`)**; Catalog badge toggles a right drawer that hosts the same panel; "Expand" navigates to the route. Session module holds items + `drawerOpen`. (resolves OQ3) Governs R9, R10.
- KTD4. **Session module store** at `web/src/outbox/` (reactive module state, not `localStorage`) so Catalog, drawer, Outbox route, and App shell share one Outbox without Vuex/Pinia.
- KTD5. **Nested category creation** via new `ensureCategoryPath(doc, segments)` in `web/src/opml/mutate.ts` that walks/creates folders with existing `appendFolder` semantics (one segment at a time). Proposed labels split on ` › `.
- KTD6. **User-facing rename only for R15** — change visible strings / aria-labels / modal copy; keep internal names (`listSectionOptions`, `sectionPath`, prop names) unless a touch already rewrites the call site for clarity. Avoid a repo-wide identifier rename in this plan.
- KTD7. **Remap UX groups by proposed category key** — one remap control applies to all feeds sharing that proposal; optional per-feed override can be a later polish if time allows, not required for DoD.

### High-Level Technical Design

```text
Catalog row ──toggle──► outbox/store (session)
                              │
                 ┌────────────┴────────────┐
                 ▼                         ▼
         OutboxDrawer (Catalog)     Route #/outbox
                 └──────────┬──────────────┘
                            ▼
                      OutboxPanel
                   propose / remap / import
                            │
                            ▼
              ensureCategoryPath + appendFeed
                            │
                            ▼
                   saveWorkspace(OPML)
```

**Propose:** `groups?.join(' › ')` when non-empty → proposed label; else Ungrouped. **Presence:** extract shared helper from Catalog `groupPresence` / `workspaceGroupKeys` into `web/src/outbox/propose.ts` (or `web/src/opml/categories.ts`) so Catalog list badges and Outbox review share one matcher.

### Assumptions

- Hash history (`createWebHashHistory`) remains; `#/outbox` is fine under `BASE_URL`.
- Workspace membership continues to use `feedMembershipKeys` / normalize URL (already used by Catalog).
- Creating a nested path `"A › B"` creates folder A then B under A when missing; matching an existing leaf `"B"` under a different parent is the unique-leaf rule in KTD1 (if ambiguous, treat as new under the proposed full path).

### Implementation Constraints

- Follow existing modal/drawer visual language (slate/teal, Teleport overlays).
- Do not persist Outbox to `localStorage` / Dexie.
- KeepAlive on Catalog/Workspace must not fork Outbox state — store is module-scoped outside view instance state.

### Sequencing

1. U1 domain store + propose/match helpers + tests
2. U2 import / ensureCategoryPath + tests
3. U3 Catalog wiring + drawer + badge (replaces Add)
4. U4 dedicated route
5. U5 Categories copy pass (can parallelize with U3–U4 once strings are listed)

---

## Implementation Units

### U1. Outbox session store and category proposal helpers

- **Goal:** Stage/unstage feeds in session memory; compute default proposed category and match/new/ungrouped status from Workspace outlines.
- **Requirements:** R2, R3, R4, R5, R6, R7, R8, R11
- **Dependencies:** None
- **Files:**
  - Create: `web/src/outbox/types.ts`
  - Create: `web/src/outbox/store.ts`
  - Create: `web/src/outbox/propose.ts`
  - Create: `web/src/outbox/propose.spec.ts`
  - Create: `web/src/outbox/store.spec.ts`
  - Reference: `web/src/views/CatalogView.vue` (`groupPresence`, `workspaceGroupKeys`, `groupLabel`)
  - Reference: `web/src/opml/url.ts` (`normalizeFeedUrl`, `feedMembershipKeys`)
- **Approach:** Define `OutboxItem` with `xmlUrl`, `title`, `htmlUrl?`, `groups?`, `proposedCategory` (string | null for Ungrouped), `remapCategory` (user override), `alreadyInWorkspace` flag refreshed against current Workspace. Store: `items` map by normalized URL, `drawerOpen`, `clear()`, `toggle()`, `setRemap()`, `remove()`. `proposeCategory(groups)` and `categoryPresence(label, workspaceOutlines)` mirror Catalog matching (KTD1).
- **Test scenarios:**
  - Toggle stages and unstages by normalized URL
  - `clear()` empties items
  - Empty groups → Ungrouped proposal + presence `none`
  - Groups `['Apple']` with Workspace folder Apple → presence `existing`
  - Groups `['Cyber security']` with no match → presence `new`
  - Nested `['A','B']` joins to `A › B`
- **Verification:** `cd web && npm run test:unit -- src/outbox/propose.spec.ts src/outbox/store.spec.ts`

### U2. Category path ensure + bulk import into Workspace

- **Goal:** Given Outbox items + current OPML, create categories as needed, append non-duplicate feeds, return summary counts, and update the store per KTD2.
- **Requirements:** R7, R11, R12, R13, R14
- **Dependencies:** U1
- **Files:**
  - Modify: `web/src/opml/mutate.ts` (`ensureCategoryPath`)
  - Modify: `web/src/opml/opml.spec.ts`
  - Create: `web/src/outbox/import.ts`
  - Create: `web/src/outbox/import.spec.ts`
  - Reference: `web/src/db/workspace.ts` (`saveWorkspace` / snapshot APIs as Catalog uses today)
- **Approach:** `ensureCategoryPath(doc, segments: string[])` returns `{ document, path }` creating missing folders. `importOutbox(doc, items, membershipKeys)` skips `alreadyInWorkspace`, resolves remap||proposed (null → root), ensures path, `appendFeed` with `folderPath`, returns `{ document, added, skippedPresent, categoriesCreated }`. Caller persists Workspace and removes added URLs from the store.
- **Test scenarios:**
  - Import into existing category path without creating folders
  - Import creates nested `A › B` when missing
  - Remap to Ungrouped appends at root
  - Already-present URL skipped; document unchanged for that URL
  - Summary counts correct when mix of add + skip
- **Verification:** `cd web && npm run test:unit -- src/opml/opml.spec.ts src/outbox/import.spec.ts`

### U3. Catalog stage controls, badge, and Outbox drawer

- **Goal:** Replace per-row Add with Outbox toggle; show badge/counter; host review/remap/import UI in a right drawer.
- **Requirements:** R1, R2, R4, R8, R9, R10, R13, R14
- **Dependencies:** U1, U2
- **Files:**
  - Create: `web/src/components/OutboxDrawer.vue`
  - Create: `web/src/components/OutboxPanel.vue`
  - Modify: `web/src/views/CatalogView.vue` (remove `addFeed` Workspace write; stage toggle; badge; mount drawer)
  - Prefer Catalog header action row beside Score / Community for the badge button
  - Reference: `web/src/components/PruneFeedsModal.vue` / `CommunitySourcesModal.vue` for overlay patterns
- **Approach:** Row CTA: "Add to Outbox" / "In Outbox" (keep "In workspace" membership hint; still allow stage when present per R11). Badge opens drawer. Panel lists groups by proposed/remap key with presence chips (Matches workspace / New category / Ungrouped highlighted). Remap control: existing category select (`listSectionOptions`) + "New…" text + Ungrouped. Import runs U2 against loaded Workspace, `saveWorkspace`, status line, store update. Clear/Reset available. Expand control routes to `#/outbox` and closes drawer.
- **Test scenarios:**
  - Prefer lightweight panel unit tests if extracted pure formatters; otherwise rely on U1/U2 + manual smoke
  - Smoke: stage two feeds → badge shows 2 → import → Workspace gains feeds → badge decreases
- **Verification:** `cd web && npm run type-check`; manual Catalog smoke on staged import

### U4. Dedicated Outbox route

- **Goal:** Full-page Outbox using the same panel for large lists.
- **Requirements:** R10
- **Dependencies:** U3
- **Files:**
  - Create: `web/src/views/OutboxView.vue`
  - Modify: `web/src/router/index.ts`
  - Minimum: Expand from drawer navigates to the route
- **Approach:** `OutboxView` loads Workspace (and refreshes `alreadyInWorkspace` flags), embeds `OutboxPanel` with `variant="page"`. Route `path: '/outbox', name: 'outbox'`. KeepAlive optional; store remains source of truth.
- **Test scenarios:**
  - Router registers `outbox`; Expand from drawer navigates without losing items
- **Verification:** `cd web && npm run type-check`; manual navigation smoke

### U5. User-facing Sections → Categories rename

- **Goal:** Align visible SPA language with Categories (R15 / KTD6).
- **Requirements:** R15
- **Dependencies:** None (can ship after or beside U3)
- **Files:**
  - Modify: `web/src/views/WorkspaceView.vue`
  - Modify: `web/src/components/OutlineList.vue` ("Remove section")
  - Modify: `web/src/components/PruneFeedsModal.vue` (empty sections copy)
  - Modify: `web/src/components/AddCategoryModal.vue` / `AddFeedModal.vue` helper text that still says "section"
  - Modify: `web/src/views/CatalogView.vue` legend copy ("matches a section…")
- **Approach:** String/aria pass only. Prefer "Categories" for plurals, "Category" for singular. Prune checkbox: "Also remove empty categories."
- **Test scenarios:**
  - Grep gate: no user-facing `Section` / `Sections` labels remain in modified Vue templates (allow HTML `<section>` tags and code identifiers)
- **Verification:** `cd web && npm run type-check`; visual spot-check Workspace + prune modal + Add Category

---

## Verification Contract

- `cd web && npm run type-check`
- `cd web && npm run test:unit -- src/outbox/propose.spec.ts src/outbox/store.spec.ts src/outbox/import.spec.ts src/opml/opml.spec.ts`
- Manual smoke: stage matching + new + ungrouped + already-present → import → confirm OPML placement, skip behavior, badge/drawer/route, Clear
- Grep templates for leftover user-facing "Section(s)" after U5

---

## Definition of Done

- All R1–R15 (as applicable) satisfied via U1–U5
- AE1–AE5 behaviors observable in manual smoke or unit coverage
- Verification Contract commands pass
- No direct Catalog→Workspace `appendFeed` remains on Catalog rows
- Abandoned spikes removed from the diff
- Plan Outstanding Questions remain empty / resolved as KTDs

---

## Risks & Dependencies

- **Ambiguous leaf match:** two folders named "News" under different parents — KTD1 says treat as new full path; document in UI if remap needed.
- **KeepAlive + workspace staleness:** Outbox import must reload/save Workspace the same way Catalog `addFeed` did (`loadWorkspace` / `saveWorkspace`) so Workspace view sees updates on activate.
- **Depends on:** existing `appendFeed` / `appendFolder` / `listSectionOptions` / membership helpers.
