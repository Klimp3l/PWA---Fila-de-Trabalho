import { ProgressSpinner } from 'primereact/progressspinner'
import { useNavigate } from 'react-router-dom'
import { ActivityCardList } from '../components/ActivityCardList'
import { faPersonWalking } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useAtividadesWithOnlineRefresh } from '../hooks/useAtividadesWithOnlineRefresh'

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
                navigate(`/home/atividade/${idAtividade}`)
              }}
            />
          </>
        )}
    </section>
  )
}
