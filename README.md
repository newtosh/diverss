# DiveRSS

Calm, **local-first OPML workspace** with a curated public directory companion.

Not a feed reader — import or build a subscription list, optionally **Score** health and velocity, prune and organize, **stage** discoveries via Outbox, **export** OPML, and optionally **push/pull** to Miniflux or FreshRSS from Tools.

## What it does

| Surface | Role |
|---------|------|
| **Workspace** | Import / edit / Score / prune / export OPML (browser IndexedDB) |
| **Catalog** | Curated directory + community collections; stage into Outbox |
| **Outbox** | Review category mapping, then bulk-import into Workspace |
| **Tools** | Connect Miniflux / FreshRSS; push, pull, protected wipe (tokens stay in this browser) |

Personal lists never leave your browser except when **you** call Score or a reader API (via optional `/api/proxy`).

## Status

Active MVP on `feat/diverss-mvp`. Primary host: **Vercel Hobby** (SPA + serverless Score / discover / Tools proxy). Local Score still runs via the Cloudflare Worker package under `workers/score` for `npm run dev`.

## Layout

| Path | Role |
|------|------|
| `web/` | Vue 3 + Vite SPA |
| `api/` | Vercel Edge functions (`/api/score`, `/api/discover`, `/api/proxy`) |
| `workers/score/` | Shared Score logic + local Wrangler/dev Worker |
| `cmd/diverss-crawl/` | Go CLI for directory crawl (CI) |
| `internal/score/` | Shared health + velocity scoring (Go) |
| `data/` | Directory, categories, community sources |
| `docs/plans/` | Product and feature plans |
| `vercel.json` | Vercel build + SPA rewrites |

## Local development

### Prerequisites

- Go 1.22+ (1.24.x in CI)
- Node.js 22.18+ or 24.12+

### SPA + Score API (recommended)

```bash
cd web && npm install
cd ../workers/score && npm install
cd .. && npm run dev
```

Starts Vite and the local Score Worker. Preferred ports **5173** / **8787**. `VITE_SCORE_URL` points at the Worker; the client calls `/api/score`, `/api/discover`, `/api/proxy` on that origin.

### Tests

```bash
cd web && npm run test:unit && npm run type-check
cd workers/score && npm test
go test ./...
```

## Production (Vercel)

1. Create a Vercel project linked to this repo (Hobby is fine for personal/OSS).
2. Root directory: repository root (uses `vercel.json`).
3. Custom domains are fine when the SPA and `/api/*` share a host (same-origin Score). Set `ALLOWED_ORIGINS` only for cross-origin callers; `*.vercel.app` and localhost are allowlisted in code.
4. Add GitHub Actions secrets for production deploys from `main`:
   - `VERCEL_TOKEN`
   - `VERCEL_ORG_ID`
   - `VERCEL_PROJECT_ID`

CI (`.github/workflows/crawl-and-pages.yml`) crawls directory data, builds the SPA, then `vercel deploy --prebuilt --prod` on `main`.

**Same-origin API:** the SPA calls `/api/*` with no separate `workers.dev` URL. Preview deployments are ideal for triaging Tools ↔ Miniflux/FreshRSS.

Hobby plan is personal/non-commercial; see [Vercel Hobby](https://vercel.com/docs/plans/hobby).

### Optional local override

```bash
cd web && VITE_SCORE_URL=http://127.0.0.1:8787 npm run dev:vite
```

Legacy GitHub Pages subpath builds: `VITE_BASE=/diverss/ npm run build-only`.

## Agent discovery

See `docs/directory-curation.md`.

```bash
python3 scripts/discover-suggest/suggest.py \
  --candidates scripts/discover-suggest/example-candidates.json \
  --out /tmp/diverss-suggestions.md
```

## Brand

DiveRSS — Iconify / Tabler `scuba-mask`.

## Plans

- Product: `docs/plans/2026-08-24-001-feat-diverss-product-plan.md`
- Catalog Outbox: `docs/plans/2026-08-25-001-feat-catalog-outbox-plan.md`
- Tools reader integrations: `docs/plans/2026-08-26-001-feat-tools-reader-integrations-plan.md`
- Vercel hosting: `docs/plans/2026-08-26-002-feat-vercel-hosting-plan.md`
