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
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faBroom,
  faBuilding,
  faLayerGroup,
  faList,
  faPersonWalking,
  faTableCellsLarge,
} from '@fortawesome/free-solid-svg-icons'
import type {
  AtividadeComProdutos,
  AtividadeProdutoColumn,
  ProdutoAtividade,
} from '../types/workflow'
import { WorkflowProgressBar } from './WorkflowProgressBar'
import {
  getProdutoAtividadeKey,
  loadActivityProductListPreferences,
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
import { syncActivitySelectionsInCache } from '../hooks/useAtividadesWithOnlineRefresh'
import { updateEncaminhamentos } from '../services/api'

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
  onToggleSelect: (productKey: string, checked: boolean) => void
  onActivityChange: (productKey: string, activityId: number | null) => void
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
  onToggleSelect,
  onActivityChange,
}: ProductCardItemProps) {
  const productKey = getProdutoAtividadeKey(produto)

  const handleCardClick = (event: MouseEvent<HTMLElement>) => {
    const clickTarget = event.target as HTMLElement | null

    if (clickTarget?.closest(CARD_INTERACTIVE_SELECTOR)) {
      return
    }

    onToggleSelect(productKey, !isSelected)
  }

  const activitySelector = (
    <div
      className={classNames('product-card-activity', {
        'product-card-activity-list': layout === 'list',
        'product-card-activity-grid': layout === 'grid',
      })}
      onClick={(event) => event.stopPropagation()}
    >
      <label htmlFor={`product-activity-${productKey}`}>
        <FontAwesomeIcon icon={faPersonWalking} />
        Atividade realizada
      </label>
      <Dropdown
        inputId={`product-activity-${productKey}`}
        value={selectedActivity}
        onChange={(event: DropdownChangeEvent) => {
          onActivityChange(productKey, toDropdownActivityId(event.value))
        }}
        options={activityOptions}
        optionLabel="label"
        optionValue="value"
        placeholder={activityOptions.length > 0 ? 'Selecionar atividade' : 'Sem atividades disponíveis'}
        className="product-card-activity-dropdown"
        disabled={activityOptions.length === 0}
        showClear
      />
    </div>
  )

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
          'product-card-selected': isSelected,
          'product-card-forwarded': isForwarded && !isSelected,
        })}
        onClick={handleCardClick}
      >
        <div
          className={classNames('product-card-content', {
            'product-card-content-list': layout === 'list',
            'product-card-content-grid': layout === 'grid',
          })}
        >
          {layout === 'list' && activitySelector}
          <div
            className={classNames('product-card-main', {
              'product-card-main-list': layout === 'list',
              'product-card-main-grid': layout === 'grid',
            })}
          >
            {layout === 'grid' && activitySelector}
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
                    {formatFieldValue(fieldConfigByKey[field], getProdutoFieldValue(produto, field))}
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
}

type SearchFilterValue = string | number | Date | string[] | boolean | null

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

export function ProductList({ atividade }: ProductListProps) {
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
  const hasLoadedPreferencesRef = useRef<number | null>(null)
  const saveSelectionsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const toastRef = useRef<Toast | null>(null)

  const products = useMemo(() => atividade?.produtos ?? [], [atividade])
  const activityEligibleItems = useMemo(() => atividade?.atividadeselegiveis ?? [], [atividade])
  const backendColumns = useMemo(() => atividade?.columns ?? {}, [atividade])
  const allFieldOptions = useMemo(() => {
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
    const initialSelectedActivities = products.reduce<Record<string, number | null>>((accumulator, produto) => {
      accumulator[getProdutoAtividadeKey(produto)] = produto.idwfatividaderealizada
      return accumulator
    }, {})

    setSelectedActivitiesByProduct(initialSelectedActivities)
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

    const currentActivityId = atividade.idwfatividade
    hasLoadedPreferencesRef.current = null

    let isCancelled = false

    void loadActivityProductListPreferences(currentActivityId)
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
        } else {
          setLayout('grid')
          setSortDirection(1)
          setSortField(defaultSortField)
        }

        hasLoadedPreferencesRef.current = currentActivityId
      })
      .catch((error) => {
        console.warn('[ProductList] Falha ao carregar preferências de visualização da atividade.', error)
        if (!isCancelled && hasLoadedPreferencesRef.current === null) {
          hasLoadedPreferencesRef.current = currentActivityId
        }
      })

    return () => {
      isCancelled = true
    }
  }, [atividade, fieldOptions, orderableFieldOptions])

  useEffect(() => {
    if (!atividade || hasLoadedPreferencesRef.current !== atividade.idwfatividade) {
      return
    }

    const preferences: ActivityProductListPreferences = {
      layout,
      visibleFields: visibleFields.filter((field) => !ALWAYS_VISIBLE_FIELDS.includes(field)),
      sortField,
      sortDirection,
    }

    void saveActivityProductListPreferences(atividade.idwfatividade, preferences).catch((error) => {
      console.warn('[ProductList] Falha ao persistir preferências de visualização da atividade.', error)
    })
  }, [atividade, layout, sortDirection, sortField, visibleFields])

  useEffect(() => {
    if (!atividade) {
      return
    }

    if (saveSelectionsTimeoutRef.current) {
      clearTimeout(saveSelectionsTimeoutRef.current)
    }

    const activityId = atividade.idwfatividade
    saveSelectionsTimeoutRef.current = setTimeout(() => {
      void saveActivityProductSelections(activityId, selectedActivitiesByProduct).catch((error) => {
        console.warn('[ProductList] Falha ao persistir encaminhamentos locais da atividade.', error)
      })
      syncActivitySelectionsInCache(activityId, selectedActivitiesByProduct)
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

    const filtered = showForwardedProducts
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

  const filteredProductKeys = useMemo(
    () => deferredFilteredAndSortedProducts.map((produto) => getProdutoAtividadeKey(produto)),
    [deferredFilteredAndSortedProducts],
  )

  const selectedProductKeysSet = useMemo(
    () => new Set(selectedProductKeys),
    [selectedProductKeys],
  )

  const areAllPagedProductsSelected = pagedProductKeys.length > 0
    && pagedProductKeys.every((productKey) => selectedProductKeysSet.has(productKey))

  const areAllFilteredProductsSelected = filteredProductKeys.length > 0
    && filteredProductKeys.every((productKey) => selectedProductKeysSet.has(productKey))

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

  const changeProductActivity = useCallback((productKey: string, activityId: number | null) => {
    setSelectedActivitiesByProduct((current) => ({
      ...current,
      [productKey]: activityId,
    }))
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

  const toggleAllSelection = (checked: boolean) => {
    setSelectedProductKeys((current) => {
      if (checked) {
        const next = new Set(current)
        filteredProductKeys.forEach((productKey) => next.add(productKey))
        return Array.from(next)
      }

      const filteredKeysSet = new Set(filteredProductKeys)
      return current.filter((currentKey) => !filteredKeysSet.has(currentKey))
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

  const handleSubmitEncaminhamentos = useCallback(async () => {
    if (!atividade || isSubmittingEncaminhamentos) {
      return
    }

    const encaminhamentos = products
      .map((produto) => {
        const productKey = getProdutoAtividadeKey(produto)
        const selectedValue = selectedActivitiesByProduct[productKey] ?? produto.idwfatividaderealizada

        if (selectedValue === null) {
          return null
        }

        return {
          idwfocorrencia: produto.idwfocorrencia,
          idwfatividadeencaminhamento: selectedValue,
          observacao: produto.observacao ?? '',
          idwffilatrabalho: produto.idwffilatrabalho,
        }
      })
      .filter((value): value is {
        idwfocorrencia: number
        idwfatividadeencaminhamento: number
        observacao: string
        idwffilatrabalho: number
      } => value !== null)

    if (encaminhamentos.length === 0) {
      toastRef.current?.show({
        severity: 'warn',
        summary: 'Nada para enviar',
        detail: 'Selecione pelo menos um encaminhamento antes de enviar.',
      })
      return
    }

    const idwfprocesso = atividade.idwfprocesso

    try {
      setIsSubmittingEncaminhamentos(true)
      const response = await updateEncaminhamentos({
        idwfprocesso,
        encaminhamentos,
      })

      const responseText = typeof response === 'string' ? response : JSON.stringify(response ?? '')
      const hasError = responseText.toLowerCase().includes('erro')

      if (hasError) {
        toastRef.current?.show({
          severity: 'error',
          summary: 'Falha ao enviar',
          detail: responseText || 'O servidor retornou erro ao enviar os encaminhamentos.',
          life: 7000,
        })
        return
      }

      toastRef.current?.show({
        severity: 'success',
        summary: 'Enviado com sucesso',
        detail: 'Os encaminhamentos da atividade foram enviados.',
      })
    } catch (error) {
      console.error('[ProductList] Falha ao enviar encaminhamentos.', error)
      toastRef.current?.show({
        severity: 'error',
        summary: 'Falha ao enviar',
        detail: error instanceof Error ? error.message : 'Não foi possível enviar os encaminhamentos.',
        life: 7000,
      })
    } finally {
      setIsSubmittingEncaminhamentos(false)
    }
  }, [atividade, isSubmittingEncaminhamentos, products, selectedActivitiesByProduct])

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
        </div>
        <DataViewLayoutOptions
          layout={layout}
          onChange={(event) => setLayout(event.value as 'list' | 'grid')}
          listIcon={<FontAwesomeIcon icon={faList} />}
          gridIcon={<FontAwesomeIcon icon={faTableCellsLarge} />}
        />
      </div>
      {showBulkControls && (
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
            <span>Selecionar</span>
            <Checkbox
              inputId="product-select-page"
              checked={areAllPagedProductsSelected}
              onChange={(event: CheckboxChangeEvent) => togglePageSelection(Boolean(event.checked))}
            />
            <label htmlFor="product-select-page">Página</label>
            <Checkbox
              inputId="product-select-all"
              checked={areAllFilteredProductsSelected}
              onChange={(event: CheckboxChangeEvent) => toggleAllSelection(Boolean(event.checked))}
            />
            <label htmlFor="product-select-all">Tudo</label>
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
      )}
      {showControls && (
        <div className="product-list-control-panel">
          <div className="product-field-select">
            <span className="product-control-label">Campos visíveis</span>
            <MultiSelect
              inputId="product-visible-fields"
              value={visibleFields}
              onChange={(event: MultiSelectChangeEvent) => setVisibleFields(event.value as string[])}
              options={fieldOptions}
              optionLabel="label"
              optionValue="value"
              filter
              maxSelectedLabels={2}
              selectedItemsLabel="{0} selecionados"
            />
          </div>
          <div className="product-search-row">
            <span className="product-control-label">Buscar em</span>
            <Dropdown
              inputId="product-search-field"
              filter
              value={searchField}
              onChange={(event: DropdownChangeEvent) => setSearchField(event.value as string)}
              options={searchableFieldOptions}
              optionLabel="label"
              optionValue="value"
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
              inputId="product-sort-field"
              filter
              value={sortField}
              onChange={(event: DropdownChangeEvent) => setSortField(event.value as string)}
              options={orderableFieldOptions}
              optionLabel="label"
              optionValue="value"
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
            selectedActivity={selectedActivitiesByProduct[productKey] ?? null}
            activityOptions={activityOptions}
            visibleFields={cardVisibleFields}
            fieldConfigByKey={fieldConfigByKey}
            onToggleSelect={toggleProductSelection}
            onActivityChange={changeProductActivity}
          />
        )
      })}
    </div>
  ), [
    activityOptions,
    selectedActivitiesByProduct,
    selectedProductKeysSet,
    isForwardedProduct,
    toggleProductSelection,
    changeProductActivity,
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
            <div
              className="p-dataview p-component product-dataview"
            >
              <div className="p-dataview-header">
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
