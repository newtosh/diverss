# GardenRSS

Calm, **local-first RSS feed manager** — tend your subscription garden: Score health, prune weeds, plant from Catalog, stage on the Deck, export OPML, sync to Miniflux / FreshRSS from Tools.

Not a feed reader — reading happens in your reader; GardenRSS keeps the list evergreen.

## What it does

| Surface | Role |
|--------|------|
| **Garden** | Import / edit / Score / prune / export OPML (browser IndexedDB) |
| **Catalog** | Curated directory + community collections; stage into Deck |
| **Deck** | Review category mapping, then bulk-import into Garden |
| **Tools** | Connect Miniflux / FreshRSS; push, pull, protected wipe (tokens stay in this browser) |

Personal lists never leave your browser except when **you** call Score or a reader API (via optional `/api/proxy`).

## Status

Active MVP. Primary host: **Vercel Hobby** at **https://gardenrss.newto.sh** (SPA + serverless Score / discover / Tools proxy). Local Score still runs via the Cloudflare Worker package under `workers/score` for `npm run dev`.

## Layout

| Path | Role |
|------|------|
| `web/` | Vue 3 + Vite SPA |
| `api/` | Vercel Edge functions (`/api/score`, `/api/discover`, `/api/proxy`) |
| `workers/score/` | Shared Score logic + local Wrangler/dev Worker |
| `cmd/gardenrss-crawl/` | Go CLI for directory crawl (CI) |
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

Git-linked deploys from this repo. Custom host: `gardenrss.newto.sh` → Vercel DNS target.

## Brand

GardenRSS — Iconify / Phosphor `ph:plant-fill`.

## Plans

- Rebrand pivot: `docs/plans/2026-08-27-002-feat-gardenrss-rebrand-plan.md`
- Product (historical DiveRSS): `docs/plans/2026-08-24-001-feat-diverss-product-plan.md`
- Catalog / Deck: `docs/plans/2026-08-25-001-feat-catalog-outbox-plan.md`
- Tools reader integrations: `docs/plans/2026-08-26-001-feat-tools-reader-integrations-plan.md`
- Vercel hosting: `docs/plans/2026-08-26-002-feat-vercel-hosting-plan.md`
