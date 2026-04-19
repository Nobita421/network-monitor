/// <reference types="vite/client" />
import type { DesktopApi } from './lib/ipc'

declare global {
  interface Window {
    desktop: DesktopApi
  }
}

export {}
