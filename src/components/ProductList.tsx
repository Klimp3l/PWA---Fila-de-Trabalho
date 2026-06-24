import { memo, type MouseEvent, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from 'primereact/button'
import { Card } from 'primereact/card'
import { Carousel } from 'primereact/carousel'
import { Calendar } from 'primereact/calendar'
import { Dropdown, type DropdownChangeEvent } from 'primereact/dropdown'
import { InputNumber, type InputNumberValueChangeEvent } from 'primereact/inputnumber'
import { InputText } from 'primereact/inputtext'
import { Message } from 'primereact/message'
import { MultiSelect } from 'primereact/multiselect'
import { Toast } from 'primereact/toast'
import { classNames } from 'primereact/utils'
import type { IconProp } from '@fortawesome/fontawesome-svg-core'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faBoxesStacked,
  faBuilding,
  faCalendarDays,
  faLayerGroup,
  faPersonWalking,
  faScaleBalanced,
  faTags,
} from '@fortawesome/free-solid-svg-icons'
import type {
  AtividadeComProdutos,
  AtividadeProdutoColumn,
  ProdutoAtividade,
} from '../types/workflow'
import { WorkflowProgressBar } from './WorkflowProgressBar'
import { exportProductsToExcel } from '../services/exportProductsToExcel'
import { useStickyHeader } from '../hooks/useStickyHeader'
import {
  useActivityProductListPreferences,
  useActivitySelectionsPersistence,
} from '../hooks/useActivityProductPersistence'
import {
  getActivityScopeKey,
  getProdutoAtividadeKey,
  removeActivityProductSelections,
} from '../services/activityData'
import {
  CARD_INTERACTIVE_SELECTOR,
  DEFAULT_PRODUCT_IMAGE,
  DEFAULT_ROWS_PER_PAGE,
  ALWAYS_VISIBLE_FIELDS,
  MARKET_FIELD_INDEX,
  MARKET_FIELD_KEYS,
  type MarketFieldKey,
} from './product-list/config'
import {
  compareFieldValues,
  formatFieldValue,
  getAtividadeLabel,
  getEffectiveActivityId,
  getProdutoFieldValue,
  normalizeBooleanValue,
  resolveProductImage,
} from './product-list/utils'
import {
  NONE_ACTIVITY_OPTION_VALUE,
  type ColumnGroupKey,
  type FieldOption,
  type GroupedFieldOptions,
  type SearchFilterValue,
} from './product-list/types'
import { ProductListHeader } from './product-list/ProductListHeader'
import {
  removeActivityProductsFromCache,
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
  showProductImage: boolean
  fieldConfigByKey: Record<string, AtividadeProdutoColumn>
  specialFieldValues: Record<string, string | number | boolean | null>
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
  showProductImage,
  fieldConfigByKey,
  specialFieldValues,
  onSpecialFieldChange,
  onToggleSelect,
  readOnly,
}: ProductCardItemProps) {
  const productKey = getProdutoAtividadeKey(produto)
  const selectedActivityLabel = selectedActivity === null
    ? '-'
    : (activityOptions.find((option) => option.value === selectedActivity)?.label ?? `Atividade ${selectedActivity}`)

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
          {layout === 'list' && selectedActivity !== null && (
            <p>
              <FontAwesomeIcon icon={faPersonWalking} />
              {selectedActivityLabel}
            </p>
          )}
          <div
            className={classNames('product-card-main', {
              'product-card-main-list': layout === 'list',
              'product-card-main-grid': layout === 'grid',
              'product-card-main-list-no-image': layout === 'list' && !showProductImage,
              'product-card-main-grid-no-image': layout === 'grid' && !showProductImage,
            })}
          >
            {layout === 'grid' && selectedActivity !== null && (
              <p>
                <FontAwesomeIcon icon={faPersonWalking} />
                {selectedActivityLabel}
              </p>
            )}
            {showProductImage && (
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
            )}
            <div
              className={classNames('product-details', {
                'product-details-no-image': !showProductImage,
              })}
            >
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
  packageSelectedActivitiesByProduct?: Record<string, number | null>
}

const PRODUCT_IMAGE_FIELD_KEY = 'urlImagem'

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

export function ProductList({
  atividade,
  readOnlyPackageView = false,
  packageProductKeys = [],
  packageSelectedActivitiesByProduct = {},
}: ProductListProps) {
  const [layout, setLayout] = useState<'list' | 'grid'>('grid')
  const [visibleFields, setVisibleFields] = useState<string[]>([])
  const [showControls, setShowControls] = useState(false)
  const [showMarketFilters, setShowMarketFilters] = useState(false)
  const [showBulkControls, setShowBulkControls] = useState(true)
  const [showExportControls, setShowExportControls] = useState(false)
  const [searchField, setSearchField] = useState('produto')
  const [searchValue, setSearchValue] = useState<SearchFilterValue>('')
  const [sortField, setSortField] = useState('produto')
  const [sortDirection, setSortDirection] = useState<1 | -1>(1)
  const [specialFieldValuesByProduct, setSpecialFieldValuesByProduct] = useState<Record<string, Record<string, string | number | boolean | null>>>({})
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
  const toastRef = useRef<Toast | null>(null)
  const stickyHeaderRef = useRef<HTMLDivElement | null>(null)
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
  const defaultBulkActivityId = useMemo<number | null>(
    () => (activityEligibleItems.length === 1 ? activityEligibleItems[0].idwfatividaderealizada : null),
    [activityEligibleItems],
  )
  const backendColumns = useMemo(() => atividade?.columns ?? {}, [atividade])
  const allFieldOptions = useMemo<FieldOption[]>(() => {
    const backendOptions = Object.entries(backendColumns)
      .map(([key, config]) => ({
        label: config.label ?? key,
        value: key,
        type: config.type,
        options: config.options,
        searchable: config.searchable,
        sortable: config.sortable,
      }))

    const hasImageField = backendOptions.some((option) => option.value === PRODUCT_IMAGE_FIELD_KEY)
    const imageFieldOption: FieldOption = {
      label: 'Imagem do produto',
      value: PRODUCT_IMAGE_FIELD_KEY,
      type: 'input',
      options: undefined,
      searchable: false,
      sortable: false,
    }

    return (hasImageField ? backendOptions : [...backendOptions, imageFieldOption])
      .sort((first, second) => first.label.localeCompare(second.label, 'pt-BR'))
  }, [backendColumns])
  const fieldConfigByKey = useMemo(
    () => backendColumns,
    [backendColumns],
  )
  const cardVisibleFields = useMemo(
    () => visibleFields.filter((field) => !ALWAYS_VISIBLE_FIELDS.includes(field) && field !== PRODUCT_IMAGE_FIELD_KEY),
    [visibleFields],
  )
  const showProductImage = useMemo(
    () => visibleFields.includes(PRODUCT_IMAGE_FIELD_KEY),
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
    const defaultVisibleFieldOptions = fieldOptions.filter((option) => option.value !== PRODUCT_IMAGE_FIELD_KEY)

    setVisibleFields((current) => {
      const filteredCurrent = current.filter((field) => availableValues.has(field) && !ALWAYS_VISIBLE_FIELDS.includes(field))

      if (filteredCurrent.length > 0 || fieldOptions.length === 0) {
        return filteredCurrent
      }

      return defaultVisibleFieldOptions.slice(0, 2).map((field) => field.value)
    })
  }, [fieldOptions])

  useEffect(() => {
    setLocallySyncedProductKeys(new Set())
  }, [atividade?.idwfatividade])

  useEffect(() => {
    const initialSelectedActivities = products.reduce<Record<string, number | null>>((accumulator, produto) => {
      const productKey = getProdutoAtividadeKey(produto)
      const hasPackageSelection = Object.prototype.hasOwnProperty.call(packageSelectedActivitiesByProduct, productKey)
      accumulator[productKey] = hasPackageSelection
        ? (packageSelectedActivitiesByProduct[productKey] ?? null)
        : produto.idwfatividaderealizada
      return accumulator
    }, {})
    const initialSpecialFieldValues = products.reduce<Record<string, Record<string, string | number | boolean | null>>>((accumulator, produto) => {
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
    setBulkActivityId(defaultBulkActivityId)
  }, [defaultBulkActivityId, packageSelectedActivitiesByProduct, products])

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

  useActivityProductListPreferences({
    atividade,
    fieldOptions,
    orderableFieldOptions,
    layout,
    visibleFields,
    sortField,
    sortDirection,
    showForwardedProducts,
    setLayout,
    setVisibleFields,
    setSortField,
    setSortDirection,
    setShowForwardedProducts,
  })

  const setMarketFilterDropdownRef = useCallback((field: MarketFieldKey, element: Dropdown | null) => {
    marketFilterDropdownRefs.current[field] = element
  }, [])

  const closeFloatingPanels = useCallback(() => {
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
  }, [])

  const isStickyHeaderStuck = useStickyHeader(stickyHeaderRef, closeFloatingPanels)

  useActivitySelectionsPersistence(atividade, selectedActivitiesByProduct)

  const isForwardedProduct = useCallback((produto: ProdutoAtividade) => {
    return getEffectiveActivityId(produto, selectedActivitiesByProduct) !== null
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
  const exportableFieldKeys = useMemo(
    () => Array.from(new Set([...ALWAYS_VISIBLE_FIELDS, ...visibleFields])),
    [visibleFields],
  )

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
      return getEffectiveActivityId(produto, selectedActivitiesByProduct) !== null
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

  const handleExportFilteredProductsToExcel = useCallback(() => {
    if (filteredAndSortedProducts.length === 0) {
      toastRef.current?.show({
        severity: 'warn',
        summary: 'Nada para exportar',
        detail: 'Nao ha produtos filtrados para exportar.',
      })
      return
    }

    try {
      exportProductsToExcel({
        products: filteredAndSortedProducts,
        exportableFieldKeys,
        fieldConfigByKey,
        specialFieldValuesByProduct,
        activityLabel: atividade?.wfatividade ?? 'atividade',
      })
    } catch (error) {
      console.error('[ProductList] Falha ao exportar produtos para Excel.', error)
      toastRef.current?.show({
        severity: 'error',
        summary: 'Falha na exportacao',
        detail: 'Nao foi possivel gerar o arquivo Excel dos produtos filtrados.',
        life: 7000,
      })
    }
  }, [atividade, exportableFieldKeys, fieldConfigByKey, filteredAndSortedProducts, specialFieldValuesByProduct])

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
  }

  const hasEncaminhamentosToSubmit = useMemo(
    () => products.some((produto) => getEffectiveActivityId(produto, selectedActivitiesByProduct) !== null),
    [products, selectedActivitiesByProduct],
  )

  const handleSpecialFieldChange = useCallback((productKey: string, field: string, value: string | number | boolean | null) => {
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
            selectedActivity={getEffectiveActivityId(produto, selectedActivitiesByProduct)}
            activityOptions={activityOptions}
            visibleFields={cardVisibleFields}
            showProductImage={showProductImage}
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
    showProductImage,
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
                <ProductListHeader
                  readOnlyPackageView={readOnlyPackageView}
                  showControls={showControls}
                  setShowControls={setShowControls}
                  showMarketFilters={showMarketFilters}
                  setShowMarketFilters={setShowMarketFilters}
                  showBulkControls={showBulkControls}
                  setShowBulkControls={setShowBulkControls}
                  showExportControls={showExportControls}
                  setShowExportControls={setShowExportControls}
                  layout={layout}
                  setLayout={setLayout}
                  showForwardedProducts={showForwardedProducts}
                  setShowForwardedProducts={setShowForwardedProducts}
                  areAllPagedProductsSelected={areAllPagedProductsSelected}
                  togglePageSelection={togglePageSelection}
                  selectedProductKeys={selectedProductKeys}
                  clearSelectedProducts={clearSelectedProducts}
                  bulkActivityId={bulkActivityId}
                  setBulkActivityId={setBulkActivityId}
                  bulkActivityOptions={bulkActivityOptions}
                  activityOptions={activityOptions}
                  applyBulkActivityToSelected={applyBulkActivityToSelected}
                  onExportToExcel={handleExportFilteredProductsToExcel}
                  canExport={filteredAndSortedProducts.length > 0}
                  visibleFields={visibleFields}
                  setVisibleFields={setVisibleFields}
                  groupedFieldOptions={groupedFieldOptions}
                  optionGroupTemplate={optionGroupTemplate}
                  searchField={searchField}
                  setSearchField={setSearchField}
                  groupedSearchableFieldOptions={groupedSearchableFieldOptions}
                  selectedSearchFieldType={selectedSearchFieldType}
                  searchValue={searchValue}
                  setSearchValue={setSearchValue}
                  searchSelectOptions={searchSelectOptions}
                  searchableFieldMap={searchableFieldMap}
                  sortField={sortField}
                  setSortField={setSortField}
                  groupedOrderableFieldOptions={groupedOrderableFieldOptions}
                  sortDirection={sortDirection}
                  setSortDirection={setSortDirection}
                  marketFilters={marketFilters}
                  setMarketFilters={setMarketFilters}
                  marketFilterOptions={marketFilterOptions}
                  setMarketFilterDropdownRef={setMarketFilterDropdownRef}
                  bulkActivityDropdownRef={bulkActivityDropdownRef}
                  visibleFieldsMultiSelectRef={visibleFieldsMultiSelectRef}
                  searchFieldDropdownRef={searchFieldDropdownRef}
                  searchSelectDropdownRef={searchSelectDropdownRef}
                  searchMultipleSelectRef={searchMultipleSelectRef}
                  searchBooleanDropdownRef={searchBooleanDropdownRef}
                  sortFieldDropdownRef={sortFieldDropdownRef}
                  searchDateCalendarRef={searchDateCalendarRef}
                />
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
