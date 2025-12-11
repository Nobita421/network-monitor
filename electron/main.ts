import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'node:path'
import si from 'systeminformation'
import kill from 'tree-kill'
// Configure geoip-lite data directory
if (app.isPackaged) {
  // In production, use the resources directory
  (global as any).geodatadir = path.join(process.resourcesPath, 'data')
} else {
  // In development, use the node_modules directory
  (global as any).geodatadir = path.join(__dirname, '../node_modules/geoip-lite/data')
}

const geoip = require('geoip-lite')

// The built directory structure
//
// ├─┬─ dist
// │ ├─ index.html
// │ ├─ assets
// │ └─ ...
// ├─┬─ dist-electron
// │ ├─ main.js
// │ └─ preload.js
//
process.env.DIST = path.join(__dirname, '../dist')
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(__dirname, '../public')

let win: BrowserWindow | null
let overlayWin: BrowserWindow | null = null
// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']

function createOverlayWindow() {
  overlayWin = new BrowserWindow({
    width: 250,
    height: 120,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  overlayWin.setIgnoreMouseEvents(true, { forward: true })

  // Allow moving the window by holding Shift (implemented in renderer if needed, but for now just click-through)
  // Actually, to make it draggable we need to toggle ignoreMouseEvents.
  // For this MVP, let's keep it fixed or simple click-through.

  if (VITE_DEV_SERVER_URL) {
    overlayWin.loadURL(`${VITE_DEV_SERVER_URL}#/overlay`)
  } else {
    overlayWin.loadFile(path.join(process.env.DIST || '', 'index.html'), { hash: 'overlay' })
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
    },
    title: "NetMonitor Pro",
    autoHideMenuBar: true,
  })

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(process.env.DIST || '', 'index.html'))
  }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(() => {
  createWindow()

  // IPC Handlers
  ipcMain.handle('get-traffic-stats', async () => {
    try {
      const networkStats = await si.networkStats();
      const defaultInterface = await si.networkInterfaceDefault();
      const stats = networkStats.find(iface => iface.iface === defaultInterface) || networkStats[0];
      return stats;
    } catch (error) {
      console.error("Error fetching traffic stats:", error);
      return null;
    }
  });

  ipcMain.handle('get-network-connections', async () => {
    try {
      const connections = await si.networkConnections();
      return connections;
    } catch (error) {
      console.error("Error fetching connections:", error);
      return [];
    }
  });

  // Deprecated: get-process-usage is too heavy to run frequently.
  // We will calculate this in the renderer or a worker using the connections list.
  
  ipcMain.handle('kill-process', async (_event, pid: number) => {
    return new Promise((resolve) => {
      if (!pid || pid === -1) {
        resolve(false)
        return
      }
      kill(pid, 'SIGKILL', (err: Error | undefined) => {
        if (err) {
          console.error(`Failed to kill process ${pid}:`, err)
          resolve(false)
        } else {
          resolve(true)
        }
      })
    })
  })

  ipcMain.handle('get-ip-locations', async (_event, ips: string[]) => {
    try {
      // Deduplicate IPs to save processing
      const uniqueIps = [...new Set(ips)];
      const results: Record<string, any> = {};
      
      for (const ip of uniqueIps) {
        const geo = geoip.lookup(ip);
        if (geo) {
          results[ip] = { lat: geo.ll[0], lon: geo.ll[1], country: geo.country, city: geo.city };
        } else {
          results[ip] = null;
        }
      }
      return results;
    } catch (error) {
      console.error(`Failed to lookup IPs:`, error);
      return {};
    }
  })

  ipcMain.handle('toggle-overlay', () => {
    if (overlayWin) {
      overlayWin.close()
      return false
    } else {
      createOverlayWindow()
      return true
    }
  })
})
