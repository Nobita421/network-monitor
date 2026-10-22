import { app, BrowserWindow, ipcMain, Notification, screen } from 'electron'
import { execFile } from 'node:child_process'
import path from 'node:path'
import * as fs from 'node:fs'
import { promisify } from 'node:util'
import si from 'systeminformation'
import kill from 'tree-kill'
import { IPC_CHANNELS, type OverlayMode } from '../src/lib/ipc'
import { backoffDelayMs } from '../src/lib/polling'
import {
  aggregateTrafficStats,
  aggregateWindowsPerformanceCounters,
  isRecord,
  isValidConnection,
  normalizeIpAddress,
} from '../src/lib/network'
import type { Connection, NetworkStat, Settings } from '../src/types'
import { isWatchSightingDue, sanitizeWatchlist } from '../src/lib/watchlist'
import { lookupIpLocations } from './geoip'
import {
  VITE_DEV_SERVER_URL,
  installCSP,
  installWindowNavigationGuards,
  registerTrustedWindow,
  rejectUntrustedSender,
} from './security'

// ─── Constants ────────────────────────────────────────────────────────────────

const MAIN_WINDOW_NETWORK_POLL_INTERVAL_MS = 1000
const OVERLAY_NETWORK_POLL_INTERVAL_MS     = 1500
const CONNECTION_POLL_INTERVAL_MS     = 3000
const PING_POLL_INTERVAL_MS           = 5000
const PING_REQUEST_TIMEOUT_MS         = 2000
const MIN_KILLABLE_PID                = 1000
const KILL_REQUEST_COOLDOWN_MS        = 2000
const MAX_TELEMETRY_PAUSE_DURATION_MS = 24 * 60 * 60 * 1000
const RUNTIME_CACHE_DIR_NAME          = 'netmonitor-runtime-cache'
const WIN_STATE_FILE                  = 'window-state.json'
const APP_USER_MODEL_ID               = 'com.netmonitor.pro'
const WINDOWS_NETWORK_COUNTER_SCRIPT  = [
  // Use SilentlyContinue so transient PDH "negative value" errors don't abort the whole command.
  "Get-Counter '\\Network Interface(*)\\Bytes Received/sec','\\Network Interface(*)\\Bytes Sent/sec' -MaxSamples 1 -ErrorAction SilentlyContinue",
  '| Select-Object -ExpandProperty CounterSamples',
  '| Select-Object Path,InstanceName,CookedValue,RawValue,Status',
  '| ConvertTo-Json -Compress -Depth 3',
].join(' ')

const execFileAsync = promisify(execFile)

// ─── Paths ────────────────────────────────────────────────────────────────────

const GEO_DATA_DIR = app.isPackaged
  ? path.join(process.resourcesPath, 'data')
  : path.join(__dirname, '../node_modules/geoip-lite/data')

;(globalThis as { geodatadir?: string }).geodatadir = GEO_DATA_DIR

process.env.DIST        = path.join(__dirname, '../dist-renderer')
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(__dirname, '../public')

// ─── Single-instance lock ─────────────────────────────────────────────────────
// Must be called before app.whenReady()

app.setAppUserModelId(app.isPackaged ? APP_USER_MODEL_ID : process.execPath)

const gotSingleInstanceLock = app.requestSingleInstanceLock()

if (!gotSingleInstanceLock) {
  // Another instance is running — quit immediately
  app.quit()
  process.exit(0)
}

// Prevent a single faulty module (GeoIP, systeminformation, PowerShell) from
// taking down the whole app. Loops already self-heal; these are last-resort guards.
process.on('uncaughtException', (error) => {
  console.error('[CRASH-GUARD] Uncaught exception:', error)
})
process.on('unhandledRejection', (reason) => {
  console.error('[CRASH-GUARD] Unhandled rejection:', reason)
})

// ─── State ────────────────────────────────────────────────────────────────────

let win: BrowserWindow | null = null
let overlayWin: BrowserWindow | null = null
let overlayMode: OverlayMode = 'unlocked'
let trafficMonitoringTimeout: NodeJS.Timeout | null    = null
let connectionMonitoringTimeout: NodeJS.Timeout | null = null
let pingMonitoringTimeout: NodeJS.Timeout | null       = null
let trafficMonitoringInFlight = false
let pingMonitoringInFlight = false
let connectionMonitoringInFlight = false
let trafficErrorStreak = 0
let pingErrorStreak = 0
let connectionErrorStreak = 0
let lastAlertTime  = 0
let lastKillAttemptTime = 0
const lastWatchSightingAt = new Map<string, number>()
let pauseTelemetryUntil = 0
let didWarnWindowsCounterFailure = false

let lastTrafficStats: NetworkStat = {
  rx_sec: 0, tx_sec: 0,
  iface: 'merged', operstate: 'down', ping: 0,
}
let lastConnections: Connection[] = []

let currentSettings: Settings = {
  threshold: 5 * 1024 * 1024,
  cooldownMinutes: 5,
  pauseMinutes: 5,
  watchlist: [],
}

// ─── Window State Persistence ─────────────────────────────────────────────────

interface WinState {
  x?: number; y?: number
  width: number; height: number
  isMaximized?: boolean
}

function getWinStatePath(): string {
  return path.join(app.getPath('userData'), WIN_STATE_FILE)
}

function finiteOrNull(value: unknown) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

function loadWinState(): WinState {
  let parsed: Record<string, unknown> = {}

  try {
    const raw: unknown = JSON.parse(fs.readFileSync(getWinStatePath(), 'utf8'))
    if (isRecord(raw)) parsed = raw
  } catch {
    // Missing or corrupt state: use defaults.
  }

  const width  = Math.max(900, Math.min(finiteOrNull(parsed.width)  ?? 1200, 8192))
  const height = Math.max(600, Math.min(finiteOrNull(parsed.height) ?? 800,  8192))
  const x = finiteOrNull(parsed.x)
  const y = finiteOrNull(parsed.y)
  const isMaximized = parsed.isMaximized === true

  if (x === null || y === null) return { width, height, isMaximized }

  try {
    const isVisible = screen.getAllDisplays().some(({ workArea }) => (
      x < workArea.x + workArea.width &&
      x + width > workArea.x &&
      y < workArea.y + workArea.height &&
      y + height > workArea.y
    ))
    return isVisible
      ? { x, y, width, height, isMaximized }
      : { width, height, isMaximized }
  } catch {
    return { width, height, isMaximized }
  }
}

function saveWinState(browserWin: BrowserWindow) {
  try {
    const isMaximized = browserWin.isMaximized()
    const bounds = browserWin.getNormalBounds() // Always returns un-maximized bounds
    const state: WinState = { ...bounds, isMaximized }
    fs.writeFileSync(getWinStatePath(), JSON.stringify(state), 'utf8')
  } catch {
    // Non-fatal
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ensureWritableDirectory(dirPath: string) {
  try {
    fs.mkdirSync(dirPath, { recursive: true })
    fs.accessSync(dirPath, fs.constants.W_OK)
    return true
  } catch {
    return false
  }
}

function configureRuntimeCachePaths() {
  try {
    const cacheRoot = app.isPackaged
      ? path.join(app.getPath('appData'), 'netmonitor-pro', 'runtime-cache')
      : path.join(app.getPath('temp'), RUNTIME_CACHE_DIR_NAME)

    const userDataPath    = path.join(cacheRoot, 'user-data')
    const sessionDataPath = path.join(cacheRoot, 'session-data')

    const userDataWritable    = ensureWritableDirectory(userDataPath)
    const sessionDataWritable = ensureWritableDirectory(sessionDataPath)

    if (!userDataWritable || !sessionDataWritable) return

    app.setPath('userData', userDataPath)
    app.setPath('sessionData', sessionDataPath)

    if (!app.isPackaged && process.env.NETMON_DISABLE_HTTP_CACHE !== '0') {
      app.commandLine.appendSwitch('disable-http-cache')
    }
  } catch (error) {
    console.warn('Failed to configure runtime cache paths:', error)
  }
}

configureRuntimeCachePaths()

function isTelemetryPaused() {
  return Date.now() < pauseTelemetryUntil
}

function isVisibleWindow(windowRef: BrowserWindow | null) {
  return Boolean(
    windowRef &&
    !windowRef.isDestroyed() &&
    windowRef.isVisible() &&
    !windowRef.isMinimized(),
  )
}

function hasVisibleMainWindow() {
  return isVisibleWindow(win)
}

function hasVisibleTrafficConsumer() {
  return isVisibleWindow(win) || isVisibleWindow(overlayWin)
}

function getTrafficPollIntervalMs() {
  return hasVisibleMainWindow()
    ? MAIN_WINDOW_NETWORK_POLL_INTERVAL_MS
    : OVERLAY_NETWORK_POLL_INTERVAL_MS
}

function requestTrafficRefresh() {
  if (trafficMonitoringTimeout) {
    clearTimeout(trafficMonitoringTimeout)
    trafficMonitoringTimeout = null
  }

  if (!trafficMonitoringInFlight) {
    void monitorTrafficLoop()
  }
}

function hasUsableTrafficStats(stats: NetworkStat) {
  return stats.rx_sec > 0 ||
    stats.tx_sec > 0 ||
    typeof stats.rx_bytes === 'number' ||
    typeof stats.tx_bytes === 'number'
}

async function sampleWindowsPerformanceCounters() {
  if (process.platform !== 'win32') return null

  try {
    const { stdout } = await execFileAsync(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-Command',
        WINDOWS_NETWORK_COUNTER_SCRIPT,
      ],
      {
        windowsHide: true,
        // 8 s: Get-Counter needs ~1 s to compute rates; extra headroom for slow startup.
        timeout: 8000,
        maxBuffer: 1024 * 1024,
      },
    )
    const output = stdout.trim()
    if (!output) return null

    const stats = aggregateWindowsPerformanceCounters(JSON.parse(output) as unknown)
    didWarnWindowsCounterFailure = false
    return stats
  } catch (error) {
    if (!didWarnWindowsCounterFailure) {
      console.warn('Failed to sample Windows network performance counters:', error)
      didWarnWindowsCounterFailure = true
    }
    return null
  }
}

function areConnectionsEqual(a: Connection[], b: Connection[]) {
  if (a.length !== b.length) return false

  for (let i = 0; i < a.length; i += 1) {
    const left = a[i]
    const right = b[i]
    if (
      left.protocol !== right.protocol ||
      left.localAddress !== right.localAddress ||
      left.localPort !== right.localPort ||
      left.peerAddress !== right.peerAddress ||
      left.peerPort !== right.peerPort ||
      left.state !== right.state ||
      left.process !== right.process ||
      left.pid !== right.pid
    ) {
      return false
    }
  }

  return true
}

function broadcast<T>(channel: string, payload: T, options: { visibleOnly?: boolean } = {}) {
  for (const windowRef of [win, overlayWin]) {
    if (windowRef && !windowRef.isDestroyed() && (!options.visibleOnly || isVisibleWindow(windowRef))) {
      windowRef.webContents.send(channel, payload)
    }
  }
}

function sanitizeSettings(settings: unknown): Settings {
  const input = settings && typeof settings === 'object'
    ? settings as Partial<Settings>
    : {}
  const threshold       = Number(input.threshold)
  const cooldownMinutes = Number(input.cooldownMinutes)
  const pauseMinutes    = Number(input.pauseMinutes)
  return {
    threshold:       Number.isFinite(threshold)       ? Math.max(0.5 * 1024 * 1024, threshold)       : currentSettings.threshold,
    cooldownMinutes: Number.isFinite(cooldownMinutes) ? Math.max(5 / 60, cooldownMinutes)             : currentSettings.cooldownMinutes,
    pauseMinutes:    Number.isFinite(pauseMinutes)    ? Math.max(5 / 60, pauseMinutes)                : currentSettings.pauseMinutes,
    watchlist: sanitizeWatchlist(input.watchlist),
  }
}

/** Coerce raw systeminformation connection data to our typed Connection */
function sanitizeConnection(raw: si.Systeminformation.NetworkConnectionsData): Connection | null {
  const connection: Connection = {
    protocol:     typeof raw.protocol     === 'string' ? raw.protocol     : 'unknown',
    localAddress: typeof raw.localAddress === 'string' ? normalizeIpAddress(raw.localAddress) : '',
    localPort:    typeof raw.localPort    === 'string' ? raw.localPort    : '0',
    peerAddress:  typeof raw.peerAddress  === 'string' ? normalizeIpAddress(raw.peerAddress) : '',
    peerPort:     typeof raw.peerPort     === 'string' ? raw.peerPort     : '0',
    state:        typeof raw.state        === 'string' ? raw.state        : '',
    process:      typeof raw.process      === 'string' ? raw.process      : '',
    pid:          typeof raw.pid          === 'number' ? raw.pid          : undefined,
  }

  return isValidConnection(connection) ? connection : null
}



function canKillProcess(pid: unknown) {
  if (!Number.isInteger(pid) || (pid as number) < MIN_KILLABLE_PID || pid === process.pid) return false
  const numericPid = pid as number
  const appPids = new Set(app.getAppMetrics().map((metric) => metric.pid))
  if (appPids.has(numericPid)) return false

  return lastConnections.some((conn) => {
    const state = conn.state.toUpperCase()
    return conn.pid === numericPid &&
      Boolean(conn.process) &&
      state !== 'LISTEN' &&
      state !== 'LISTENING'
  })
}

/** Human-readable rate for OS notifications (kept local: utils pulls in renderer-only deps). */
function formatRateBps(bytesPerSec: number) {
  if (bytesPerSec >= 1024 * 1024) return `${(bytesPerSec / 1024 / 1024).toFixed(1)} MB/s`
  if (bytesPerSec >= 1024) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`
  return `${bytesPerSec.toFixed(0)} B/s`
}

function showNotification(title: string, body: string) {
  if (!Notification.isSupported()) return
  try {
    new Notification({ title, body, silent: false }).show()
  } catch (error) {
    console.warn('Failed to show notification:', error)
  }
}

function handleTrafficAlert(stats: NetworkStat) {
  if (isTelemetryPaused() || currentSettings.threshold <= 0) return
  const now = Date.now()
  const cooldownMs = currentSettings.cooldownMinutes * 60 * 1000
  if (now - lastAlertTime <= cooldownMs) return

  let title = ''
  let body  = ''
  let direction: 'rx' | 'tx' | null = null

  if (stats.rx_sec > currentSettings.threshold) {
    title = 'High Download Traffic'
    body  = `Download speed: ${formatRateBps(stats.rx_sec)}`
    direction = 'rx'
  } else if (stats.tx_sec > currentSettings.threshold) {
    title = 'High Upload Traffic'
    body  = `Upload speed: ${formatRateBps(stats.tx_sec)}`
    direction = 'tx'
  }

  if (!title || !direction) return

  showNotification(title, body)
  lastAlertTime = now
  const rateBps = direction === 'rx' ? stats.rx_sec : stats.tx_sec
  broadcast(IPC_CHANNELS.alertTriggered, {
    title,
    body,
    time: new Date().toISOString(),
    direction,
    rxSec: stats.rx_sec,
    txSec: stats.tx_sec,
    rateBps,
    rateLabel: formatRateBps(rateBps),
  })
}

// ─── Monitoring loops ─────────────────────────────────────────────────────────
// Each loop self-heals with capped exponential backoff (see lib/polling.ts)
// so a single failing collector can't busy-loop the CPU.

async function monitorTrafficLoop() {
  if (trafficMonitoringInFlight) return
  trafficMonitoringInFlight = true

  try {
    if (!isTelemetryPaused() && hasVisibleTrafficConsumer()) {
      const systemStats = aggregateTrafficStats(await si.networkStats())
      const hasSystemStats = hasUsableTrafficStats(systemStats)
      const fallbackStats = hasSystemStats
        ? null
        : await sampleWindowsPerformanceCounters()
      lastTrafficStats = {
        ...(fallbackStats ?? systemStats),
        sampledAt: Date.now(),
        ping: lastTrafficStats.ping ?? 0,
      }
      broadcast(IPC_CHANNELS.trafficUpdate, lastTrafficStats, { visibleOnly: true })
      handleTrafficAlert(lastTrafficStats)
      // If both collectors produced unusable data, back off instead of
      // re-running PowerShell at the full cadence.
      if (!hasSystemStats && !fallbackStats) trafficErrorStreak += 1
      else trafficErrorStreak = 0
    } else {
      trafficErrorStreak = 0
    }
  } catch (error) {
    trafficErrorStreak += 1
    console.error('Monitor loop error:', error)
  } finally {
    trafficMonitoringInFlight = false
    const delay = backoffDelayMs(getTrafficPollIntervalMs(), trafficErrorStreak)
    trafficMonitoringTimeout = setTimeout(() => { void monitorTrafficLoop() }, delay)
  }
}

async function sampleLatency() {
  return new Promise<number | null>((resolve) => {
    const timeout = setTimeout(() => { resolve(null) }, PING_REQUEST_TIMEOUT_MS)
    void si
      .inetLatency()
      .then((latency) => {
        if (Number.isFinite(latency) && latency >= 0) resolve(latency)
        else resolve(null)
      })
      .catch(() => { resolve(null) })
      .finally(() => { clearTimeout(timeout) })
  })
}

async function monitorPingLoop() {
  if (pingMonitoringInFlight) return
  pingMonitoringInFlight = true
  try {
    if (!isTelemetryPaused() && hasVisibleTrafficConsumer()) {
      const ping = await sampleLatency()
      if (ping !== null) {
        lastTrafficStats = { ...lastTrafficStats, ping }
        broadcast(IPC_CHANNELS.latencyUpdate, { ping, sampledAt: Date.now() }, { visibleOnly: true })
      }
    }
    pingErrorStreak = 0
  } catch (error) {
    pingErrorStreak += 1
    console.error('Ping monitor loop error:', error)
  } finally {
    pingMonitoringInFlight = false
    pingMonitoringTimeout = setTimeout(
      () => { void monitorPingLoop() },
      backoffDelayMs(PING_POLL_INTERVAL_MS, pingErrorStreak),
    )
  }
}

async function monitorConnectionsLoop() {
  if (connectionMonitoringInFlight) return
  connectionMonitoringInFlight = true
  try {
    if (!isTelemetryPaused() && hasVisibleMainWindow()) {
      const raw = await si.networkConnections()
      const nextConnections = raw
        .map(sanitizeConnection)
        .filter((connection): connection is Connection => connection !== null)

      if (!areConnectionsEqual(lastConnections, nextConnections)) {
        lastConnections = nextConnections
        broadcast(IPC_CHANNELS.connectionsUpdate, lastConnections, { visibleOnly: true })
      }
    }
    connectionErrorStreak = 0
  } catch (error) {
    connectionErrorStreak += 1
    console.error('Error fetching connections:', error)
  } finally {
    connectionMonitoringInFlight = false
    connectionMonitoringTimeout = setTimeout(
      () => { void monitorConnectionsLoop() },
      backoffDelayMs(CONNECTION_POLL_INTERVAL_MS, connectionErrorStreak),
    )
  }
}

function startMonitoring() {
  if (!trafficMonitoringTimeout)    void monitorTrafficLoop()
  if (!connectionMonitoringTimeout) void monitorConnectionsLoop()
  if (!pingMonitoringTimeout)       void monitorPingLoop()
}

function stopMonitoring() {
  if (trafficMonitoringTimeout)    { clearTimeout(trafficMonitoringTimeout);    trafficMonitoringTimeout    = null }
  if (connectionMonitoringTimeout) { clearTimeout(connectionMonitoringTimeout); connectionMonitoringTimeout = null }
  if (pingMonitoringTimeout)       { clearTimeout(pingMonitoringTimeout);       pingMonitoringTimeout       = null }
}

// ─── Window creation ──────────────────────────────────────────────────────────

function createOverlayWindow() {
  overlayWin = new BrowserWindow({
    width: 350, height: 70,
    frame: false, transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true, skipTaskbar: true,
    resizable: false, hasShadow: false,
    useContentSize: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'overlay-preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      webviewTag: false,
      backgroundThrottling: true,
    },
  })
  registerTrustedWindow(overlayWin)
  installWindowNavigationGuards(overlayWin)
  overlayWin.webContents.setBackgroundThrottling(true)

  if (VITE_DEV_SERVER_URL) {
    void overlayWin.loadURL(`${VITE_DEV_SERVER_URL}#/overlay`)
  } else {
    void overlayWin.loadFile(path.join(process.env.DIST || '', 'index.html'), { hash: '/overlay' })
  }

  overlayWin.once('ready-to-show', () => {
    overlayWin?.showInactive()
  })

  overlayWin.on('closed', () => {
    overlayWin = null
    overlayMode = 'unlocked'
    broadcast(IPC_CHANNELS.overlayClosed, null)
    broadcast(IPC_CHANNELS.overlayModeChanged, overlayMode)
  })
}

function createWindow() {
  const winState = loadWinState()

  win = new BrowserWindow({
    width:  winState.width,
    height: winState.height,
    x: winState.x,
    y: winState.y,
    minWidth:  900,
    minHeight: 600,
    icon: path.join(process.env.VITE_PUBLIC || '', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      webviewTag: false,
      backgroundThrottling: true,
    },
    title: 'NetMonitor Pro',
    autoHideMenuBar: true,
    show: false, // Don't flash; show after ready-to-show
  })

  registerTrustedWindow(win)
  installWindowNavigationGuards(win)
  win.webContents.setBackgroundThrottling(true)

  // Restore maximized state
  if (winState.isMaximized) win.maximize()

  // Show window once it's fully rendered, then fetch fresh traffic immediately.
  win.once('ready-to-show', () => {
    win?.show()
    requestTrafficRefresh()
  })

  win.on('show', requestTrafficRefresh)
  win.on('restore', requestTrafficRefresh)
  win.on('focus', requestTrafficRefresh)

  // Save window state before closing
  win.on('close', () => { if (win) saveWinState(win) })

  if (VITE_DEV_SERVER_URL) {
    void win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    void win.loadFile(path.join(process.env.DIST || '', 'index.html'))
  }

  win.on('closed', () => { win = null })
}

// ─── App lifecycle ────────────────────────────────────────────────────────────

// Focus existing window when second instance is launched
app.on('second-instance', () => {
  if (win) {
    if (win.isMinimized()) win.restore()
    win.focus()
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

app.on('before-quit', () => {
  // Signal renderer to clean up IPC subscriptions before we stop monitoring
  broadcast(IPC_CHANNELS.appBeforeQuit, null)
  stopMonitoring()
  if (process.platform === 'win32') {
    try { si.powerShellRelease() } catch { /* best-effort shutdown */ }
  }
})

// ─── IPC Handlers ─────────────────────────────────────────────────────────────

void app.whenReady().then(() => {
  installCSP()
  // Keep one PowerShell worker warm on Windows. systeminformation otherwise
  // spawns a fresh shell for several network queries on every poll.
  if (process.platform === 'win32') {
    try { si.powerShellStart() } catch (error) {
      console.warn('Failed to start persistent PowerShell worker:', error)
    }
  }
  createWindow()
  startMonitoring()

  ipcMain.on(IPC_CHANNELS.updateSettings, (event, settings: unknown) => {
    if (rejectUntrustedSender(event, IPC_CHANNELS.updateSettings)) return
    currentSettings = sanitizeSettings(settings)
  })

  ipcMain.on(IPC_CHANNELS.setTelemetryPaused, (event, durationMs: number) => {
    if (rejectUntrustedSender(event, IPC_CHANNELS.setTelemetryPaused)) return

    const numericDurationMs = Number(durationMs)
    if (!Number.isFinite(numericDurationMs)) {
      pauseTelemetryUntil = 0
      return
    }

    const clampedDurationMs = Math.min(
      Math.max(0, Math.trunc(numericDurationMs)),
      MAX_TELEMETRY_PAUSE_DURATION_MS,
    )
    pauseTelemetryUntil = clampedDurationMs > 0 ? Date.now() + clampedDurationMs : 0
  })

  // Watchlist sightings: renderer already dedupes to absent→present transitions;
  // main adds a per-process cooldown so a flapping process can't spam the OS.
  ipcMain.on(IPC_CHANNELS.watchSighting, (event, processName: unknown) => {
    if (rejectUntrustedSender(event, IPC_CHANNELS.watchSighting)) return
    if (typeof processName !== 'string') return
    const name = processName.trim().slice(0, 100)
    if (!name) return

    const now = Date.now()
    if (!isWatchSightingDue(lastWatchSightingAt.get(name.toLowerCase()), now)) return
    lastWatchSightingAt.set(name.toLowerCase(), now)
    if (lastWatchSightingAt.size > 100) {
      const oldest = lastWatchSightingAt.keys().next()
      if (!oldest.done) lastWatchSightingAt.delete(oldest.value)
    }

    showNotification('Watched process active', name)
  })

  ipcMain.handle(IPC_CHANNELS.getTrafficStats, (event) => {
    if (rejectUntrustedSender(event, IPC_CHANNELS.getTrafficStats)) return null
    return lastTrafficStats
  })

  ipcMain.handle(IPC_CHANNELS.getNetworkConnections, (event) => {
    if (rejectUntrustedSender(event, IPC_CHANNELS.getNetworkConnections)) return []
    return lastConnections
  })

  ipcMain.handle(IPC_CHANNELS.killProcess, async (event, rawPid: unknown) => {
    if (rejectUntrustedSender(event, IPC_CHANNELS.killProcess)) return false
    const pid = typeof rawPid === 'number' ? rawPid : Number(rawPid)
    if (!canKillProcess(pid)) {
      console.warn(`[SECURITY] Blocked kill-process for pid ${String(rawPid)}`)
      return false
    }
    const now = Date.now()
    if (now - lastKillAttemptTime < KILL_REQUEST_COOLDOWN_MS) return false
    lastKillAttemptTime = now

    try {
      await new Promise<void>((resolve, reject) => {
        kill(pid, 'SIGKILL', (error) => { if (error) reject(error); else resolve() })
      })
      return true
    } catch (error) {
      console.error(`Failed to kill process ${pid}:`, error)
      return false
    }
  })

  ipcMain.handle(IPC_CHANNELS.getIpLocations, async (event, ips: unknown) => {
    if (rejectUntrustedSender(event, IPC_CHANNELS.getIpLocations)) return {}
    return lookupIpLocations(ips)
  })

  ipcMain.handle(IPC_CHANNELS.toggleOverlay, (event) => {
    if (rejectUntrustedSender(event, IPC_CHANNELS.toggleOverlay)) return false
    if (overlayWin) { overlayWin.close(); return false }
    createOverlayWindow()
    return true
  })

  ipcMain.handle(IPC_CHANNELS.getOverlayMode, (event) => {
    if (rejectUntrustedSender(event, IPC_CHANNELS.getOverlayMode)) return 'unlocked' satisfies OverlayMode
    return overlayMode
  })

  ipcMain.handle(IPC_CHANNELS.getOverlayOpen, (event) => {
    if (rejectUntrustedSender(event, IPC_CHANNELS.getOverlayOpen)) return false
    return Boolean(overlayWin && !overlayWin.isDestroyed())
  })

  ipcMain.handle(IPC_CHANNELS.setOverlayMode, (event, mode: OverlayMode) => {
    if (rejectUntrustedSender(event, IPC_CHANNELS.setOverlayMode)) return false
    if (mode !== 'locked' && mode !== 'unlocked') return false
    if (!overlayWin || overlayWin.isDestroyed()) return false

    if (mode === 'locked') {
      overlayWin.setIgnoreMouseEvents(true, { forward: true })
      overlayWin.setFocusable(false)
    } else {
      overlayWin.setIgnoreMouseEvents(false)
      overlayWin.setFocusable(true)
    }
    overlayMode = mode
    broadcast(IPC_CHANNELS.overlayModeChanged, overlayMode)
    return true
  })
})
