import { Skeleton } from 'primereact/skeleton'
import { Button } from 'primereact/button'
import { useNavigate } from 'react-router-dom'
import { ActivityCardList } from '../components/ActivityCardList'
import { faArrowsRotate, faPersonWalking } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useAtividadesWithOnlineRefresh } from '../hooks/useAtividadesWithOnlineRefresh'
import type { AtividadeComProdutos } from '../types/workflow'
import { Card } from 'primereact/card'

export function HomePage() {
  const { atividades, isLoading, reloadAtividades } = useAtividadesWithOnlineRefresh('HomePage')
  const navigate = useNavigate()

  return (
    <section>
      <div className="home-page-header">
        <h3><FontAwesomeIcon icon={faPersonWalking} /> Minhas Atividades</h3>
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
