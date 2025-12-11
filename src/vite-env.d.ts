/// <reference types="vite/client" />

interface Window {
  ipcRenderer: {
    on: (channel: string, listener: (event: any, ...args: any[]) => void) => void
    off: (channel: string, ...args: any[]) => void
    send: (channel: string, ...args: any[]) => void
    invoke: (channel: string, ...args: any[]) => Promise<any>
    getTrafficStats: () => Promise<any>
    getNetworkConnections: () => Promise<any[]>
    killProcess: (pid: number) => Promise<boolean>
    getIpLocations: (ips: string[]) => Promise<Record<string, { lat: number; lon: number; country: string; city: string } | null>>
    toggleOverlay: () => Promise<boolean>
  }
}
