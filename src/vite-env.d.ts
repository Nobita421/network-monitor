/// <reference types="vite/client" />

interface Window {
  ipcRenderer: {
    on: (channel: string, listener: (event: any, ...args: any[]) => void) => void
    off: (channel: string, ...args: any[]) => void
    send: (channel: string, ...args: any[]) => void
    invoke: (channel: string, ...args: any[]) => Promise<any>
    getNetworkStats: () => Promise<any>
    getNetworkConnections: () => Promise<any[]>
    getProcessUsage: () => Promise<any[]>
    killProcess: (pid: number) => Promise<boolean>
    getIpLocation: (ip: string) => Promise<{ lat: number; lon: number; country: string; city: string } | null>
    toggleOverlay: () => Promise<boolean>
  }
}
