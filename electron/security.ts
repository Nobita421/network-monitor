import {
  session,
  type BrowserWindow,
  type IpcMainEvent,
  type IpcMainInvokeEvent,
} from 'electron'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

export type TrustedEvent = IpcMainEvent | IpcMainInvokeEvent

export const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

const trustedWebContentsIds = new Set<number>()

export function registerTrustedWindow(windowRef: BrowserWindow) {
  const { id } = windowRef.webContents
  trustedWebContentsIds.add(id)
  windowRef.webContents.once('destroyed', () => { trustedWebContentsIds.delete(id) })
}

function getExpectedRendererPathname() {
  const distDir = process.env.DIST
  if (!distDir) return null
  return pathToFileURL(path.join(distDir, 'index.html')).pathname
}

export function isAllowedRendererUrl(candidateUrl: string) {
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

export function rejectUntrustedSender(event: TrustedEvent, channel: string) {
  if (isTrustedSender(event)) return false
  console.warn(`[SECURITY] Blocked IPC channel "${channel}" from sender ${event.senderFrame?.url ?? 'unknown'}`)
  return true
}

export function installWindowNavigationGuards(windowRef: BrowserWindow) {
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

// ─── CSP ─────────────────────────────────────────────────────────────────────

export function installCSP() {
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
