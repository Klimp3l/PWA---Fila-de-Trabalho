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
import { loadActivitySyncQueueItems, upsertActivitySyncQueueItem, upsertManyActivitySyncQueueItems } from '../services/activityData'
import type { ActivitySyncQueueItem } from '../types/workflow'

interface ActivitySyncQueueContextValue {
  syncQueueItems: ActivitySyncQueueItem[]
  processingSubmissionId: string | null
  isOnline: boolean
  enqueueForSync: (item: ActivitySyncQueueItem) => Promise<void>
  retryQueueItem: (item: ActivitySyncQueueItem) => Promise<void>
}

const ActivitySyncQueueContext = createContext<ActivitySyncQueueContextValue | null>(null)

const MAX_AUTO_RETRIES = 5
const BASE_RETRY_DELAY_MS = 2_000
const MAX_RETRY_DELAY_MS = 60_000

interface ActivitySyncQueueProviderProps {
  children: ReactNode
}

export function ActivitySyncQueueProvider({ children }: ActivitySyncQueueProviderProps) {
  const toastRef = useRef<Toast | null>(null)
  const retryTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const syncQueueItemsRef = useRef<ActivitySyncQueueItem[]>([])
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    if (typeof navigator === 'undefined') {
      return true
    }
    return navigator.onLine
  })
  const [processingSubmissionId, setProcessingSubmissionId] = useState<string | null>(null)
  const [syncQueueItems, setSyncQueueItems] = useState<ActivitySyncQueueItem[]>([])

  useEffect(() => {
    syncQueueItemsRef.current = syncQueueItems
  }, [syncQueueItems])

  useEffect(() => {
    const timers = retryTimersRef.current
    return () => {
      timers.forEach((timer) => clearTimeout(timer))
      timers.clear()
    }
  }, [])

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
        const recoveredItems = items.map((item) => {
          const normalizedItem = { ...item, retryCount: item.retryCount ?? 0 }
          return normalizedItem.status === 'processing'
            ? { ...normalizedItem, status: 'pending' as const, updatedAt: Date.now() }
            : normalizedItem
        })
        setSyncQueueItems(recoveredItems)
        const recoveredFromProcessing = recoveredItems.filter((item) => item.status === 'pending')
        if (recoveredFromProcessing.length > 0) {
          void upsertManyActivitySyncQueueItems(recoveredFromProcessing)
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

  const reEnqueuePendingItem = useCallback(async (submissionId: string) => {
    const current = syncQueueItemsRef.current.find((queueItem) => queueItem.submissionId === submissionId)
    if (!current || current.status !== 'error') {
      return
    }

    const pendingItem: ActivitySyncQueueItem = {
      ...current,
      status: 'pending',
      errorMessage: null,
      updatedAt: Date.now(),
    }

    setSyncQueueItems((items) =>
      items.map((queueItem) => (
        queueItem.submissionId === submissionId ? pendingItem : queueItem
      ))
    )
    await upsertActivitySyncQueueItem(pendingItem)
  }, [])

  const scheduleRetry = useCallback((item: ActivitySyncQueueItem) => {
    if (item.retryCount >= MAX_AUTO_RETRIES) {
      return
    }

    const delay = Math.min(MAX_RETRY_DELAY_MS, BASE_RETRY_DELAY_MS * 2 ** (item.retryCount - 1))

    const existingTimer = retryTimersRef.current.get(item.submissionId)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }

    const timer = setTimeout(() => {
      retryTimersRef.current.delete(item.submissionId)
      void reEnqueuePendingItem(item.submissionId)
    }, delay)

    retryTimersRef.current.set(item.submissionId, timer)
  }, [reEnqueuePendingItem])

  const processQueueItem = useCallback(async (item: ActivitySyncQueueItem) => {
    setProcessingSubmissionId(item.submissionId)
    try {
      const processingItem = await markQueueItemAsProcessing(item)
      const response = await updateEncaminhamentos(processingItem.payload)
      const isSuccessful = response !== null
        && typeof response.error === 'string'
        && response.error.trim() === ''

      if (!isSuccessful) {
        const serverError = typeof response?.error === 'string' ? response.error.trim() : ''
        const message = serverError !== ''
          ? serverError
          : 'O servidor retornou uma resposta invalida ao enviar os encaminhamentos.'
        const failedItem: ActivitySyncQueueItem = {
          ...processingItem,
          retryCount: processingItem.retryCount + 1,
        }
        await markQueueItemAsError(failedItem, message)
        scheduleRetry(failedItem)
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
      const failedItem: ActivitySyncQueueItem = {
        ...item,
        retryCount: item.retryCount + 1,
      }
      await markQueueItemAsError(failedItem, message)
      scheduleRetry(failedItem)
      toastRef.current?.show({
        severity: 'error',
        summary: 'Falha ao enviar',
        detail: message,
        life: 7000,
      })
    } finally {
      setProcessingSubmissionId(null)
    }
  }, [markQueueItemAsError, markQueueItemAsProcessing, markQueueItemAsSuccess, scheduleRetry])

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

    const existingTimer = retryTimersRef.current.get(item.submissionId)
    if (existingTimer) {
      clearTimeout(existingTimer)
      retryTimersRef.current.delete(item.submissionId)
    }

    await enqueueForSync({ ...item, retryCount: 0 })
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
