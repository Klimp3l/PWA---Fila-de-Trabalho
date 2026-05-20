import { Skeleton } from 'primereact/skeleton'
import { Button } from 'primereact/button'
import { useNavigate } from 'react-router-dom'
import { ActivityCardList } from '../components/ActivityCardList'
import { faArrowsRotate, faPersonWalking } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useAtividadesWithOnlineRefresh } from '../hooks/useAtividadesWithOnlineRefresh'
import type { AtividadeComProdutos } from '../types/workflow'
import { Card } from 'primereact/card'
import { Toast } from 'primereact/toast'
import { useRef, useState } from 'react'
import { updateEncaminhamentos } from '../services/api'

export function HomePage() {
  const { atividades, isLoading, reloadAtividades } = useAtividadesWithOnlineRefresh('HomePage')
  const navigate = useNavigate()
  const toastRef = useRef<Toast | null>(null)
  const [submittingActivityId, setSubmittingActivityId] = useState<number | null>(null)

  const handleSubmitActivity = async (atividade: AtividadeComProdutos) => {
    if (submittingActivityId !== null) {
      return
    }

    const encaminhamentos = atividade.produtos
      .filter((produto) => produto.idwfatividaderealizada !== null)
      .map((produto) => ({
        idwfocorrencia: produto.idwfocorrencia,
        idwffilatrabalho: produto.idwffilatrabalho,
        idwfatividadeencaminhamento: produto.idwfatividaderealizada as number,
        observacao: produto.observacao ?? '',
      }))

    if (encaminhamentos.length === 0) {
      toastRef.current?.show({
        severity: 'warn',
        summary: 'Nada para enviar',
        detail: 'Esta atividade nao possui encaminhamentos para envio.',
      })
      return
    }

    setSubmittingActivityId(atividade.idwfatividade)

    try {
      const response = await updateEncaminhamentos({
        idwfprocesso: atividade.idwfprocesso,
        encaminhamentos,
      })

      const responseText = typeof response === 'string' ? response : JSON.stringify(response ?? '')
      const hasError = responseText.toLowerCase().includes('erro')

      if (hasError) {
        toastRef.current?.show({
          severity: 'error',
          summary: 'Falha ao enviar',
          detail: responseText || 'O servidor retornou erro ao enviar os encaminhamentos.',
          life: 7000,
        })
        return
      }

      toastRef.current?.show({
        severity: 'success',
        summary: 'Enviado com sucesso',
        detail: `Atividade "${atividade.wfatividade}" enviada.`,
      })

      await reloadAtividades()
    } catch (error) {
      console.error('[HomePage] Falha ao enviar encaminhamentos.', error)
      toastRef.current?.show({
        severity: 'error',
        summary: 'Falha ao enviar',
        detail: error instanceof Error ? error.message : 'Nao foi possivel enviar os encaminhamentos.',
        life: 7000,
      })
    } finally {
      setSubmittingActivityId(null)
    }
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
            disabled={isLoading || submittingActivityId !== null}
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
            atividades={atividades}
            selectedActivityId={null}
            submittingActivityId={submittingActivityId}
            onSubmitActivity={(atividade) => {
              void handleSubmitActivity(atividade)
            }}
            onSelect={(idAtividade) => {
              const selectedActivity = atividades.find(
                (atividade) => atividade.idwfatividade === idAtividade
              ) ?? null

              navigate(`/home/atividade/${idAtividade}`, {
                state: {
                  selectedActivity: selectedActivity as AtividadeComProdutos | null,
                },
              })
            }}
          />
        )}
    </section>
  )
}
