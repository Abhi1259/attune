#!/usr/bin/env node
/**
 * Launches the app with ATTUNE_SMOKE=1 (main process prints SMOKE_OK after the
 * BrowserWindow is created, then quits) and asserts the marker appeared.
 * Used to verify main-process wiring boots without a full manual session.
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const electronModule = path.join(root, 'node_modules', 'electron')
const exeRel = fs.readFileSync(path.join(electronModule, 'path.txt'), 'utf-8').trim()
const exe = path.join(path.join(electronModule, 'dist'), exeRel)

const isBuilt = process.argv.includes('--built')
const mainArg = isBuilt ? path.join(root, 'out', 'main', 'index.js') : root

const child = spawn(exe, [mainArg], {
  env: { ...process.env, ATTUNE_SMOKE: '1', SMOKE_ARG: String(isBuilt) },
  cwd: root,
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true
})

let out = ''
const done = new Promise((resolve) => {
  const timer = setTimeout(() => resolve(false), 30000)
  child.stdout.on('data', (d) => {
    out += d.toString()
    if (out.includes('SMOKE_OK')) {
      clearTimeout(timer)
      resolve(true)
    }
  })
  child.stderr.on('data', (d) => { out += d.toString() })
})

const ok = await done
try { child.kill('SIGINT') } catch { /* already gone */ }
setTimeout(() => process.exit(ok ? 0 : 1), ok ? 0 : 100)
if (!ok) {
  console.error('\n[smoke] FAILED. Output:')
  console.error(out.slice(-4000))
  process.exit(1)
}
console.log('\n[smoke] SMOKE_OK received; main process boots fine')
