import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const args = process.argv.slice(2)
const strict = args.includes('--strict')
const force = args.includes('--force')
const licenseKeyArg = args.find((arg) => arg.startsWith('--license-key='))
const licenseKey = licenseKeyArg ? licenseKeyArg.split('=')[1] : process.env.LICENSE_KEY
const maxAgeDaysArg = args.find((arg) => arg.startsWith('--max-age-days='))
const parsedMaxAgeDays = maxAgeDaysArg ? Number(maxAgeDaysArg.split('=')[1]) : Number.NaN
const maxAgeDays = Number.isFinite(parsedMaxAgeDays) && parsedMaxAgeDays > 0 ? parsedMaxAgeDays : 7
const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000

const scriptPath = fileURLToPath(import.meta.url)
const scriptsDir = path.dirname(scriptPath)
const repoRoot = path.resolve(scriptsDir, '..')
const geoipPackageDir = path.join(repoRoot, 'node_modules', 'geoip-lite')
const dataDir = path.join(geoipPackageDir, 'data')
const updaterScriptPath = path.join(geoipPackageDir, 'scripts', 'updatedb.js')

function latestDataMtimeMs() {
  if (!fs.existsSync(dataDir)) {
    return 0
  }

  const entries = fs.readdirSync(dataDir, { withFileTypes: true })
  let latest = 0

  for (const entry of entries) {
    if (!entry.isFile()) {
      continue
    }

    const entryPath = path.join(dataDir, entry.name)
    const { mtimeMs } = fs.statSync(entryPath)
    latest = Math.max(latest, mtimeMs)
  }

  return latest
}

function runUpdater() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [updaterScriptPath], {
      cwd: repoRoot,
      env: {
        ...process.env,
        LICENSE_KEY: licenseKey,
      },
      stdio: 'inherit',
    })

    child.on('error', (error) => reject(error))
    child.on('close', (code) => resolve(code ?? 1))
  })
}

function fail(message) {
  if (strict) {
    console.error(`[geoip-update] ${message}`)
    process.exit(1)
  }

  console.warn(`[geoip-update] ${message}`)
}

async function main() {
  if (!fs.existsSync(updaterScriptPath)) {
    fail('Unable to locate geoip-lite updater script. Run pnpm install first.')
    return
  }

  if (!licenseKey) {
    fail('Missing MaxMind license key. Set LICENSE_KEY or pass --license-key=...')
    return
  }

  if (!force) {
    const latestMtime = latestDataMtimeMs()
    if (latestMtime > 0 && Date.now() - latestMtime <= maxAgeMs) {
      console.log(`[geoip-update] Data is fresh (<= ${maxAgeDays} days old). Skipping update.`)
      return
    }
  }

  console.log('[geoip-update] Refreshing geoip-lite data...')
  try {
    const code = await runUpdater()
    if (code !== 0) {
      fail(`Updater exited with code ${code}.`)
      return
    }

    console.log('[geoip-update] GeoIP data refresh completed.')
  } catch (error) {
    fail(`Updater failed: ${error instanceof Error ? error.message : String(error)}`)
  }
}

void main()
