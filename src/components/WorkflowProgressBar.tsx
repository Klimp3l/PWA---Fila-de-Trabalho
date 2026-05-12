import { ProgressBar } from 'primereact/progressbar'

interface WorkflowProgressBarProps {
  completed: number
  total: number
  itemLabel: string
  className?: string
}

export function WorkflowProgressBar({
  completed,
  total,
  itemLabel,
  className,
}: WorkflowProgressBarProps) {
  const normalizedTotal = Math.max(total, 0)
  const normalizedCompleted = Math.min(Math.max(completed, 0), normalizedTotal)
  const percentage = normalizedTotal > 0
    ? Math.round((normalizedCompleted / normalizedTotal) * 100)
    : 0

  const classes = ['workflow-progress', className].filter(Boolean).join(' ')

  return (
    <div className={classes}>
      <div className="workflow-progress-meta">
        <span>{normalizedCompleted}/{normalizedTotal} {itemLabel}</span>
        <strong>{percentage}%</strong>
      </div>
      <ProgressBar value={percentage} className="workflow-progress-bar" />
    </div>
  )
}
