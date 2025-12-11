# Implementation Plan: Network Monitor Pro

This document provides technical details and code examples for the tasks outlined in `tasks.md`.

## 1. Security Hardening

### Content Security Policy (CSP)
Add this to the `<head>` of `index.html`:
```html
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://*; connect-src 'self' https://*;">
```

### Secure Preload Script
**File:** `electron/preload.ts`

Instead of exposing `ipcRenderer`, expose a defined API.

```typescript
import { contextBridge, ipcRenderer } from 'electron'

// Define the API type for TypeScript intellisense in Renderer
export type ElectronAPI = {
  getTrafficStats: () => Promise<any>,
  getNetworkConnections: () => Promise<any>,
  killProcess: (pid: number) => Promise<boolean>,
  getIpLocations: (ips: string[]) => Promise<Record<string, any>>,
  toggleOverlay: () => Promise<boolean>,
  onTrafficUpdate: (callback: (data: any) => void) => void,
  offTrafficUpdate: () => void,
}

const api: ElectronAPI = {
  getTrafficStats: () => ipcRenderer.invoke('get-traffic-stats'),
  getNetworkConnections: () => ipcRenderer.invoke('get-network-connections'),
  killProcess: (pid) => ipcRenderer.invoke('kill-process', pid),
  getIpLocations: (ips) => ipcRenderer.invoke('get-ip-locations', ips),
  toggleOverlay: () => ipcRenderer.invoke('toggle-overlay'),
  
  // Event listeners (One-way Main -> Renderer)
  onTrafficUpdate: (callback) => {
    const subscription = (_event: any, data: any) => callback(data)
    ipcRenderer.on('traffic-update', subscription)
    // Return a cleanup function or handle removal separately
  },
  offTrafficUpdate: () => {
    ipcRenderer.removeAllListeners('traffic-update')
  }
}

contextBridge.exposeInMainWorld('electronAPI', api)
```

**Update `src/vite-env.d.ts`:**
```typescript
interface Window {
  electronAPI: import('../electron/preload').ElectronAPI
}
```

## 2. Performance Optimization

### Virtualized Connection Table
**Library:** `react-virtuoso` (Recommended for variable heights and ease of use) or `react-window`.

**File:** `src/components/dashboard/ConnectionTable.tsx`

```tsx
import { TableVirtuoso } from 'react-virtuoso'

// ... inside component ...

return (
  <div className="h-[600px] border border-white/5 bg-slate-950/70 rounded-3xl overflow-hidden">
    <TableVirtuoso
      style={{ height: '100%' }}
      data={filteredConnections}
      fixedHeaderContent={() => (
        <tr className="bg-slate-900/95 backdrop-blur text-xs uppercase tracking-wide text-slate-400">
          <th className="px-5 py-3">Process</th>
          <th className="px-5 py-3">Protocol</th>
          <th className="px-5 py-3">Local</th>
          <th className="px-5 py-3">Remote</th>
          <th className="px-5 py-3">State</th>
        </tr>
      )}
      itemContent={(index, conn) => (
        <>
          <td className="px-5 py-4 font-medium text-white">{conn.process || 'System'}</td>
          <td className="px-5 py-4">{conn.protocol.toUpperCase()}</td>
          <td className="px-5 py-4 text-slate-300">{conn.localAddress}:{conn.localPort}</td>
          <td className="px-5 py-4 text-slate-300">{conn.peerAddress}:{conn.peerPort}</td>
          <td className="px-5 py-4">
            {/* State Badge Component */}
            <span className="..."> {conn.state} </span>
          </td>
        </>
      )}
    />
  </div>
)
```

### Optimized GeoIP Lookup (Caching)
**File:** `electron/main.ts`

```typescript
const ipCache = new Map<string, any>();

ipcMain.handle('get-ip-locations', async (_event, ips: string[]) => {
  const results: Record<string, any> = {};
  const uniqueIps = [...new Set(ips)];
  
  for (const ip of uniqueIps) {
    if (ipCache.has(ip)) {
      results[ip] = ipCache.get(ip);
    } else {
      // geoip.lookup is synchronous but fast. 
      // If it becomes a bottleneck, wrap in setImmediate or use a worker.
      const geo = geoip.lookup(ip);
      const data = geo ? { lat: geo.ll[0], lon: geo.ll[1], country: geo.country, city: geo.city } : null;
      
      ipCache.set(ip, data);
      results[ip] = data;
      
      // Limit cache size if necessary
      if (ipCache.size > 5000) ipCache.clear(); 
    }
  }
  return results;
});
```

## 3. Windows Native Integration

### System Tray & Background Mode
**File:** `electron/main.ts`

```typescript
import { Tray, Menu, nativeImage } from 'electron'

let tray: Tray | null = null

function createTray() {
  const icon = nativeImage.createFromPath(path.join(process.env.VITE_PUBLIC, 'icon.png'))
  tray = new Tray(icon)
  
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show App', click: () => win?.show() },
    { type: 'separator' },
    { label: 'Quit', click: () => {
        app.quit() 
      } 
    }
  ])
  
  tray.setToolTip('NetMonitor Pro')
  tray.setContextMenu(contextMenu)
  
  tray.on('double-click', () => {
    win?.show()
  })
}

// Update createWindow
function createWindow() {
  // ... existing code ...
  
  win.on('close', (event) => {
    if (!app.isQuitting) { // Custom flag
      event.preventDefault()
      win?.hide()
      return false
    }
  })
}

app.whenReady().then(() => {
  createTray()
  createWindow()
})
```

### Single Instance Lock
**File:** `electron/main.ts`

```typescript
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Someone tried to run a second instance, we should focus our window.
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })
  
  // ... rest of app initialization
}
```

## 4. Overlay Window Draggability
To make the transparent overlay draggable, you need to handle mouse events carefully.

**Renderer (Overlay Component):**
```css
.draggable-region {
  -webkit-app-region: drag;
}
.interactive-region {
  -webkit-app-region: no-drag;
}
```
Apply `.draggable-region` to the container and `.interactive-region` to buttons/inputs.

**Main Process:**
Ensure `transparent: true` and `frame: false` are set (already done).
```typescript
// If you need click-through but also drag, it gets complex. 
// For simple drag, just use CSS -webkit-app-region: drag.
```
