import Dexie, { Table } from 'dexie'

export interface TrafficLog {
  id?: number
  timestamp: number
  rx: number
  tx: number
}

export class NetMonitorDB extends Dexie {
  traffic_logs!: Table<TrafficLog>

  constructor() {
    super('NetMonitorDB')
    this.version(1).stores({
      traffic_logs: '++id, timestamp' // Primary key and indexed props
    })
  }
}

export const db = new NetMonitorDB()
