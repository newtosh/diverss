# Filter packs

Shared GardenRSS filter packs (schema v1). Browse, create, and save them from **Tools → Filters**. Packs use **Miniflux-native** semantics: `block` or `keep`. There is no muffle/mute — Miniflux only supports block and keep regex rules.

## Schema

| Field | Type | Notes |
|-------|------|--------|
| `schemaVersion` | `1` | Required |
| `id` | string | Stable slug; shipped packs must match `{id}.json` |
| `name` | string | Display name |
| `mode` | `block` \| `keep` | Miniflux blocklist vs keeplist |
| `pattern` | string | Keyword or regex (optional `/.../` wrappers OK) |
| `patternKind` | `keyword` \| `regex` | |
| `fields` | `title` \| `body`[] | At least one |
| `scope` | `{ global: boolean, feedUrls?: string[] }` | Associated feeds |
| `notes` | string? | |

## Pull from Miniflux

**Pull from Miniflux** lists existing per-feed `block_filter_entry_rules` / `keep_filter_entry_rules`, groups identical lines, and can **Import selected as local packs** (EntryTitle/EntryContent only). Import never writes back to the server.

Patterns must be **RE2-compatible** (no lookarounds or backreferences). Miniflux rejects invalid regex with HTTP 400.

## Apply via API

When Miniflux is connected (or mock is on), **Apply block/keep to Miniflux** merges compiled `EntryTitle=` / `EntryContent=` lines into each target feed’s `block_filter_entry_rules` or `keep_filter_entry_rules` (append-if-absent). Pack `global: true` fans out to every feed. Miniflux Settings-page globals are not available via public API.

## Local packs

Tools can **Create** packs and **Save** them in browser `localStorage`. Use **Backup** / **Restore** to export or import JSON. Contribute lasting packs via PR into this folder.

## Add a shipped pack

1. Create `web/public/data/filter-packs/{id}.json`.
2. Add `{id}` to `index.json`.
3. Open a PR.
