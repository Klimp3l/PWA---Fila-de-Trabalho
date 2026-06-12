import { Toast } from 'primereact/toast'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { updateEncaminhamentos } from '../services/api'
import { loadActivitySyncQueueItems, upsertActivitySyncQueueItem } from '../services/activityData'
import type { ActivitySyncQueueItem } from '../types/workflow'

interface ActivitySyncQueueContextValue {
  syncQueueItems: ActivitySyncQueueItem[]
  processingSubmissionId: string | null
  isOnline: boolean
  enqueueForSync: (item: ActivitySyncQueueItem) => Promise<void>
  retryQueueItem: (item: ActivitySyncQueueItem) => Promise<void>
}

const ActivitySyncQueueContext = createContext<ActivitySyncQueueContextValue | null>(null)

interface ActivitySyncQueueProviderProps {
  children: ReactNode
}

export function ActivitySyncQueueProvider({ children }: ActivitySyncQueueProviderProps) {
  const toastRef = useRef<Toast | null>(null)
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    if (typeof navigator === 'undefined') {
      return true
    }
    return navigator.onLine
  })
  const [processingSubmissionId, setProcessingSubmissionId] = useState<string | null>(null)
  const [syncQueueItems, setSyncQueueItems] = useState<ActivitySyncQueueItem[]>([])

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
    }

    const handleOffline = () => {
      setIsOnline(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  useEffect(() => {
    void loadActivitySyncQueueItems()
      .then((items) => {
        const recoveredItems = items.map((item) => (
          item.status === 'processing'
            ? { ...item, status: 'pending' as const, updatedAt: Date.now() }
            : item
        ))
        setSyncQueueItems(recoveredItems)
        const recoveredFromProcessing = recoveredItems.filter((item) => item.status === 'pending')
        if (recoveredFromProcessing.length > 0) {
          void Promise.all(recoveredFromProcessing.map(async (item) => upsertActivitySyncQueueItem(item)))
        }
      })
      .catch((error) => {
        console.warn('[ActivitySyncQueueProvider] Falha ao carregar fila de sincronizacao.', error)
      })
  }, [])

  const enqueueForSync = useCallback(async (item: ActivitySyncQueueItem) => {
    const now = Date.now()
    const pendingItem: ActivitySyncQueueItem = {
      ...item,
      status: 'pending',
      errorMessage: null,
      updatedAt: now,
    }

    setSyncQueueItems((current) => {
      const alreadyExists = current.some((queueItem) => queueItem.submissionId === pendingItem.submissionId)
      if (alreadyExists) {
        return current.map((queueItem) => (
          queueItem.submissionId === pendingItem.submissionId ? pendingItem : queueItem
        ))
      }
      return [pendingItem, ...current]
    })
    await upsertActivitySyncQueueItem(pendingItem)
  }, [])

  const markQueueItemAsError = useCallback(async (item: ActivitySyncQueueItem, message: string) => {
    const errorItem: ActivitySyncQueueItem = {
      ...item,
      status: 'error',
      errorMessage: message,
      updatedAt: Date.now(),
    }

    setSyncQueueItems((current) =>
      current.map((queueItem) => (
        queueItem.submissionId === item.submissionId ? errorItem : queueItem
      ))
    )
    await upsertActivitySyncQueueItem(errorItem)
  }, [])

  const markQueueItemAsSuccess = useCallback(async (item: ActivitySyncQueueItem) => {
    const successItem: ActivitySyncQueueItem = {
      ...item,
      status: 'success',
      errorMessage: null,
      updatedAt: Date.now(),
    }

    setSyncQueueItems((current) =>
      current.map((queueItem) => (
        queueItem.submissionId === item.submissionId ? successItem : queueItem
      ))
    )
    await upsertActivitySyncQueueItem(successItem)
  }, [])

  const markQueueItemAsProcessing = useCallback(async (item: ActivitySyncQueueItem) => {
    const processingItem: ActivitySyncQueueItem = {
      ...item,
      status: 'processing',
      errorMessage: null,
      updatedAt: Date.now(),
    }
    setSyncQueueItems((current) =>
      current.map((queueItem) => (
        queueItem.submissionId === item.submissionId ? processingItem : queueItem
      ))
    )
    await upsertActivitySyncQueueItem(processingItem)
    return processingItem
  }, [])

  const processQueueItem = useCallback(async (item: ActivitySyncQueueItem) => {
    setProcessingSubmissionId(item.submissionId)
    try {
      const processingItem = await markQueueItemAsProcessing(item)
      const response = await updateEncaminhamentos(processingItem.payload)
      const hasError = response?.error !== ''

      if (hasError) {
        const message = response?.error ?? 'O servidor retornou erro ao enviar os encaminhamentos.'
        await markQueueItemAsError(processingItem, message)
        toastRef.current?.show({
          severity: 'error',
          summary: 'Falha ao enviar',
          detail: message,
          life: 7000,
        })
        return
      }

      toastRef.current?.show({
        severity: 'success',
        summary: 'Enviado com sucesso',
        detail: `Atividade "${processingItem.atividade.wfatividade}" enviada.`,
      })

      await markQueueItemAsSuccess(processingItem)
    } catch (error) {
      console.error('[ActivitySyncQueueProvider] Falha ao enviar encaminhamentos.', error)
      const message = error instanceof Error ? error.message : 'Nao foi possivel enviar os encaminhamentos.'
      await markQueueItemAsError(item, message)
      toastRef.current?.show({
        severity: 'error',
        summary: 'Falha ao enviar',
        detail: message,
        life: 7000,
      })
    } finally {
      setProcessingSubmissionId(null)
    }
  }, [markQueueItemAsError, markQueueItemAsProcessing, markQueueItemAsSuccess])

  useEffect(() => {
    if (!isOnline) {
      return
    }

    if (processingSubmissionId !== null) {
      return
    }

    const nextPendingItem = syncQueueItems.find((item) => item.status === 'pending')
    if (!nextPendingItem) {
      return
    }

    void processQueueItem(nextPendingItem)
  }, [isOnline, processingSubmissionId, processQueueItem, syncQueueItems])

  const retryQueueItem = useCallback(async (item: ActivitySyncQueueItem) => {
    if (processingSubmissionId !== null) {
      return
    }
    await enqueueForSync(item)
  }, [enqueueForSync, processingSubmissionId])

  const contextValue = useMemo<ActivitySyncQueueContextValue>(() => ({
    syncQueueItems,
    processingSubmissionId,
    isOnline,
    enqueueForSync,
    retryQueueItem,
  }), [enqueueForSync, isOnline, processingSubmissionId, retryQueueItem, syncQueueItems])

  return (
    <ActivitySyncQueueContext.Provider value={contextValue}>
      <Toast ref={toastRef} position="top-right" />
      {children}
    </ActivitySyncQueueContext.Provider>
  )
}

export const useActivitySyncQueue = () => {
  const context = useContext(ActivitySyncQueueContext)
  if (!context) {
    throw new Error('useActivitySyncQueue deve ser usado dentro de ActivitySyncQueueProvider.')
  }
  return context
}
