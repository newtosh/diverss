import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import worker, { parseFeed, scoreParsedFeed, checkUrlShape } from './index'
import type { Env } from './types'

const __dirname = dirname(fileURLToPath(import.meta.url))
const testdata = join(__dirname, '../../../testdata')

const env: Env = {
  ALLOWED_ORIGINS: 'http://localhost:5173,https://example.github.io',
}

describe('golden fixture parity', () => {
  it('scores fixture-blog.xml to match score-golden (ignoring scoredAt)', () => {
    const xml = readFileSync(join(testdata, 'feeds/fixture-blog.xml'), 'utf8')
    const golden = JSON.parse(
      readFileSync(join(testdata, 'score-golden/fixture-blog.json'), 'utf8'),
    ) as Record<string, unknown>

    const feed = parseFeed(xml)
    expect(feed).not.toBeNull()

    const now = new Date('2026-08-24T12:00:00.000Z')
    const result = scoreParsedFeed('https://fixture.example/feed.xml', feed, now)

    const { scoredAt: _gotAt, ...got } = result
    const { scoredAt: _wantAt, ...want } = golden
    expect(got).toEqual(want)
  })
})

describe('POST batch validation', () => {
  it('returns 400 for empty batch', async () => {
    const res = await worker.fetch(
      new Request('https://score.example/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'http://localhost:5173',
        },
        body: JSON.stringify({ urls: [] }),
      }),
      env,
    )
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe('empty_batch')
  })

  it('returns 400 for oversize batch', async () => {
    const urls = Array.from({ length: 26 }, (_, i) => `https://example.com/f${i}.xml`)
    const res = await worker.fetch(
      new Request('https://score.example/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'http://localhost:5173',
        },
        body: JSON.stringify({ urls }),
      }),
      env,
    )
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe('batch_too_large')
  })
})

describe('SSRF', () => {
  it('blocks private / metadata URLs', () => {
    const blocked = [
      'http://127.0.0.1/feed.xml',
      'http://10.0.0.1/feed.xml',
      'http://192.168.1.1/feed.xml',
      'http://169.254.169.254/latest/meta-data/',
      'http://[::1]/feed.xml',
      'http://localhost/feed.xml',
      'http://user:pass@example.com/feed.xml',
      'ftp://example.com/feed.xml',
    ]
    for (const u of blocked) {
      const r = checkUrlShape(u)
      expect(r.ok, u).toBe(false)
    }
  })

  it('returns blocked_url reason for private URL via worker', async () => {
    const res = await worker.fetch(
      new Request('https://score.example/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'http://localhost:5173',
        },
        body: JSON.stringify({ urls: ['http://127.0.0.1/feed.xml'] }),
      }),
      env,
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      results: Array<{ health: string; reason: string; xmlUrl: string }>
    }
    expect(body.results).toHaveLength(1)
    expect(body.results[0].health).toBe('unhealthy')
    expect(body.results[0].reason).toBe('blocked_url')
    // Response must not leak upstream body.
    expect(JSON.stringify(body)).not.toMatch(/<rss|<html|meta-data/i)
  })
})

describe('CORS', () => {
  it('handles OPTIONS for allowed origin', async () => {
    const res = await worker.fetch(
      new Request('https://score.example/', {
        method: 'OPTIONS',
        headers: { Origin: 'http://localhost:5173' },
      }),
      env,
    )
    expect(res.status).toBe(204)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(
      'http://localhost:5173',
    )
  })
})
