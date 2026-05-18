import { type MouseEvent, type TouchEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from 'primereact/button'
import { Card } from 'primereact/card'
import { Checkbox, type CheckboxChangeEvent } from 'primereact/checkbox'
import { DataViewLayoutOptions } from 'primereact/dataview'
import { Dropdown, type DropdownChangeEvent } from 'primereact/dropdown'
import { InputText } from 'primereact/inputtext'
import { InputSwitch, type InputSwitchChangeEvent } from 'primereact/inputswitch'
import { Message } from 'primereact/message'
import { MultiSelect, type MultiSelectChangeEvent } from 'primereact/multiselect'
import { Paginator } from 'primereact/paginator'
import { classNames } from 'primereact/utils'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faBarcode,
  faBuilding,
  faLayerGroup,
  faList,
  faPersonWalking,
  faTableCellsLarge,
} from '@fortawesome/free-solid-svg-icons'
import type {
  AtividadeComProdutos,
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
  DEFAULT_OPTIONAL_FIELDS,
  DEFAULT_PRODUCT_IMAGE,
  DEFAULT_ROWS_PER_PAGE,
  EXCLUDED_ORDERABLE_FIELDS,
  EXCLUDED_SEARCHABLE_FIELDS,
  EXCLUDED_SELECT_FIELDS,
  FIELD_LABELS,
  MARKET_FIELD_INDEX,
  MARKET_FIELD_KEYS,
  SWIPE_THRESHOLD,
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

interface ProductCardItemProps {
  produto: ProdutoAtividade
  layout: 'list' | 'grid'
  index: number
  isSelected: boolean
  selectedActivity: number | null
  activityOptions: Array<{ label: string; value: number }>
  visibleFields: string[]
  onToggleSelect: (productKey: string, checked: boolean) => void
  onActivityChange: (productKey: string, value: number | null) => void
}

function ProductCardItem({
  produto,
  layout,
  index,
  isSelected,
  selectedActivity,
  activityOptions,
  visibleFields,
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
        })}
        onClick={handleCardClick}
      >
        <div
          className={classNames('product-card-content', {
            'product-card-content-list': layout === 'list',
            'product-card-content-grid': layout === 'grid',
          })}
        >
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
              <p>
                <FontAwesomeIcon icon={faBarcode} />
                Código de barras: {produto.codigobarras || '-'}
              </p>
              <div
                className="product-activity-select"
                onClick={(event) => event.stopPropagation()}
                onMouseDown={(event) => event.stopPropagation()}
                onTouchStart={(event) => event.stopPropagation()}
              >
                <span className="product-activity-select-label">Atividade realizada</span>
                <Dropdown
                  inputId={`product-activity-${productKey}`}
                  value={selectedActivity}
                  onChange={(event: DropdownChangeEvent) => {
                    event.originalEvent?.stopPropagation()
                    onActivityChange(productKey, toDropdownActivityId(event.value))
                  }}
                  options={activityOptions}
                  optionLabel="label"
                  optionValue="value"
                  placeholder={
                    activityOptions.length > 0
                      ? 'Selecione a atividade'
                      : 'Sem atividades disponíveis'
                  }
                  className="product-activity-dropdown"
                  showClear={activityOptions.length > 0}
                  disabled={activityOptions.length === 0}
                />
              </div>
              {visibleFields.map((field) => (
                <p key={`${produto.idproduto}-${field}`}>
                  {FIELD_LABELS[field]?.label ?? field}
                  :{' '}
                  {formatFieldValue(field, getProdutoFieldValue(produto, field))}
                </p>
              ))}
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}

interface ProductListProps {
  atividade: AtividadeComProdutos | null
}

export function ProductList({ atividade }: ProductListProps) {
  const [layout, setLayout] = useState<'list' | 'grid'>('grid')
  const [visibleFields, setVisibleFields] = useState<string[]>([])
  const [showControls, setShowControls] = useState(false)
  const [showMarketFilters, setShowMarketFilters] = useState(false)
  const [showBulkControls, setShowBulkControls] = useState(true)
  const [searchField, setSearchField] = useState('produto')
  const [searchValue, setSearchValue] = useState('')
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
  const [bulkActivityId, setBulkActivityId] = useState<number | null>(null)
  const [showForwardedProducts, setShowForwardedProducts] = useState(false)
  const [first, setFirst] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(DEFAULT_ROWS_PER_PAGE)
  const touchStartXRef = useRef<number | null>(null)
  const touchStartYRef = useRef<number | null>(null)
  const hasLoadedPreferencesRef = useRef<number | null>(null)

  const products = useMemo(() => atividade?.produtos ?? [], [atividade])
  const activityEligibleItems = useMemo(() => atividade?.atividadeselegiveis ?? [], [atividade])
  const allFieldOptions = useMemo(() => {
    const allFields = new Set<string>()

    products.forEach((produto) => {
      Object.keys(produto).forEach((field) => {
        allFields.add(field)
      })
    })

    return Array.from(allFields)
      .map((field) => ({
        label: FIELD_LABELS[field]?.label ?? field,
        value: field,
      }))
      .sort((first, second) => first.label.localeCompare(second.label, 'pt-BR'))
  }, [products])

  const fieldOptions = useMemo(
    () => allFieldOptions.filter((option) => !EXCLUDED_SELECT_FIELDS.has(option.value)),
    [allFieldOptions],
  )

  const searchableFieldOptions = useMemo(
    () => allFieldOptions.filter((option) => !EXCLUDED_SEARCHABLE_FIELDS.has(option.value)),
    [allFieldOptions],
  )

  const orderableFieldOptions = useMemo(
    () => searchableFieldOptions.filter((option) => !EXCLUDED_ORDERABLE_FIELDS.has(option.value)),
    [searchableFieldOptions],
  )

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
      const filteredCurrent = current.filter((field) => availableValues.has(field))

      if (filteredCurrent.length > 0) {
        return filteredCurrent
      }

      return DEFAULT_OPTIONAL_FIELDS.filter((field) => availableValues.has(field))
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

    setSearchField((current) => (availableValues.has(current) ? current : defaultField))
    setSortField((current) => (availableValues.has(current) ? current : defaultField))
  }, [searchableFieldOptions])

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
            preferences.visibleFields.filter((field) => availableFieldValues.has(field)),
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
      visibleFields,
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

    void saveActivityProductSelections(atividade.idwfatividade, selectedActivitiesByProduct).catch((error) => {
      console.warn('[ProductList] Falha ao persistir encaminhamentos locais da atividade.', error)
    })
    syncActivitySelectionsInCache(atividade.idwfatividade, selectedActivitiesByProduct)
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
    const normalizedSearch = searchValue.trim().toLocaleLowerCase('pt-BR')

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

    const filteredBySearch = !normalizedSearch || !searchField
      ? filteredByMarket
      : filteredByMarket.filter((produto) => {
        const fieldValue = getProdutoFieldValue(produto, searchField)
        return String(fieldValue ?? '').toLocaleLowerCase('pt-BR').includes(normalizedSearch)
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
      return compareFieldValues(sortField, firstValue, secondValue) * sortDirection
    })
  }, [
    marketFilters,
    products,
    searchField,
    searchValue,
    showForwardedProducts,
    isForwardedProduct,
    sortDirection,
    sortField,
  ])

  const pagedProducts = useMemo(
    () => filteredAndSortedProducts.slice(first, first + rowsPerPage),
    [filteredAndSortedProducts, first, rowsPerPage],
  )

  useEffect(() => {
    const lastPageStart = Math.max(
      0,
      Math.floor((filteredAndSortedProducts.length - 1) / rowsPerPage) * rowsPerPage,
    )
    setFirst((current) => Math.min(current, lastPageStart))
  }, [filteredAndSortedProducts.length, rowsPerPage])

  const goToPreviousPage = () => {
    setFirst((current) => Math.max(0, current - rowsPerPage))
  }

  const goToNextPage = () => {
    setFirst((current) => {
      if (current + rowsPerPage >= filteredAndSortedProducts.length) {
        return current
      }

      return current + rowsPerPage
    })
  }

  const activityOptions = activityEligibleItems.map((atividadeElegivel) => ({
    label: getAtividadeLabel(atividadeElegivel),
    value: atividadeElegivel.idwfatividaderealizada,
  }))

  const pagedProductKeys = useMemo(
    () => pagedProducts.map((produto) => getProdutoAtividadeKey(produto)),
    [pagedProducts],
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

  const handleActivityChange = useCallback((productKey: string, value: number | null) => {
    setSelectedActivitiesByProduct((current) => ({
      ...current,
      [productKey]: value,
    }))

    if (value !== null) {
      setSelectedProductKeys((current) => current.filter((k) => k !== productKey))
    }
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

  const applyBulkActivityToSelected = () => {
    if (bulkActivityId === null || selectedProductKeys.length === 0) {
      return
    }

    const selectedKeys = [...selectedProductKeys]
    setSelectedActivitiesByProduct((current) => {
      const next = { ...current }
      selectedKeys.forEach((productKey) => {
        next[productKey] = bulkActivityId
      })
      return next
    })

    setSelectedProductKeys((current) => current.filter((productKey) => !selectedKeys.includes(productKey)))

    setShowBulkControls(false)
    setTimeout(() => {
      setShowBulkControls(true)
    }, 1)
  }

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    const touch = event.changedTouches[0]
    touchStartXRef.current = touch.clientX
    touchStartYRef.current = touch.clientY
  }

  const handleTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    if (touchStartXRef.current == null || touchStartYRef.current == null) {
      return
    }

    const touch = event.changedTouches[0]
    const deltaX = touch.clientX - touchStartXRef.current
    const deltaY = touch.clientY - touchStartYRef.current

    touchStartXRef.current = null
    touchStartYRef.current = null

    if (Math.abs(deltaX) < SWIPE_THRESHOLD || Math.abs(deltaX) <= Math.abs(deltaY)) {
      return
    }

    if (deltaX > 0) {
      goToPreviousPage()
      return
    }

    goToNextPage()
  }

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
        <Paginator
          first={first}
          rows={rowsPerPage}
          totalRecords={filteredAndSortedProducts.length}
          onPageChange={(event) => {
            setFirst(event.first)
            setRowsPerPage(event.rows)
          }}
          rowsPerPageOptions={[4, 6, 8, 12]}
          currentPageReportTemplate="({totalRecords}) Página {currentPage} de {totalPages}"
          template="PrevPageLink CurrentPageReport NextPageLink RowsPerPageDropdown"
        />
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
            <Checkbox
              inputId="product-select-page"
              checked={areAllPagedProductsSelected}
              onChange={(event: CheckboxChangeEvent) => togglePageSelection(Boolean(event.checked))}
            />
            <label htmlFor="product-select-page">Selecionar página</label>
            <span className="product-bulk-count">{selectedProductKeys.length} selecionado(s)</span>
          </div>
          <div className="product-bulk-actions-row">
            <Dropdown
              inputId="product-bulk-activity"
              value={bulkActivityId}
              onChange={(event: DropdownChangeEvent) => setBulkActivityId(toDropdownActivityId(event.value))}
              options={activityOptions}
              optionLabel="label"
              optionValue="value"
              placeholder={activityOptions.length > 0 ? 'Selecionar atividade para os marcados' : 'Sem atividades disponíveis'}
              className="product-bulk-dropdown"
              disabled={activityOptions.length === 0}
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
            <InputText
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="Digite para buscar..."
              className="product-search-input"
            />
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
                placeholder={FIELD_LABELS[field].label}
                disabled={MARKET_FIELD_INDEX[field] > 0 && !marketFilters[MARKET_FIELD_KEYS[MARKET_FIELD_INDEX[field] - 1]]}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )

  const renderProductList = (
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
            selectedActivity={selectedActivitiesByProduct[productKey] ?? null}
            activityOptions={activityOptions}
            visibleFields={visibleFields}
            onToggleSelect={toggleProductSelection}
            onActivityChange={handleActivityChange}
          />
        )
      })}
    </div>
  )

  return (
    <section className="panel product-panel">
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
            <WorkflowProgressBar
              completed={forwardedProductsCount}
              total={products.length}
              itemLabel="produtos encaminhados"
              className="product-progress-overview"
            />
            <div
              className="p-dataview p-component product-dataview"
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >
              <div className="p-dataview-header">
                {header()}
              </div>
              <div className="p-dataview-content">
                {pagedProducts.length > 0
                  ? renderProductList(pagedProducts, layout)
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
