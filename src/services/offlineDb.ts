import { openDB, type DBSchema, type StoreNames } from 'idb'
import { ACTIVE_USER_STORAGE_KEY } from '../constants/storageKeys'
import type {
  ActivitySyncQueueItem,
  ActivitySyncQueueSnapshot,
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

interface ActivitySyncQueueRecord {
  key: string
  value: ActivitySyncQueueSnapshot
}

interface ActivitySyncQueueItemRecord {
  id: string
  userScope: string
  item: ActivitySyncQueueItem
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
  activitySyncQueue: {
    key: string
    value: ActivitySyncQueueRecord
  }
  activitySyncQueueItems: {
    key: string
    value: ActivitySyncQueueItemRecord
    indexes: { 'by-user-scope': string }
  }
}

const DB_NAME = 'fila-trabalho-offline-db'
const DB_VERSION = 6
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

const buildScopedItemKey = (submissionId: string) => `${submissionId}::${currentUserScope}`

const extractScopeFromLegacyKey = (key: string) => {
  const separatorIndex = key.indexOf('::')
  if (separatorIndex === -1) {
    return currentUserScope
  }
  return key.slice(separatorIndex + 2) || ANONYMOUS_USER_SCOPE
}

export const setOfflineDataUserScope = (user: string | null) => {
  currentUserScope = normalizeUserScope(user)

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(ACTIVE_USER_STORAGE_KEY, currentUserScope)
  }
}

const dbPromise = openDB<OfflineDatabaseSchema>(DB_NAME, DB_VERSION, {
  async upgrade(db, _oldVersion, _newVersion, transaction) {
    if (!db.objectStoreNames.contains('activitySnapshots')) {
      db.createObjectStore('activitySnapshots', { keyPath: 'key' })
    }
    if (!db.objectStoreNames.contains('activityProductSelections')) {
      db.createObjectStore('activityProductSelections', { keyPath: 'key' })
    }
    if (!db.objectStoreNames.contains('activityProductListPreferences')) {
      db.createObjectStore('activityProductListPreferences', { keyPath: 'key' })
    }
    if (!db.objectStoreNames.contains('activitySyncQueue')) {
      db.createObjectStore('activitySyncQueue', { keyPath: 'key' })
    }
    if (!db.objectStoreNames.contains('activitySyncQueueItems')) {
      const itemsStore = db.createObjectStore('activitySyncQueueItems', { keyPath: 'id' })
      itemsStore.createIndex('by-user-scope', 'userScope')

      if (db.objectStoreNames.contains('activitySyncQueue')) {
        const legacyStore = transaction.objectStore('activitySyncQueue')
        const legacyRecords = await legacyStore.getAll()

        for (const legacyRecord of legacyRecords) {
          const scope = extractScopeFromLegacyKey(legacyRecord.key)
          const snapshot = legacyRecord.value as ActivitySyncQueueSnapshot & {
            itemsByActivityId?: Record<string, ActivitySyncQueueItem>
          }
          const itemsBySubmissionId = snapshot.itemsBySubmissionId
            ?? snapshot.itemsByActivityId
            ?? {}

          for (const item of Object.values(itemsBySubmissionId)) {
            await itemsStore.put({
              id: `${item.submissionId}::${scope}`,
              userScope: scope,
              item,
            })
          }
        }
      }
    }
  },
})

interface ScopedRepository<TValue> {
  save(snapshot: TValue): Promise<void>
  load(): Promise<TValue | null>
  clear(): Promise<void>
}

type SnapshotStoreName = Extract<
  StoreNames<OfflineDatabaseSchema>,
  'activitySnapshots' | 'activityProductSelections' | 'activityProductListPreferences' | 'activitySyncQueue'
>

const createScopedRepository = <Name extends SnapshotStoreName>(
  storeName: Name,
  baseKey: string,
): ScopedRepository<OfflineDatabaseSchema[Name]['value']['value']> => {
  type StoredRecord = OfflineDatabaseSchema[Name]['value']
  type SnapshotValue = StoredRecord['value']

  return {
    async save(snapshot: SnapshotValue) {
      const db = await dbPromise
      await db.put(storeName, {
        key: buildScopedKey(baseKey),
        value: snapshot,
      } as StoredRecord)
    },

    async load(): Promise<SnapshotValue | null> {
      const db = await dbPromise
      const scopedKey = buildScopedKey(baseKey)
      const record = await db.get(storeName, scopedKey)

      if (record?.value) {
        return record.value as SnapshotValue
      }

      const legacyRecord = await db.get(storeName, baseKey)

      if (legacyRecord?.value) {
        await db.put(storeName, {
          key: scopedKey,
          value: legacyRecord.value,
        } as StoredRecord)
        await db.delete(storeName, baseKey)
        return legacyRecord.value as SnapshotValue
      }

      return (record?.value as SnapshotValue | undefined) ?? null
    },

    async clear() {
      const db = await dbPromise
      await db.delete(storeName, buildScopedKey(baseKey))
    },
  }
}

export const activitySnapshotRepository = createScopedRepository('activitySnapshots', ACTIVITIES_SNAPSHOT_KEY)

export const activityProductSelectionRepository = createScopedRepository('activityProductSelections', ACTIVITY_PRODUCT_SELECTIONS_KEY)

export const activityProductListPreferencesRepository = createScopedRepository('activityProductListPreferences', ACTIVITY_PRODUCT_LIST_PREFERENCES_KEY)

export const activitySyncQueueItemRepository = {
  async loadAll(): Promise<ActivitySyncQueueItem[]> {
    const db = await dbPromise
    const records = await db.getAllFromIndex('activitySyncQueueItems', 'by-user-scope', currentUserScope)
    return records.map((record) => record.item)
  },

  async upsertMany(items: ActivitySyncQueueItem[]): Promise<void> {
    if (items.length === 0) {
      return
    }

    const db = await dbPromise
    const tx = db.transaction('activitySyncQueueItems', 'readwrite')
    const now = Date.now()

    await Promise.all([
      ...items.map((item) => tx.store.put({
        id: buildScopedItemKey(item.submissionId),
        userScope: currentUserScope,
        item: { ...item, updatedAt: now },
      })),
      tx.done,
    ])
  },

  async remove(submissionId: string): Promise<void> {
    const db = await dbPromise
    await db.delete('activitySyncQueueItems', buildScopedItemKey(submissionId))
  },

  async removeOldSuccessful(olderThanMs: number): Promise<void> {
    const db = await dbPromise
    const tx = db.transaction('activitySyncQueueItems', 'readwrite')
    const records = await tx.store.index('by-user-scope').getAll(currentUserScope)
    const now = Date.now()

    const deletions = records
      .filter((record) => {
        const { item } = record
        const referenceTimestamp = Math.max(item.updatedAt ?? 0, item.createdAt ?? 0)
        return item.status === 'success' && now - referenceTimestamp > olderThanMs
      })
      .map((record) => tx.store.delete(record.id))

    await Promise.all([...deletions, tx.done])
  },

  async clear(): Promise<void> {
    const db = await dbPromise
    const tx = db.transaction('activitySyncQueueItems', 'readwrite')
    const keys = await tx.store.index('by-user-scope').getAllKeys(currentUserScope)

    await Promise.all([
      ...keys.map((key) => tx.store.delete(key)),
      tx.done,
    ])
  },
}

export const clearOfflineActivityData = async () => {
  await Promise.all([
    activitySnapshotRepository.clear(),
    activityProductSelectionRepository.clear(),
    activityProductListPreferencesRepository.clear(),
    activitySyncQueueItemRepository.clear(),
  ])
}
