---
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
product_contract_source: ce-brainstorm
execution: code
---

# UI Consistency & Mobile Optimization Pass - Plan

**Product Contract preservation:** restructured, no scope change — the In Scope button-audit bullet now names two files (`FeedActionsMenu.vue`, `FeedUrlSuggestions.vue`) that were always covered by "all routes" but were missing from the enumeration (doc review finding).

---

## Goal Capsule

- **Objective:** Bring desktop button consistency (sizing/variant scale) and mobile nav/header/window-pane behavior up to the standard already implied elsewhere in the app, with the Deck panel (fastest-scaffolded UI) as the primary offender to fix. No horizontal scroll on mobile at any route. Verify across all breakpoints, run the frontend-design skill on the diff, then manual-test before PR.
- **Product authority:** Existing product shape (Garden/Catalog/Deck/Tools) and existing `gr-*` theme/component conventions are the anchor — this is a consistency and polish pass, not a redesign.
- **Open blockers:** None. PWA/iOS manifest optimization was raised in the original request but is explicitly out of scope for this plan (see Non-Goals) — track separately if still wanted.

## Product Contract

### Problem

Desktop: buttons across routes use inconsistent padding/height (e.g. `px-2.5 py-1.5` vs `px-3 py-2`) with no shared scale, most visible on the Deck panel (`web/src/components/OutboxPanel.vue`), which was scaffolded fastest and never reconciled against the rest of the UI. Its close button (`OutboxPanel.vue:232-240`) sits inline with Expand/Clear at equal visual weight — every other overlay in the app (`AddFeedModal.vue`, `CommunitySourcesModal.vue`, etc.) closes via backdrop-click + footer Cancel with no X icon at all, so Deck's inline X is the one non-conforming element, not the missing pattern.

Mobile: the header (`web/src/App.vue:47-107`) is a single non-collapsing flex row (logo + title/subtitle + nav pill tray + theme toggle + GitHub badge) with no responsive behavior — verified no `tailwind.config.*` exists, so default Tailwind v4 breakpoints (sm 640/md 768/lg 1024/xl 1280) apply everywhere already used in the codebase. There is no verified global overflow-x guard, and window panes (modals/drawers) have not been checked edge-to-edge at small viewports for content that could force horizontal scroll.

### In Scope

- **Desktop button audit, all routes:** Garden, Catalog, Deck (page + drawer variant), Tools, and all modals (`AddFeedModal`, `AddCategoryModal`, `CommunitySourcesModal`, `ExportOpmlModal`, `MoveFeedModal`, `PruneFeedsModal`, `PushPullModal`, `WipeBackupModal`), plus the standalone action buttons in `FeedActionsMenu.vue` and `FeedUrlSuggestions.vue`. Converge on one padding/height scale per button role (primary, secondary, icon-only, destructive); apply consistently.
- **Deck close-button conformity:** Add a standard top-right corner close (X) on the Deck panel, visually separated from the Expand/Clear action row, matching the window-pane convention users expect from a drawer/panel (distinct from the Cancel/backdrop-click convention used by form modals, which is unaffected).
- **Mobile header collapse:** Below a breakpoint, drop the subtitle line (`RSS feed manager · prune weeds, keep evergreen`) and shrink the header logo so the row (logo + title + nav + toggle + GitHub badge) fits without wrapping or overflowing.
- **Mobile nav bar rendering:** Nav pill tray, theme toggle, and GitHub badge must remain usable (tap targets, no clipping) at mobile widths once the header collapses.
- **Global horizontal-scroll prevention:** No route or open overlay may force horizontal scroll on any mobile viewport width. Verify existing window panes (modals, Deck drawer, Deck page) size correctly at each breakpoint with real content (long feed titles/URLs, populated groups).
- **Verification gates (process, not optional):**
  1. Manual check across all breakpoints (sm/md/lg/xl) after the above changes.
  2. Run the frontend-design skill review against the final diff.
  3. Manual step-through testing is the final gate before opening a PR — no PR without it.

### Non-Goals

- PWA manifest / iOS home-screen optimization — raised in the original request but deferred as separate future work; not touched by this plan.
- Color/variant overhaul (primary/secondary/danger semantics) — this pass is sizing/scale consistency, not a color-system rework.
- Hamburger/condensed nav menu — mobile nav uses the collapsing-header approach (hide subtitle, shrink logo), not a menu-based nav restructure.
- Any change to modal close convention (Cancel/backdrop-click) outside of Deck.

### Key Decisions

- **Deck gets a standard corner X; other modals unchanged.** *(session-settled: user confirmed after reviewing that no other modal in the codebase uses an X icon — they all rely on Cancel/backdrop-click.)*
- **Mobile header uses collapsing pattern (hide subtitle, shrink logo), not hamburger/condensed nav.** *(session-settled: user's explicit choice among presented options, referencing prior nitpub-project execution.)*
- **Button audit is sizing/scale-first, not a color/variant overhaul.** *(session-settled: user identified sizing inconsistency, not color/variant, as the concrete pain point.)*

### Acceptance Examples

- Opening the Deck drawer on desktop shows a corner X distinct from Expand/Clear; clicking it closes the drawer (existing close behavior/Escape handling unchanged).
- Any two same-role buttons (e.g. two secondary actions) on different routes use the same padding/height class set.
- On a mobile viewport (e.g. 375px wide), the header shows logo + title + nav + toggle + GitHub badge on one row with no subtitle, no wrapping, and no clipped tap targets.
- No route or open modal/drawer produces a horizontal scrollbar at 320px-767px viewport widths, including with a long feed title/URL in Deck or Garden lists.

### Outstanding Questions (for ce-plan)

- Exact shared button size scale (specific padding/height token values) per role. **Resolved — see KTD1.**
- Exact breakpoint at which the mobile header collapses (subtitle hides, logo shrinks). **Resolved — see KTD4.**
- Icon/placement details for the Deck corner-X (size, spacing from panel edge, relation to header title). **Resolved — see U5** (opposite-corner placement via `justify-between`, explicit tab order).

---

## Planning Contract

### Grounding

- No shared button component exists. `rg` across `web/src` found ~90 hand-authored `<button>`/`<a>` action elements in ~20 files using at least 8 distinct padding combinations (`px-2 py-1.5`, `px-2.5 py-1.5`, `px-3 py-1.5`, `px-3 py-2`, `px-4 py-2`, plus icon-only `p-1.5`).
- Destructive actions are inconsistent: some use `bg-red-700`/`border-red-700` or `border-red-300` (raw Tailwind reds, not `gr-*` tokens); most destructive actions use no distinct color at all (e.g. `OutboxPanel.vue:224-231` Clear button is styled identically to a neutral secondary action).
- `web/src/App.vue:19-20` already establishes the codebase's own precedent for consolidating repeated button classes into a shared string constant (`navTabClass`) — this plan extends that instinct into a real component because the button surface is far larger and role-varied (primary/secondary/danger/icon) than the nav tabs' two states.
- No `web/src/assets/main.css` overflow-x guard exists today (`@import 'tailwindcss'` + `@theme` tokens only).
- `web/src/__tests__/App.spec.ts` is the only component-level spec in the repo (mounts `App.vue` with a memory router, asserts visible text). No spec exists for `OutboxPanel.vue` or `OutboxDrawer.vue`.
- jsdom (the test runtime) does not evaluate CSS media queries or layout, so Tailwind responsive classes (`sm:hidden`, etc.) are not meaningfully unit-testable — the plan's mobile-collapse and overflow work rely on the manual breakpoint pass already required by the Product Contract, not new automated viewport tests.

### Key Technical Decisions

- **KTD1 — Button.vue component, not shared class strings.** *(session-settled: user-directed — chosen over exporting `button*Class` string constants like the existing `navTabClass` pattern: a component enforces the contract at every future call site, a string constant can still be hand-copied wrong.)* Scale: two sizes — `sm` (`px-2.5 py-1.5 text-xs`; icon-only `p-1.5`, matching the label size's own `py-1.5` so an icon-only `sm` button sits the same height as a label `sm` button beside it — see the touch-target note below) and `md` (`px-3 py-2 text-sm`, icon-only `p-2` with a `min-h-10 min-w-10` floor). Component: `web/src/components/ui/Button.vue`, props `variant: 'primary' | 'secondary' | 'danger' | 'ghost'`, `size?: 'sm' | 'md'` (default `md`), `iconOnly?: boolean`, standard `disabled` passthrough, default slot for label/icon content. Variant class maps (mirroring existing call sites so migration is a lookup, not a design decision): `primary` = `border-gr-accent-strong bg-gr-accent-strong text-white hover:brightness-90` (per `OutboxPanel.vue:384`); `secondary` = `border-gr-border bg-gr-surface hover:bg-gr-surface-2` (per `OutboxPanel.vue:219,226`); `ghost` = `border-transparent text-gr-text-muted hover:bg-gr-surface-2 hover:text-gr-text` (per the theme-toggle button pattern already in `web/src/App.vue`). `iconOnly` requires the consumer to pass `aria-label` (documented on the prop, not runtime-enforced).
  - **Post-implementation revisions (ponytail-review + PR feedback, not re-litigated per unit):** a `type` prop (button/submit/reset passthrough) was built and then cut — zero call sites across the ~90-button migration ever set it, so `Button.vue` hardcodes `type="button"`. A Copilot review later asked for it back; declined as not-addressing since the premise (a real submit/reset caller) doesn't exist in this codebase — add it back if one shows up. The `sm` icon-only 40px tap-target floor was also raised again in review; the user explicitly reviewed the Deck close control at both sizes via screenshots and chose the smaller, label-height-matched size for this specific desktop-first admin control over the generic floor — declined as a deliberate, evidence-verified UX call, not reverted.
- **KTD2 — Standardized leading-icon slot.** *(session-settled: user-directed — chosen over reserving fixed leading-icon space on every button regardless of whether it has one: forced placeholder space on icon-less buttons adds visual clutter for no benefit here.)* **Removed post-implementation (ponytail-review):** built as a named `#icon` slot before the default slot, but zero real call sites in U3/U4 ever used it — every button with an icon (e.g. FeedActionsMenu's trigger) puts it in the default slot instead. Kept here for decision history; re-add if a real multi-icon-position need shows up.
- **KTD3 — Danger variant absorbs existing raw-red usage without a color-system overhaul.** Consolidates the ad-hoc `red-300`/`red-700` destructive buttons onto one `gr-*`-token-based danger style (border/bg using a single new `--color-gr-danger`/`--color-gr-danger-strong` pair, mirroring the existing `gr-accent`/`gr-accent-strong` pattern in `web/src/assets/main.css`). This is scale/token consolidation of an already-implied role, not a new color system — consistent with the Non-Goals boundary. Both tokens must meet 4.5:1 text contrast against `gr-surface` in both themes (Verification Contract).
- **KTD4 — Mobile header collapses at the `sm` breakpoint (640px).** Below `sm`, hide the subtitle (`<p class="text-xs text-gr-text-muted">`) and shrink the logo (`h-11 w-11` → `h-8 w-8`) in `web/src/App.vue`. Chosen because `sm` is the first Tailwind default breakpoint already in use elsewhere in the codebase (`web/src/App.vue:20` `sm:px-3`), and the header row's content (nav pill tray + toggle + GitHub badge) is tightest below 640px.
- **KTD5 — Global overflow-x guard lives in `web/src/assets/main.css`, not a component.** A one-time `html, body { overflow-x: hidden; }`-equivalent rule (Tailwind v4 `@layer base` block) is the correct root-level fix per Core Principle "stdlib/native over hand-rolled" — no JS, no per-component guards.
- **KTD6 — Nav pill tray (`RouterLink`/`navTabClass`) and the theme-toggle/GitHub-badge icon buttons in `web/src/App.vue` are excluded from the Button.vue migration.** They are a distinct nav-chrome pattern already internally consistent (Key Decision: mobile nav bar rendering is handled by KTD4's header collapse, not button-component migration) — migrating them would blur nav styling with action-button styling, which the brainstorm's Non-Goals already rules out (no color/variant overhaul, no nav restructure). This excludes swapping these elements onto `Button.vue`; it does **not** exclude shrinking their existing responsive padding/gap values below `sm` if the manual pass finds the collapsed row doesn't fit at 320px (U6 already permits `gap`/`px` tuning) — that is a value change to the existing nav-chrome classes, not a component migration.
- **KTD7 — FeedActionsMenu.vue's dropdown menu items are excluded from the Button.vue migration; only its trigger button migrates.** The menu items are full-width, left-aligned, `role="menuitem"` rows with a trailing badge on one item (`web/src/components/FeedActionsMenu.vue`) — a different shape than Button.vue's centered label + optional leading icon contract (KTD1/KTD2). Forcing them onto Button.vue would require adding `fullWidth`/`align`/trailing-slot props that no other call site needs. The dropdown's trigger button (the icon-only button that opens the menu) migrates normally in U3.

---

## Implementation Units

### U1. Global overflow-x guard

- **Goal:** Prevent any route or open overlay from producing horizontal scroll on mobile.
- **Requirements:** Global horizontal-scroll prevention (Product Contract In Scope); KTD5.
- **Dependencies:** None.
- **Files:**
  - `web/src/assets/main.css`
- **Approach:**
  1. Add an `@layer base` rule constraining `html`/`body` (or the app root) to `overflow-x: hidden` / `max-width: 100vw`, matching the "native platform feature over hand-rolled JS" principle.
  2. Spot-check the widest existing surfaces (`CommunitySourcesModal.vue` at `max-w-3xl`, `OutboxDrawer.vue` at `max-w-md`) still render inside the viewport with the guard in place — no layout should rely on intentional horizontal overflow.
- **Patterns to follow:** Existing `@theme`/`@layer` usage in `web/src/assets/main.css`.
- **Test scenarios:**
  - Test expectation: none — CSS-only global guard, verified via the manual breakpoint pass (Verification Contract).
- **Verification:** No horizontal scrollbar appears on any route or open modal/drawer at 320px–767px widths during the manual breakpoint pass, including with a long feed title/URL.

### U2. Button.vue component

- **Goal:** Introduce the shared button component and token pair that the rest of the plan migrates onto.
- **Requirements:** Desktop button audit (Product Contract In Scope); KTD1, KTD3.
- **Dependencies:** None.
- **Files:**
  - `web/src/components/ui/Button.vue` (new)
  - `web/src/assets/main.css` (add `--color-gr-danger` / `--color-gr-danger-strong`, light + dark)
  - `web/src/components/ui/Button.spec.ts` (new)
- **Approach:**
  1. Add danger token pair to `@theme` and `[data-theme='dark']` blocks in `main.css`, following the existing `gr-accent`/`gr-accent-strong` naming and contrast pattern.
  2. Build `Button.vue` as a thin wrapper over `<button>`: a `variant`→class map and `size`→class map (per KTD1 scale), `iconOnly` swaps padding to the square `p-*` values, a named `#icon` slot (KTD2) rendered before the default label slot with fixed icon size/gap classes, `disabled` and `type` pass through to the native attribute.
- **Patterns to follow:** `web/src/App.vue:19-20` (`navTabClass`/`navTabActiveClass` computed-string precedent); existing `rounded-md` / `focus-visible:outline` treatment used throughout the audited buttons; existing `<Icon icon="...">` usage (e.g. `OutboxPanel.vue:239`) for the icon slot's expected content.
- **Test scenarios:**
  - Renders with `variant="primary"` and default size → contains the `md` padding/height classes and primary background token class.
  - `size="sm"` → contains the `sm` padding classes instead of `md`.
  - `variant="danger"` → contains the new danger token classes, not `gr-accent-strong`.
  - `iconOnly` → contains the square padding class and the `min-h-10 min-w-10` tap-target floor, not the label padding class.
  - `disabled` prop → renders the native `disabled` attribute and the disabled opacity class.
  - `#icon` slot content provided → renders before the default slot content with the fixed icon-size/gap classes.
  - `#icon` slot omitted → no reserved icon space renders (no extra gap/margin before the label).
- **Verification:** `Button.spec.ts` passes; `npm run type-check` passes with the new component's prop types.

### U3. Migrate modals and menu/suggestion action buttons to Button.vue

- **Goal:** Apply the shared button scale to every modal, plus the standalone action buttons in `FeedActionsMenu.vue` (trigger only, per KTD7) and `FeedUrlSuggestions.vue`.
- **Requirements:** Desktop button audit (Product Contract In Scope); KTD1, KTD3, KTD7.
- **Dependencies:** U2.
- **Files:**
  - `web/src/components/AddCategoryModal.vue`
  - `web/src/components/AddFeedModal.vue`
  - `web/src/components/CommunitySourcesModal.vue`
  - `web/src/components/ExportOpmlModal.vue`
  - `web/src/components/MoveFeedModal.vue`
  - `web/src/components/PruneFeedsModal.vue`
  - `web/src/components/tools/PushPullModal.vue`
  - `web/src/components/tools/WipeBackupModal.vue`
  - `web/src/components/FeedActionsMenu.vue` (trigger button only — menu items excluded per KTD7)
  - `web/src/components/FeedUrlSuggestions.vue`
- **Approach:**
  1. Replace each hand-authored `<button class="rounded-md ...">` with `<Button :variant="..." :size="...">`, choosing `variant="danger"` for any destructive/irreversible action (e.g. wipe, delete, prune-confirm) and `variant="secondary"` for Cancel-style actions.
  2. Where a button already renders a leading `<Icon>` before its label, move that icon into `Button.vue`'s `#icon` slot (KTD2) instead of leaving it inline in the default slot. Do not add icons to buttons that don't already have one.
  3. In `FeedActionsMenu.vue`, migrate only the trigger button that opens the dropdown; leave the `role="menuitem"` rows as-is (KTD7).
  4. Preserve every existing `@click`, `:disabled`, `type`, and `aria-label` binding — this is a markup swap, not a behavior change.
- **Patterns to follow:** U2's `Button.vue` variant/size/icon-slot contract.
- **Test scenarios:**
  - Test expectation: none — no behavior change, existing click handlers and disabled/aria bindings are preserved verbatim; verified via the manual breakpoint/visual pass plus `npm run type-check`.
- **Verification:** `npm run type-check` and `npm run test:unit` remain green (no existing spec regresses); manual pass confirms consistent sizing and icon placement across all migrated modals.

### U4. Migrate view/panel components to Button.vue

- **Goal:** Apply the shared button scale to the remaining non-modal surfaces.
- **Requirements:** Desktop button audit (Product Contract In Scope); KTD1, KTD3.
- **Dependencies:** U2.
- **Files:**
  - `web/src/components/OutlineList.vue`
  - `web/src/components/SelectionActionBar.vue`
  - `web/src/components/tools/FilterPacksPanel.vue`
  - `web/src/components/tools/PatternTryPanel.vue`
  - `web/src/components/tools/ReaderAdminPanel.vue`
  - `web/src/components/tools/ReaderPanelTabs.vue`
  - `web/src/views/CatalogView.vue`
  - `web/src/views/ToolsView.vue`
  - `web/src/views/WorkspaceView.vue`
- **Approach:** Same as U3 — markup swap onto `Button.vue` (including moving any existing leading `<Icon>` into the `#icon` slot per KTD2), preserving all existing bindings and behavior.
- **Patterns to follow:** U2's `Button.vue` variant/size/icon-slot contract.
- **Test scenarios:**
  - Test expectation: none — no behavior change; verified via manual pass plus `npm run type-check`.
- **Verification:** `npm run type-check` and `npm run test:unit` remain green; manual pass confirms consistent sizing and icon placement across all migrated views/panels.

### U5. Deck close-button conformity

- **Goal:** Give the Deck panel a standard top-right corner close (X), visually separated from Expand/Clear, and migrate its remaining buttons to `Button.vue`.
- **Requirements:** Deck close-button conformity (Product Contract In Scope, Acceptance Example 1); KTD1, KTD3.
- **Dependencies:** U2.
- **Files:**
  - `web/src/components/OutboxPanel.vue`
  - `web/src/components/OutboxPanel.spec.ts` (new)
- **Approach:**
  1. Restructure the header row (`OutboxPanel.vue:201-242`) with `justify-between`: title block on the left, Expand/Clear as `Button.vue` `secondary`/`ghost` actions grouped in the middle-right, and the close X as its own icon-only `ghost` button pinned to the far top-right corner — the opposite edge from Expand/Clear, not merely a wider gap. Tab order becomes title → Expand → Clear → Close.
  2. Keep existing `onClose`/`onExpand`/`onClear` handlers and the `v-if="variant === 'drawer'"` guards (Expand and the close X only show in drawer variant; Clear shows in both) — this is a layout change, not a behavior change.
- **Patterns to follow:** U2's `Button.vue` contract; existing `aria-label="Close Deck"` and `Icon icon="tabler:x"` usage.
- **Test scenarios:**
  - Renders the drawer variant → a close button with `aria-label="Close Deck"` is present and visually distinct (separate DOM position/class) from the Expand/Clear group.
  - Clicking the close button emits `close`.
  - Renders the `page` variant → no close button renders (matches current `v-if="variant === 'drawer'"` behavior).
- **Verification:** `OutboxPanel.spec.ts` passes; manual pass confirms the corner-X reads as a standard window-pane close control, not a fourth action button.

### U6. Mobile header collapse

- **Goal:** Collapse the header on mobile so logo + title + nav + toggle + GitHub badge fit on one row without wrapping.
- **Requirements:** Mobile header collapse, mobile nav bar rendering (Product Contract In Scope, Acceptance Example 3); KTD4.
- **Dependencies:** None.
- **Files:**
  - `web/src/App.vue`
- **Approach:**
  1. Add `sm:` variants to `web/src/App.vue:47-107`: hide the subtitle `<p>` below `sm` (e.g. `hidden sm:block`), shrink the logo below `sm` (e.g. `h-8 w-8 sm:h-11 sm:w-11`).
  2. Confirm the nav pill tray, theme toggle, and GitHub badge remain full tap-target size and unclipped at the collapsed width. `navTabClass` already uses smaller padding by default (`px-2.5`, bumping to `sm:px-3`), so no change may be needed — but if the manual pass finds the collapsed row doesn't fit at 320px, reduce `nav`'s `gap-3` and/or the pill padding further below `sm` (KTD6 permits this; it excludes only migrating these elements onto `Button.vue`, not tuning their existing responsive values).
- **Patterns to follow:** Existing `sm:px-3` responsive usage already in `navTabClass` (`web/src/App.vue:20`).
- **Test scenarios:**
  - Test expectation: none — jsdom does not evaluate CSS breakpoints; verified via the manual breakpoint pass (Product Contract Acceptance Example 3: 375px width, one row, no subtitle, no wrapping, no clipped tap targets).
- **Verification:** Manual pass at 320px–639px confirms one-row header with no subtitle and a shrunk logo; manual pass at ≥640px confirms the full header (subtitle + full-size logo) is unchanged.

---

## Verification Contract

- `npm run test:unit` and `npm run type-check` (from `web/`) pass after every unit.
- After U1–U6 are complete: run the frontend-design skill against the full diff (Product Contract Verification gate 2).
- Manual check across all five bands (< 640 including 320px, 640–767, 768–1023, 1024–1279, ≥1280 — matching Tailwind's sm/md/lg/xl breakpoints named in Grounding) on every route (Garden, Catalog, Deck page + drawer, Tools) plus every modal (Product Contract Verification gate 1). Confirm the U6 collapsed header row fits with no wrapping at 320px specifically.
- Contrast check (4.5:1 text) for the new `--color-gr-danger`/`--color-gr-danger-strong` tokens in both themes (KTD3).
- Manual step-through testing is the final gate before opening a PR (Product Contract Verification gate 3) — no PR without it.

## Definition of Done

- All six implementation units complete, `npm run test:unit` and `npm run type-check` green.
- Frontend-design skill run against the final diff with findings addressed or explicitly deferred.
- Manual breakpoint pass and manual step-through testing both completed and confirmed by the user before a PR is opened.
- No route or open overlay produces horizontal scroll at any viewport width 320px–1920px.
