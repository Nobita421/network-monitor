import {
  app, BrowserWindow, ipcMain, Notification, session,
  type IpcMainEvent, type IpcMainInvokeEvent,
} from 'electron'
import { Reader, type ReaderModel } from '@maxmind/geoip2-node'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import * as fs from 'node:fs'
import { isIP } from 'node:net'
import si from 'systeminformation'
import kill from 'tree-kill'
import { IPC_CHANNELS, type IpLocation, type OverlayMode } from '../src/lib/ipc'
import {
  aggregateTrafficStats,
  isPublicRoutableIp,
  isValidConnection,
  normalizeIpAddress,
} from '../src/lib/network'
import type { Connection, NetworkStat, Settings } from '../src/types'

// ─── Types ────────────────────────────────────────────────────────────────────

type TrustedEvent = IpcMainEvent | IpcMainInvokeEvent

type GeoIpLookupResult = {
  ll: [number, number]
  country: string
  city: string
}

type GeoIpModule = {
  lookup: (ip: string) => GeoIpLookupResult | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MAIN_WINDOW_NETWORK_POLL_INTERVAL_MS = 1000
const OVERLAY_NETWORK_POLL_INTERVAL_MS     = 1000
const CONNECTION_POLL_INTERVAL_MS     = 1000
const PING_POLL_INTERVAL_MS           = 1000
const PING_REQUEST_TIMEOUT_MS         = 2000
const MIN_KILLABLE_PID                = 1000
const KILL_REQUEST_COOLDOWN_MS        = 2000
const MAX_TELEMETRY_PAUSE_DURATION_MS = 24 * 60 * 60 * 1000
const MAX_IP_LOOKUP_BATCH_SIZE        = 500
const MAX_IP_LOOKUP_HANDLER_DURATION_MS = 1500
const RUNTIME_CACHE_DIR_NAME          = 'netmonitor-runtime-cache'
const WIN_STATE_FILE                  = 'window-state.json'

// ─── Paths ────────────────────────────────────────────────────────────────────

const GEO_DATA_DIR = app.isPackaged
  ? path.join(process.resourcesPath, 'data')
  : path.join(__dirname, '../../node_modules/geoip-lite/data')

;(globalThis as { geodatadir?: string }).geodatadir = GEO_DATA_DIR

process.env.DIST        = path.join(__dirname, '../dist-renderer')
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(__dirname, '../public')

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

// ─── Single-instance lock ─────────────────────────────────────────────────────
// Must be called before app.whenReady()

const gotSingleInstanceLock = app.requestSingleInstanceLock()

if (!gotSingleInstanceLock) {
  // Another instance is running — quit immediately
  app.quit()
  process.exit(0)
}

// ─── State ────────────────────────────────────────────────────────────────────

let win: BrowserWindow | null = null
let overlayWin: BrowserWindow | null = null
let trafficMonitoringTimeout: NodeJS.Timeout | null    = null
let connectionMonitoringTimeout: NodeJS.Timeout | null = null
let pingMonitoringTimeout: NodeJS.Timeout | null       = null
let trafficMonitoringInFlight = false
let lastAlertTime  = 0
let lastKillAttemptTime = 0
let pauseTelemetryUntil = 0
const trustedWebContentsIds = new Set<number>()

let lastTrafficStats: NetworkStat = {
  rx_sec: 0, tx_sec: 0,
  iface: 'merged', operstate: 'down', ping: 0,
}
let lastConnections: Connection[] = []
let asnReaderPromise:  Promise<ReaderModel | null> | null = null
let geoIpModulePromise: Promise<GeoIpModule | null> | null = null

let currentSettings: Settings = {
  threshold: 5 * 1024 * 1024,
  cooldownMinutes: 5,
  pauseMinutes: 5,
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

function loadWinState(): WinState {
  try {
    const raw = fs.readFileSync(getWinStatePath(), 'utf8')
    const parsed = JSON.parse(raw) as Partial<WinState>
    const width  = Number(parsed.width)  || 1200
    const height = Number(parsed.height) || 800
    return { x: parsed.x, y: parsed.y, width, height, isMaximized: parsed.isMaximized }
  } catch {
    return { width: 1200, height: 800 }
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

// ─── CSP ─────────────────────────────────────────────────────────────────────

function installCSP() {
  const isDev = Boolean(VITE_DEV_SERVER_URL)

  // In dev we need to allow the Vite dev server origin; in prod allow only file://
  const scriptSrc = isDev ? `'self' 'unsafe-inline'` : `'self'`
  const connectSrc = isDev ? `'self' ws: wss:` : `'none'`

  const csp = [
    `default-src 'self'`,
    `script-src ${scriptSrc}`,
    `style-src 'self' 'unsafe-inline'`,
    `font-src 'self' data:`,
    `img-src 'self' data:`,
    `connect-src ${connectSrc}`,
    `object-src 'none'`,
    `base-uri 'self'`,
  ].join('; ')

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp],
      },
    })
  })

  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false)
  })
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

function getExpectedRendererPathname() {
  const distDir = process.env.DIST
  if (!distDir) return null
  return pathToFileURL(path.join(distDir, 'index.html')).pathname
}

function isAllowedRendererUrl(candidateUrl: string) {
  try {
    if (VITE_DEV_SERVER_URL) {
      return new URL(candidateUrl).origin === new URL(VITE_DEV_SERVER_URL).origin
    }

    const parsedUrl = new URL(candidateUrl)
    if (parsedUrl.protocol !== 'file:') return false

    const expectedPathname = getExpectedRendererPathname()
    return Boolean(expectedPathname && parsedUrl.pathname === expectedPathname)
  } catch {
    return false
  }
}

function isTrustedSender(event: TrustedEvent) {
  const senderFrame = event.senderFrame
  if (!senderFrame || senderFrame !== event.sender.mainFrame) return false
  if (!trustedWebContentsIds.has(event.sender.id)) return false

  const senderUrl = senderFrame.url
  if (!senderUrl) return false

  return isAllowedRendererUrl(senderUrl)
}

function rejectUntrustedSender(event: TrustedEvent, channel: string) {
  if (isTrustedSender(event)) return false
  console.warn(`[SECURITY] Blocked IPC channel "${channel}" from sender ${event.senderFrame?.url ?? 'unknown'}`)
  return true
}

function installWindowNavigationGuards(windowRef: BrowserWindow) {
  windowRef.webContents.setWindowOpenHandler(({ url }) => {
    console.warn(`[SECURITY] Blocked new-window navigation to ${url}`)
    return { action: 'deny' }
  })

  windowRef.webContents.on('will-navigate', (event, url) => {
    if (isAllowedRendererUrl(url)) return
    event.preventDefault()
    console.warn(`[SECURITY] Blocked renderer navigation to ${url}`)
  })
}

function sanitizeSettings(settings: Partial<Settings>): Settings {
  const threshold       = Number(settings.threshold)
  const cooldownMinutes = Number(settings.cooldownMinutes)
  const pauseMinutes    = Number(settings.pauseMinutes)
  return {
    threshold:       Number.isFinite(threshold)       ? Math.max(0.5 * 1024 * 1024, threshold)       : currentSettings.threshold,
    cooldownMinutes: Number.isFinite(cooldownMinutes) ? Math.max(5 / 60, cooldownMinutes)             : currentSettings.cooldownMinutes,
    pauseMinutes:    Number.isFinite(pauseMinutes)    ? Math.max(5 / 60, pauseMinutes)                : currentSettings.pauseMinutes,
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



function getOptionalAsnDbPath() {
  const candidates = [
    process.env.MAXMIND_ASN_DB_PATH,
    path.join(process.cwd(), 'resources', 'GeoLite2-ASN.mmdb'),
    app.isPackaged ? path.join(process.resourcesPath, 'GeoLite2-ASN.mmdb') : null,
  ].filter((candidate): candidate is string => Boolean(candidate))
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null
}

async function loadAsnReader() {
  if (asnReaderPromise) return asnReaderPromise
  const asnDbPath = getOptionalAsnDbPath()
  if (!asnDbPath) {
    asnReaderPromise = Promise.resolve(null)
    return asnReaderPromise
  }
  asnReaderPromise = Reader.open(asnDbPath).catch((error) => {
    console.warn('Failed to open ASN database:', error)
    return null
  })
  return asnReaderPromise
}

async function loadGeoIpModule() {
  if (geoIpModulePromise) return geoIpModulePromise
  geoIpModulePromise = import('geoip-lite')
    .then((module) => {
      const candidate = ((module as { default?: unknown }).default ?? module) as Partial<GeoIpModule>
      if (typeof candidate.lookup !== 'function') throw new Error('geoip-lite did not expose lookup()')
      return candidate as GeoIpModule
    })
    .catch((error) => {
      console.error('Failed to initialize geoip-lite:', error)
      return null
    })
  return geoIpModulePromise
}

function canKillProcess(pid: number) {
  if (!Number.isInteger(pid) || pid < MIN_KILLABLE_PID || pid === process.pid) return false
  const appPids = new Set(app.getAppMetrics().map((metric) => metric.pid))
  if (appPids.has(pid)) return false

  return lastConnections.some((conn) => {
    const state = conn.state.toUpperCase()
    return conn.pid === pid &&
      Boolean(conn.process) &&
      state !== 'LISTEN' &&
      state !== 'LISTENING'
  })
}

function handleTrafficAlert(stats: NetworkStat) {
  if (isTelemetryPaused() || currentSettings.threshold <= 0) return
  const now = Date.now()
  const cooldownMs = currentSettings.cooldownMinutes * 60 * 1000
  if (now - lastAlertTime <= cooldownMs) return

  let title = ''
  let body  = ''

  if (stats.rx_sec > currentSettings.threshold) {
    title = 'High Download Traffic'
    body  = `Download speed: ${stats.rx_sec.toFixed(0)} B/s`
  } else if (stats.tx_sec > currentSettings.threshold) {
    title = 'High Upload Traffic'
    body  = `Upload speed: ${stats.tx_sec.toFixed(0)} B/s`
  }

  if (!title) return

  new Notification({ title, body, silent: false }).show()
  lastAlertTime = now
  broadcast(IPC_CHANNELS.alertTriggered, { title, body, time: new Date().toISOString() })
}

// ─── Monitoring loops ─────────────────────────────────────────────────────────

async function monitorTrafficLoop() {
  if (trafficMonitoringInFlight) return
  trafficMonitoringInFlight = true

  try {
    if (!isTelemetryPaused() && hasVisibleTrafficConsumer()) {
      const stats = await si.networkStats()
      lastTrafficStats = {
        ...aggregateTrafficStats(stats),
        sampledAt: Date.now(),
        ping: lastTrafficStats.ping ?? 0,
      }
      broadcast(IPC_CHANNELS.trafficUpdate, lastTrafficStats, { visibleOnly: true })
      handleTrafficAlert(lastTrafficStats)
    }
  } catch (error) {
    console.error('Monitor loop error:', error)
  } finally {
    trafficMonitoringInFlight = false
    trafficMonitoringTimeout = setTimeout(() => { void monitorTrafficLoop() }, getTrafficPollIntervalMs())
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
  try {
    if (!isTelemetryPaused() && hasVisibleTrafficConsumer()) {
      const ping = await sampleLatency()
      if (ping !== null) {
        lastTrafficStats = { ...lastTrafficStats, ping }
        broadcast(IPC_CHANNELS.latencyUpdate, { ping, sampledAt: Date.now() }, { visibleOnly: true })
      }
    }
  } catch (error) {
    console.error('Ping monitor loop error:', error)
  } finally {
    pingMonitoringTimeout = setTimeout(() => { void monitorPingLoop() }, PING_POLL_INTERVAL_MS)
  }
}

async function monitorConnectionsLoop() {
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
  } catch (error) {
    console.error('Error fetching connections:', error)
  } finally {
    connectionMonitoringTimeout = setTimeout(() => { void monitorConnectionsLoop() }, CONNECTION_POLL_INTERVAL_MS)
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

function registerTrustedWindow(windowRef: BrowserWindow) {
  const { id } = windowRef.webContents
  trustedWebContentsIds.add(id)
  windowRef.webContents.once('destroyed', () => { trustedWebContentsIds.delete(id) })
}

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
      preload: path.join(__dirname, 'preload.js'),
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

  overlayWin.on('closed', () => { overlayWin = null })
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
})

// ─── IPC Handlers ─────────────────────────────────────────────────────────────

void app.whenReady().then(() => {
  installCSP()
  createWindow()
  startMonitoring()

  ipcMain.handle(IPC_CHANNELS.getAppVersion, () => app.getVersion())

  ipcMain.on(IPC_CHANNELS.updateSettings, (event, settings: Settings) => {
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

  ipcMain.handle(IPC_CHANNELS.getTrafficStats, (event) => {
    if (rejectUntrustedSender(event, IPC_CHANNELS.getTrafficStats)) return null
    return lastTrafficStats
  })

  ipcMain.handle(IPC_CHANNELS.getNetworkConnections, (event) => {
    if (rejectUntrustedSender(event, IPC_CHANNELS.getNetworkConnections)) return []
    return lastConnections
  })

  ipcMain.handle(IPC_CHANNELS.killProcess, async (event, pid: number) => {
    if (rejectUntrustedSender(event, IPC_CHANNELS.killProcess) || !canKillProcess(pid)) return false
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

  ipcMain.handle(IPC_CHANNELS.getIpLocations, async (event, ips: string[]) => {
    if (rejectUntrustedSender(event, IPC_CHANNELS.getIpLocations)) return {}

    try {
      const requestedIps = Array.isArray(ips) ? ips : []
      const uniqueIps = [
        ...new Set(
          requestedIps
            .filter((ip): ip is string => typeof ip === 'string' && ip.trim().length > 0)
            .map((ip) => normalizeIpAddress(ip))
            .filter(isPublicRoutableIp),
        ),
      ]
      const cappedIps = uniqueIps.slice(0, MAX_IP_LOOKUP_BATCH_SIZE)
      const results: Record<string, IpLocation | null> = {}
      const lookupDeadline = Date.now() + MAX_IP_LOOKUP_HANDLER_DURATION_MS

      for (const ip of uniqueIps.slice(MAX_IP_LOOKUP_BATCH_SIZE)) {
        results[ip] = null
      }

      const [asnReader, geoip] = await Promise.all([loadAsnReader(), loadGeoIpModule()])

      if (!geoip) {
        for (const ip of cappedIps) results[ip] = null
        return results
      }

      for (const ip of cappedIps) {
        if (Date.now() > lookupDeadline || isIP(ip) === 0) {
          results[ip] = null
          continue
        }

        const geo = geoip.lookup(ip)
        if (!geo) { results[ip] = null; continue }

        const lat = Number(geo.ll[0])
        const lon = Number(geo.ll[1])
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) { results[ip] = null; continue }

        let isp: string | undefined
        let asn: string | undefined

        if (asnReader) {
          try {
            const response = asnReader.asn(ip)
            isp = response.autonomousSystemOrganization || undefined
            asn = response.autonomousSystemNumber ? `AS${response.autonomousSystemNumber}` : undefined
          } catch {
            isp = undefined
            asn = undefined
          }
        }

        results[ip] = {
          lat, lon,
          country: geo.country,
          city:    geo.city,
          ...(isp ? { isp } : {}),
          ...(asn ? { asn } : {}),
        }
      }

      return results
    } catch (error) {
      console.error('Failed to lookup IPs:', error)
      return {}
    }
  })

  ipcMain.handle(IPC_CHANNELS.toggleOverlay, (event) => {
    if (rejectUntrustedSender(event, IPC_CHANNELS.toggleOverlay)) return false
    if (overlayWin) { overlayWin.close(); return false }
    createOverlayWindow()
    return true
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
    return true
  })
})
