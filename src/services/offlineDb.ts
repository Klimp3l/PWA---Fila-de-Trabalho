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
const ACTIVE_USER_STORAGE_KEY = 'odw:active-user'
const ANONYMOUS_USER_SCOPE = 'anonymous'
const ACTIVITIES_SNAPSHOT_KEY = 'atividades'
const ACTIVITY_PRODUCT_SELECTIONS_KEY = 'activity-product-selections'
const ACTIVITY_PRODUCT_LIST_PREFERENCES_KEY = 'activity-product-list-preferences'

const normalizeUserScope = (value: string | null | undefined) => {
  const normalized = value?.trim().toLocaleLowerCase('pt-BR') ?? ''
  return normalized || ANONYMOUS_USER_SCOPE
}

const getInitialUserScope = () => {
  if (typeof window === 'undefined') {
    return ANONYMOUS_USER_SCOPE
  }

  return normalizeUserScope(window.localStorage.getItem(ACTIVE_USER_STORAGE_KEY))
}

let currentUserScope = getInitialUserScope()

const buildScopedKey = (baseKey: string) => `${baseKey}::${currentUserScope}`

export const setOfflineDataUserScope = (user: string | null) => {
  currentUserScope = normalizeUserScope(user)

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(ACTIVE_USER_STORAGE_KEY, currentUserScope)
  }
}

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
      key: buildScopedKey(ACTIVITIES_SNAPSHOT_KEY),
      value: snapshot,
    })
  },

  async load() {
    const db = await dbPromise
    const scopedKey = buildScopedKey(ACTIVITIES_SNAPSHOT_KEY)
    const record = await db.get('activitySnapshots', scopedKey)

    if (record?.value) {
      return record.value
    }

    const legacyRecord = await db.get('activitySnapshots', ACTIVITIES_SNAPSHOT_KEY)

    if (legacyRecord?.value) {
      await db.put('activitySnapshots', {
        key: scopedKey,
        value: legacyRecord.value,
      })
      await db.delete('activitySnapshots', ACTIVITIES_SNAPSHOT_KEY)
      return legacyRecord.value
    }

    return record?.value ?? null
  },

  async clear() {
    const db = await dbPromise
    await db.delete('activitySnapshots', buildScopedKey(ACTIVITIES_SNAPSHOT_KEY))
  },
}

export const activityProductSelectionRepository = {
  async save(snapshot: ActivityProductSelectionsSnapshot) {
    const db = await dbPromise
    await db.put('activityProductSelections', {
      key: buildScopedKey(ACTIVITY_PRODUCT_SELECTIONS_KEY),
      value: snapshot,
    })
  },

  async load() {
    const db = await dbPromise
    const scopedKey = buildScopedKey(ACTIVITY_PRODUCT_SELECTIONS_KEY)
    const record = await db.get('activityProductSelections', scopedKey)

    if (record?.value) {
      return record.value
    }

    const legacyRecord = await db.get('activityProductSelections', ACTIVITY_PRODUCT_SELECTIONS_KEY)

    if (legacyRecord?.value) {
      await db.put('activityProductSelections', {
        key: scopedKey,
        value: legacyRecord.value,
      })
      await db.delete('activityProductSelections', ACTIVITY_PRODUCT_SELECTIONS_KEY)
      return legacyRecord.value
    }

    return record?.value ?? null
  },

  async clear() {
    const db = await dbPromise
    await db.delete('activityProductSelections', buildScopedKey(ACTIVITY_PRODUCT_SELECTIONS_KEY))
  },
}

export const activityProductListPreferencesRepository = {
  async save(snapshot: ActivityProductListPreferencesSnapshot) {
    const db = await dbPromise
    await db.put('activityProductListPreferences', {
      key: buildScopedKey(ACTIVITY_PRODUCT_LIST_PREFERENCES_KEY),
      value: snapshot,
    })
  },

  async load() {
    const db = await dbPromise
    const scopedKey = buildScopedKey(ACTIVITY_PRODUCT_LIST_PREFERENCES_KEY)
    const record = await db.get('activityProductListPreferences', scopedKey)

    if (record?.value) {
      return record.value
    }

    const legacyRecord = await db.get('activityProductListPreferences', ACTIVITY_PRODUCT_LIST_PREFERENCES_KEY)

    if (legacyRecord?.value) {
      await db.put('activityProductListPreferences', {
        key: scopedKey,
        value: legacyRecord.value,
      })
      await db.delete('activityProductListPreferences', ACTIVITY_PRODUCT_LIST_PREFERENCES_KEY)
      return legacyRecord.value
    }

    return record?.value ?? null
  },

  async clear() {
    const db = await dbPromise
    await db.delete('activityProductListPreferences', buildScopedKey(ACTIVITY_PRODUCT_LIST_PREFERENCES_KEY))
  },
}

export const clearOfflineActivityData = async () => {
  await Promise.all([
    activitySnapshotRepository.clear(),
    activityProductSelectionRepository.clear(),
    activityProductListPreferencesRepository.clear(),
  ])
}
