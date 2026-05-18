import { openDB, type DBSchema } from 'idb'
import type {
  ActivityProductListPreferencesSnapshot,
  ActivityProductSelectionsSnapshot,
  ActivitySnapshot,
} from '../types/workflow'

interface ActivitySnapshotRecord {
  key: string
  value: ActivitySnapshot
}

interface ActivityProductSelectionsRecord {
  key: string
  value: ActivityProductSelectionsSnapshot
}

interface ActivityProductListPreferencesRecord {
  key: string
  value: ActivityProductListPreferencesSnapshot
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
  activityProductListPreferences: {
    key: string
    value: ActivityProductListPreferencesRecord
  }
}

const DB_NAME = 'fila-trabalho-offline-db'
const DB_VERSION = 4
const ACTIVITIES_SNAPSHOT_KEY = 'atividades'
const ACTIVITY_PRODUCT_SELECTIONS_KEY = 'activity-product-selections'
const ACTIVITY_PRODUCT_LIST_PREFERENCES_KEY = 'activity-product-list-preferences'

const dbPromise = openDB<OfflineDatabaseSchema>(DB_NAME, DB_VERSION, {
  upgrade(db) {
    if (!db.objectStoreNames.contains('activitySnapshots')) {
      db.createObjectStore('activitySnapshots', { keyPath: 'key' })
    }
    if (!db.objectStoreNames.contains('activityProductSelections')) {
      db.createObjectStore('activityProductSelections', { keyPath: 'key' })
    }
    if (!db.objectStoreNames.contains('activityProductListPreferences')) {
      db.createObjectStore('activityProductListPreferences', { keyPath: 'key' })
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

export const activityProductListPreferencesRepository = {
  async save(snapshot: ActivityProductListPreferencesSnapshot) {
    const db = await dbPromise
    await db.put('activityProductListPreferences', {
      key: ACTIVITY_PRODUCT_LIST_PREFERENCES_KEY,
      value: snapshot,
    })
  },

  async load() {
    const db = await dbPromise
    const record = await db.get('activityProductListPreferences', ACTIVITY_PRODUCT_LIST_PREFERENCES_KEY)
    return record?.value ?? null
  },

  async clear() {
    const db = await dbPromise
    await db.delete('activityProductListPreferences', ACTIVITY_PRODUCT_LIST_PREFERENCES_KEY)
  },
}

export const clearOfflineActivityData = async () => {
  await Promise.all([
    activitySnapshotRepository.clear(),
    activityProductSelectionRepository.clear(),
    activityProductListPreferencesRepository.clear(),
  ])
}
