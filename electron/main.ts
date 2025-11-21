import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'node:path'
import si from 'systeminformation'

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
// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']

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
  ipcMain.handle('get-network-stats', async () => {
    try {
      const networkStats = await si.networkStats();
      // We usually want the first active interface or all of them
      // For simplicity, let's return the default interface or the one with traffic
      const defaultInterface = await si.networkInterfaceDefault();
      const stats = networkStats.find(iface => iface.iface === defaultInterface) || networkStats[0];
      return stats;
    } catch (error) {
      console.error("Error fetching network stats:", error);
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

  ipcMain.handle('get-process-usage', async () => {
    try {
      const [connections, networkStats, defaultInterface] = await Promise.all([
        si.networkConnections(),
        si.networkStats(),
        si.networkInterfaceDefault(),
      ]);

      const ifaceStats = networkStats.find((iface) => iface.iface === defaultInterface) || networkStats[0];
      const rxSec = ifaceStats?.rx_sec || 0;
      const txSec = ifaceStats?.tx_sec || 0;

      const aggregated = new Map<number, { name: string; pid: number; connections: number; tcp: number; udp: number }>();

      connections.forEach((conn) => {
        const pid = typeof conn.pid === 'number' ? conn.pid : -1;
        const existing = aggregated.get(pid) || { name: conn.process || 'System', pid, connections: 0, tcp: 0, udp: 0 };
        existing.connections += 1;
        const protocol = (conn.protocol || '').toLowerCase();
        if (protocol.startsWith('tcp')) {
          existing.tcp += 1;
        } else if (protocol.startsWith('udp')) {
          existing.udp += 1;
        }
        existing.name = conn.process || existing.name;
        aggregated.set(pid, existing);
      });

      const totals = Array.from(aggregated.values());
      const connectionTotal = totals.reduce((sum, entry) => sum + entry.connections, 0) || 1;

      const ranked = totals
        .map((entry) => {
          const ratio = entry.connections / connectionTotal;
          return {
            pid: entry.pid,
            name: entry.name,
            connections: entry.connections,
            tcp: entry.tcp,
            udp: entry.udp,
            rx: rxSec * ratio,
            tx: txSec * ratio,
            activityScore: ratio,
          };
        })
        .sort((a, b) => b.activityScore - a.activityScore)
        .slice(0, 8);

      return ranked;
    } catch (error) {
      console.error('Error fetching process usage:', error);
      return [];
    }
  });
})
