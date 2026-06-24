import type { Dispatch, ReactNode, Ref, SetStateAction } from 'react'
import { Button } from 'primereact/button'
import { Calendar } from 'primereact/calendar'
import { Checkbox, type CheckboxChangeEvent } from 'primereact/checkbox'
import { DataViewLayoutOptions } from 'primereact/dataview'
import { Dropdown, type DropdownChangeEvent } from 'primereact/dropdown'
import { InputNumber, type InputNumberValueChangeEvent } from 'primereact/inputnumber'
import { InputText } from 'primereact/inputtext'
import { InputSwitch, type InputSwitchChangeEvent } from 'primereact/inputswitch'
import { MultiSelect, type MultiSelectChangeEvent } from 'primereact/multiselect'
import { classNames } from 'primereact/utils'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faBroom,
  faEye,
  faFileExcel,
  faLayerGroup,
  faList,
  faPersonWalking,
  faShareFromSquare,
  faTableCellsLarge,
} from '@fortawesome/free-solid-svg-icons'
import type { AtividadeProdutoColumn } from '../../types/workflow'
import {
  MARKET_FIELD_INDEX,
  MARKET_FIELD_KEYS,
  MARKET_FIELD_LABELS,
  type MarketFieldKey,
} from './config'
import { toDropdownActivityId } from './utils'
import {
  NONE_ACTIVITY_OPTION_VALUE,
  type FieldOption,
  type GroupedFieldOptions,
  type SearchFilterValue,
} from './types'

type BulkActivityId = number | typeof NONE_ACTIVITY_OPTION_VALUE | null

interface ProductListHeaderProps {
  readOnlyPackageView: boolean
  showControls: boolean
  setShowControls: Dispatch<SetStateAction<boolean>>
  showMarketFilters: boolean
  setShowMarketFilters: Dispatch<SetStateAction<boolean>>
  showBulkControls: boolean
  setShowBulkControls: Dispatch<SetStateAction<boolean>>
  showExportControls: boolean
  setShowExportControls: Dispatch<SetStateAction<boolean>>
  layout: 'list' | 'grid'
  setLayout: Dispatch<SetStateAction<'list' | 'grid'>>
  showForwardedProducts: boolean
  setShowForwardedProducts: Dispatch<SetStateAction<boolean>>
  areAllPagedProductsSelected: boolean
  togglePageSelection: (checked: boolean) => void
  selectedProductKeys: string[]
  clearSelectedProducts: () => void
  bulkActivityId: BulkActivityId
  setBulkActivityId: Dispatch<SetStateAction<BulkActivityId>>
  bulkActivityOptions: Array<{ label: string; value: number | string }>
  activityOptions: Array<{ label: string; value: number }>
  applyBulkActivityToSelected: () => void
  onExportToExcel: () => void
  canExport: boolean
  visibleFields: string[]
  setVisibleFields: Dispatch<SetStateAction<string[]>>
  groupedFieldOptions: GroupedFieldOptions[]
  optionGroupTemplate: (group: GroupedFieldOptions) => ReactNode
  searchField: string
  setSearchField: Dispatch<SetStateAction<string>>
  groupedSearchableFieldOptions: GroupedFieldOptions[]
  selectedSearchFieldType: AtividadeProdutoColumn['type']
  searchValue: SearchFilterValue
  setSearchValue: Dispatch<SetStateAction<SearchFilterValue>>
  searchSelectOptions: Array<{ label: string; value: string }>
  searchableFieldMap: Record<string, FieldOption>
  sortField: string
  setSortField: Dispatch<SetStateAction<string>>
  groupedOrderableFieldOptions: GroupedFieldOptions[]
  sortDirection: 1 | -1
  setSortDirection: Dispatch<SetStateAction<1 | -1>>
  marketFilters: Record<MarketFieldKey, string>
  setMarketFilters: Dispatch<SetStateAction<Record<MarketFieldKey, string>>>
  marketFilterOptions: Record<MarketFieldKey, { label: string; value: string }[]>
  setMarketFilterDropdownRef: (field: MarketFieldKey, element: Dropdown | null) => void
  bulkActivityDropdownRef: Ref<Dropdown>
  visibleFieldsMultiSelectRef: Ref<MultiSelect>
  searchFieldDropdownRef: Ref<Dropdown>
  searchSelectDropdownRef: Ref<Dropdown>
  searchMultipleSelectRef: Ref<MultiSelect>
  searchBooleanDropdownRef: Ref<Dropdown>
  sortFieldDropdownRef: Ref<Dropdown>
  searchDateCalendarRef: Ref<Calendar>
}

export function ProductListHeader({
  readOnlyPackageView,
  showControls,
  setShowControls,
  showMarketFilters,
  setShowMarketFilters,
  showBulkControls,
  setShowBulkControls,
  showExportControls,
  setShowExportControls,
  layout,
  setLayout,
  showForwardedProducts,
  setShowForwardedProducts,
  areAllPagedProductsSelected,
  togglePageSelection,
  selectedProductKeys,
  clearSelectedProducts,
  bulkActivityId,
  setBulkActivityId,
  bulkActivityOptions,
  activityOptions,
  applyBulkActivityToSelected,
  onExportToExcel,
  canExport,
  visibleFields,
  setVisibleFields,
  groupedFieldOptions,
  optionGroupTemplate,
  searchField,
  setSearchField,
  groupedSearchableFieldOptions,
  selectedSearchFieldType,
  searchValue,
  setSearchValue,
  searchSelectOptions,
  searchableFieldMap,
  sortField,
  setSortField,
  groupedOrderableFieldOptions,
  sortDirection,
  setSortDirection,
  marketFilters,
  setMarketFilters,
  marketFilterOptions,
  setMarketFilterDropdownRef,
  bulkActivityDropdownRef,
  visibleFieldsMultiSelectRef,
  searchFieldDropdownRef,
  searchSelectDropdownRef,
  searchMultipleSelectRef,
  searchBooleanDropdownRef,
  sortFieldDropdownRef,
  searchDateCalendarRef,
}: ProductListHeaderProps) {
  return (
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
                  setShowExportControls(false)
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
                  setShowExportControls(false)
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
                  setShowExportControls(false)
                  }

                  return next
                })
              }
            />
          )}
          <Button
            type="button"
            icon={<FontAwesomeIcon icon={faShareFromSquare} />}
            text
            rounded
            className={classNames({ 'product-control-toggle-active': showExportControls })}
            aria-label={showExportControls ? 'Fechar opções de exportação' : 'Abrir opções de exportação'}
            onClick={() =>
              setShowExportControls((current) => {
                const next = !current

                if (next) {
                  setShowControls(false)
                  setShowMarketFilters(false)
                  setShowBulkControls(false)
                }

                return next
              })
            }
          />
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
      {showExportControls && (
        <div className="product-list-control-panel">
          <div className="product-bulk-actions-row">
            <Button
              type="button"
              label="Download em Excel"
              icon={<FontAwesomeIcon icon={faFileExcel} />}
              onClick={onExportToExcel}
              disabled={!canExport}
            />
          </div>
        </div>
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
}
