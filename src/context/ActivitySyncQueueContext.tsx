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
  processingSubmissionIds: string[]
  isOnline: boolean
  enqueueForSync: (item: ActivitySyncQueueItem) => Promise<void>
  retryQueueItem: (item: ActivitySyncQueueItem) => Promise<void>
}

const ActivitySyncQueueContext = createContext<ActivitySyncQueueContextValue | null>(null)

const NETWORK_CONFIRMATION_ERROR_MESSAGE =
  'Não foi possível confirmar o envio. A remessa pode já ter sido salva no servidor. Confirme antes de reenviar.'

const inFlightSubmissionIds = new Set<string>()

type QueueItemUiUpdater = (item: ActivitySyncQueueItem) => void
type QueueToastUpdater = (toast: {
  severity: 'success' | 'error'
  summary: string
  detail: string
  life?: number
}) => void

let activeQueueUserScope: string | null = null
let applyQueueItemToUi: QueueItemUiUpdater | null = null
let showQueueToast: QueueToastUpdater | null = null

const isUnconfirmedNetworkError = (error: unknown) => {
  if (!(error instanceof Error)) {
    return false
  }

  const message = error.message.toLowerCase()
  return error instanceof TypeError
    || message.includes('failed to fetch')
    || message.includes('networkerror')
    || message.includes('network request failed')
    || message.includes('load failed')
}

const toSyncErrorMessage = (error: unknown) => {
  if (isUnconfirmedNetworkError(error)) {
    return NETWORK_CONFIRMATION_ERROR_MESSAGE
  }

  return error instanceof Error ? error.message : 'Nao foi possivel enviar os encaminhamentos.'
}

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
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    if (typeof navigator === 'undefined') {
      return true
    }
    return navigator.onLine
  })
  const [processingSubmissionIds, setProcessingSubmissionIds] = useState<string[]>([])
  const [syncQueueItems, setSyncQueueItems] = useState<ActivitySyncQueueItem[]>([])

  useEffect(() => {
    isActiveRef.current = enabled && userScope !== null

    if (enabled && userScope !== null) {
      activeQueueUserScope = userScope
      applyQueueItemToUi = (item) => {
        setSyncQueueItems((current) => {
          const alreadyExists = current.some((queueItem) => queueItem.submissionId === item.submissionId)
          if (!alreadyExists) {
            return [item, ...current]
          }

          return current.map((queueItem) => (
            queueItem.submissionId === item.submissionId ? item : queueItem
          ))
        })
        setProcessingSubmissionIds((current) => {
          if (item.status === 'processing') {
            return current.includes(item.submissionId) ? current : [...current, item.submissionId]
          }

          return current.filter((submissionId) => submissionId !== item.submissionId)
        })
      }
      showQueueToast = (toast) => {
        toastRef.current?.show(toast)
      }
    }

    return () => {
      isActiveRef.current = false
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
          item.status === 'processing' && !inFlightSubmissionIds.has(item.submissionId)
            ? { ...item, status: 'pending' as const, updatedAt: Date.now() }
            : item
        ))
        setSyncQueueItems(recoveredItems)
        setProcessingSubmissionIds(
          recoveredItems
            .filter((item) => item.status === 'processing')
            .map((item) => item.submissionId),
        )
        const recoveredFromProcessing = recoveredItems.filter((item, index) => (
          item.status === 'pending' && items[index]?.status === 'processing'
        ))
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

  const applyQueueItem = useCallback((item: ActivitySyncQueueItem, itemUserScope: string) => {
    if (activeQueueUserScope === itemUserScope) {
      applyQueueItemToUi?.(item)
    }
  }, [])

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

    await upsertActivitySyncQueueItem(pendingItem, userScope)
    applyQueueItem(pendingItem, userScope)
  }, [applyQueueItem, enabled, userScope])

  const markQueueItemAsError = useCallback(async (
    item: ActivitySyncQueueItem,
    message: string,
    itemUserScope: string,
  ) => {
    const errorItem: ActivitySyncQueueItem = {
      ...item,
      status: 'error',
      errorMessage: message,
      updatedAt: Date.now(),
    }

    await upsertActivitySyncQueueItem(errorItem, itemUserScope)
    applyQueueItem(errorItem, itemUserScope)
  }, [applyQueueItem])

  const markQueueItemAsSuccess = useCallback(async (
    item: ActivitySyncQueueItem,
    itemUserScope: string,
  ) => {
    const successItem: ActivitySyncQueueItem = {
      ...item,
      status: 'success',
      errorMessage: null,
      updatedAt: Date.now(),
    }

    await upsertActivitySyncQueueItem(successItem, itemUserScope)
    applyQueueItem(successItem, itemUserScope)
  }, [applyQueueItem])

  const markQueueItemAsProcessing = useCallback(async (
    item: ActivitySyncQueueItem,
    itemUserScope: string,
  ) => {
    const processingItem: ActivitySyncQueueItem = {
      ...item,
      status: 'processing',
      errorMessage: null,
      updatedAt: Date.now(),
    }
    await upsertActivitySyncQueueItem(processingItem, itemUserScope)
    applyQueueItem(processingItem, itemUserScope)
    return processingItem
  }, [applyQueueItem])

  const processQueueItem = useCallback(async (item: ActivitySyncQueueItem) => {
    if (userScope === null || inFlightSubmissionIds.has(item.submissionId)) {
      return
    }

    const itemUserScope = userScope
    inFlightSubmissionIds.add(item.submissionId)
    applyQueueItem({
      ...item,
      status: 'processing',
      errorMessage: null,
      updatedAt: Date.now(),
    }, itemUserScope)

    try {
      const processingItem = await markQueueItemAsProcessing(item, itemUserScope)
      const response = await updateEncaminhamentos(processingItem.payload)
      const hasError = response?.error !== ''

      if (hasError) {
        const message = response?.error ?? 'O servidor retornou erro ao enviar os encaminhamentos.'
        await markQueueItemAsError(processingItem, message, itemUserScope)
        if (activeQueueUserScope === itemUserScope) {
          showQueueToast?.({
            severity: 'error',
            summary: 'Falha ao enviar',
            detail: message,
            life: 7000,
          })
        }
        return
      }

      await markQueueItemAsSuccess(processingItem, itemUserScope)
      if (activeQueueUserScope === itemUserScope) {
        showQueueToast?.({
          severity: 'success',
          summary: 'Enviado com sucesso',
          detail: `Atividade "${processingItem.atividade.wfatividade}" enviada.`,
        })
      }
    } catch (error) {
      console.error('[ActivitySyncQueueProvider] Falha ao enviar encaminhamentos.', error)
      const message = toSyncErrorMessage(error)
      await markQueueItemAsError(item, message, itemUserScope)
      if (activeQueueUserScope === itemUserScope) {
        showQueueToast?.({
          severity: 'error',
          summary: 'Falha ao enviar',
          detail: message,
          life: 7000,
        })
      }
    } finally {
      inFlightSubmissionIds.delete(item.submissionId)
    }
  }, [applyQueueItem, markQueueItemAsError, markQueueItemAsProcessing, markQueueItemAsSuccess, userScope])

  useEffect(() => {
    if (!enabled || userScope === null || !isOnline) {
      return
    }

    const pendingItems = syncQueueItems.filter((item) => (
      item.status === 'pending' && !inFlightSubmissionIds.has(item.submissionId)
    ))

    pendingItems.forEach((item) => {
      void processQueueItem(item)
    })
  }, [enabled, isOnline, processQueueItem, syncQueueItems, userScope])

  const retryQueueItem = useCallback(async (item: ActivitySyncQueueItem) => {
    if (!enabled || userScope === null || inFlightSubmissionIds.has(item.submissionId)) {
      return
    }
    await enqueueForSync(item)
  }, [enabled, enqueueForSync, userScope])

  const contextValue = useMemo<ActivitySyncQueueContextValue>(() => ({
    syncQueueItems,
    processingSubmissionIds,
    isOnline,
    enqueueForSync,
    retryQueueItem,
  }), [enqueueForSync, isOnline, processingSubmissionIds, retryQueueItem, syncQueueItems])

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
