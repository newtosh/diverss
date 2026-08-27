---
title: Vercel Hosting Migration - Plan
type: feat
date: 2026-08-26
topic: vercel-hosting
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
product_contract_source: ce-brainstorm
execution: code
---

# Vercel Hosting Migration - Plan

## Goal Capsule

- **Objective:** Host the DiveRSS SPA and Score/Tools API on **Vercel Hobby** (free) so Score, discover, and reader `/proxy` are **same-origin**, with Git-linked **preview deploys** for easier Tools/reader integration triage.
- **Product authority:** Hosting and deploy topology only. Product behavior of Score, Catalog, Outbox, Tools stays the same.
- **Open blockers:** None for requirements. Deploy needs a Vercel project + `VERCEL_TOKEN` (and org/project ids) in GitHub secrets — document setup; CI can ship config before secrets exist.

---

## Product Contract

### Summary

DiveRSS moves primary public hosting from **GitHub Pages + separate Cloudflare Worker** to **Vercel**: static Vue SPA at `/` plus serverless functions at `/api/score`, `/api/discover`, `/api/proxy`. Local-first product rules unchanged. Preview deployments from PRs/branches make Miniflux/FreshRSS proxy debugging practical without dual-host CORS and `/diverss/` base-path friction.

### Key Decisions

- KD1. **Vercel Hobby as primary host** for SPA + Score + Tools proxy. (session-settled: user-directed — chosen over Pages+Worker / CF Pages consolidation: portfolio story + triage) Governs R1–R4.
- KD2. **Same-origin API** — browser uses relative `/api/*` in production; `VITE_SCORE_URL` optional override for local/legacy. Governs R2, R5.
- KD3. **Root `/` base path** on Vercel (drop required `/diverss/`). Governs R3.
- KD4. **Directory crawl stays in GitHub Actions**; build artifact deploys to Vercel (not Pages) on `main`. Governs R6.
- KD5. **Cloudflare Worker kept as optional local/dev fallback** (`workers/score` + `npm run dev`) with path aliases matching `/api/*` via Vite proxy — not the primary production host. Governs R5, Scope Boundaries.

### Requirements

- R1. Production SPA is served from Vercel (Hobby-compatible).
- R2. Score, discover, and Tools proxy are available as Vercel serverless endpoints under `/api/score`, `/api/discover`, `/api/proxy` with the same JSON contracts as today’s Worker.
- R3. Production SPA uses Vite `base: '/'` (no project-Pages subpath requirement).
- R4. PR/branch preview deploys are supported via Vercel’s Git integration or Actions deploy.
- R5. Local `npm run dev` continues to work: Vite proxies `/api/*` to the local Score process (Wrangler/dev script).
- R6. Scheduled/manual directory crawl still runs in Actions and ships data with the SPA deploy to Vercel.
- R7. README documents Vercel setup, secrets, and that Hobby is personal/non-commercial.
- R8. Reader Tools proxy remains backup-gated wipe / push-pull product behavior — only the transport host changes.

### Scope Boundaries

**In** — Vercel project config, API port from Worker logic, client URL defaults, Vite base, Actions deploy path, README.

**Out** — Custom domain (optional later), retiring Worker package entirely, changing Score algorithm, DiveRSS accounts.

### Success Criteria

- S1. Production URL serves SPA at `/` and Score succeeds without a separate `workers.dev` origin.
- S2. Tools proxy works same-origin on a preview deploy against a real Miniflux/FreshRSS.
- S3. Local dual-process dev still scores and proxies.

---

## Planning Contract

### Key Technical Decisions

- KTD1. **Repo-root `vercel.json`** — `buildCommand` builds `web/`, `outputDirectory` `web/dist`, SPA fallback rewrite; `api/*.ts` as Node serverless functions importing shared logic from `workers/score/src/`.
- KTD2. **Client default base** — `scoreApiBase()` returns `VITE_SCORE_URL` if set, else `''` (same origin). Paths always `/api/score`, `/api/discover`, `/api/proxy`.
- KTD3. **Vite `base`** — `'/'` by default; optional `VITE_BASE` for legacy Pages if ever needed.
- KTD4. **Actions** — crawl + `npm run build-only` in `web/`, then `vercel deploy --prebuilt` (or build+deploy) using secrets; Pages `deploy-pages` job retired or disabled.
- KTD5. **CORS on functions** — allow configured origins + local Vite; same-origin Vercel traffic needs no CORS, but local/dev and overrides still do.

### Sequencing

1. U1 Shared path + Vercel `api/` handlers  
2. U2 Client + Vite base + local proxy  
3. U3 vercel.json + Actions + README  
4. U4 Smoke build / typecheck / worker tests  

---

## Implementation Units

### U1. Vercel API handlers from Worker logic

- **Files:** Create `api/score.ts`, `api/discover.ts`, `api/proxy.ts`; thin wrappers calling `workers/score/src/*`. Adjust Worker router to also accept `/api/*` aliases for local parity.
- **Verification:** `cd workers/score && npm test`; local function smoke if feasible.

### U2. Client same-origin + Vite base `/`

- **Files:** `web/src/score/client.ts`, `web/src/tools/transport.ts`, `web/vite.config.ts`, `scripts/dev-*.mjs` / vite proxy.
- **Verification:** `cd web && npm run type-check && npm run test:unit -- src/score src/tools`

### U3. vercel.json + CI + README

- **Files:** `vercel.json`, `.github/workflows/crawl-and-pages.yml` (rename or retarget), `README.md`
- **Verification:** Document secrets; `vercel build` dry-run if CLI available.

### U4. Definition of Done gate

- Contracts unchanged; production host is Vercel; local dev documented.

---

## Verification Contract

- `cd web && npm run type-check && npm run test:unit -- src/tools/ src/score/`
- `cd workers/score && npm test`
- `cd web && npm run build-only` with `base /`
- Manual: preview URL Score + Tools Test connection

## Definition of Done

- R1–R8 met; KD1–KD5 reflected in config; GH Pages no longer the primary documented host.
