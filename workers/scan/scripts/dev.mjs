#!/usr/bin/env node
/**
 * Start Score Worker on the first free port at or above 8787 (or $PORT).
 */
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { findFreePort } from '../../../scripts/lib/find-free-port.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const preferred = Number(process.env.PORT) || 8787
const host = process.env.HOST || '127.0.0.1'
const port = await findFreePort(preferred, host)

if (port !== preferred) {
  console.log(`[gardenrss] port ${preferred} busy — using ${port}`)
}

const child = spawn(
  'npx',
  ['wrangler', 'dev', '--ip', host, '--port', String(port)],
  {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
  },
)

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  process.exit(code ?? 1)
})

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    child.kill(sig)
  })
}
