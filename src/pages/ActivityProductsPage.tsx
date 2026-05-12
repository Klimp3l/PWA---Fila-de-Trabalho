import { useMemo } from 'react'
import { ProgressSpinner } from 'primereact/progressspinner'
import { useNavigate, useParams } from 'react-router-dom'
import { ProductList } from '../components/ProductList'
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button } from 'primereact/button'
import { useAtividadesWithOnlineRefresh } from '../hooks/useAtividadesWithOnlineRefresh'

export function ActivityProductsPage() {
  const navigate = useNavigate()
  const { activityId } = useParams()
  const { atividades, isLoading } = useAtividadesWithOnlineRefresh('ActivityProductsPage')

  const activityIdAsNumber = useMemo(() => {
    if (!activityId) {
      return null
    }

    const parsed = Number(activityId)
    return Number.isFinite(parsed) ? parsed : null
  }, [activityId])

  const selectedActivity = useMemo(() => {
    if (activityIdAsNumber === null) {
      return null
    }

    return atividades.find((atividade) => atividade.idwfatividade === activityIdAsNumber) ?? null
  }, [activityIdAsNumber, atividades])

  if (isLoading) {
    return (
      <section className="panel resource-loading">
        <ProgressSpinner
          style={{ width: '24px', height: '24px' }}
          strokeWidth="6"
          animationDuration=".9s"
        />
        <span>Carregando produtos da atividade...</span>
      </section>
    )
  }

  return (
    <section>

      <div>
        <Button
          className="app-btn default"
          type="button"
          onClick={() => {
            navigate('/home')
          }}
          text
        >
          <FontAwesomeIcon icon={faArrowLeft} />
          <span>Voltar para minhas atividades</span>
        </Button>
      </div>
      <ProductList atividade={selectedActivity} />
    </section>
  )
}
