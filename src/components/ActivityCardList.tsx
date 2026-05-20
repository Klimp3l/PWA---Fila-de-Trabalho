import { ActivityCard } from './ActivityCard'
import { Message } from 'primereact/message'
import type { AtividadeComProdutos } from '../types/workflow'

interface ActivityCardListProps {
  atividades: AtividadeComProdutos[]
  selectedActivityId: number | null
  onSelect: (idAtividade: number) => void
  onSubmitActivity: (atividade: AtividadeComProdutos) => void
  submittingActivityId: number | null
}

export function ActivityCardList({
  atividades,
  selectedActivityId,
  onSelect,
  onSubmitActivity,
  submittingActivityId,
}: ActivityCardListProps) {
  if (atividades.length === 0) {
    return (
      <section className="panel empty-panel">
        <Message
          severity="info"
          text="Nenhuma atividade foi encontrada para seu usuário."
        />
      </section>
    )
  }

  return (
    <section className="activity-card-list">
      {atividades.map((atividade) => (
        <ActivityCard
          key={`${atividade.idwfatividade}-${atividade.idempresa}`}
          atividade={atividade}
          isSelected={selectedActivityId === atividade.idwfatividade}
          onSelect={onSelect}
          canSubmit={atividade.produtos.some((produto) => produto.idwfatividaderealizada !== null)}
          isSubmitting={submittingActivityId === atividade.idwfatividade}
          onSubmit={onSubmitActivity}
        />
      ))}
    </section>
  )
}
