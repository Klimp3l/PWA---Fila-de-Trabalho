import { useMemo } from 'react'
import { Skeleton } from 'primereact/skeleton'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { ProductList } from '../components/ProductList'
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button } from 'primereact/button'
import { useAtividadesWithOnlineRefresh } from '../hooks/useAtividadesWithOnlineRefresh'
import type { AtividadeComProdutos } from '../types/workflow'

interface ActivityProductsPageLocationState {
  selectedActivity?: AtividadeComProdutos | null
}

export function ActivityProductsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { activityId } = useParams()
  const locationState = (location.state ?? null) as ActivityProductsPageLocationState | null
  const selectedActivityFromNavigation = locationState?.selectedActivity ?? null
  const shouldLoadAtividades = selectedActivityFromNavigation === null
  const { atividades, isLoading } = useAtividadesWithOnlineRefresh('ActivityProductsPage', {
    enabled: shouldLoadAtividades,
  })

  const activityIdAsNumber = useMemo(() => {
    if (!activityId) {
      return null
    }

    const parsed = Number(activityId)
    return Number.isFinite(parsed) ? parsed : null
  }, [activityId])

  const selectedActivity = useMemo(() => {
    if (
      selectedActivityFromNavigation
      && activityIdAsNumber !== null
      && selectedActivityFromNavigation.idwfatividade === activityIdAsNumber
    ) {
      return selectedActivityFromNavigation
    }

    if (activityIdAsNumber === null) {
      return null
    }

    return atividades.find((atividade) => atividade.idwfatividade === activityIdAsNumber) ?? null
  }, [activityIdAsNumber, atividades, selectedActivityFromNavigation])

  if (isLoading) {
    return (
      <section className="panel product-panel product-panel-loading" aria-busy="true" aria-live="polite">
        <div className="product-panel-loading-back">
          <Skeleton width="220px" height="18px" />
        </div>
        <Skeleton width="65%" height="14px" />
        <Skeleton width="48%" height="26px" />
        <Skeleton width="100%" height="58px" borderRadius="10px" />
        <Skeleton width="100%" height="54px" borderRadius="10px" />
        <div className="product-list product-list-grid">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="product-item product-item-grid">
              <Skeleton width="100%" height="190px" borderRadius="10px" />
            </div>
          ))}
        </div>
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
