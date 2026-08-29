#!/usr/bin/env node
/**
 * Start Vite on the first free port at or above 5173 (or $PORT).
 * Honors VITE_SCAN_URL from the environment.
 */
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { findFreePort } from './lib/find-free-port.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '../web')
const preferred = Number(process.env.PORT) || 5173
const host = process.env.HOST || '127.0.0.1'
const port = await findFreePort(preferred, host)

if (port !== preferred) {
  console.log(`[gardenrss] port ${preferred} busy — using ${port}`)
}

const child = spawn(
  'npm',
  ['run', 'dev:vite', '--', '--host', host, '--port', String(port)],
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
