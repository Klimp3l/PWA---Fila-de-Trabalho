import { Card } from 'primereact/card'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBuilding, faPersonWalking } from '@fortawesome/free-solid-svg-icons'
import type { AtividadeComProdutos } from '../types/workflow'
import { WorkflowProgressBar } from './WorkflowProgressBar'

interface ActivityCardProps {
  atividade: AtividadeComProdutos
  isSelected: boolean
  onSelect: (idAtividade: number) => void
}

export function ActivityCard({ atividade, isSelected, onSelect }: ActivityCardProps) {
  const totalProdutos = atividade.produtos.length
  const produtosRealizados = atividade.produtos.filter((produto) => produto.idwfatividaderealizada !== null).length

  return (
    <Card className={isSelected ? 'activity-card selected' : 'activity-card'}>
      <button
        type="button"
        className="activity-card-btn"
        onClick={() => onSelect(atividade.idwfatividade)}
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
          <p className="activity-process">{atividade.wfprocesso}</p>
          <h3><FontAwesomeIcon icon={faPersonWalking} /> {atividade.wfatividade}</h3>
        </div>
      </button>
    </Card>
  )
}
