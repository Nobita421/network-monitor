/// <reference types="vite/client" />

interface Window {
  ipcRenderer: {
    on: (channel: string, listener: (event: unknown, ...args: any[]) => void) => void
    off: (channel: string, ...args: unknown[]) => void
    send: (channel: string, ...args: any[]) => void
    invoke: (channel: string, ...args: unknown[]) => Promise<any>
    getTrafficStats: () => Promise<any>
    getNetworkStats: () => Promise<NetworkStat | null>
    getNetworkConnections: () => Promise<any[]>
    killProcess: (pid: number) => Promise<boolean>
    getIpLocations: (ips: string[]) => Promise<Record<string, { lat: number; lon: number; country: string; city: string } | null>>
    toggleOverlay: () => Promise<boolean>
  }
}
