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

## Agent discovery scaffold

Agents (or humans) can propose directory adds without writing to `main` directly:

```bash
python3 scripts/discover-suggest/suggest.py \
  --candidates scripts/discover-suggest/example-candidates.json \
  --out /tmp/diverss-suggestions.md
```

Open a PR against `data/directory.json` using the suggestion markdown. CODEOWNERS requires human review. The SPA only loads merged, published catalog data — there is no in-app pending queue.

## Score Worker

Deploy `workers/score` with Wrangler, then build the SPA with:

```bash
export VITE_SCORE_URL=https://<your-worker>.workers.dev
cd web && npm run build
```

Local Score against `wrangler dev`:

```bash
# terminal 1
cd workers/score && npx wrangler dev

# terminal 2
cd web && VITE_SCORE_URL=http://127.0.0.1:8787 npm run dev
```
