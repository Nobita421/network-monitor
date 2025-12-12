import { app, BrowserWindow, ipcMain, Notification } from 'electron'
import path from 'node:path'
import * as fs from 'node:fs'
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
process.env.DIST = path.join(__dirname, '../dist')
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(__dirname, '../public')

let win: BrowserWindow | null
let overlayWin: BrowserWindow | null = null
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']

// --- BACKGROUND MONITORING STATE ---
let monitoringTimeout: NodeJS.Timeout | null = null;
let isMonitoring = false;
let lastAlertTime = 0;
let pauseAlertsUntil = 0;

interface AppSettings {
    threshold: number;      // Bytes per second
    cooldownMinutes: number;
    pauseMinutes: number;   // In minutes, but we might receive/store as needed
}

// Default settings until frontend syncs
let currentSettings: AppSettings = {
    threshold: 5 * 1024 * 1024,
    cooldownMinutes: 5,
    pauseMinutes: 5
};

function formatBytes(bytes: number, decimals = 2) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function startMonitoring() {
    if (isMonitoring) return;
    isMonitoring = true;
    monitorLoop();
}

async function monitorLoop() {
    if (!isMonitoring) return;

    try {
        const networkStats = await si.networkStats();
            // Aggregate traffic from all active, non-internal interfaces
            // Filter out loopbacks or internal only if possible, but stats usually returns external-ish ones.
            // We want to sum up traffic to catch VPNs + Ethernet etc.
            
            let totalRx = 0;
            let totalTx = 0;
            let activeIface = '';

            for (const iface of networkStats) {
                // simple heuristic: if it has traffic, count it.
                // or check iface.operstate === 'up'
                if (iface.operstate === 'up' || iface.rx_sec > 0 || iface.tx_sec > 0) {
                     totalRx += iface.rx_sec;
                     totalTx += iface.tx_sec;
                     // Just keep track of one active name for display
                     if (!activeIface) activeIface = iface.iface;
                }
            }

            // Fallback object to send
            const aggregatedStats = {
                rx_sec: totalRx,
                tx_sec: totalTx,
                iface: activeIface || 'merged',
                operstate: 'up'
            };

            // Send to Renderer
            if (win && !win.isDestroyed()) {
                win.webContents.send('traffic-update', aggregatedStats);
            }
            if (overlayWin && !overlayWin.isDestroyed()) {
                overlayWin.webContents.send('traffic-update', aggregatedStats);
            }

            // --- ALERT LOGIC ---
            const now = Date.now();
            const isPaused = now < pauseAlertsUntil;
            
            if (!isPaused && currentSettings.threshold > 0) {
                 const cooldownMs = currentSettings.cooldownMinutes * 60 * 1000;
                 // Check if cooled down
                 if (now - lastAlertTime > cooldownMs) {
                      let triggered = false;
                      let bodyText = '';
                      let titleText = '';

                      if (totalRx > currentSettings.threshold) {
                          titleText = 'High Download Traffic';
                          bodyText = `Download speed: ${formatBytes(totalRx)}/s`;
                          triggered = true;
                      } else if (totalTx > currentSettings.threshold) {
                          titleText = 'High Upload Traffic';
                          bodyText = `Upload speed: ${formatBytes(totalTx)}/s`;
                          triggered = true;
                      }

                      if (triggered) {
                          new Notification({
                              title: titleText,
                              body: bodyText,
                              silent: false
                          }).show();
                          
                          lastAlertTime = now;
                          
                          // Optional: Notify renderer that an alert happened (for logs)
                          if (win && !win.isDestroyed()) {
                              win.webContents.send('alert-triggered', {
                                  title: titleText,
                                  body: bodyText,
                                  time: new Date().toISOString()
                              });
                          }
                      }
                 }
            }

        } catch (error) {
            console.error("Monitor loop error:", error);
        }

        if (isMonitoring) {
            monitoringTimeout = setTimeout(monitorLoop, 1000);
        }
    }

function createOverlayWindow() {
  overlayWin = new BrowserWindow({
    width: 220,
    height: 100,
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

  // We want to interact with it (drag), so DO NOT ignore mouse events.
  // overlayWin.setIgnoreMouseEvents(true, { forward: true })

  if (VITE_DEV_SERVER_URL) {
    overlayWin.loadURL(`${VITE_DEV_SERVER_URL}#/overlay`)
  } else {
    overlayWin.loadFile(path.join(process.env.DIST || '', 'index.html'), { hash: '/overlay' })
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
      backgroundThrottling: false, // Keep this, though Main process loop is better
    },
    title: "NetMonitor Pro",
    autoHideMenuBar: true,
  })

  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(process.env.DIST || '', 'index.html'))
  }
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
    if (monitoringTimeout) clearTimeout(monitoringTimeout);
})

app.whenReady().then(() => {
  createWindow()
  startMonitoring(); // Start the heartbeat

  // IPC Handlers
  
  // Update Settings from Renderer
  ipcMain.on('update-settings', (_event, settings: AppSettings) => {
      // Basic validation
      if (settings) {
          currentSettings = { ...currentSettings, ...settings };
          // Console log for debug
          // console.log('Settings updated in Main:', currentSettings);
      }
  });

  // Pause Alerting
  ipcMain.on('set-paused', (_event, durationMs: number) => {
      if (durationMs > 0) {
          pauseAlertsUntil = Date.now() + durationMs;
          console.log(`Alerts paused for ${durationMs/1000}s`);
      } else {
          pauseAlertsUntil = 0; // Resume
          console.log('Alerts resumed');
      }
  });

  // Legacy Handlers (kept if needed by other components, but traffic is pushed now)
  ipcMain.handle('get-traffic-stats', async () => {
       // We can return the last aggregated stats if we want, or just fetch new.
       // For consistency, let's fetch new but use the same aggregation logic if possible.
       // But since we generate events, this might be unused. 
       // Leaving it as is or slightly improved for compatibility.
    try {
      const networkStats = await si.networkStats();
      const defaultInterface = await si.networkInterfaceDefault();
      const stats = networkStats.find(iface => iface.iface === defaultInterface) || networkStats[0];
      return stats;
    } catch (error) {
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
      const uniqueIps = [...new Set(ips)];
      const results: Record<string, any> = {};

      let asnReader: any = null;
      const asnPath = path.join((global as any).geodatadir, 'GeoLite2-ASN.mmdb');
      
      if (fs.existsSync(asnPath)) {
        try {
            const Reader = require('@maxmind/geoip2-node').Reader;
            asnReader = Reader.open(asnPath);
        } catch (e) {
            console.warn('Failed to open ASN Database:', e);
        }
      }
      
      for (const ip of uniqueIps) {
        const geo = geoip.lookup(ip);
        let isp = asnReader ? 'Unknown ISP' : 'ISP Info Unavailable (No DB)';
        let asn = '';

        if (asnReader) {
            try {
                const response = asnReader.asn(ip);
                isp = response.autonomousSystemOrganization || 'Unknown ISP';
                asn = response.autonomousSystemNumber ? `AS${response.autonomousSystemNumber}` : '';
            } catch (e) {
                // IP not found
            }
        }

        if (geo) {
          results[ip] = { 
              lat: geo.ll[0], 
              lon: geo.ll[1], 
              country: geo.country, 
              city: geo.city,
              isp: isp,
              asn: asn
           };
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

  // SECURITY: Validate kill request
  ipcMain.handle('kill-process-secure', async (_event, pid: number) => {
    if (!Number.isInteger(pid)) return false;
    if (pid < 1000) {
        console.warn(`SECURITY BLOCKED: Attempt to kill low PID ${pid}`);
        return false;
    }
    try {
        await new Promise<void>((resolve, reject) => {
            kill(pid, 'SIGKILL', (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        return true;
    } catch (error) {
        console.error(`Failed to kill process ${pid}:`, error);
        return false;
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
