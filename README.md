# DiveRSS

Calm, local-first OPML workspace with a curated public directory companion.
Not a feed reader — manage, score, prune, and export into the reader you already use.

## Status

Greenfield scaffold (plan unit U1). Score engine, Worker, and SPA workspace land in subsequent units.

## Layout

| Path | Role |
|------|------|
| `web/` | Vue 3 + Vite SPA (GitHub Pages) |
| `cmd/diverss-crawl/` | Go CLI for directory crawl (CI) |
| `internal/score/` | Shared health + velocity scoring |
| `workers/score/` | Cloudflare Worker for on-demand Score |
| `data/directory.json` | Curated directory source of truth |
| `docs/plans/` | Product + implementation plan |

## Local development

### Prerequisites

- Go 1.22+
- Node.js 22.18+ or 24.12+
- Optional: [Wrangler](https://developers.cloudflare.com/workers/wrangler/) for the Score Worker

### SPA

```bash
cd web
npm install
npm run dev
```

Production base path is `/diverss/` (project GitHub Pages). Hash routing is used so Pages does not need SPA fallbacks.

```bash
cd web && npm run build
```

### Go

```bash
go build ./...
go test ./...
```

### Score Worker

```bash
cd workers/score
npm install
npm test
npx wrangler deploy   # after U4 implementation
```

## Brand

DiveRSS — Iconify / Tabler `scuba-mask`.
