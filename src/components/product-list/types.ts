import type { IconProp } from '@fortawesome/fontawesome-svg-core'
import type { AtividadeProdutoColumn } from '../../types/workflow'

export const NONE_ACTIVITY_OPTION_VALUE = '__none__'

export type SearchFilterValue = string | number | Date | string[] | boolean | null

export type FieldOption = {
  label: string
  value: string
  type: AtividadeProdutoColumn['type']
  options: string[] | undefined
  searchable: boolean
  sortable: boolean
}

export type ColumnGroupKey = 'produto' | 'mercadologico' | 'datasValores' | 'quantidade' | 'estoque'

export type GroupedFieldOptions = {
  label: string
  icon: IconProp
  items: FieldOption[]
}
