import type { AtividadeElegivelProduto, AtividadeProdutoColumn, ProdutoAtividade } from '../../types/workflow'
import { DEFAULT_PRODUCT_IMAGE } from './config'

type FieldFormatter = (value: unknown) => string
type LocalFieldType = 'string' | 'number' | 'currency'

export const getProdutoFieldValue = (produto: ProdutoAtividade, field: string): unknown =>
  produto[field as keyof ProdutoAtividade]

const formatCurrency = (value: number | null) =>
  typeof value === 'number' && Number.isFinite(value)
    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
    : '-'

const FIELD_FORMATTERS: Record<LocalFieldType, FieldFormatter> = {
  string: (value) => String(value ?? ''),
  number: (value) => {
    const numeric = Number(value)
    return Number.isFinite(numeric) ? new Intl.NumberFormat('pt-BR').format(numeric) : '-'
  },
  currency: (value) => formatCurrency(typeof value === 'number' ? value : Number(value)),
}

const resolveFieldType = (fieldConfig?: AtividadeProdutoColumn): LocalFieldType => {
  const configuredType = String(fieldConfig?.type ?? '').toLowerCase()
  if (configuredType === 'inputnumber') {
    return 'number'
  }
  if (configuredType === 'currency' || configuredType === 'money') {
    return 'currency'
  }
  return 'string'
}

export const formatFieldValue = (fieldConfig: AtividadeProdutoColumn | undefined, value: unknown) => {
  const fieldType = resolveFieldType(fieldConfig)

  if (!fieldType) {
    return String(value ?? '')
  }

  return FIELD_FORMATTERS[fieldType](value)
}

export const resolveProductImage = (produto: ProdutoAtividade) => {
  const rawImage = produto.urlImagem
  const image = rawImage?.trim()

  if (!image) {
    return DEFAULT_PRODUCT_IMAGE
  }

  if (/^(https?:|data:|blob:)/i.test(image) || image.startsWith('/')) {
    return image
  }

  return `${import.meta.env.BASE_URL}${image.replace(/^\/+/, '')}`
}

export const getAtividadeLabel = (atividade: AtividadeElegivelProduto) => {
  const descricao = atividade.atividaderealizada.trim()
  return descricao || `Atividade ${atividade.idwfatividaderealizada}`
}

export const toDropdownActivityId = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

export const compareFieldValues = (
  fieldConfig: AtividadeProdutoColumn | undefined,
  first: unknown,
  second: unknown,
) => {
  if (first == null && second == null) {
    return 0
  }

  if (first == null) {
    return 1
  }

  if (second == null) {
    return -1
  }

  const fieldType = resolveFieldType(fieldConfig)

  if (fieldType === 'number' || fieldType === 'currency') {
    return Number(first) - Number(second)
  }

  return String(first).localeCompare(String(second), 'pt-BR', {
    sensitivity: 'base',
    numeric: true,
  })
}
