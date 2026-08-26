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

Personal lists never leave your browser except when **you** call Score or a reader API (via optional Worker proxy).

## Status

Active MVP on `feat/diverss-mvp`. SPA + Score Worker + directory crawl CI are in place. Production still targets **GitHub Pages** for the SPA and a **Cloudflare Worker** for Score / Tools proxy — hosting may be revisited (Pages base-path + dual-host friction vs colocated SPA+edge).

## Layout

| Path | Role |
|------|------|
| `web/` | Vue 3 + Vite SPA |
| `workers/score/` | Cloudflare Worker — Score, discover, Tools `/proxy` |
| `cmd/diverss-crawl/` | Go CLI for directory crawl (CI) |
| `internal/score/` | Shared health + velocity scoring (Go) |
| `data/` | Directory, categories, community sources |
| `docs/plans/` | Product and feature plans |
| `docs/directory-curation.md` | Curation and discovery-session workflow |

## Local development

### Prerequisites

- Go 1.22+ (1.24.x in CI)
- Node.js 22.18+ or 24.12+
- Optional: [Wrangler](https://developers.cloudflare.com/workers/wrangler/) for the Score Worker

### SPA + Score Worker (recommended)

```bash
cd web && npm install
cd ../workers/score && npm install
cd .. && npm run dev
```

Starts both processes. Preferred ports **5173** (SPA) and **8787** (Score); if taken, the next free port is chosen and printed. `VITE_SCORE_URL` is wired automatically. CORS allows any `localhost` / `127.0.0.1` Vite origin.

Override with `WEB_PORT` / `SCORE_PORT`.

### SPA only

```bash
cd web && npm install && npm run dev
```

Without `VITE_SCORE_URL`, browsing and OPML editing still work; Score and Tools proxy need the Worker.

### Tests

```bash
cd web && npm run test:unit && npm run type-check
cd workers/score && npm test
go test ./...
```

### Go crawl

```bash
go build ./...
go run ./cmd/diverss-crawl -directory data/directory.json -out web/public/data/scores.json
```

## Production shape (current)

- **SPA:** GitHub Pages project site, Vite `base: '/diverss/'`, hash router (`#/…`)
- **CI:** `.github/workflows/crawl-and-pages.yml` crawls directory data, builds `web/`, deploys Pages from `main`
- **Edge:** Cloudflare Worker (`workers/score`) — set at build time:

```bash
export VITE_SCORE_URL=https://<your-worker>.workers.dev
# ALLOWED_ORIGINS must include your Pages origin, e.g. https://<user>.github.io
cd web && npm run build
```

### Tools ↔ reader proxy

Tools try browser-direct reader APIs first. If CORS blocks, the SPA relays via Worker `POST /proxy` (same `VITE_SCORE_URL`). Reader tokens stay in `localStorage` on device; the Worker does not persist them.

## Agent discovery

Propose directory adds without writing `main` directly — see `docs/directory-curation.md`.

```bash
python3 scripts/discover-suggest/suggest.py \
  --candidates scripts/discover-suggest/example-candidates.json \
  --out /tmp/diverss-suggestions.md
```

Open a PR against `data/directory.json`. CODEOWNERS requires human review. The SPA only loads published catalog data.

## Brand

DiveRSS — Iconify / Tabler `scuba-mask`.

## Plans

- Product: `docs/plans/2026-08-24-001-feat-diverss-product-plan.md`
- Catalog Outbox: `docs/plans/2026-08-25-001-feat-catalog-outbox-plan.md`
- Tools reader integrations: `docs/plans/2026-08-26-001-feat-tools-reader-integrations-plan.md`
