import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react'
import {
  getActivityScopeKey,
  loadActivityProductListPreferences,
  saveActivityProductListPreferences,
  saveActivityProductSelections,
} from '../services/activityData'
import { syncActivitySelectionsInCache } from './useAtividadesWithOnlineRefresh'
import { ALWAYS_VISIBLE_FIELDS } from '../components/product-list/config'
import type { ActivityProductListPreferences, AtividadeComProdutos } from '../types/workflow'

const SAVE_SELECTIONS_DEBOUNCE_MS = 200

export const useActivitySelectionsPersistence = (
  atividade: AtividadeComProdutos | null,
  selectedActivitiesByProduct: Record<string, number | null>,
) => {
  const saveSelectionsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
    }, SAVE_SELECTIONS_DEBOUNCE_MS)

    return () => {
      if (saveSelectionsTimeoutRef.current) {
        clearTimeout(saveSelectionsTimeoutRef.current)
        saveSelectionsTimeoutRef.current = null
      }
    }
  }, [atividade, selectedActivitiesByProduct])
}

interface UseActivityProductListPreferencesParams {
  atividade: AtividadeComProdutos | null
  fieldOptions: Array<{ value: string }>
  orderableFieldOptions: Array<{ value: string }>
  layout: 'list' | 'grid'
  visibleFields: string[]
  sortField: string
  sortDirection: 1 | -1
  showForwardedProducts: boolean
  setLayout: Dispatch<SetStateAction<'list' | 'grid'>>
  setVisibleFields: Dispatch<SetStateAction<string[]>>
  setSortField: Dispatch<SetStateAction<string>>
  setSortDirection: Dispatch<SetStateAction<1 | -1>>
  setShowForwardedProducts: Dispatch<SetStateAction<boolean>>
}

export const useActivityProductListPreferences = ({
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
}: UseActivityProductListPreferencesParams) => {
  const hasLoadedPreferencesRef = useRef<string | null>(null)

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
  }, [
    atividade,
    fieldOptions,
    orderableFieldOptions,
    setLayout,
    setShowForwardedProducts,
    setSortDirection,
    setSortField,
    setVisibleFields,
  ])

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
}
