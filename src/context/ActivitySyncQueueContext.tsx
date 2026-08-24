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
  enabled: boolean
  userScope: string | null
}

export function ActivitySyncQueueProvider({
  children,
  enabled,
  userScope,
}: ActivitySyncQueueProviderProps) {
  const toastRef = useRef<Toast | null>(null)
  const isActiveRef = useRef(false)
  const processAbortControllerRef = useRef<AbortController | null>(null)
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    if (typeof navigator === 'undefined') {
      return true
    }
    return navigator.onLine
  })
  const [processingSubmissionId, setProcessingSubmissionId] = useState<string | null>(null)
  const [syncQueueItems, setSyncQueueItems] = useState<ActivitySyncQueueItem[]>([])

  useEffect(() => {
    isActiveRef.current = enabled && userScope !== null

    return () => {
      isActiveRef.current = false
      processAbortControllerRef.current?.abort()
      processAbortControllerRef.current = null
    }
  }, [enabled, userScope])

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
    if (!enabled || userScope === null) {
      return
    }

    let cancelled = false
    void loadActivitySyncQueueItems(userScope)
      .then((items) => {
        if (cancelled || !isActiveRef.current) {
          return
        }

        const recoveredItems = items.map((item) => (
          item.status === 'processing'
            ? { ...item, status: 'pending' as const, updatedAt: Date.now() }
            : item
        ))
        setSyncQueueItems(recoveredItems)
        const recoveredFromProcessing = recoveredItems.filter((item) => item.status === 'pending')
        if (recoveredFromProcessing.length > 0) {
          void Promise.all(recoveredFromProcessing.map(async (item) => upsertActivitySyncQueueItem(item, userScope)))
        }
      })
      .catch((error) => {
        if (cancelled) {
          return
        }
        console.warn('[ActivitySyncQueueProvider] Falha ao carregar fila de sincronizacao.', error)
      })

    return () => {
      cancelled = true
    }
  }, [enabled, userScope])

  const enqueueForSync = useCallback(async (item: ActivitySyncQueueItem) => {
    if (!enabled || userScope === null || !isActiveRef.current) {
      return
    }

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
    await upsertActivitySyncQueueItem(pendingItem, userScope)
  }, [enabled, userScope])

  const markQueueItemAsError = useCallback(async (item: ActivitySyncQueueItem, message: string) => {
    const errorItem: ActivitySyncQueueItem = {
      ...item,
      status: 'error',
      errorMessage: message,
      updatedAt: Date.now(),
    }

    if (isActiveRef.current) {
      setSyncQueueItems((current) =>
        current.map((queueItem) => (
          queueItem.submissionId === item.submissionId ? errorItem : queueItem
        ))
      )
    }
    await upsertActivitySyncQueueItem(errorItem, userScope ?? undefined)
  }, [userScope])

  const markQueueItemAsSuccess = useCallback(async (item: ActivitySyncQueueItem) => {
    const successItem: ActivitySyncQueueItem = {
      ...item,
      status: 'success',
      errorMessage: null,
      updatedAt: Date.now(),
    }

    if (isActiveRef.current) {
      setSyncQueueItems((current) =>
        current.map((queueItem) => (
          queueItem.submissionId === item.submissionId ? successItem : queueItem
        ))
      )
    }
    await upsertActivitySyncQueueItem(successItem, userScope ?? undefined)
  }, [userScope])

  const markQueueItemAsProcessing = useCallback(async (item: ActivitySyncQueueItem) => {
    const processingItem: ActivitySyncQueueItem = {
      ...item,
      status: 'processing',
      errorMessage: null,
      updatedAt: Date.now(),
    }
    if (isActiveRef.current) {
      setSyncQueueItems((current) =>
        current.map((queueItem) => (
          queueItem.submissionId === item.submissionId ? processingItem : queueItem
        ))
      )
    }
    await upsertActivitySyncQueueItem(processingItem, userScope ?? undefined)
    return processingItem
  }, [userScope])

  const processQueueItem = useCallback(async (item: ActivitySyncQueueItem) => {
    if (!enabled || userScope === null || !isActiveRef.current) {
      return
    }

    const controller = new AbortController()
    processAbortControllerRef.current = controller
    setProcessingSubmissionId(item.submissionId)
    try {
      const processingItem = await markQueueItemAsProcessing(item)
      if (controller.signal.aborted || !isActiveRef.current) {
        return
      }

      const response = await updateEncaminhamentos(processingItem.payload, undefined, controller.signal)
      if (controller.signal.aborted || !isActiveRef.current) {
        return
      }

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
      if (controller.signal.aborted) {
        return
      }

      console.error('[ActivitySyncQueueProvider] Falha ao enviar encaminhamentos.', error)
      const message = error instanceof Error ? error.message : 'Nao foi possivel enviar os encaminhamentos.'
      if (isActiveRef.current) {
        await markQueueItemAsError(item, message)
        toastRef.current?.show({
          severity: 'error',
          summary: 'Falha ao enviar',
          detail: message,
          life: 7000,
        })
      }
    } finally {
      if (processAbortControllerRef.current === controller) {
        processAbortControllerRef.current = null
      }
      if (isActiveRef.current) {
        setProcessingSubmissionId(null)
      }
    }
  }, [enabled, markQueueItemAsError, markQueueItemAsProcessing, markQueueItemAsSuccess, userScope])

  useEffect(() => {
    if (!enabled || userScope === null || !isOnline) {
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
  }, [enabled, isOnline, processingSubmissionId, processQueueItem, syncQueueItems, userScope])

  const retryQueueItem = useCallback(async (item: ActivitySyncQueueItem) => {
    if (!enabled || userScope === null || processingSubmissionId !== null) {
      return
    }
    await enqueueForSync(item)
  }, [enabled, enqueueForSync, processingSubmissionId, userScope])

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
