import type {
  AtividadeElegivelProduto,
  AtividadeProdutoColumn,
  CampoDigitalValue,
  CampoUsoAplicacao,
  ProdutoAtividade,
} from '../../types/workflow'
import { DATA_INCLUSAO_FIELD, DEFAULT_PRODUCT_IMAGE, PINNED_COLUMN_KEYS } from './config'

type FieldFormatter = (value: unknown) => string
type LocalFieldType = 'string' | 'number' | 'currency' | 'date'

export const getProdutoFieldValue = (produto: ProdutoAtividade, field: string): unknown =>
  produto.camposDigitais && Object.prototype.hasOwnProperty.call(produto.camposDigitais, field)
    ? produto.camposDigitais[field]
    : produto[field as keyof ProdutoAtividade]

const formatCurrency = (value: number | null) =>
  typeof value === 'number' && Number.isFinite(value)
    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
    : '-'

const createValidDate = (year: number, month: number, day: number) => {
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year
    && date.getMonth() === month - 1
    && date.getDate() === day
    ? date
    : null
}

export const parseDateValue = (value: unknown): Date | null => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }

  if (typeof value !== 'string') {
    return null
  }

  const normalizedValue = value.trim()
  const isoMatch = normalizedValue.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/)
  if (isoMatch) {
    return createValidDate(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]))
  }

  const brazilianMatch = normalizedValue.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (brazilianMatch) {
    return createValidDate(Number(brazilianMatch[3]), Number(brazilianMatch[2]), Number(brazilianMatch[1]))
  }

  const compactMatch = normalizedValue.match(/^(\d{2})(\d{2})(\d{4})$/)
  if (compactMatch) {
    return createValidDate(Number(compactMatch[3]), Number(compactMatch[2]), Number(compactMatch[1]))
  }

  return null
}

export const formatDateValue = (value: unknown) => {
  const date = parseDateValue(value)
  if (!date) {
    return String(value ?? '')
  }

  return `${`${date.getDate()}`.padStart(2, '0')}/${`${date.getMonth() + 1}`.padStart(2, '0')}/${date.getFullYear()}`
}

const FIELD_FORMATTERS: Record<LocalFieldType, FieldFormatter> = {
  string: (value) => String(value ?? ''),
  number: (value) => {
    const numeric = Number(value)
    return Number.isFinite(numeric) ? new Intl.NumberFormat('pt-BR').format(numeric) : '-'
  },
  currency: (value) => formatCurrency(typeof value === 'number' ? value : Number(value)),
  date: formatDateValue,
}

const resolveFieldType = (fieldConfig?: AtividadeProdutoColumn): LocalFieldType => {
  const configuredType = String(fieldConfig?.type ?? '').toLowerCase()
  if (configuredType === 'inputnumber') {
    return 'number'
  }
  if (configuredType === 'currency' || configuredType === 'money') {
    return 'currency'
  }
  if (configuredType === 'date' || fieldConfig?.inputType === 'date') {
    return 'date'
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

const parseDefaultBoolean = (value: string): boolean | null => {
  const normalizedValue = value.trim().toLowerCase()
  if (['true', '1', 's', 'sim'].includes(normalizedValue)) {
    return true
  }
  if (['false', '0', 'n', 'nao', 'não'].includes(normalizedValue)) {
    return false
  }
  return null
}

export const resolveActivityDigitalDefault = (
  atividadeElegivel: AtividadeElegivelProduto | undefined,
  columns: Record<string, AtividadeProdutoColumn>,
): { field: string, value: CampoDigitalValue } | null => {
  const configuredFieldName = atividadeElegivel?.nomeCampoDigital?.trim() ?? ''
  const field = Object.keys(columns).find(
    (columnName) => columnName.toLowerCase() === configuredFieldName.toLowerCase(),
  ) ?? ''
  const fieldConfig = columns[field]

  if (!configuredFieldName || !field || !fieldConfig?.inputType) {
    return null
  }

  const rawValue = atividadeElegivel?.valorDefaultCampoDigital ?? ''
  const inputType = fieldConfig.inputType

  if (inputType === 'inputNumber') {
    const normalizedValue = rawValue.trim().replace(',', '.')
    const numericValue = normalizedValue === '' ? null : Number(normalizedValue)
    return { field, value: numericValue !== null && Number.isFinite(numericValue) ? numericValue : null }
  }

  if (inputType === 'date') {
    const parsedDate = parseDateValue(rawValue)
    return { field, value: parsedDate ? formatDateValue(parsedDate) : '' }
  }

  if (inputType === 'boolean') {
    return { field, value: parseDefaultBoolean(rawValue) }
  }

  if (inputType === 'multipleSelect') {
    return {
      field,
      value: rawValue.split(',').map((item) => item.trim()).filter(Boolean),
    }
  }

  return { field, value: rawValue }
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

  if (fieldType === 'date') {
    const firstDate = parseDateValue(first)
    const secondDate = parseDateValue(second)
    if (firstDate && secondDate) {
      return firstDate.getTime() - secondDate.getTime()
    }
  }

  return String(first).localeCompare(String(second), 'pt-BR', {
    sensitivity: 'base',
    numeric: true,
  })
}

export interface EffectiveActivityColumns {
  columns: Record<string, AtividadeProdutoColumn>
  policyActive: boolean
  defaultVisibleFieldKeys: string[]
}

export const EXCEL_STORE_ID_FIELD = 'idempresa'
export const EXCEL_STORE_ID_LABEL = 'ID Loja'
export const EXCEL_NOTE_FIELD = 'observacao'
export const EXCEL_NOTE_LABEL = 'Observação'

const normalizeExcelLabel = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()

const findExcelBoundaryKey = (
  columns: Record<string, AtividadeProdutoColumn>,
  label: string,
  fallbackKey: string,
) => {
  const normalizedLabel = normalizeExcelLabel(label)
  const labeledKey = Object.entries(columns).find(
    ([, column]) => normalizeExcelLabel(column.label ?? '') === normalizedLabel,
  )?.[0]
  if (labeledKey) {
    return labeledKey
  }

  const keyed = Object.keys(columns).find((key) => key.toLowerCase() === fallbackKey)
  return keyed ?? fallbackKey
}

export interface ExcelColumnBoundaries {
  firstKey: string
  lastKey: string
}

export const resolveExcelColumnBoundaries = (
  columns: Record<string, AtividadeProdutoColumn>,
): ExcelColumnBoundaries => ({
  firstKey: findExcelBoundaryKey(columns, EXCEL_STORE_ID_LABEL, EXCEL_STORE_ID_FIELD),
  lastKey: findExcelBoundaryKey(columns, EXCEL_NOTE_LABEL, EXCEL_NOTE_FIELD),
})

const isExcelBoundaryField = (
  field: string,
  columns: Record<string, AtividadeProdutoColumn>,
  boundaries: ExcelColumnBoundaries,
) => {
  const normalizedField = field.toLowerCase()
  if (
    normalizedField === boundaries.firstKey.toLowerCase()
    || normalizedField === boundaries.lastKey.toLowerCase()
    || normalizedField === EXCEL_STORE_ID_FIELD
    || normalizedField === EXCEL_NOTE_FIELD
  ) {
    return true
  }

  const column = columns[field]
  if (!column) {
    return false
  }

  const label = normalizeExcelLabel(column.label ?? '')
  return label === normalizeExcelLabel(EXCEL_STORE_ID_LABEL) || label === normalizeExcelLabel(EXCEL_NOTE_LABEL)
}

export const buildExcelColumnModel = (
  visibleFieldKeys: string[],
  columns: Record<string, AtividadeProdutoColumn> = {},
): string[] => {
  const boundaries = resolveExcelColumnBoundaries(columns)
  const seen = new Set<string>()
  const middle = visibleFieldKeys.filter((field) => {
    const normalizedField = field.toLowerCase()
    if (isExcelBoundaryField(field, columns, boundaries) || seen.has(normalizedField)) {
      return false
    }
    seen.add(normalizedField)
    return true
  })

  return [boundaries.firstKey, ...middle, boundaries.lastKey]
}

const withPinnedColumnFlags = (
  columns: Record<string, AtividadeProdutoColumn>,
): Record<string, AtividadeProdutoColumn> => {
  const nextColumns = { ...columns }

  PINNED_COLUMN_KEYS.forEach((key) => {
    const column = nextColumns[key]
    if (!column) {
      return
    }

    nextColumns[key] = {
      ...column,
      searchable: true,
      sortable: true,
    }
  })

  return nextColumns
}

export const resolveEffectiveColumns = (
  columns: Record<string, AtividadeProdutoColumn>,
  camposUsoAplicacao?: CampoUsoAplicacao[] | null,
): EffectiveActivityColumns => {
  if (!camposUsoAplicacao?.length) {
    return {
      columns: withPinnedColumnFlags(columns),
      policyActive: false,
      defaultVisibleFieldKeys: [],
    }
  }

  const columnsByKey = new Map(
    Object.entries(columns).map(([key, column]) => [key.toLowerCase(), [key, column] as const]),
  )
  const nextColumns: Record<string, AtividadeProdutoColumn> = {}
  const defaultVisibleFieldKeys: string[] = []

  camposUsoAplicacao.forEach((item) => {
    const match = columnsByKey.get(item.campo.trim().toLowerCase())
    if (!match || nextColumns[match[0]]) {
      return
    }

    const [key, column] = match
    const visual = item.visual === true
    nextColumns[key] = {
      ...column,
      defaultVisible: visual,
    }
    if (visual) {
      defaultVisibleFieldKeys.push(key)
    }
  })

  PINNED_COLUMN_KEYS.forEach((pinnedKey) => {
    if (nextColumns[pinnedKey]) {
      return
    }

    const match = columnsByKey.get(pinnedKey)
    if (!match) {
      return
    }

    const [key, column] = match
    if (key.toLowerCase() === DATA_INCLUSAO_FIELD) {
      nextColumns[key] = {
        ...column,
        defaultVisible: true,
      }
      defaultVisibleFieldKeys.push(key)
      return
    }

    nextColumns[key] = column
  })

  return {
    columns: withPinnedColumnFlags(nextColumns),
    policyActive: true,
    defaultVisibleFieldKeys,
  }
}
