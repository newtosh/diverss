---
title: Tools Reader Integrations - Plan
type: feat
date: 2026-08-26
topic: tools-reader-integrations
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
product_contract_source: ce-brainstorm
execution: code
product_contract_preservation: "enriched-in-place"
---

# Tools Reader Integrations - Plan

> Historical: written under the DiveRSS name; product is now GardenRSS.


## Goal Capsule

- **Objective:** Add a navbar **Tools** area where users connect **Miniflux** and **FreshRSS**, push/pull subscription lists against the DiveRSS workspace, and run protected reader ops — without turning DiveRSS into a feed reader or adding DiveRSS accounts.
- **Product authority:** This plan owns Tools navigation, reader connection UX, local credential storage posture, push/pull modes, wipe/backup guards, and ops surfaces for Miniflux and FreshRSS. Workspace/Catalog/Outbox/Score stay as they are unless cited. Other readers are stubs only.
- **Execution profile:** SPA feature + Score Worker proxy route; unit-test adapters/transport/orchestration first, then Tools UI; verify with `npm run type-check` / `npm run test:unit` under `web/` and worker tests under `workers/score/`.
- **Stop conditions / open blockers:** None blocking. Deferred: exact stub reader roster polish; Worker SSRF hardening beyond Origin allowlist + https-only (see Risks).
- **Tail ownership:** Implementer runs Verification Contract gates and leaves a clean diff.

---

## Product Contract

### Summary

DiveRSS gains a **Tools** section in the top nav. Inside it, users see sections for common RSS readers; **Miniflux** and **FreshRSS** are live integrations, others are clearly stubbed. Connecting a reader stores the API base URL and token **in this browser only**, with persistent **transparency** in the UI that credentials never go to a DiveRSS account database. Transport is **hybrid**: try browser-direct calls first; if CORS blocks, relay through a DiveRSS Worker (expected to work off localhost only when that Worker is deployed). Users can **push** the current workspace to the reader or **pull** the reader’s list into DiveRSS; each action asks for a mode (push: Replace or Merge; pull: Replace, Merge, or Stage to Outbox). An **ops toolkit** covers test connection, standalone wipe, empty-category cleanup, feed counts, and last-error summary. Any wipe — standalone or as part of Replace — is **protected**: a backup must be taken first, then an explicit confirm.

### Problem Frame

Exporting OPML into a reader is additive in tools like Miniflux. Users who prune in DiveRSS and re-import get duplicate categories/feeds, and some reader UIs lack an obvious “remove all feeds” path. DiveRSS already owns the clean list; users need a native bridge to apply that list (or pull the reader’s list back) plus safe destructive ops, without abandoning local-first “no DiveRSS accounts.”

### Key Decisions

- KD1. **Tools = two-way hub + ops toolkit** — connect, push/pull, and reader ops; not guides-only and not push-only. (session-settled: user-directed — chosen over push-only / guides-first) Governs R1–R4, R10–R16.
- KD2. **First live readers: Miniflux + FreshRSS**; other common readers appear as stubs. (session-settled: user-directed — chosen over Miniflux-only / shell-only) Governs R2, R3, Scope Boundaries.
- KD3. **Hybrid transport** — browser-direct first, Worker proxy when CORS fails; non-localhost use expects a deployed Worker. (session-settled: user-directed — chosen over browser-only or Worker-only) Governs R8, R9.
- KD4. **Push asks each time** — Replace or Merge; Replace is never silent. (session-settled: user-directed) Governs R11, R17.
- KD5. **Pull asks each time** — Replace workspace, Merge into workspace, or Stage via Outbox. (session-settled: user-directed) Governs R12.
- KD6. **Plain local connection store** — URL + token in this browser, same trust boundary as the workspace; **no passphrase vault** (forgettable meta-password rejected). (session-settled: user-directed — chosen over encrypted vault / session-only) Governs R5–R7.
- KD7. **Transparency signal in product UI** — connection storage posture is visible in Tools design, not only docs. (session-settled: user-directed) Governs R7.
- KD8. **Ops-heavy toolkit** for live readers — test connection, standalone wipe, empty categories, counts, last-error — beyond push/pull alone. (session-settled: user-directed) Governs R13–R16.
- KD9. **Wipe is protected** — backup required before wipe (including Replace-path wipe), then explicit confirm. (session-settled: user-directed) Governs R17, R18.
- KD10. **Still not a feed reader; still no DiveRSS accounts** — live API bridge extends export loop; does not add article reading or hosted user accounts. Aligns with product plan KD5/KD7. Governs Scope Boundaries, R5.

### Actors

- A1. **OPML owner** — primary Tools user; connects a self-hosted reader and moves lists safely.
- A2. **SPA user** — sees Tools in nav; may browse stubs without connecting.

### Requirements

**Navigation and coverage**

- R1. The top nav includes a **Tools** entry that opens the Tools area.
- R2. Tools presents **sections (or equivalent clear grouping) for common RSS readers**, with **Miniflux** and **FreshRSS** as live integration targets.
- R3. Readers without a live integration in this release appear as **stubs** (named, not pretend-connected), without fake auth success.
- R4. DiveRSS remains **not a feed reader**: Tools does not offer article reading or an in-app unread river.

**Connection and storage**

- R5. A live reader can be **connected** with the reader’s API base URL and credential (API token / app password as that reader expects).
- R6. Connection details persist **only in this browser** (same class of local persistence as the workspace). They are **not** stored in a DiveRSS account database and are not recoverable via DiveRSS if site data is cleared.
- R7. Tools UI includes a durable **transparency signal** that credentials stay on-device / in this browser and are not a DiveRSS account.
- R8. After connect, the user can **test connection** and see success or a clear failure reason.
- R9. API calls use **hybrid transport**: attempt browser-direct; if the reader blocks the browser (e.g. CORS), use a DiveRSS Worker relay. Product copy may note that off-localhost use needs a deployed Worker when proxy is required.
- R10. The user can **disconnect** a reader (remove local connection details for that integration).

**Push and pull**

- R11. **Push** offers a mode choice every time: **Replace** or **Merge**. Merge is additive on the reader side. Replace means wipe-then-apply workspace feeds (subject to R17–R18).
- R12. **Pull** offers a mode choice every time: **Replace** the DiveRSS workspace, **Merge** into the workspace (skip URLs already present), or **Stage** into the Outbox for review/import.
- R13. Push and pull report a short status summary (counts added/skipped/removed/errors as applicable).

**Ops toolkit**

- R14. For each live connection, Tools exposes **standalone Wipe all feeds** on the reader (subject to R17–R18), independent of a full Replace push.
- R15. Tools can list categories and support **deleting empty categories** where the reader API allows; if not allowed, the UI says so without pretending success.
- R16. Tools shows **feed counts** and a **last-error** (or equivalent health) summary from the reader when the API provides it; missing fields degrade gracefully.

**Destructive action guard**

- R17. Any wipe of reader feeds — **standalone Wipe** or wipe that is part of **Replace** push — cannot proceed until the user has completed a **backup step** in the flow (e.g. download/export the reader’s current OPML or confirm an equivalent just-captured backup DiveRSS obtained for them).
- R18. After the backup step, wipe still requires an **explicit confirm** (distinct from the backup action). Cancel leaves the reader unchanged.

### Key Flows

- F1. Connect Miniflux or FreshRSS
  - **Trigger:** User opens Tools → reader section → Connect.
  - **Actors:** A1
  - **Steps:** Enter URL + credential; persistence is local; transparency signal visible; Test connection; optional Disconnect later.
  - **Outcome:** Live integration ready for push/pull/ops; failures are readable.
  - **Covered by:** R1, R2, R5–R10

- F2. Push with ask-each-time modes
  - **Trigger:** User chooses Push on a connected reader.
  - **Actors:** A1
  - **Steps:** Choose Replace or Merge; if Replace, complete backup then confirm wipe; apply workspace list; show summary.
  - **Outcome:** Reader matches intent without silent wipe; Merge never wipes.
  - **Covered by:** R11, R13, R17, R18

- F3. Pull with ask-each-time modes
  - **Trigger:** User chooses Pull on a connected reader.
  - **Actors:** A1
  - **Steps:** Choose Replace / Merge / Stage; confirm if Replace workspace; apply or stage; show summary.
  - **Outcome:** Workspace or Outbox updated per choice; no silent workspace replace.
  - **Covered by:** R12, R13

- F4. Protected standalone wipe
  - **Trigger:** User chooses Wipe all feeds.
  - **Actors:** A1
  - **Steps:** Backup step required → explicit confirm → wipe → optional empty-category cleanup entry point → summary.
  - **Outcome:** No wipe without backup+confirm; reader feeds cleared when API succeeds.
  - **Covered by:** R14, R17, R18

- F5. Hybrid transport fallback
  - **Trigger:** Browser-direct API call fails due to CORS (or equivalent browser block).
  - **Actors:** A1
  - **Steps:** Client retries via Worker proxy using the same local credentials for that request; surface deploy/CORS guidance if proxy unavailable.
  - **Outcome:** Self-hosted readers usable when Worker is reachable; failure mode is clear on localhost without deploy.
  - **Covered by:** R9

### Acceptance Examples

- AE1. Connect and test
  - **Covers:** R5, R6, R7, R8
  - **Given:** User on Tools with Miniflux or FreshRSS section
  - **When:** They save URL + token and run Test connection
  - **Then:** Success or clear error; UI still shows on-device storage transparency; credentials are not in a DiveRSS server account store

- AE2. Replace push requires backup
  - **Covers:** R11, R17, R18
  - **Given:** Connected reader with existing feeds and a non-empty DiveRSS workspace
  - **When:** User chooses Push → Replace
  - **Then:** Wipe cannot run until backup completes; then confirm; then reader feeds match workspace intent; cancel before confirm leaves reader unchanged

- AE3. Pull stage to Outbox
  - **Covers:** R12
  - **Given:** Connected reader with feeds and an empty or existing Outbox
  - **When:** User chooses Pull → Stage
  - **Then:** Reader feeds appear as Outbox entries for review/import; workspace OPML is not silently replaced

- AE4. Stub reader
  - **Covers:** R3
  - **Given:** Tools lists a non-live reader stub
  - **When:** User opens that section
  - **Then:** No successful auth/connect path is offered as if the integration were live

- AE5. CORS fallback
  - **Covers:** R9
  - **Given:** Reader API rejects browser-direct calls
  - **When:** User runs Test connection with Worker available
  - **Then:** Request succeeds via proxy; if Worker is unavailable, the user sees that direct failed and proxy is needed/deploy missing

### Scope Boundaries

**In scope**

- Tools nav + Tools area
- Live Miniflux and FreshRSS connect / disconnect / test
- Hybrid transport product behavior (direct then proxy)
- Push (Replace/Merge) and pull (Replace/Merge/Stage)
- Ops: wipe (guarded), empty categories, counts, last-error
- Transparency UI for local credential storage
- Named stubs for other common readers

**Deferred / out of scope**

- DiveRSS accounts, cloud sync of credentials, passphrase vault
- Article reading / replacing Miniflux or FreshRSS as a reader
- Live integrations beyond Miniflux and FreshRSS
- Guaranteeing every ops action on every reader version when the API cannot support it (degrade with messaging)
- Automatic silent sync or background polling of reader state
- Designing the full catalog of stub reader names beyond “common RSS readers” placeholders (planning picks initial stub labels below)

### How This Work Fits Together

- **Tools reader integrations (this plan)**
  - **Extends:** product loop “export OPML → import in reader” with an optional live API bridge
  - **Uses:** Workspace OPML, Outbox staging (pull → Stage), existing local-persistence posture
  - **Depends on (product):** a reachable Worker when CORS blocks browser-direct (deployment expectation)
- **DiveRSS product core (existing plan)**
  - **Shares:** not-a-reader, no DiveRSS accounts, browser-local personal state
  - **Unchanged:** Catalog curation, Score semantics, primary Workspace editing
- **Additional live readers (later candidate)**
  - **Depends on:** Tools shell + connection/push-pull/ops patterns proven on Miniflux/FreshRSS
  - **Still to decide:** which hosted readers and auth schemes (OAuth vs token)

### Success Criteria

- S1. A user can connect Miniflux or FreshRSS from Tools, see on-device storage transparency, and successfully test the connection (direct or via Worker when required).
- S2. Push and pull always present mode choices; Replace wipe paths never run without backup + confirm.
- S3. Ops toolkit exposes wipe, empty-category cleanup, counts, and last-error with honest degradation when APIs lack support.
- S4. Stub readers cannot be mistaken for live integrations.
- S5. DiveRSS still does not read articles and does not create DiveRSS user accounts for Tools.

### Outstanding Questions

- None blocking. Worker shape and FreshRSS API choice resolved as KTD1–KTD3.

---

## Planning Contract

### Key Technical Decisions

- KTD1. **Extend the existing Score Worker with `POST /proxy`** rather than a sibling Worker — one `VITE_SCORE_URL`, shared CORS allowlist (`workers/score/src/cors.ts`). Proxy body: `{ url, method, headers?, body? }`; response: `{ status, headers, bodyText }` (or binary-safe encoding if needed). Credentials ride in the forwarded `headers` from the client for that request only; Worker does not persist them. (resolves open blocker from Goal Capsule) Governs R9.
- KTD2. **Hybrid client transport** in `web/src/tools/transport.ts`: `fetch` direct first; on network/CORS failure (TypeError / failed fetch), retry once via `/proxy` when `scoreWorkerUrl()` is set; if proxy also fails, surface dual error (direct + proxy/deploy hint). Governs R9, AE5.
- KTD3. **FreshRSS via Google Reader–compatible API** (`…/api/greader.php`) with username + API password → `ClientLogin` → `Authorization: GoogleLogin auth=…`; OPML via `subscription/export` + `subscription/import`; wipe via list + `subscription/edit` unsubscribe. Miniflux via REST `X-Auth-Token`, `GET /v1/export`, `POST /v1/import`, `GET/DELETE /v1/feeds`, categories as supported. Governs R5, R11–R16.
- KTD4. **Plain `localStorage` connection store** at `web/src/tools/connections.ts` key `gardenrss-reader-connections-v1` — do **not** put secrets on the workspace Dexie snapshot. Shape: per-reader records (`miniflux`: baseUrl + token; `freshrss`: baseUrl + username + apiPassword). Governs R6, R10.
- KTD5. **Shared `ReaderAdapter` interface** (`test`, `exportOpml`, `importOpml`, `listFeeds`, `deleteFeed`, `listCategories`, `deleteCategory`, `summarize`) implemented by `miniflux.ts` / `freshrss.ts`; orchestration (`push`, `pull`, `wipeWithBackupGate`) stays adapter-agnostic. Governs R8, R11–R16.
- KTD6. **Backup gate = auto-download reader OPML + checkbox** “I saved this backup” before Confirm wipe — download uses `exportOpml` (same as pull source). Confirm remains a separate control (R17–R18). Governs R17, R18, AE2.
- KTD7. **Pull → Stage** reuses `stageEntry` / Outbox propose helpers; Pull → Merge/Replace mutates workspace via existing `parseOpml` + `appendFeed` / document replace + `saveWorkspace` / `workspaceEpoch`. Governs R12.
- KTD8. **Initial stubs:** Inoreader, Feedbin, NewsBlur — labeled “Coming soon”, no connect form that claims success. Governs R3, AE4.
- KTD9. **Proxy safety floor for v1:** require allowed Origin (existing CORS), `http:`/`https:` only, reject obviously dangerous schemes; document open-proxy residual risk for allowed origins. Deeper SSRF allowlists deferred. Governs Risks.

### High-Level Technical Design

```text
ToolsView ──► connections (localStorage)
       │
       ▼
 ReaderAdapter (miniflux | freshrss)
       │
       ▼
 transport.directOrProxy(request)
       ├─ fetch(reader) ──CORS fail──┐
       └─────────────────────────────▼
                          Worker POST /proxy
                          (VITE_SCORE_URL)

 wipe/replace ──► exportOpml ──► download backup
              ──► confirm ──► delete feeds ──► importOpml (push)
 pull ──► exportOpml ──► Replace | Merge workspace | stageEntry Outbox
```

### Assumptions

- Hash router remains; `#/tools` is fine under `BASE_URL`.
- Score Worker stays the ephemeral edge for user-triggered network work (product plan R10/R13 family).
- Miniflux import remains additive on the server; Replace is client-orchestrated wipe-then-import.
- FreshRSS API password is distinct from the login password (documented in Tools UI helper text).

### Implementation Constraints

- Follow existing slate/teal SPA patterns; KeepAlive-safe (Tools should reload connection status on activate if needed).
- Do not invent DiveRSS accounts or encrypt connection store with a passphrase.
- Do not put reader tokens in `WorkspaceSnapshot` / Dexie workspace DB.
- Worker `/proxy` must not log Authorization headers or request bodies containing tokens.

### Sequencing

1. U1 connection store
2. U2 Worker `/proxy` + client transport
3. U3 Miniflux + FreshRSS adapters
4. U4 orchestration (backup gate, push/pull/wipe)
5. U5 Tools UI + nav + stubs
6. U6 README / deploy notes for proxy

---

## Implementation Units

### U1. Local reader connection store

- **Goal:** Persist and clear Miniflux/FreshRSS connection records in this browser only.
- **Requirements:** R5, R6, R10
- **Dependencies:** None
- **Files:**
  - Create: `web/src/tools/connections.ts`
  - Create: `web/src/tools/connections.spec.ts`
  - Create: `web/src/tools/types.ts` (shared connection + adapter types as needed)
- **Approach:** `loadConnections` / `saveConnection(id, record)` / `clearConnection(id)` around `localStorage` key `gardenrss-reader-connections-v1`. Normalize base URLs (trim trailing slash). Never write to Dexie workspace.
- **Test scenarios:**
  - Round-trip save/load Miniflux token record
  - Round-trip FreshRSS username + apiPassword
  - `clearConnection` removes one reader without wiping the other
  - Corrupt JSON yields empty store without throw
- **Verification:** `cd web && npm run test:unit -- src/tools/connections.spec.ts`

### U2. Hybrid transport + Score Worker `/proxy`

- **Goal:** Browser-direct fetch with Worker relay fallback for CORS-blocked readers.
- **Requirements:** R9, AE5
- **Dependencies:** None (can parallel U1)
- **Files:**
  - Create: `web/src/tools/transport.ts`
  - Create: `web/src/tools/transport.spec.ts`
  - Modify: `workers/score/src/index.ts` (route `/proxy`)
  - Create: `workers/score/src/proxy.ts`
  - Create: `workers/score/src/proxy.test.ts` (or extend `index.test.ts`)
  - Reference: `workers/score/src/cors.ts`, `web/src/score/client.ts` (`scoreWorkerUrl`)
- **Approach:** Client `readerFetch(input)` tries direct `fetch`; on failure, `POST ${scoreWorkerUrl()}/proxy` with url/method/headers/body. Worker validates Origin via existing CORS helper, allows only `http:`/`https:`, forwards, returns status + body text. Do not persist credentials on the Worker.
- **Test scenarios:**
  - Direct success does not call proxy
  - Direct network failure retries proxy when Worker URL configured
  - Missing Worker URL after direct failure yields actionable error
  - Worker rejects disallowed origin
  - Worker rejects non-http(s) target URL
- **Verification:** `cd web && npm run test:unit -- src/tools/transport.spec.ts`; `cd workers/score && npm test` (or package’s existing test script)

### U3. Miniflux and FreshRSS adapters

- **Goal:** Implement `ReaderAdapter` for both live readers using transport.
- **Requirements:** R5, R8, R11–R16 (API capability surface)
- **Dependencies:** U1, U2
- **Files:**
  - Create: `web/src/tools/readers/types.ts` (if not in `tools/types.ts`)
  - Create: `web/src/tools/readers/miniflux.ts`
  - Create: `web/src/tools/readers/freshrss.ts`
  - Create: `web/src/tools/readers/miniflux.spec.ts`
  - Create: `web/src/tools/readers/freshrss.spec.ts`
- **Approach:** Miniflux: `X-Auth-Token`, `/v1/me` test, `/v1/export`, `/v1/import`, feeds list/delete, categories list/delete when available, map feed parsing errors into summarize. FreshRSS: ClientLogin + GoogleLogin auth header; export/import OPML endpoints; unsubscribe loop for wipe; degrade empty-category delete if API lacks a clean empty filter. Inject `readerFetch` for tests.
- **Test scenarios:**
  - Miniflux test maps 401 to clear auth error
  - Miniflux export returns OPML string
  - Miniflux wipe deletes each listed feed id
  - FreshRSS ClientLogin failure surfaces readable error
  - FreshRSS export/import paths called with auth header
  - summarize returns count; missing last-error fields → undefined/empty without throw
- **Verification:** `cd web && npm run test:unit -- src/tools/readers/`

### U4. Push / pull / wipe orchestration with backup gate

- **Goal:** Mode choosers and protected wipe/replace flows against adapters + workspace/Outbox.
- **Requirements:** R11–R14, R17, R18, AE2, AE3
- **Dependencies:** U3
- **Files:**
  - Create: `web/src/tools/ops.ts`
  - Create: `web/src/tools/ops.spec.ts`
  - Create: `web/src/tools/backup.ts` (download helper; may be tiny)
  - Reference: `web/src/opml/parse.ts`, `web/src/opml/serialize.ts`, `web/src/opml/mutate.ts`, `web/src/outbox/store.ts`, `web/src/db/workspace.ts`
- **Approach:** `downloadOpmlBackup(opml, filename)` triggers browser download and returns a token/flag the UI uses for “backup completed.” `wipeFeeds(adapter, { backupCompleted, confirmed })` refuses unless both true. `pushReplace` = backup gate → wipe → `importOpml(serializeOpml(workspace))`. `pushMerge` = import only. `pull` modes: parse export → replace doc / merge append skip dups / `stageEntry` per feed with groups from OPML folders. Bump workspace via `saveWorkspace` + rely on `workspaceEpoch`.
- **Test scenarios:**
  - wipe throws/returns error if backupCompleted false
  - wipe throws if confirmed false
  - pushReplace calls export → wipe → import in order (mocked adapter)
  - pushMerge does not wipe
  - pull Stage produces Outbox-stage payloads with xmlUrl/title
  - pull Merge skips existing membership keys
- **Verification:** `cd web && npm run test:unit -- src/tools/ops.spec.ts`

### U5. Tools route, nav, live panels, stubs

- **Goal:** Ship Tools UI with transparency signal, connect forms, ops, and stubs.
- **Requirements:** R1–R4, R7, R8, R10–R16, AE1, AE4
- **Dependencies:** U4
- **Files:**
  - Create: `web/src/views/ToolsView.vue`
  - Create: `web/src/components/tools/ReaderSection.vue` (or equivalent)
  - Create: `web/src/components/tools/WipeBackupModal.vue` (backup download + checkbox + confirm)
  - Create: `web/src/components/tools/PushPullModal.vue` (mode choose)
  - Modify: `web/src/router/index.ts` (`/tools`)
  - Modify: `web/src/App.vue` (nav Tools link)
  - Optional: short note in `README.md` linking to Worker deploy for Tools proxy
- **Approach:** Tools page lists Miniflux, FreshRSS (live), then stubs (Inoreader, Feedbin, NewsBlur). Live section: transparency callout, URL/credential fields, Save/Test/Disconnect, status, counts/last-error, Push/Pull/Wipe/Empty categories actions wiring U4. Follow existing modal patterns (`ExportOpmlModal`, prune confirms).
- **Test scenarios:**
  - Prefer component smoke manual; unit-test any extracted pure formatters
  - Router registers `tools`; nav link present
  - Stub section has no working connect submit that sets a live connection id
- **Verification:** `cd web && npm run type-check`; manual Tools smoke (connect test, push merge, wipe backup gate, pull stage)

### U6. Deploy / local-dev documentation for proxy

- **Goal:** Document that hybrid Tools needs a reachable Worker off localhost when CORS blocks.
- **Requirements:** R9
- **Dependencies:** U2
- **Files:**
  - Modify: `README.md` (and/or existing worker README if present)
- **Approach:** Short “Tools ↔ reader proxy” subsection: set `VITE_SCORE_URL`, deploy Score Worker with `ALLOWED_ORIGINS`, note `/proxy` exists for Tools, localhost Score still works for local SPA.
- **Test scenarios:** None automated — doc review only.
- **Verification:** README mentions Tools proxy + `VITE_SCORE_URL` / origins

---

## Verification Contract

- `cd web && npm run type-check`
- `cd web && npm run test:unit -- src/tools/`
- `cd workers/score && npm test` (use the package’s standard test script)
- Manual smoke: connect Miniflux or FreshRSS → Test → Push Merge → Pull Stage → Wipe with backup+confirm cancel path → Replace push after backup
- Confirm stubs cannot complete a live connect

---

## Definition of Done

- R1–R18 satisfied via U1–U6 (API degrade paths honest for R15–R16)
- AE1–AE5 observable in tests and/or manual smoke
- Verification Contract commands pass
- No passphrase vault; no tokens in workspace Dexie
- Abandoned spikes removed from the diff
- Outstanding Questions remain empty / resolved as KTDs

---

## Risks & Dependencies

- **CORS + deploy:** Without a deployed Worker and allowlisted origin, many self-hosted readers will fail browser-direct; UI must say so (R9).
- **Open proxy residual:** Allowed-origin clients can ask `/proxy` to fetch user-supplied URLs; v1 relies on Origin allowlist + https/http only (KTD9).
- **FreshRSS API variance:** GReader endpoints differ slightly by version; adapters should tolerate missing empty-category ops.
- **Wipe duration:** Large subscription lists delete feed-by-feed; show progress if slow.
- **Depends on:** `workspaceEpoch` sync (already shipped), Outbox `stageEntry`, existing OPML parse/serialize, Score Worker CORS/`VITE_SCORE_URL`.
