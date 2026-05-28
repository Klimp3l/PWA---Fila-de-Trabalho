import { Card } from 'primereact/card'
import { Button } from 'primereact/button'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBuilding, faFile, faPersonWalking } from '@fortawesome/free-solid-svg-icons'
import type { AtividadeComProdutos } from '../types/workflow'
import { WorkflowProgressBar } from './WorkflowProgressBar'

interface ActivityCardProps {
  atividade: AtividadeComProdutos
  isSelected: boolean
  onSelect: (atividade: AtividadeComProdutos) => void
  canSubmit: boolean
  isSubmitting: boolean
  onSubmit: (atividade: AtividadeComProdutos) => void
}

export function ActivityCard({
  atividade,
  isSelected,
  onSelect,
  canSubmit,
  isSubmitting,
  onSubmit,
}: ActivityCardProps) {
  const totalProdutos = atividade.produtos.length
  const produtosRealizados = atividade.produtos.filter((produto) => produto.idwfatividaderealizada !== null).length

  return (
    <Card className={isSelected ? 'activity-card selected' : 'activity-card'}>
      <div className="activity-card-shell">
        <button
          type="button"
          className="activity-card-btn"
          onClick={() => onSelect(atividade)}
        >
          <div className="activity-meta">
            <WorkflowProgressBar
              completed={produtosRealizados}
              total={totalProdutos}
              itemLabel="produtos"
              className="activity-progress-container"
            />
          </div>
          <div className="activity-card-content">
            <p className="activity-company"><FontAwesomeIcon icon={faBuilding} /> {atividade.empresa}</p>
            <p className="activity-process"><FontAwesomeIcon icon={faFile} /> {atividade.wfprocesso}</p>
            <h3><FontAwesomeIcon icon={faPersonWalking} /> {atividade.wfatividade}</h3>
          </div>
        </button>
        <div className="activity-card-actions">
          <Button
            type="button"
            label="Enviar"
            icon="pi pi-send"
            className="app-btn primary"
            onClick={() => onSubmit(atividade)}
            loading={isSubmitting}
            disabled={!canSubmit || isSubmitting}
          />
        </div>
      </div>
    </Card>
  )
}
