import { openDB, type DBSchema } from 'idb'
import type { ActivityProductSelectionsSnapshot, ActivitySnapshot } from '../types/workflow'

interface ActivitySnapshotRecord {
  key: string
  value: ActivitySnapshot
}

interface ActivityProductSelectionsRecord {
  key: string
  value: ActivityProductSelectionsSnapshot
}

interface OfflineDatabaseSchema extends DBSchema {
  activitySnapshots: {
    key: string
    value: ActivitySnapshotRecord
  }
  activityProductSelections: {
    key: string
    value: ActivityProductSelectionsRecord
  }
}

const DB_NAME = 'fila-trabalho-offline-db'
const DB_VERSION = 3
const ACTIVITIES_SNAPSHOT_KEY = 'atividades'
const ACTIVITY_PRODUCT_SELECTIONS_KEY = 'activity-product-selections'

const dbPromise = openDB<OfflineDatabaseSchema>(DB_NAME, DB_VERSION, {
  upgrade(db) {
    if (!db.objectStoreNames.contains('activitySnapshots')) {
      db.createObjectStore('activitySnapshots', { keyPath: 'key' })
    }
    if (!db.objectStoreNames.contains('activityProductSelections')) {
      db.createObjectStore('activityProductSelections', { keyPath: 'key' })
    }
  },
})

export const activitySnapshotRepository = {
  async save(snapshot: ActivitySnapshot) {
    const db = await dbPromise
    await db.put('activitySnapshots', {
      key: ACTIVITIES_SNAPSHOT_KEY,
      value: snapshot,
    })
  },

  async load() {
    const db = await dbPromise
    const record = await db.get('activitySnapshots', ACTIVITIES_SNAPSHOT_KEY)
    return record?.value ?? null
  },

  async clear() {
    const db = await dbPromise
    await db.delete('activitySnapshots', ACTIVITIES_SNAPSHOT_KEY)
  },
}

export const activityProductSelectionRepository = {
  async save(snapshot: ActivityProductSelectionsSnapshot) {
    const db = await dbPromise
    await db.put('activityProductSelections', {
      key: ACTIVITY_PRODUCT_SELECTIONS_KEY,
      value: snapshot,
    })
  },

  async load() {
    const db = await dbPromise
    const record = await db.get('activityProductSelections', ACTIVITY_PRODUCT_SELECTIONS_KEY)
    return record?.value ?? null
  },

  async clear() {
    const db = await dbPromise
    await db.delete('activityProductSelections', ACTIVITY_PRODUCT_SELECTIONS_KEY)
  },
}

export const clearOfflineActivityData = async () => {
  await Promise.all([
    activitySnapshotRepository.clear(),
    activityProductSelectionRepository.clear(),
  ])
}
