import { memo, type MouseEvent, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from 'primereact/button'
import { Card } from 'primereact/card'
import { Carousel } from 'primereact/carousel'
import { Calendar } from 'primereact/calendar'
import { Checkbox, type CheckboxChangeEvent } from 'primereact/checkbox'
import { DataViewLayoutOptions } from 'primereact/dataview'
import { Dropdown, type DropdownChangeEvent } from 'primereact/dropdown'
import { InputNumber, type InputNumberValueChangeEvent } from 'primereact/inputnumber'
import { InputText } from 'primereact/inputtext'
import { InputSwitch, type InputSwitchChangeEvent } from 'primereact/inputswitch'
import { Message } from 'primereact/message'
import { MultiSelect, type MultiSelectChangeEvent } from 'primereact/multiselect'
import { Toast } from 'primereact/toast'
import { classNames } from 'primereact/utils'
import type { IconProp } from '@fortawesome/fontawesome-svg-core'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faBroom,
  faBoxesStacked,
  faBuilding,
  faCalendarDays,
  faEye,
  faLayerGroup,
  faList,
  faPersonWalking,
  faScaleBalanced,
  faTableCellsLarge,
  faTags,
} from '@fortawesome/free-solid-svg-icons'
import type {
  AtividadeComProdutos,
  AtividadeProdutoColumn,
  ProdutoAtividade,
} from '../types/workflow'
import { WorkflowProgressBar } from './WorkflowProgressBar'
import {
  getActivityScopeKey,
  getProdutoAtividadeKey,
  loadActivityProductListPreferences,
  removeActivityProductSelections,
  saveActivityProductListPreferences,
  saveActivityProductSelections,
} from '../services/activityData'
import {
  CARD_INTERACTIVE_SELECTOR,
  DEFAULT_PRODUCT_IMAGE,
  DEFAULT_ROWS_PER_PAGE,
  ALWAYS_VISIBLE_FIELDS,
  MARKET_FIELD_INDEX,
  MARKET_FIELD_LABELS,
  MARKET_FIELD_KEYS,
  type MarketFieldKey,
} from './product-list/config'
import {
  compareFieldValues,
  formatFieldValue,
  getAtividadeLabel,
  getProdutoFieldValue,
  resolveProductImage,
  toDropdownActivityId,
} from './product-list/utils'
import type { ActivityProductListPreferences } from '../types/workflow'
import {
  removeActivityProductsFromCache,
  syncActivitySelectionsInCache,
} from '../hooks/useAtividadesWithOnlineRefresh'
import { useActivitySyncQueue } from '../context/ActivitySyncQueueContext'
import { createActivitySyncQueueItem, getQueueItemProductKeys } from '../services/activitySyncQueueUtils'

interface ProductCardItemProps {
  produto: ProdutoAtividade
  layout: 'list' | 'grid'
  index: number
  isSelected: boolean
  isForwarded: boolean
  selectedActivity: number | null
  activityOptions: Array<{ label: string; value: number }>
  visibleFields: string[]
  fieldConfigByKey: Record<string, AtividadeProdutoColumn>
  specialFieldValues: Record<string, string | number | null>
  onSpecialFieldChange: (productKey: string, field: string, value: string | number | boolean | null) => void
  onToggleSelect: (productKey: string, checked: boolean) => void
  readOnly: boolean
}

const ProductCardItem = memo(function ProductCardItem({
  produto,
  layout,
  index,
  isSelected,
  isForwarded,
  selectedActivity,
  activityOptions,
  visibleFields,
  fieldConfigByKey,
  specialFieldValues,
  onSpecialFieldChange,
  onToggleSelect,
  readOnly,
}: ProductCardItemProps) {
  const productKey = getProdutoAtividadeKey(produto)

  const handleCardClick = (event: MouseEvent<HTMLElement>) => {
    if (readOnly) {
      return
    }

    const clickTarget = event.target as HTMLElement | null

    if (clickTarget?.closest(CARD_INTERACTIVE_SELECTOR)) {
      return
    }

    onToggleSelect(productKey, !isSelected)
  }

  return (
    <div
      className={classNames('product-item', {
        'product-item-list': layout === 'list',
        'product-item-grid': layout === 'grid',
        'product-item-bordered': layout === 'list' && index !== 0,
      })}
    >
      <Card
        className={classNames('product-card', {
          'product-card-selected': isSelected && !readOnly,
          'product-card-forwarded': isForwarded && !isSelected,
        })}
        onClick={readOnly ? undefined : handleCardClick}
      >
        <div
          className={classNames('product-card-content', {
            'product-card-content-list': layout === 'list',
            'product-card-content-grid': layout === 'grid',
          })}
        >
          {layout === 'list' && selectedActivity && (
            <p>
              <FontAwesomeIcon icon={faPersonWalking} />
              {activityOptions.find((option) => option.value === selectedActivity)?.label || '-'}
            </p>
          )}
          <div
            className={classNames('product-card-main', {
              'product-card-main-list': layout === 'list',
              'product-card-main-grid': layout === 'grid',
            })}
          >
            {layout === 'grid' && selectedActivity && (
              <p>
                <FontAwesomeIcon icon={faPersonWalking} />
                {activityOptions.find((option) => option.value === selectedActivity)?.label || '-'}
              </p>
            )}
            <div className="product-image-wrap">
              <img
                className="product-image"
                src={resolveProductImage(produto)}
                alt={produto.produto}
                loading="lazy"
                onError={(event) => {
                  if (event.currentTarget.src.endsWith('/default.png')) {
                    return
                  }
                  event.currentTarget.src = DEFAULT_PRODUCT_IMAGE
                }}
              />
            </div>
            <div className="product-details">
              <div className="product-card-head">
                <h3>{produto.produto}</h3>
              </div>
              <div className="product-card-body">
                <p key={`${produto.idproduto}-idproduto`}>
                  ID: {produto.idproduto}
                  <i className="fa-solid fa-barcode" aria-hidden="true" />{produto.codigobarras}
                </p>
                {visibleFields.map((field) => (
                  <p key={`${produto.idproduto}-${field}`}>
                    {fieldConfigByKey[field]?.icon && <i className={fieldConfigByKey[field].icon} aria-hidden="true" />}
                    {fieldConfigByKey[field]?.label || field}
                    :{' '}
                    {!(fieldConfigByKey[field]?.inputType) && (
                      formatFieldValue(fieldConfigByKey[field], getProdutoFieldValue(produto, field))
                    )}
                    {fieldConfigByKey[field]?.inputType === 'input' ? (
                      <InputText
                        value={String(specialFieldValues[field] ?? getProdutoFieldValue(produto, field) ?? '')}
                        onChange={(event) => onSpecialFieldChange(productKey, field, event.target.value)}
                        disabled={readOnly}
                      />
                    ) : null}
                    {fieldConfigByKey[field]?.inputType === 'inputNumber' ? (
                      <InputNumber
                        value={typeof specialFieldValues[field] === 'number'
                          ? specialFieldValues[field] as number
                          : (typeof getProdutoFieldValue(produto, field) === 'number' ? getProdutoFieldValue(produto, field) as number : null)}
                        onValueChange={(event: InputNumberValueChangeEvent) => onSpecialFieldChange(productKey, field, event.value ?? null)}
                        disabled={readOnly}
                        useGrouping={false}
                        minFractionDigits={2}
                      />
                    ) : null}
                    {fieldConfigByKey[field]?.inputType === 'date' ? (
                      <Calendar
                        value={(() => {
                          const rawValue = specialFieldValues[field] ?? getProdutoFieldValue(produto, field)
                          if (typeof rawValue !== 'string' || !rawValue.trim()) {
                            return null
                          }
                          const date = new Date(rawValue)
                          return Number.isNaN(date.getTime()) ? null : date
                        })()}
                        onChange={(event) => {
                          const dateValue = event.value instanceof Date && !Number.isNaN(event.value.getTime())
                            ? `${event.value.getFullYear()}-${`${event.value.getMonth() + 1}`.padStart(2, '0')}-${`${event.value.getDate()}`.padStart(2, '0')}`
                            : ''
                          onSpecialFieldChange(productKey, field, dateValue)
                        }}
                        dateFormat="yy-mm-dd"
                        showIcon
                        disabled={readOnly}
                      />
                    ) : null}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
})

interface ProductListProps {
  atividade: AtividadeComProdutos | null
  readOnlyPackageView?: boolean
  packageProductKeys?: string[]
}

type SearchFilterValue = string | number | Date | string[] | boolean | null
type FieldOption = {
  label: string
  value: string
  type: AtividadeProdutoColumn['type']
  options: string[] | undefined
  searchable: boolean
  sortable: boolean
}
type ColumnGroupKey = 'produto' | 'mercadologico' | 'datasValores' | 'quantidade' | 'estoque'
type GroupedFieldOptions = {
  label: string
  icon: IconProp
  items: FieldOption[]
}

const COLUMN_GROUPS: Array<{ key: ColumnGroupKey; label: string; icon: IconProp }> = [
  { key: 'produto', label: 'Produto', icon: faTags },
  { key: 'mercadologico', label: 'Mercadologico', icon: faLayerGroup },
  { key: 'datasValores', label: 'Datas e Valores', icon: faCalendarDays },
  { key: 'quantidade', label: 'Quantidade', icon: faScaleBalanced },
  { key: 'estoque', label: 'Estoque', icon: faBoxesStacked },
]

const resolveColumnGroup = (field: string): ColumnGroupKey => {
  const normalizedField = field.toLowerCase()

  if (MARKET_FIELD_KEYS.some((marketField) => marketField === normalizedField)) {
    return 'mercadologico'
  }

  if (
    normalizedField.includes('estoque')
    || normalizedField.includes('ruptura')
    || normalizedField.includes('abastecimento')
  ) {
    return 'estoque'
  }

  if (
    normalizedField.includes('qtd')
    || normalizedField.includes('quantidade')
    || normalizedField.includes('unentrada')
  ) {
    return 'quantidade'
  }

  if (
    normalizedField.includes('data')
    || normalizedField.includes('hora')
    || normalizedField.includes('valor')
    || normalizedField.includes('preco')
    || normalizedField.includes('dias')
  ) {
    return 'datasValores'
  }

  return 'produto'
}

const groupFieldOptions = (options: FieldOption[]): GroupedFieldOptions[] => {
  const optionsByGroup = options.reduce<Record<ColumnGroupKey, FieldOption[]>>((accumulator, option) => {
    const group = resolveColumnGroup(option.value)
    accumulator[group].push(option)
    return accumulator
  }, {
    produto: [],
    mercadologico: [],
    datasValores: [],
    quantidade: [],
    estoque: [],
  })

  return COLUMN_GROUPS
    .map((group) => ({
      label: group.label,
      icon: group.icon,
      items: optionsByGroup[group.key],
    }))
    .filter((group) => group.items.length > 0)
}

const normalizeBooleanValue = (value: unknown): boolean | null => {
  if (typeof value === 'boolean') {
    return value
  }
  if (typeof value === 'number') {
    if (value === 1) {
      return true
    }
    if (value === 0) {
      return false
    }
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (['true', '1', 'sim', 's'].includes(normalized)) {
      return true
    }
    if (['false', '0', 'nao', 'não', 'n'].includes(normalized)) {
      return false
    }
  }
  return null
}

const formatDateForComparison = (value: unknown) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getFullYear()
    const month = `${value.getMonth() + 1}`.padStart(2, '0')
    const day = `${value.getDate()}`.padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  if (typeof value === 'string') {
    return value.slice(0, 10)
  }
  return ''
}

export function ProductList({ atividade, readOnlyPackageView = false, packageProductKeys = [] }: ProductListProps) {
  const NONE_ACTIVITY_OPTION_VALUE = '__none__'
  const [layout, setLayout] = useState<'list' | 'grid'>('grid')
  const [visibleFields, setVisibleFields] = useState<string[]>([])
  const [showControls, setShowControls] = useState(false)
  const [showMarketFilters, setShowMarketFilters] = useState(false)
  const [showBulkControls, setShowBulkControls] = useState(true)
  const [searchField, setSearchField] = useState('produto')
  const [searchValue, setSearchValue] = useState<SearchFilterValue>('')
  const [sortField, setSortField] = useState('produto')
  const [sortDirection, setSortDirection] = useState<1 | -1>(1)
  const [specialFieldValuesByProduct, setSpecialFieldValuesByProduct] = useState<Record<string, Record<string, string | number | null>>>({})
  const [marketFilters, setMarketFilters] = useState<Record<MarketFieldKey, string>>({
    departamento: '',
    setor: '',
    grupo: '',
    familia: '',
  })
  const [selectedActivitiesByProduct, setSelectedActivitiesByProduct] = useState<Record<string, number | null>>({})
  const [selectedProductKeys, setSelectedProductKeys] = useState<string[]>([])
  const [bulkActivityId, setBulkActivityId] = useState<number | typeof NONE_ACTIVITY_OPTION_VALUE | null>(null)
  const [showForwardedProducts, setShowForwardedProducts] = useState(true)
  const [activePage, setActivePage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(DEFAULT_ROWS_PER_PAGE)
  const [isSubmittingEncaminhamentos, setIsSubmittingEncaminhamentos] = useState(false)
  const [locallySyncedProductKeys, setLocallySyncedProductKeys] = useState<Set<string>>(new Set())
  const { enqueueForSync } = useActivitySyncQueue()
  const hasLoadedPreferencesRef = useRef<string | null>(null)
  const saveSelectionsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const toastRef = useRef<Toast | null>(null)
  const stickyHeaderRef = useRef<HTMLDivElement | null>(null)
  const [isStickyHeaderStuck, setIsStickyHeaderStuck] = useState(false)
  const bulkActivityDropdownRef = useRef<Dropdown>(null)
  const visibleFieldsMultiSelectRef = useRef<MultiSelect>(null)
  const searchFieldDropdownRef = useRef<Dropdown>(null)
  const searchSelectDropdownRef = useRef<Dropdown>(null)
  const searchMultipleSelectRef = useRef<MultiSelect>(null)
  const searchBooleanDropdownRef = useRef<Dropdown>(null)
  const sortFieldDropdownRef = useRef<Dropdown>(null)
  const searchDateCalendarRef = useRef<Calendar>(null)
  const marketFilterDropdownRefs = useRef<Partial<Record<MarketFieldKey, Dropdown | null>>>({})

  const packageProductKeysSet = useMemo(() => new Set(packageProductKeys), [packageProductKeys])

  const products = useMemo(() => {
    const baseProducts = atividade?.produtos ?? []
    const packageFilteredProducts = readOnlyPackageView
      ? baseProducts.filter((produto) => packageProductKeysSet.has(getProdutoAtividadeKey(produto)))
      : baseProducts

    if (locallySyncedProductKeys.size === 0) {
      return packageFilteredProducts
    }
    return packageFilteredProducts.filter((produto) => !locallySyncedProductKeys.has(getProdutoAtividadeKey(produto)))
  }, [atividade, locallySyncedProductKeys, packageProductKeysSet, readOnlyPackageView])
  const activityEligibleItems = useMemo(() => atividade?.atividadeselegiveis ?? [], [atividade])
  const backendColumns = useMemo(() => atividade?.columns ?? {}, [atividade])
  const allFieldOptions = useMemo<FieldOption[]>(() => {
    return Object.entries(backendColumns)
      .map((field) => ({
        label: field[1].label ?? field[0],
        value: field[0],
        type: field[1].type,
        options: field[1].options,
        searchable: field[1].searchable,
        sortable: field[1].sortable,
      }))
      .sort((first, second) => first.label.localeCompare(second.label, 'pt-BR'))
  }, [backendColumns])
  const fieldConfigByKey = useMemo(
    () => backendColumns,
    [backendColumns],
  )
  const cardVisibleFields = useMemo(
    () => visibleFields.filter((field) => !ALWAYS_VISIBLE_FIELDS.includes(field)),
    [visibleFields],
  )

  const fieldOptions = useMemo(
    () => allFieldOptions.filter((option) => !ALWAYS_VISIBLE_FIELDS.includes(option.value)),
    [allFieldOptions],
  )

  const searchableFieldOptions = useMemo(
    () => allFieldOptions.filter((option) => option.searchable),
    [allFieldOptions],
  )

  const orderableFieldOptions = useMemo(
    () => allFieldOptions.filter((option) => option.sortable),
    [allFieldOptions],
  )
  const groupedFieldOptions = useMemo(
    () => groupFieldOptions(fieldOptions),
    [fieldOptions],
  )
  const groupedSearchableFieldOptions = useMemo(
    () => groupFieldOptions(searchableFieldOptions),
    [searchableFieldOptions],
  )
  const groupedOrderableFieldOptions = useMemo(
    () => groupFieldOptions(orderableFieldOptions),
    [orderableFieldOptions],
  )
  const searchableFieldMap = useMemo(
    () => searchableFieldOptions.reduce<Record<string, typeof searchableFieldOptions[number]>>((accumulator, option) => {
      accumulator[option.value] = option
      return accumulator
    }, {}),
    [searchableFieldOptions],
  )
  const selectedSearchFieldConfig = fieldConfigByKey[searchField]
  const selectedSearchFieldType = selectedSearchFieldConfig?.type ?? 'input'
  const searchSelectOptions = useMemo(() => {
    if (!searchField) {
      return []
    }
    const config = fieldConfigByKey[searchField]
    if (!config) {
      return []
    }

    if ((config.type === 'select' || config.type === 'multipleSelect') && Array.isArray(config.options) && config.options.length > 0) {
      return config.options.map((option) => ({ label: option, value: option }))
    }

    if (config.type !== 'select' && config.type !== 'multipleSelect') {
      return []
    }

    const values = new Set<string>()
    products.forEach((produto) => {
      const value = String(getProdutoFieldValue(produto, searchField) ?? '').trim()
      if (value) {
        values.add(value)
      }
    })
    return Array.from(values)
      .sort((first, second) => first.localeCompare(second, 'pt-BR', { sensitivity: 'base' }))
      .map((value) => ({ label: value, value }))
  }, [fieldConfigByKey, products, searchField])

  const marketFilterOptions = useMemo(() => {
    return MARKET_FIELD_KEYS.reduce((accumulator, field) => {
      const currentIndex = MARKET_FIELD_INDEX[field]
      const previousFields = MARKET_FIELD_KEYS.slice(0, currentIndex)
      const values = new Set<string>()

      products
        .filter((produto) => {
          return previousFields.every((previousField) => {
            const selectedValue = marketFilters[previousField]

            if (!selectedValue) {
              return true
            }

            const previousValue = produto[previousField]
            return String(previousValue ?? '').trim() === selectedValue
          })
        })
        .forEach((produto) => {
          const rawValue = produto[field]
          const normalizedValue = String(rawValue ?? '').trim()

          if (normalizedValue) {
            values.add(normalizedValue)
          }
        })

      accumulator[field] = Array.from(values)
        .sort((first, second) => first.localeCompare(second, 'pt-BR', { sensitivity: 'base' }))
        .map((value) => ({ label: value, value }))

      return accumulator
    }, {} as Record<MarketFieldKey, { label: string, value: string }[]>)
  }, [marketFilters, products])

  useEffect(() => {
    setMarketFilters((current) => {
      let changed = false
      const next = { ...current }

      MARKET_FIELD_KEYS.forEach((field) => {
        if (!next[field]) {
          return
        }

        const isStillAvailable = marketFilterOptions[field].some((option) => option.value === next[field])
        if (!isStillAvailable) {
          next[field] = ''
          changed = true
        }
      })

      return changed ? next : current
    })
  }, [marketFilterOptions])

  useEffect(() => {
    const availableValues = new Set(fieldOptions.map((option) => option.value))

    setVisibleFields((current) => {
      const filteredCurrent = current.filter((field) => availableValues.has(field) && !ALWAYS_VISIBLE_FIELDS.includes(field))

      if (filteredCurrent.length > 0 || fieldOptions.length === 0) {
        return filteredCurrent
      }

      return fieldOptions.slice(0, 2).map((field) => field.value)
    })
  }, [fieldOptions])

  useEffect(() => {
    setLocallySyncedProductKeys(new Set())
  }, [atividade?.idwfatividade])

  useEffect(() => {
    const initialSelectedActivities = products.reduce<Record<string, number | null>>((accumulator, produto) => {
      accumulator[getProdutoAtividadeKey(produto)] = produto.idwfatividaderealizada
      return accumulator
    }, {})
    const initialSpecialFieldValues = products.reduce<Record<string, Record<string, string | number | null>>>((accumulator, produto) => {
      const productKey = getProdutoAtividadeKey(produto)
      accumulator[productKey] = {
        datavalidade: produto.datavalidade ?? '',
        qtdproduzido: produto.qtdproduzido ?? null,
        qtdestoquecorreta: produto.qtdestoquecorreta ?? null,
      }
      return accumulator
    }, {})

    setSelectedActivitiesByProduct(initialSelectedActivities)
    setSpecialFieldValuesByProduct(initialSpecialFieldValues)
    setSelectedProductKeys([])
    setBulkActivityId(null)
  }, [products])

  useEffect(() => {
    const availableValues = new Set(searchableFieldOptions.map((option) => option.value))
    const defaultField = availableValues.has('produto') ? 'produto' : searchableFieldOptions[0]?.value ?? ''

    setSearchField((current) => {
      const next = availableValues.has(current) ? current : defaultField
      if (next !== current) {
        setSearchValue('')
      }
      return next
    })
  }, [searchableFieldOptions])

  useEffect(() => {
    if (!searchField) {
      setSearchValue('')
      return
    }

    const fieldType = selectedSearchFieldType
    if (fieldType === 'multipleSelect') {
      if (!Array.isArray(searchValue)) {
        setSearchValue([])
      }
      return
    }
    if (fieldType === 'input') {
      if (typeof searchValue !== 'string') {
        setSearchValue('')
      }
      return
    }
    if (fieldType === 'inputNumber') {
      if (typeof searchValue !== 'number' && searchValue !== null) {
        setSearchValue(null)
      }
      return
    }
    if (fieldType === 'date') {
      if (!(searchValue instanceof Date) && searchValue !== null) {
        setSearchValue(null)
      }
      return
    }
    if (fieldType === 'select') {
      if (typeof searchValue !== 'string' && searchValue !== null) {
        setSearchValue(null)
      }
      return
    }
    if (fieldType === 'boolean') {
      if (typeof searchValue !== 'boolean' && searchValue !== null) {
        setSearchValue(null)
      }
    }
  }, [searchField, searchValue, selectedSearchFieldType])

  useEffect(() => {
    const availableValues = new Set(orderableFieldOptions.map((option) => option.value))
    const defaultField = availableValues.has('produto') ? 'produto' : orderableFieldOptions[0]?.value ?? ''

    setSortField((current) => (availableValues.has(current) ? current : defaultField))
  }, [orderableFieldOptions])

  useEffect(() => {
    if (!atividade) {
      hasLoadedPreferencesRef.current = null
      return
    }

    const currentActivityScopeKey = getActivityScopeKey(atividade)
    hasLoadedPreferencesRef.current = null

    let isCancelled = false

    void loadActivityProductListPreferences(currentActivityScopeKey)
      .then((preferences) => {
        if (isCancelled || hasLoadedPreferencesRef.current !== null) {
          return
        }

        const availableFieldValues = new Set(fieldOptions.map((option) => option.value))
        const availableOrderableFieldValues = new Set(orderableFieldOptions.map((option) => option.value))
        const defaultSortField = availableOrderableFieldValues.has('produto')
          ? 'produto'
          : orderableFieldOptions[0]?.value ?? ''

        if (preferences) {
          setLayout(preferences.layout)
          setVisibleFields(
            preferences.visibleFields.filter(
              (field) => availableFieldValues.has(field) && !ALWAYS_VISIBLE_FIELDS.includes(field),
            ),
          )
          setSortDirection(preferences.sortDirection)
          setSortField(
            availableOrderableFieldValues.has(preferences.sortField) ? preferences.sortField : defaultSortField,
          )
          setShowForwardedProducts(preferences.showForwardedProducts ?? true)
        } else {
          setLayout('grid')
          setSortDirection(1)
          setSortField(defaultSortField)
          setShowForwardedProducts(true)
        }

        hasLoadedPreferencesRef.current = currentActivityScopeKey
      })
      .catch((error) => {
        console.warn('[ProductList] Falha ao carregar preferências de visualização da atividade.', error)
        if (!isCancelled && hasLoadedPreferencesRef.current === null) {
          hasLoadedPreferencesRef.current = currentActivityScopeKey
        }
      })

    return () => {
      isCancelled = true
    }
  }, [atividade, fieldOptions, orderableFieldOptions])

  useEffect(() => {
    if (!atividade || hasLoadedPreferencesRef.current !== getActivityScopeKey(atividade)) {
      return
    }

    const preferences: ActivityProductListPreferences = {
      layout,
      visibleFields: visibleFields.filter((field) => !ALWAYS_VISIBLE_FIELDS.includes(field)),
      sortField,
      sortDirection,
      showForwardedProducts,
    }

    void saveActivityProductListPreferences(getActivityScopeKey(atividade), preferences).catch((error) => {
      console.warn('[ProductList] Falha ao persistir preferências de visualização da atividade.', error)
    })
  }, [atividade, layout, sortDirection, sortField, visibleFields, showForwardedProducts])

  const setMarketFilterDropdownRef = useCallback((field: MarketFieldKey, element: Dropdown | null) => {
    marketFilterDropdownRefs.current[field] = element
  }, [])

  useEffect(() => {
    const stickyHeaderElement = stickyHeaderRef.current

    if (!stickyHeaderElement) {
      return
    }

    let animationFrameId: number | null = null

    const closeFloatingPanels = () => {
      visibleFieldsMultiSelectRef.current?.hide()
      searchFieldDropdownRef.current?.hide()
      searchSelectDropdownRef.current?.hide()
      searchMultipleSelectRef.current?.hide()
      searchBooleanDropdownRef.current?.hide()
      sortFieldDropdownRef.current?.hide()
      bulkActivityDropdownRef.current?.hide()
        ; (searchDateCalendarRef.current as unknown as { hideOverlay?: () => void } | null)?.hideOverlay?.()
      MARKET_FIELD_KEYS.forEach((field) => {
        marketFilterDropdownRefs.current[field]?.hide()
      })
    }

    const updateStickyState = () => {
      const { top } = stickyHeaderElement.getBoundingClientRect()
      setIsStickyHeaderStuck(top <= 0)
    }

    const handleScroll = () => {
      if (animationFrameId !== null) {
        return
      }

      animationFrameId = window.requestAnimationFrame(() => {
        animationFrameId = null
        const { top } = stickyHeaderElement.getBoundingClientRect()
        if (top <= 0) {
          closeFloatingPanels()
        }
        updateStickyState()
      })
    }

    updateStickyState()
    window.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('resize', handleScroll)

    return () => {
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId)
      }
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleScroll)
    }
  }, [])

  useEffect(() => {
    if (!atividade) {
      return
    }

    if (saveSelectionsTimeoutRef.current) {
      clearTimeout(saveSelectionsTimeoutRef.current)
    }

    const activityScopeKey = getActivityScopeKey(atividade)
    saveSelectionsTimeoutRef.current = setTimeout(() => {
      void saveActivityProductSelections(activityScopeKey, selectedActivitiesByProduct).catch((error) => {
        console.warn('[ProductList] Falha ao persistir encaminhamentos locais da atividade.', error)
      })
      syncActivitySelectionsInCache(activityScopeKey, selectedActivitiesByProduct)
    }, 200)

    return () => {
      if (saveSelectionsTimeoutRef.current) {
        clearTimeout(saveSelectionsTimeoutRef.current)
        saveSelectionsTimeoutRef.current = null
      }
    }
  }, [atividade, selectedActivitiesByProduct])

  const isForwardedProduct = useCallback((produto: ProdutoAtividade) => {
    const productKey = getProdutoAtividadeKey(produto)
    const selectedValue = selectedActivitiesByProduct[productKey]
    const value = selectedValue ?? produto.idwfatividaderealizada
    return value !== null
  }, [selectedActivitiesByProduct])

  const forwardedProductsCount = useMemo(
    () => products.filter((produto) => isForwardedProduct(produto)).length,
    [isForwardedProduct, products],
  )

  const filteredAndSortedProducts = useMemo(() => {
    const hasSearchValue = (() => {
      if (!searchField) {
        return false
      }
      if (selectedSearchFieldType === 'multipleSelect') {
        return Array.isArray(searchValue) && searchValue.length > 0
      }
      if (selectedSearchFieldType === 'input') {
        return typeof searchValue === 'string' && searchValue.trim() !== ''
      }
      return searchValue !== null && searchValue !== ''
    })()

    const filteredByMarket = products.filter((produto) => {
      return MARKET_FIELD_KEYS.every((field) => {
        const selectedValue = marketFilters[field]

        if (!selectedValue) {
          return true
        }

        const fieldValue = produto[field]
        return String(fieldValue ?? '').trim() === selectedValue
      })
    })

    const filteredBySearch = !searchField || !hasSearchValue
      ? filteredByMarket
      : filteredByMarket.filter((produto) => {
        const fieldValue = getProdutoFieldValue(produto, searchField)
        if (selectedSearchFieldType === 'input') {
          const normalizedSearch = String(searchValue ?? '').trim().toLocaleLowerCase('pt-BR')
          return String(fieldValue ?? '').toLocaleLowerCase('pt-BR').includes(normalizedSearch)
        }
        if (selectedSearchFieldType === 'inputNumber') {
          const target = Number(searchValue)
          if (!Number.isFinite(target)) {
            return true
          }
          return Number(fieldValue) === target
        }
        if (selectedSearchFieldType === 'date') {
          return formatDateForComparison(fieldValue) === formatDateForComparison(searchValue)
        }
        if (selectedSearchFieldType === 'select') {
          return String(fieldValue ?? '').trim() === String(searchValue ?? '').trim()
        }
        if (selectedSearchFieldType === 'multipleSelect') {
          if (!Array.isArray(searchValue)) {
            return true
          }
          return searchValue.includes(String(fieldValue ?? '').trim())
        }
        if (selectedSearchFieldType === 'boolean') {
          const boolSearch = normalizeBooleanValue(searchValue)
          const boolField = normalizeBooleanValue(fieldValue)
          if (boolSearch === null || boolField === null) {
            return false
          }
          return boolField === boolSearch
        }
        return String(fieldValue ?? '').toLocaleLowerCase('pt-BR').includes(String(searchValue ?? '').toLocaleLowerCase('pt-BR'))
      })

    const shouldShowForwardedProducts = readOnlyPackageView || showForwardedProducts
    const filtered = shouldShowForwardedProducts
      ? filteredBySearch
      : filteredBySearch.filter((produto) => !isForwardedProduct(produto))

    if (!sortField) {
      return filtered
    }

    return [...filtered].sort((first, second) => {
      const firstValue = getProdutoFieldValue(first, sortField)
      const secondValue = getProdutoFieldValue(second, sortField)
      return compareFieldValues(fieldConfigByKey[sortField], firstValue, secondValue) * sortDirection
    })
  }, [
    fieldConfigByKey,
    marketFilters,
    products,
    searchField,
    selectedSearchFieldType,
    searchValue,
    readOnlyPackageView,
    showForwardedProducts,
    isForwardedProduct,
    sortDirection,
    sortField,
  ])

  const deferredFilteredAndSortedProducts = useDeferredValue(filteredAndSortedProducts)

  const productPages = useMemo(() => {
    if (deferredFilteredAndSortedProducts.length === 0) {
      return []
    }

    const pages: ProdutoAtividade[][] = []
    for (let index = 0; index < deferredFilteredAndSortedProducts.length; index += rowsPerPage) {
      pages.push(deferredFilteredAndSortedProducts.slice(index, index + rowsPerPage))
    }

    return pages
  }, [deferredFilteredAndSortedProducts, rowsPerPage])

  const currentPageProducts = useMemo(
    () => productPages[activePage] ?? [],
    [activePage, productPages],
  )

  useEffect(() => {
    setActivePage((current) => {
      if (productPages.length === 0) {
        return 0
      }
      return Math.min(current, productPages.length - 1)
    })
  }, [productPages.length])

  const activityOptions = useMemo(
    () => activityEligibleItems.map((atividadeElegivel) => ({
      label: getAtividadeLabel(atividadeElegivel),
      value: atividadeElegivel.idwfatividaderealizada,
    })),
    [activityEligibleItems],
  )

  const hasForwardedSelectedProducts = useMemo(
    () => selectedProductKeys.some((productKey) => {
      const produto = products.find((item) => getProdutoAtividadeKey(item) === productKey)
      if (!produto) {
        return false
      }
      const selectedValue = selectedActivitiesByProduct[productKey] ?? produto.idwfatividaderealizada
      return selectedValue !== null
    }),
    [products, selectedActivitiesByProduct, selectedProductKeys],
  )
  const optionGroupTemplate = useCallback((group: GroupedFieldOptions) => {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
        <FontAwesomeIcon icon={group.icon} />
        <span>{group.label}</span>
      </span>
    )
  }, [])

  const bulkActivityOptions = useMemo(
    () => (
      hasForwardedSelectedProducts
        ? [{ label: 'Nenhum encaminhamento', value: NONE_ACTIVITY_OPTION_VALUE }, ...activityOptions]
        : activityOptions
    ),
    [activityOptions, hasForwardedSelectedProducts],
  )

  const pagedProductKeys = useMemo(
    () => currentPageProducts.map((produto) => getProdutoAtividadeKey(produto)),
    [currentPageProducts],
  )

  const selectedProductKeysSet = useMemo(
    () => new Set(selectedProductKeys),
    [selectedProductKeys],
  )

  const areAllPagedProductsSelected = pagedProductKeys.length > 0
    && pagedProductKeys.every((productKey) => selectedProductKeysSet.has(productKey))

  const toggleProductSelection = useCallback((productKey: string, checked: boolean) => {
    setSelectedProductKeys((current) => {
      if (checked) {
        if (current.includes(productKey)) {
          return current
        }
        return [...current, productKey]
      }

      return current.filter((currentKey) => currentKey !== productKey)
    })
  }, [])

  const togglePageSelection = (checked: boolean) => {
    setSelectedProductKeys((current) => {
      if (checked) {
        const next = new Set(current)
        pagedProductKeys.forEach((productKey) => next.add(productKey))
        return Array.from(next)
      }

      const pageKeysSet = new Set(pagedProductKeys)
      return current.filter((currentKey) => !pageKeysSet.has(currentKey))
    })
  }

  const clearSelectedProducts = () => {
    setSelectedProductKeys([])
  }

  const applyBulkActivityToSelected = () => {
    if (bulkActivityId === null || selectedProductKeys.length === 0) {
      return
    }

    const selectedKeys = [...selectedProductKeys]
    setSelectedActivitiesByProduct((current) => {
      const next = { ...current }
      selectedKeys.forEach((productKey) => {
        next[productKey] = bulkActivityId === NONE_ACTIVITY_OPTION_VALUE ? null : bulkActivityId
      })
      return next
    })

    setSelectedProductKeys((current) => current.filter((productKey) => !selectedKeys.includes(productKey)))

    // setShowBulkControls(false)
    // setTimeout(() => {
    //   setShowBulkControls(true)
    // }, 1)
  }

  const hasEncaminhamentosToSubmit = useMemo(
    () => products.some((produto) => {
      const productKey = getProdutoAtividadeKey(produto)
      const selectedValue = selectedActivitiesByProduct[productKey] ?? produto.idwfatividaderealizada
      return selectedValue !== null
    }),
    [products, selectedActivitiesByProduct],
  )

  const handleSpecialFieldChange = useCallback((productKey: string, field: string, value: string | number | null) => {
    setSpecialFieldValuesByProduct((current) => ({
      ...current,
      [productKey]: {
        ...(current[productKey] ?? {}),
        [field]: value,
      },
    }))
  }, [])

  const handleSubmitEncaminhamentos = useCallback(async () => {
    if (readOnlyPackageView) {
      return
    }

    if (!atividade || isSubmittingEncaminhamentos) {
      return
    }

    const queueItem = createActivitySyncQueueItem({
      atividade,
      source: 'product-list',
      selectedActivitiesByProduct,
      products: products.map((produto) => {
        const productKey = getProdutoAtividadeKey(produto)
        const specialValues = specialFieldValuesByProduct[productKey] ?? {}
        return {
          ...produto,
          datavalidade: typeof specialValues.datavalidade === 'string' ? specialValues.datavalidade : (produto.datavalidade ?? ''),
          qtdproduzido: typeof specialValues.qtdproduzido === 'number' ? specialValues.qtdproduzido : (produto.qtdproduzido ?? null),
          qtdestoquecorreta: typeof specialValues.qtdestoquecorreta === 'number' ? specialValues.qtdestoquecorreta : (produto.qtdestoquecorreta ?? null),
        }
      }),
    })

    if (!queueItem) {
      toastRef.current?.show({
        severity: 'warn',
        summary: 'Nada para enviar',
        detail: 'Selecione pelo menos um encaminhamento antes de enviar.',
      })
      return
    }

    const submittedProductKeys = getQueueItemProductKeys(queueItem)
    const activityScopeKey = getActivityScopeKey(atividade)

    try {
      setIsSubmittingEncaminhamentos(true)
      await enqueueForSync(queueItem)
      removeActivityProductsFromCache(activityScopeKey, submittedProductKeys)
      await removeActivityProductSelections(activityScopeKey)
      setLocallySyncedProductKeys((current) => {
        const next = new Set(current)
        submittedProductKeys.forEach((key) => {
          next.add(key)
        })
        return next
      })
      setSelectedActivitiesByProduct((current) => {
        const next = { ...current }
        submittedProductKeys.forEach((key) => {
          delete next[key]
        })
        return next
      })
      setSelectedProductKeys((current) => current.filter((key) => !submittedProductKeys.has(key)))

      toastRef.current?.show({
        severity: 'success',
        summary: 'Envio enfileirado',
        detail: 'Os encaminhamentos foram adicionados a fila e serao processados em background.',
      })
    } catch (error) {
      console.error('[ProductList] Falha ao enfileirar encaminhamentos.', error)
      const errorMessage = error instanceof Error ? error.message : 'Nao foi possivel enfileirar os encaminhamentos.'
      toastRef.current?.show({
        severity: 'error',
        summary: 'Falha ao enfileirar',
        detail: errorMessage,
        life: 7000,
      })
    } finally {
      setIsSubmittingEncaminhamentos(false)
    }
  }, [atividade, enqueueForSync, isSubmittingEncaminhamentos, products, readOnlyPackageView, selectedActivitiesByProduct, specialFieldValuesByProduct])

  const header = () => (
    <div className="product-list-header">
      <div className="product-list-header-top">
        <div className="product-list-controls">
          <Button
            type="button"
            icon="pi pi-sliders-h"
            text
            rounded
            className={classNames({ 'product-control-toggle-active': showControls })}
            aria-label={showControls ? 'Fechar controles' : 'Abrir controles'}
            onClick={() =>
              setShowControls((current) => {
                const next = !current

                if (next) {
                  setShowMarketFilters(false)
                  setShowBulkControls(false)
                }

                return next
              })
            }
          />
          <Button
            type="button"
            icon={<FontAwesomeIcon icon={faLayerGroup} />}
            text
            rounded
            className={classNames({ 'product-control-toggle-active': showMarketFilters })}
            aria-label={showMarketFilters ? 'Fechar filtros mercadológicos' : 'Abrir filtros mercadológicos'}
            onClick={() =>
              setShowMarketFilters((current) => {
                const next = !current

                if (next) {
                  setShowControls(false)
                  setShowBulkControls(false)
                }

                return next
              })
            }
          />
          {!readOnlyPackageView && (
            <Button
              type="button"
              icon={<FontAwesomeIcon icon={faPersonWalking} />}
              text
              rounded
              className={classNames({ 'product-control-toggle-active': showBulkControls })}
              aria-label={showBulkControls ? 'Fechar ações em lote' : 'Abrir ações em lote'}
              onClick={() =>
                setShowBulkControls((current) => {
                  const next = !current

                  if (next) {
                    setShowControls(false)
                    setShowMarketFilters(false)
                  }

                  return next
                })
              }
            />
          )}
        </div>
        {readOnlyPackageView && (
          <>
            <span className="product-list-view-mode"><FontAwesomeIcon icon={faEye} /> Modo visualização</span>
          </>
        )}
        <DataViewLayoutOptions
          layout={layout}
          onChange={(event) => setLayout(event.value as 'list' | 'grid')}
          listIcon={<FontAwesomeIcon icon={faList} />}
          gridIcon={<FontAwesomeIcon icon={faTableCellsLarge} />}
        />
      </div>
      {showBulkControls && (
        !readOnlyPackageView && (
          <div className="product-list-control-panel">

            <div className="product-display-config">
              <InputSwitch
                inputId="product-show-forwarded"
                className="product-show-forwarded-switch"
                checked={showForwardedProducts}
                onChange={(event: InputSwitchChangeEvent) => setShowForwardedProducts(Boolean(event.value))}
              />
              <label htmlFor="product-show-forwarded">Encaminhados</label>
            </div>
            <div className="product-bulk-selection-row">
              <Checkbox
                inputId="product-select-page"
                checked={areAllPagedProductsSelected}
                onChange={(event: CheckboxChangeEvent) => togglePageSelection(Boolean(event.checked))}
              />
              <label htmlFor="product-select-page">Selecionar página</label>
              <div className="product-bulk-count">
                {selectedProductKeys.length > 0 && (
                  <Button
                    type="button"
                    icon={<FontAwesomeIcon icon={faBroom} />}
                    text
                    rounded
                    aria-label="Limpar selecionados"
                    onClick={clearSelectedProducts}
                  />
                )}
                <span >{selectedProductKeys.length} selecionado(s)</span>
              </div>
            </div>
            <div className="product-bulk-actions-row">
              <Dropdown
                ref={bulkActivityDropdownRef}
                inputId="product-bulk-activity"
                value={bulkActivityId}
                onChange={(event: DropdownChangeEvent) => {
                  const value = event.value
                  if (value === NONE_ACTIVITY_OPTION_VALUE) {
                    setBulkActivityId(NONE_ACTIVITY_OPTION_VALUE)
                    return
                  }
                  setBulkActivityId(toDropdownActivityId(value))
                }}
                options={bulkActivityOptions}
                optionLabel="label"
                optionValue="value"
                placeholder={activityOptions.length > 0 ? 'Selecionar atividade para os marcados' : 'Sem atividades disponíveis'}
                className="product-bulk-dropdown"
                disabled={bulkActivityOptions.length === 0}
                showClear
              />
              <Button
                type="button"
                label="Aplicar aos selecionados"
                onClick={applyBulkActivityToSelected}
                disabled={selectedProductKeys.length === 0 || bulkActivityId === null}
              />
            </div>
          </div>
        )
      )}
      {showControls && (
        <div className="product-list-control-panel">
          <div className="product-field-select">
            <span className="product-control-label">Campos visíveis</span>
            <MultiSelect
              ref={visibleFieldsMultiSelectRef}
              inputId="product-visible-fields"
              value={visibleFields}
              onChange={(event: MultiSelectChangeEvent) => setVisibleFields(event.value as string[])}
              options={groupedFieldOptions}
              optionLabel="label"
              optionValue="value"
              optionGroupLabel="label"
              optionGroupChildren="items"
              optionGroupTemplate={optionGroupTemplate}
              filter
              maxSelectedLabels={2}
              selectedItemsLabel="{0} selecionados"
            />
          </div>
          <div className="product-search-row">
            <span className="product-control-label">Buscar em</span>
            <Dropdown
              ref={searchFieldDropdownRef}
              inputId="product-search-field"
              filter
              value={searchField}
              onChange={(event: DropdownChangeEvent) => setSearchField(event.value as string)}
              options={groupedSearchableFieldOptions}
              optionLabel="label"
              optionValue="value"
              optionGroupLabel="label"
              optionGroupChildren="items"
              optionGroupTemplate={optionGroupTemplate}
              className="product-search-column"
              placeholder="Selecione a coluna"
            />
            {selectedSearchFieldType === 'input' && (
              <InputText
                value={typeof searchValue === 'string' ? searchValue : ''}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder="Digite para buscar..."
                className="product-search-input"
              />
            )}
            {selectedSearchFieldType === 'inputNumber' && (
              <InputNumber
                value={typeof searchValue === 'number' ? searchValue : null}
                onValueChange={(event: InputNumberValueChangeEvent) => setSearchValue(event.value ?? null)}
                placeholder="Digite um número..."
                className="product-search-input"
                useGrouping={false}
              />
            )}
            {selectedSearchFieldType === 'date' && (
              <Calendar
                ref={searchDateCalendarRef}
                value={searchValue instanceof Date ? searchValue : null}
                onChange={(event) => setSearchValue(event.value instanceof Date ? event.value : null)}
                dateFormat="yy-mm-dd"
                placeholder="Selecione a data"
                className="product-search-input"
                showIcon
              />
            )}
            {selectedSearchFieldType === 'select' && (
              <Dropdown
                ref={searchSelectDropdownRef}
                value={typeof searchValue === 'string' ? searchValue : null}
                onChange={(event: DropdownChangeEvent) => setSearchValue((event.value as string | null) ?? null)}
                options={searchSelectOptions}
                optionLabel="label"
                optionValue="value"
                placeholder={`Selecione ${searchableFieldMap[searchField]?.label ?? 'um valor'}`}
                className="product-search-input"
                showClear
                filter
              />
            )}
            {selectedSearchFieldType === 'multipleSelect' && (
              <MultiSelect
                ref={searchMultipleSelectRef}
                value={Array.isArray(searchValue) ? searchValue : []}
                onChange={(event: MultiSelectChangeEvent) => setSearchValue((event.value as string[]) ?? [])}
                options={searchSelectOptions}
                optionLabel="label"
                optionValue="value"
                placeholder={`Selecione ${searchableFieldMap[searchField]?.label ?? 'os valores'}`}
                className="product-search-input"
                filter
                display="chip"
              />
            )}
            {selectedSearchFieldType === 'boolean' && (
              <Dropdown
                ref={searchBooleanDropdownRef}
                value={typeof searchValue === 'boolean' ? searchValue : null}
                onChange={(event: DropdownChangeEvent) => setSearchValue((event.value as boolean | null) ?? null)}
                options={[
                  { label: 'Sim', value: true },
                  { label: 'Não', value: false },
                ]}
                optionLabel="label"
                optionValue="value"
                placeholder="Selecione"
                className="product-search-input"
                showClear
              />
            )}
          </div>
          <div className="product-sort-row">
            <span className="product-control-label">Ordenar por</span>
            <Dropdown
              ref={sortFieldDropdownRef}
              inputId="product-sort-field"
              filter
              value={sortField}
              onChange={(event: DropdownChangeEvent) => setSortField(event.value as string)}
              options={groupedOrderableFieldOptions}
              optionLabel="label"
              optionValue="value"
              optionGroupLabel="label"
              optionGroupChildren="items"
              optionGroupTemplate={optionGroupTemplate}
              className="product-sort-column"
              placeholder="Selecione a coluna"
            />
            <Button
              type="button"
              icon={sortDirection === 1 ? 'pi pi-sort-alpha-down' : 'pi pi-sort-alpha-up'}
              label={sortDirection === 1 ? 'Crescente' : 'Decrescente'}
              outlined
              onClick={() => setSortDirection((current) => (current === 1 ? -1 : 1))}
            />
          </div>
        </div>
      )}
      {showMarketFilters && (
        <div className="product-list-control-panel">
          <div className="product-sort-row product-market-filters">
            <span className="product-control-label">Filtros mercadológicos</span>
            {MARKET_FIELD_KEYS.map((field) => (
              <Dropdown
                key={field}
                ref={(element) => {
                  setMarketFilterDropdownRef(field, element)
                }}
                inputId={`product-market-${field}`}
                filter
                showClear
                value={marketFilters[field]}
                onChange={(event: DropdownChangeEvent) =>
                  setMarketFilters((current) => {
                    const nextValue = (event.value as string | null) ?? ''
                    const currentIndex = MARKET_FIELD_INDEX[field]
                    const next = { ...current, [field]: nextValue }

                    MARKET_FIELD_KEYS.slice(currentIndex + 1).forEach((dependentField) => {
                      next[dependentField] = ''
                    })

                    return next
                  })
                }
                options={marketFilterOptions[field]}
                optionLabel="label"
                optionValue="value"
                className="product-sort-column"
                placeholder={MARKET_FIELD_LABELS[field]}
                disabled={MARKET_FIELD_INDEX[field] > 0 && !marketFilters[MARKET_FIELD_KEYS[MARKET_FIELD_INDEX[field] - 1]]}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )

  const renderProductList = useCallback((
    items: ProdutoAtividade[],
    currentLayout: 'list' | 'grid' = 'list',
  ) => (
    <div
      className={classNames('product-list', {
        'product-list-grid': currentLayout === 'grid',
      })}
    >
      {items.map((produto, index) => {
        const productKey = getProdutoAtividadeKey(produto)
        return (
          <ProductCardItem
            key={productKey}
            produto={produto}
            layout={currentLayout}
            index={index}
            isSelected={selectedProductKeysSet.has(productKey)}
            isForwarded={isForwardedProduct(produto)}
            selectedActivity={selectedActivitiesByProduct[productKey] ?? produto.idwfatividaderealizada ?? null}
            activityOptions={activityOptions}
            visibleFields={cardVisibleFields}
            fieldConfigByKey={fieldConfigByKey}
            specialFieldValues={specialFieldValuesByProduct[productKey] ?? {}}
            onSpecialFieldChange={handleSpecialFieldChange}
            onToggleSelect={toggleProductSelection}
            readOnly={readOnlyPackageView}
          />
        )
      })}
    </div>
  ), [
    activityOptions,
    selectedActivitiesByProduct,
    specialFieldValuesByProduct,
    selectedProductKeysSet,
    isForwardedProduct,
    toggleProductSelection,
    handleSpecialFieldChange,
    cardVisibleFields,
    fieldConfigByKey,
  ])

  const carouselItemTemplate = useCallback(
    (items: ProdutoAtividade[]) => renderProductList(items, layout),
    [layout, renderProductList],
  )

  return (
    <section className="panel product-panel">
      <Toast ref={toastRef} position="top-right" />
      {!atividade
        ? (
          <>
            <h2>Produtos da atividade</h2>
            <Message
              severity="info"
              text="Selecione uma atividade para carregar os produtos correspondentes."
            />
          </>
        )
        : (
          <>
            <span className="product-panel-subtitle"><FontAwesomeIcon icon={faBuilding} />{atividade.empresa} | {atividade.wfprocesso}</span>
            <h2 className="product-panel-title"><FontAwesomeIcon icon={faPersonWalking} />{atividade.wfatividade}</h2>
            {!readOnlyPackageView && (
              <div className="product-panel-submit-row">
                <WorkflowProgressBar
                  completed={forwardedProductsCount}
                  total={products.length}
                  itemLabel="produtos encaminhados"
                  className="product-progress-overview"
                >
                  <Button
                    type="button"
                    label="Enviar"
                    icon="pi pi-send"
                    className="app-btn primary"
                    onClick={() => {
                      void handleSubmitEncaminhamentos()
                    }}
                    loading={isSubmittingEncaminhamentos}
                    disabled={!hasEncaminhamentosToSubmit}
                  />
                </WorkflowProgressBar>
              </div>
            )}
            <div
              className={classNames(
                'p-dataview p-component product-dataview product-dataview-sticky',
                { 'is-stuck': isStickyHeaderStuck },
              )}
            >
              <div className="p-dataview-header" ref={stickyHeaderRef}>
                {header()}
              </div>
              <div className="p-dataview-content">
                {productPages.length > 0
                  ? (
                    <>
                      <div className="product-carousel-page-controls">
                        <span>
                          ({filteredAndSortedProducts.length}) Página {productPages.length === 0 ? 0 : activePage + 1} de {Math.max(productPages.length, 1)}
                        </span>
                        <Dropdown
                          value={rowsPerPage}
                          onChange={(event: DropdownChangeEvent) => {
                            const nextRows = Number(event.value)
                            const currentFirstItem = activePage * rowsPerPage
                            const nextPage = Math.floor(currentFirstItem / nextRows)
                            setRowsPerPage(nextRows)
                            setActivePage(nextPage)
                          }}
                          options={[4, 6, 8, 12].map((value) => ({ label: `${value}`, value }))}
                          optionLabel="label"
                          optionValue="value"
                          className="product-rows-dropdown"
                        />
                      </div>
                      <Carousel
                        value={productPages}
                        page={activePage}
                        numVisible={1}
                        numScroll={1}
                        circular={false}
                        showIndicators={productPages.length > 1}
                        showNavigators={productPages.length > 1}
                        onPageChange={(event) => setActivePage(event.page)}
                        itemTemplate={carouselItemTemplate}
                        className="product-pages-carousel"
                      />
                    </>
                  )
                  : (
                    <div className="p-dataview-emptymessage">
                      Nenhum produto encontrado com os filtros atuais.
                    </div>
                  )}
              </div>
            </div>
          </>
        )}
    </section>
  )
}
