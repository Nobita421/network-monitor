import { app, BrowserWindow, ipcMain, Notification, type IpcMainEvent, type IpcMainInvokeEvent } from 'electron'
import { Reader, type ReaderModel } from '@maxmind/geoip2-node'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import * as fs from 'node:fs'
import si from 'systeminformation'
import kill from 'tree-kill'
import { IPC_CHANNELS, type IpLocation, type OverlayMode } from '../src/lib/ipc'
import { aggregateTrafficStats } from '../src/lib/network'
import type { Connection, NetworkStat, Settings } from '../src/types'

type TrustedEvent = IpcMainEvent | IpcMainInvokeEvent

type GeoIpLookupResult = {
  ll: [number, number]
  country: string
  city: string
}

type GeoIpModule = {
  lookup: (ip: string) => GeoIpLookupResult | null
}

const GEO_DATA_DIR = app.isPackaged
  ? path.join(process.resourcesPath, 'data')
  : path.join(__dirname, '../node_modules/geoip-lite/data')

;(globalThis as { geodatadir?: string }).geodatadir = GEO_DATA_DIR

process.env.DIST = path.join(__dirname, '../dist-renderer')
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(__dirname, '../public')

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL
const NETWORK_POLL_INTERVAL_MS = 1000
const CONNECTION_POLL_INTERVAL_MS = 5000
const PING_POLL_INTERVAL_MS = 5000
const PING_REQUEST_TIMEOUT_MS = 2000
const MIN_KILLABLE_PID = 1000
const RUNTIME_CACHE_DIR_NAME = 'netmonitor-runtime-cache'

let win: BrowserWindow | null = null
let overlayWin: BrowserWindow | null = null
let trafficMonitoringTimeout: NodeJS.Timeout | null = null
let connectionMonitoringTimeout: NodeJS.Timeout | null = null
let pingMonitoringTimeout: NodeJS.Timeout | null = null
let lastAlertTime = 0
let pauseTelemetryUntil = 0
const trustedWebContentsIds = new Set<number>()
let lastTrafficStats: NetworkStat = {
  rx_sec: 0,
  tx_sec: 0,
  iface: 'merged',
  operstate: 'down',
  ping: 0,
}
let lastConnections: Connection[] = []
let asnReaderPromise: Promise<ReaderModel | null> | null = null
let geoIpModulePromise: Promise<GeoIpModule | null> | null = null

let currentSettings: Settings = {
  threshold: 5 * 1024 * 1024,
  cooldownMinutes: 5,
  pauseMinutes: 5,
}

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

    const userDataPath = path.join(cacheRoot, 'user-data')
    const sessionDataPath = path.join(cacheRoot, 'session-data')
    const diskCachePath = path.join(cacheRoot, 'chromium-disk-cache')

    const userDataWritable = ensureWritableDirectory(userDataPath)
    const sessionDataWritable = ensureWritableDirectory(sessionDataPath)
    const diskCacheWritable = ensureWritableDirectory(diskCachePath)

    if (!userDataWritable || !sessionDataWritable || !diskCacheWritable) {
      return
    }

    app.setPath('userData', userDataPath)
    app.setPath('sessionData', sessionDataPath)
    app.commandLine.appendSwitch('disk-cache-dir', diskCachePath)
    app.commandLine.appendSwitch('disable-http-cache')
    app.commandLine.appendSwitch('disable-gpu-shader-disk-cache')
  } catch (error) {
    console.warn('Failed to configure runtime cache paths:', error)
  }
}

configureRuntimeCachePaths()

function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) {
    return '0 B'
  }

  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
}

function isTelemetryPaused() {
  return Date.now() < pauseTelemetryUntil
}

function broadcast<T>(channel: string, payload: T) {
  for (const windowRef of [win, overlayWin]) {
    if (windowRef && !windowRef.isDestroyed()) {
      windowRef.webContents.send(channel, payload)
    }
  }
}

function getExpectedRendererPathname() {
  const distDir = process.env.DIST
  if (!distDir) {
    return null
  }

  return pathToFileURL(path.join(distDir, 'index.html')).pathname
}

function isTrustedSender(event: TrustedEvent) {
  const senderFrame = event.senderFrame
  if (!senderFrame || senderFrame !== event.sender.mainFrame) {
    return false
  }

  if (!trustedWebContentsIds.has(event.sender.id)) {
    return false
  }

  const senderUrl = senderFrame.url
  if (!senderUrl) {
    return false
  }

  try {
    if (VITE_DEV_SERVER_URL) {
      return new URL(senderUrl).origin === new URL(VITE_DEV_SERVER_URL).origin
    }

    const parsedSenderUrl = new URL(senderUrl)
    if (parsedSenderUrl.protocol !== 'file:') {
      return false
    }

    const expectedPathname = getExpectedRendererPathname()
    return Boolean(expectedPathname && parsedSenderUrl.pathname === expectedPathname)
  } catch {
    return false
  }
}

function rejectUntrustedSender(event: TrustedEvent, channel: string) {
  if (isTrustedSender(event)) {
    return false
  }

  console.warn(`[SECURITY] Blocked IPC channel "${channel}" from sender ${event.senderFrame?.url ?? 'unknown'}`)
  return true
}

function sanitizeSettings(settings: Partial<Settings>): Settings {
  const threshold = Number(settings.threshold)
  const cooldownMinutes = Number(settings.cooldownMinutes)
  const pauseMinutes = Number(settings.pauseMinutes)

  return {
    threshold: Number.isFinite(threshold) ? Math.max(0.5 * 1024 * 1024, threshold) : currentSettings.threshold,
    cooldownMinutes: Number.isFinite(cooldownMinutes) ? Math.max(5 / 60, cooldownMinutes) : currentSettings.cooldownMinutes,
    pauseMinutes: Number.isFinite(pauseMinutes) ? Math.max(5 / 60, pauseMinutes) : currentSettings.pauseMinutes,
  }
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
  if (asnReaderPromise) {
    return asnReaderPromise
  }

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
  if (geoIpModulePromise) {
    return geoIpModulePromise
  }

  geoIpModulePromise = import('geoip-lite')
    .then((module) => {
      const candidate = ((module as { default?: unknown }).default ?? module) as Partial<GeoIpModule>

      if (typeof candidate.lookup !== 'function') {
        throw new Error('geoip-lite did not expose lookup()')
      }

      return candidate as GeoIpModule
    })
    .catch((error) => {
      console.error('Failed to initialize geoip-lite:', error)
      return null
    })

  return geoIpModulePromise
}

function canKillProcess(pid: number) {
  if (!Number.isInteger(pid) || pid < MIN_KILLABLE_PID || pid === process.pid) {
    return false
  }

  const appPids = new Set(app.getAppMetrics().map((metric) => metric.pid))
  return !appPids.has(pid)
}

function handleTrafficAlert(stats: NetworkStat) {
  if (isTelemetryPaused() || currentSettings.threshold <= 0) {
    return
  }

  const now = Date.now()
  const cooldownMs = currentSettings.cooldownMinutes * 60 * 1000

  if (now - lastAlertTime <= cooldownMs) {
    return
  }

  let title = ''
  let body = ''

  if (stats.rx_sec > currentSettings.threshold) {
    title = 'High Download Traffic'
    body = `Download speed: ${formatBytes(stats.rx_sec)}/s`
  } else if (stats.tx_sec > currentSettings.threshold) {
    title = 'High Upload Traffic'
    body = `Upload speed: ${formatBytes(stats.tx_sec)}/s`
  }

  if (!title) {
    return
  }

  new Notification({
    title,
    body,
    silent: false,
  }).show()

  lastAlertTime = now
  broadcast(IPC_CHANNELS.alertTriggered, {
    title,
    body,
    time: new Date().toISOString(),
  })
}

async function monitorTrafficLoop() {
  try {
    if (!isTelemetryPaused()) {
      const stats = await si.networkStats()
      lastTrafficStats = {
        ...aggregateTrafficStats(stats),
        ping: lastTrafficStats.ping ?? 0,
      }

      broadcast(IPC_CHANNELS.trafficUpdate, lastTrafficStats)
      handleTrafficAlert(lastTrafficStats)
    }
  } catch (error) {
    console.error('Monitor loop error:', error)
  } finally {
    trafficMonitoringTimeout = setTimeout(() => {
      void monitorTrafficLoop()
    }, NETWORK_POLL_INTERVAL_MS)
  }
}

async function sampleLatency() {
  return new Promise<number | null>((resolve) => {
    const timeout = setTimeout(() => {
      resolve(null)
    }, PING_REQUEST_TIMEOUT_MS)

    void si
      .inetLatency()
      .then((latency) => {
        if (Number.isFinite(latency) && latency >= 0) {
          resolve(latency)
        } else {
          resolve(null)
        }
      })
      .catch(() => {
        resolve(null)
      })
      .finally(() => {
        clearTimeout(timeout)
      })
  })
}

async function monitorPingLoop() {
  try {
    if (!isTelemetryPaused()) {
      const ping = await sampleLatency()
      if (ping !== null) {
        lastTrafficStats = { ...lastTrafficStats, ping }
        broadcast(IPC_CHANNELS.trafficUpdate, lastTrafficStats)
      }
    }
  } catch (error) {
    console.error('Ping monitor loop error:', error)
  } finally {
    pingMonitoringTimeout = setTimeout(() => {
      void monitorPingLoop()
    }, PING_POLL_INTERVAL_MS)
  }
}

async function monitorConnectionsLoop() {
  try {
    if (!isTelemetryPaused()) {
      lastConnections = await si.networkConnections()
      broadcast(IPC_CHANNELS.connectionsUpdate, lastConnections)
    }
  } catch (error) {
    console.error('Error fetching connections:', error)
  } finally {
    connectionMonitoringTimeout = setTimeout(() => {
      void monitorConnectionsLoop()
    }, CONNECTION_POLL_INTERVAL_MS)
  }
}

function startMonitoring() {
  if (!trafficMonitoringTimeout) {
    void monitorTrafficLoop()
  }

  if (!connectionMonitoringTimeout) {
    void monitorConnectionsLoop()
  }

  if (!pingMonitoringTimeout) {
    void monitorPingLoop()
  }
}

function stopMonitoring() {
  if (trafficMonitoringTimeout) {
    clearTimeout(trafficMonitoringTimeout)
    trafficMonitoringTimeout = null
  }

  if (connectionMonitoringTimeout) {
    clearTimeout(connectionMonitoringTimeout)
    connectionMonitoringTimeout = null
  }

  if (pingMonitoringTimeout) {
    clearTimeout(pingMonitoringTimeout)
    pingMonitoringTimeout = null
  }
}

function registerTrustedWindow(windowRef: BrowserWindow) {
  const { id } = windowRef.webContents
  trustedWebContentsIds.add(id)
  windowRef.webContents.once('destroyed', () => {
    trustedWebContentsIds.delete(id)
  })
}

function createOverlayWindow() {
  overlayWin = new BrowserWindow({
    width: 350,
    height: 70,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    useContentSize: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })
  registerTrustedWindow(overlayWin)

  if (VITE_DEV_SERVER_URL) {
    void overlayWin.loadURL(`${VITE_DEV_SERVER_URL}#/overlay`)
  } else {
    void overlayWin.loadFile(path.join(process.env.DIST || '', 'index.html'), { hash: '/overlay' })
  }

  overlayWin.on('closed', () => {
    overlayWin = null
  })
}

function createWindow() {
  win = new BrowserWindow({
    width: 1000,
    height: 800,
    icon: path.join(process.env.VITE_PUBLIC || '', 'electron-vite.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false,
    },
    title: 'NetMonitor Pro',
    autoHideMenuBar: true,
  })
  registerTrustedWindow(win)

  if (VITE_DEV_SERVER_URL) {
    void win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    void win.loadFile(path.join(process.env.DIST || '', 'index.html'))
  }

  win.on('closed', () => {
    win = null
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.on('before-quit', () => {
  stopMonitoring()
})

void app.whenReady().then(() => {
  createWindow()
  startMonitoring()

  ipcMain.on(IPC_CHANNELS.updateSettings, (event, settings: Settings) => {
    if (rejectUntrustedSender(event, IPC_CHANNELS.updateSettings)) {
      return
    }

    currentSettings = sanitizeSettings(settings)
  })

  ipcMain.on(IPC_CHANNELS.setTelemetryPaused, (event, durationMs: number) => {
    if (rejectUntrustedSender(event, IPC_CHANNELS.setTelemetryPaused)) {
      return
    }

    const numericDurationMs = Number(durationMs)
    pauseTelemetryUntil = numericDurationMs > 0 ? Date.now() + numericDurationMs : 0
  })

  ipcMain.handle(IPC_CHANNELS.getTrafficStats, (event) => {
    if (rejectUntrustedSender(event, IPC_CHANNELS.getTrafficStats)) {
      return null
    }

    return lastTrafficStats
  })

  ipcMain.handle(IPC_CHANNELS.getNetworkConnections, (event) => {
    if (rejectUntrustedSender(event, IPC_CHANNELS.getNetworkConnections)) {
      return []
    }

    return lastConnections
  })

  ipcMain.handle(IPC_CHANNELS.killProcess, async (event, pid: number) => {
    if (rejectUntrustedSender(event, IPC_CHANNELS.killProcess) || !canKillProcess(pid)) {
      return false
    }

    try {
      await new Promise<void>((resolve, reject) => {
        kill(pid, 'SIGKILL', (error) => {
          if (error) {
            reject(error)
          } else {
            resolve()
          }
        })
      })
      return true
    } catch (error) {
      console.error(`Failed to kill process ${pid}:`, error)
      return false
    }
  })

  ipcMain.handle(IPC_CHANNELS.getIpLocations, async (event, ips: string[]) => {
    if (rejectUntrustedSender(event, IPC_CHANNELS.getIpLocations)) {
      return {}
    }

    try {
      const uniqueIps = [...new Set(ips.filter((ip): ip is string => typeof ip === 'string' && ip.trim().length > 0))]
      const results: Record<string, IpLocation | null> = {}
      const [asnReader, geoip] = await Promise.all([loadAsnReader(), loadGeoIpModule()])

      if (!geoip) {
        for (const ip of uniqueIps) {
          results[ip] = null
        }

        return results
      }

      for (const ip of uniqueIps) {
        const geo = geoip.lookup(ip)
        if (!geo) {
          results[ip] = null
          continue
        }

        const lat = Number(geo.ll[0])
        const lon = Number(geo.ll[1])
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
          results[ip] = null
          continue
        }

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
          lat,
          lon,
          country: geo.country,
          city: geo.city,
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
    if (rejectUntrustedSender(event, IPC_CHANNELS.toggleOverlay)) {
      return false
    }

    if (overlayWin) {
      overlayWin.close()
      return false
    }

    createOverlayWindow()
    return true
  })

  ipcMain.handle(IPC_CHANNELS.setOverlayMode, (event, mode: OverlayMode) => {
    if (rejectUntrustedSender(event, IPC_CHANNELS.setOverlayMode)) {
      return false
    }

    if (mode !== 'locked' && mode !== 'unlocked') {
      return false
    }

    if (!overlayWin || overlayWin.isDestroyed()) {
      return false
    }

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
