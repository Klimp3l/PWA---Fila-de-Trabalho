import { Skeleton } from 'primereact/skeleton'
import { Button } from 'primereact/button'
import { useNavigate } from 'react-router-dom'
import { ActivityCardList } from '../components/ActivityCardList'
import { faArrowsRotate, faBuilding, faFile, faPersonWalking, faTasks } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useAtividadesWithOnlineRefresh } from '../hooks/useAtividadesWithOnlineRefresh'
import type { ActivitySyncQueueItem, AtividadeComProdutos } from '../types/workflow'
import { Card } from 'primereact/card'
import { Toast } from 'primereact/toast'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { updateEncaminhamentos } from '../services/api'
import {
  getActivityScopeKey,
  loadActivitySyncQueueItems,
  removeActivityProductSelections,
  upsertActivitySyncQueueItem,
} from '../services/activityData'
import { removeActivityProductsFromCache } from '../hooks/useAtividadesWithOnlineRefresh'

const getQueueItemProductKeys = (item: ActivitySyncQueueItem) => {
  return new Set((item.products ?? []).map((product) => product.productKey))
}

const getPackageProductKeys = (item: ActivitySyncQueueItem) => {
  const productKeysFromSnapshot = (item.products ?? []).map((product) => product.productKey)
  if (productKeysFromSnapshot.length > 0) {
    return productKeysFromSnapshot
  }

  const matchedProductKeys = item.payload.encaminhamentos
    .map((encaminhamento) => {
      const matchedProduct = item.atividade.produtos.find((produto) => (
        produto.idwffilatrabalho === encaminhamento.idwffilatrabalho
        && produto.idwfocorrencia === encaminhamento.idwfocorrencia
      ))

      if (!matchedProduct) {
        return null
      }

      return `${matchedProduct.idwffilatrabalho}-${matchedProduct.idwfocorrencia}-${matchedProduct.idproduto}`
    })
    .filter((value): value is string => value !== null)

  return matchedProductKeys
}

const formatSubmissionDateTime = (timestamp: number) => (
  new Date(timestamp).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
)

export function HomePage() {
  const { atividades, isLoading, reloadAtividades } = useAtividadesWithOnlineRefresh('HomePage')
  const navigate = useNavigate()
  const toastRef = useRef<Toast | null>(null)
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    if (typeof navigator === 'undefined') {
      return true
    }

    return navigator.onLine
  })
  const [enqueuingActivityKey, setEnqueuingActivityKey] = useState<string | null>(null)
  const [processingSubmissionId, setProcessingSubmissionId] = useState<string | null>(null)
  const [syncQueueItems, setSyncQueueItems] = useState<ActivitySyncQueueItem[]>([])
  const [optimisticRemovedProductKeysByActivity, setOptimisticRemovedProductKeysByActivity] = useState<Record<string, Set<string>>>({})
  const sortedSyncQueueItems = useMemo(() => {
    return [...syncQueueItems].sort((left, right) => right.createdAt - left.createdAt)
  }, [syncQueueItems])

  const displayedAtividades = useMemo(() => {
    if (Object.keys(optimisticRemovedProductKeysByActivity).length === 0) {
      return atividades
    }

    return atividades.map((atividade) => {
      const activityKey = getActivityScopeKey(atividade)
      const removedProductKeys = optimisticRemovedProductKeysByActivity[activityKey]

      if (!removedProductKeys || removedProductKeys.size === 0) {
        return atividade
      }

      return {
        ...atividade,
        produtos: atividade.produtos.filter((produto) => {
          const productKey = `${produto.idwffilatrabalho}-${produto.idwfocorrencia}-${produto.idproduto}`
          return !removedProductKeys.has(productKey)
        }),
      }
    })
  }, [atividades, optimisticRemovedProductKeysByActivity])

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

        const mergedByActivity = recoveredItems.reduce<Record<string, Set<string>>>((accumulator, item) => {
          const pendingProductKeys = getQueueItemProductKeys(item)
          if (pendingProductKeys.size === 0) {
            return accumulator
          }

          const previous = accumulator[item.activityKey] ?? new Set<string>()
          accumulator[item.activityKey] = new Set([...previous, ...pendingProductKeys])
          return accumulator
        }, {})

        if (Object.keys(mergedByActivity).length > 0) {
          setOptimisticRemovedProductKeysByActivity(mergedByActivity)
        }
      })
      .catch((error) => {
        console.warn('[HomePage] Falha ao carregar fila de sincronizacao.', error)
      })
  }, [])

  const buildQueueItem = (
    atividade: AtividadeComProdutos,
  ): ActivitySyncQueueItem | null => {
    const selectedProducts = atividade.produtos
      .filter((produto) => produto.idwfatividaderealizada !== null)
    const encaminhamentos = selectedProducts.map((produto) => ({
      idwfocorrencia: produto.idwfocorrencia,
      idwffilatrabalho: produto.idwffilatrabalho,
      idwfatividadeencaminhamento: produto.idwfatividaderealizada as number,
      observacao: produto.observacao ?? '',
    }))

    if (encaminhamentos.length === 0) {
      return null
    }

    const now = Date.now()
    const submissionId = `${now}-${Math.random().toString(36).slice(2, 10)}`
    const products = selectedProducts.map((produto) => ({
      productKey: `${produto.idwffilatrabalho}-${produto.idwfocorrencia}-${produto.idproduto}`,
      idproduto: produto.idproduto,
      codigobarras: produto.codigobarras,
      produto: produto.produto,
      idwffilatrabalho: produto.idwffilatrabalho,
      idwfocorrencia: produto.idwfocorrencia,
      idwfatividadeencaminhamento: produto.idwfatividaderealizada as number,
      observacao: produto.observacao ?? '',
    }))
    return {
      submissionId,
      activityKey: getActivityScopeKey(atividade),
      activityId: atividade.idwfatividade,
      source: 'home',
      atividade,
      payload: {
        idwfprocesso: atividade.idwfprocesso,
        encaminhamentos,
      },
      productCount: products.length,
      products,
      status: 'pending',
      errorMessage: null,
      createdAt: now,
      updatedAt: now,
    }
  }

  const enqueueForSync = useCallback(async (item: ActivitySyncQueueItem) => {
    const now = Date.now()
    const pendingItem: ActivitySyncQueueItem = {
      ...item,
      status: 'pending',
      errorMessage: null,
      updatedAt: now,
    }

    setSyncQueueItems((current) => [pendingItem, ...current])
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
      console.error('[HomePage] Falha ao enviar encaminhamentos.', error)
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

  const handleSubmitActivity = async (atividade: AtividadeComProdutos) => {
    const queueItem = buildQueueItem(atividade)
    if (!queueItem) {
      toastRef.current?.show({
        severity: 'warn',
        summary: 'Nada para enviar',
        detail: 'Esta atividade nao possui encaminhamentos para envio.',
      })
      return
    }

    const productKeysToRemove = getQueueItemProductKeys(queueItem)

    setEnqueuingActivityKey(queueItem.activityKey)
    try {
      setOptimisticRemovedProductKeysByActivity((current) => {
        const previous = current[queueItem.activityKey] ?? new Set<string>()
        const merged = new Set([...previous, ...productKeysToRemove])
        return {
          ...current,
          [queueItem.activityKey]: merged,
        }
      })

      removeActivityProductsFromCache(queueItem.activityKey, productKeysToRemove)
      await removeActivityProductSelections(queueItem.activityKey)
      await enqueueForSync(queueItem)
    } finally {
      setEnqueuingActivityKey(null)
    }
  }

  const handleRetryQueueItem = async (item: ActivitySyncQueueItem) => {
    if (processingSubmissionId !== null) {
      return
    }

    await enqueueForSync(item)
  }

  return (
    <section>
      <Toast ref={toastRef} position="top-right" />
      <div className="home-page-header">
        <h3><FontAwesomeIcon icon={faPersonWalking} /> Minhas Atividades</h3>
        <div className="home-page-actions">
          <Button
            type="button"
            text
            onClick={() => {
              void reloadAtividades()
            }}
            disabled={isLoading}
          >
            <FontAwesomeIcon icon={faArrowsRotate} />
            <span>Atualizar</span>
          </Button>
        </div>
      </div>
      {isLoading
        ? (
          <section className="activity-card-list">
            {Array.from({ length: 5 }).map((_, index) => (
              <Card key={index} className="activity-card" >
                <div className="activity-card-btn">
                  <Skeleton width="60%" height="16px" />
                  <Skeleton width="78%" height="12px" />
                  <Skeleton width="100%" height="42px" borderRadius="10px" />
                </div>
              </Card>
            ))}
          </section>
        )
        : (
          <ActivityCardList
            atividades={displayedAtividades}
            selectedActivityId={null}
            submittingActivityKey={enqueuingActivityKey}
            onSubmitActivity={(atividade) => {
              void handleSubmitActivity(atividade)
            }}
            onSelect={(selectedActivity) => {
              navigate(`/home/atividade/${selectedActivity.idwfatividade}/empresa/${selectedActivity.idempresa}`, {
                state: {
                  selectedActivity: selectedActivity as AtividadeComProdutos | null,
                },
              })
            }}
          />
        )}
      <section className="sync-queue-section">
        <div className="sync-queue-header">
          <h4>Processamentos</h4>
        </div>
        {syncQueueItems.length === 0
          ? (
            <p className="sync-queue-empty">Nenhum item em processamento no momento.</p>
          )
          : (
            <div className="sync-queue-list">
              {sortedSyncQueueItems.map((item) => (
                (() => {
                  const packageProducts = item.products ?? []
                  const packageCount = item.productCount ?? packageProducts.length ?? item.payload.encaminhamentos.length
                  return (
                    <Card
                      key={item.submissionId}
                      className="sync-queue-card sync-queue-card-clickable"
                      onClick={() => {
                        navigate(`/home/atividade/${item.atividade.idwfatividade}/empresa/${item.atividade.idempresa}`, {
                          state: {
                            selectedActivity: item.atividade,
                            readOnlyPackageView: true,
                            packageProductKeys: getPackageProductKeys(item),
                          },
                        })
                      }}
                    >
                      <p className="sync-queue-sent-at">{formatSubmissionDateTime(item.createdAt)}</p>

                      <div className="sync-queue-card-content">
                        <div>
                          <p className="sync-queue-company"><FontAwesomeIcon icon={faBuilding} /> {item.atividade.empresa} | <FontAwesomeIcon icon={faFile} /> {item.atividade.wfprocesso} | <FontAwesomeIcon icon={faPersonWalking} /> {item.atividade.wfatividade}</p>
                          <p className="sync-queue-products-summary">
                            <FontAwesomeIcon icon={faTasks} /> {packageCount} produto(s) encaminhado(s)
                          </p>
                        </div>
                        <div className="sync-queue-meta">
                          <span className={`sync-queue-status status-${item.status}`}>
                            {item.status === 'pending'
                              ? 'Na fila'
                              : item.status === 'processing'
                                ? 'Processando'
                                : item.status === 'success'
                                  ? 'Sincronizado'
                                  : 'Erro'}
                          </span>
                          {item.status === 'error' && (
                            <Button
                              type="button"
                              label="Reenviar"
                              icon="pi pi-refresh"
                              className="app-btn primary"
                              onClick={(event) => {
                                event.stopPropagation()
                                void handleRetryQueueItem(item)
                              }}
                              loading={processingSubmissionId === item.submissionId}
                              disabled={processingSubmissionId !== null}
                            />
                          )}
                        </div>
                      </div>
                      {item.status === 'error' && item.errorMessage && (
                        <p className="sync-queue-error-message">{item.errorMessage}</p>
                      )}
                    </Card>
                  )
                })()
              ))}
            </div>
          )}
      </section>
    </section>
  )
}
