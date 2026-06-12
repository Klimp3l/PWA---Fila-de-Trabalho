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
import { useEffect, useMemo, useRef, useState } from 'react'
import { getActivityScopeKey, removeActivityProductSelections } from '../services/activityData'
import { removeActivityProductsFromCache } from '../hooks/useAtividadesWithOnlineRefresh'
import { useActivitySyncQueue } from '../context/ActivitySyncQueueContext'
import {
  createActivitySyncQueueItem,
  getPackageProductKeys,
  getQueueItemProductKeys,
} from '../services/activitySyncQueueUtils'

const formatSubmissionDateTime = (timestamp: number) => (
  new Date(timestamp).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
)

const PROCESSINGS_PAGE_SIZE = 5

export function HomePage() {
  const { atividades, isLoading, reloadAtividades } = useAtividadesWithOnlineRefresh('HomePage')
  const navigate = useNavigate()
  const toastRef = useRef<Toast | null>(null)
  const { syncQueueItems, processingSubmissionId, enqueueForSync, retryQueueItem } = useActivitySyncQueue()
  const [enqueuingActivityKey, setEnqueuingActivityKey] = useState<string | null>(null)
  const [visibleProcessingsCount, setVisibleProcessingsCount] = useState(PROCESSINGS_PAGE_SIZE)
  const [optimisticRemovedProductKeysByActivity, setOptimisticRemovedProductKeysByActivity] = useState<Record<string, Set<string>>>({})
  const sortedSyncQueueItems = useMemo(() => {
    return [...syncQueueItems].sort((left, right) => right.createdAt - left.createdAt)
  }, [syncQueueItems])
  const visibleSyncQueueItems = useMemo(
    () => sortedSyncQueueItems.slice(0, visibleProcessingsCount),
    [sortedSyncQueueItems, visibleProcessingsCount],
  )
  const hasMoreProcessings = sortedSyncQueueItems.length > visibleProcessingsCount
  const queueStatusLegend = useMemo(() => {
    return syncQueueItems.reduce(
      (accumulator, item) => {
        if (item.status === 'pending') {
          accumulator.pending += 1
        } else if (item.status === 'processing') {
          accumulator.processing += 1
        } else if (item.status === 'error') {
          accumulator.error += 1
        }
        return accumulator
      },
      {
        pending: 0,
        processing: 0,
        error: 0,
      },
    )
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
    setVisibleProcessingsCount((current) => {
      const minimum = Math.min(PROCESSINGS_PAGE_SIZE, sortedSyncQueueItems.length)
      return Math.max(minimum, Math.min(current, sortedSyncQueueItems.length))
    })
  }, [sortedSyncQueueItems.length])

  useEffect(() => {
    const mergedByActivity = syncQueueItems
      .filter((item) => item.status !== 'success')
      .reduce<Record<string, Set<string>>>((accumulator, item) => {
      const pendingProductKeys = getQueueItemProductKeys(item)
      if (pendingProductKeys.size === 0) {
        return accumulator
      }

      const previous = accumulator[item.activityKey] ?? new Set<string>()
      accumulator[item.activityKey] = new Set([...previous, ...pendingProductKeys])
        return accumulator
      }, {})

    if (Object.keys(mergedByActivity).length > 0) {
      setOptimisticRemovedProductKeysByActivity((current) => {
        const nextState = { ...current }
        Object.entries(mergedByActivity).forEach(([activityKey, keys]) => {
          const previous = nextState[activityKey] ?? new Set<string>()
          nextState[activityKey] = new Set([...previous, ...keys])
        })
        return nextState
      })
    }
  }, [syncQueueItems])

  const handleSubmitActivity = async (atividade: AtividadeComProdutos) => {
    const queueItem = createActivitySyncQueueItem({
      atividade,
      source: 'home',
    })
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
    await retryQueueItem(item)
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
          <div className="sync-queue-legend">
            <span className="sync-queue-legend-chip status-pending">Na fila ({queueStatusLegend.pending})</span>
            <span className="sync-queue-legend-chip status-processing">Processando ({queueStatusLegend.processing})</span>
            <span className="sync-queue-legend-chip status-error">Erro ({queueStatusLegend.error})</span>
          </div>
        </div>
        {syncQueueItems.length === 0
          ? (
            <p className="sync-queue-empty">Nenhum item em processamento no momento.</p>
          )
          : (
            <div className="sync-queue-list">
              {visibleSyncQueueItems.map((item) => (
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
              {hasMoreProcessings && (
                <div className="sync-queue-load-more">
                  <Button
                    type="button"
                    label="Ver mais"
                    icon="pi pi-chevron-down"
                    className="app-btn default"
                    onClick={() => {
                      setVisibleProcessingsCount((current) => current + PROCESSINGS_PAGE_SIZE)
                    }}
                  />
                </div>
              )}
            </div>
          )}
      </section>
    </section>
  )
}
