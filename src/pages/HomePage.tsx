import { ProgressSpinner } from 'primereact/progressspinner'
import { useNavigate } from 'react-router-dom'
import { ActivityCardList } from '../components/ActivityCardList'
import { faPersonWalking } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useAtividadesWithOnlineRefresh } from '../hooks/useAtividadesWithOnlineRefresh'
import type { AtividadeComProdutos } from '../types/workflow'

export function HomePage() {
  const { atividades, isLoading } = useAtividadesWithOnlineRefresh('HomePage')
  const navigate = useNavigate()

  return (
    <section>
      <h3><FontAwesomeIcon icon={faPersonWalking} /> Minhas Atividades</h3>
      {isLoading
        ? (
          <section className="panel resource-loading">
            <ProgressSpinner
              style={{ width: '24px', height: '24px' }}
              strokeWidth="6"
              animationDuration=".9s"
            />
            <span>Carregando atividades...</span>
          </section>
        )
        : (
          <>
            <ActivityCardList
              atividades={atividades}
              selectedActivityId={null}
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
          </>
        )}
    </section>
  )
}
