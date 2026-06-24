import { useCallback, useEffect, useState } from 'react'
import { getProdutoAtividadeKey, loadAtividadesWithOfflineFallback } from '../services/activityData'
import type { AtividadeComProdutos } from '../types/workflow'

let atividadesCache: AtividadeComProdutos[] | null = null

export const clearAtividadesCache = () => {
  atividadesCache = null
}

export const syncActivitySelectionsInCache = (
  activityScopeKey: string,
  selectionsByProduct: Record<string, number | null>,
) => {
  if (atividadesCache === null) {
    return
  }

  const [activityIdRaw, companyIdRaw] = activityScopeKey.split('-')
  const activityId = Number(activityIdRaw)
  const companyId = Number(companyIdRaw)

  if (!Number.isFinite(activityId) || !Number.isFinite(companyId)) {
    return
  }

  atividadesCache = atividadesCache.map((atividade) => {
    if (atividade.idwfatividade !== activityId || atividade.idempresa !== companyId) {
      return atividade
    }

    return {
      ...atividade,
      produtos: atividade.produtos.map((produto) => {
        const productKey = getProdutoAtividadeKey(produto)

        if (!(productKey in selectionsByProduct)) {
          return produto
        }

        return {
          ...produto,
          idwfatividaderealizada: selectionsByProduct[productKey] ?? null,
        }
      }),
    }
  })
}

export const removeActivityFromCache = (activityId: number) => {
  if (atividadesCache === null) {
    return
  }

  atividadesCache = atividadesCache.filter((atividade) => atividade.idwfatividade !== activityId)
}

export const removeActivityProductsFromCache = (
  activityScopeKey: string,
  productKeys: Set<string>,
) => {
  if (atividadesCache === null || productKeys.size === 0) {
    return
  }

  const [activityIdRaw, companyIdRaw] = activityScopeKey.split('-')
  const activityId = Number(activityIdRaw)
  const companyId = Number(companyIdRaw)

  if (!Number.isFinite(activityId) || !Number.isFinite(companyId)) {
    return
  }

  atividadesCache = atividadesCache.map((atividade) => {
    if (atividade.idwfatividade !== activityId || atividade.idempresa !== companyId) {
      return atividade
    }

    return {
      ...atividade,
      produtos: atividade.produtos.filter((produto) => {
        const productKey = getProdutoAtividadeKey(produto)
        return !productKeys.has(productKey)
      }),
    }
  })
}

interface UseAtividadesWithOnlineRefreshResult {
  atividades: AtividadeComProdutos[]
  isLoading: boolean
  reloadAtividades: () => Promise<void>
}

interface UseAtividadesWithOnlineRefreshOptions {
  enabled?: boolean
}

export function useAtividadesWithOnlineRefresh(
  logContext: string,
  options?: UseAtividadesWithOnlineRefreshOptions
): UseAtividadesWithOnlineRefreshResult {
  const shouldLoad = options?.enabled ?? true
  const [atividades, setAtividades] = useState<AtividadeComProdutos[]>(() => atividadesCache ?? [])
  const [isLoading, setIsLoading] = useState(shouldLoad && atividadesCache === null)

  const fetchAtividades = useCallback(async () => {
    setIsLoading(true)
    try {
      const parsedAtividades = await loadAtividadesWithOfflineFallback()
      atividadesCache = parsedAtividades
      setAtividades(parsedAtividades)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const reloadAtividades = useCallback(async () => {
    await fetchAtividades()
  }, [fetchAtividades])

  useEffect(() => {
    if (!shouldLoad) {
      setIsLoading(false)
      return
    }

    if (atividadesCache !== null) {
      setAtividades(atividadesCache)
      setIsLoading(false)
      return
    }

    void fetchAtividades().catch((error) => {
      console.warn(`[${logContext}] Falha ao carregar atividades.`, error)
    })
  }, [fetchAtividades, logContext, shouldLoad])

  return {
    atividades,
    isLoading,
    reloadAtividades,
  }
}
