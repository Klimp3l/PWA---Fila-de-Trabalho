import { useCallback, useEffect, useState } from 'react'
import { loadAtividadesWithOfflineFallback } from '../services/activityData'
import type { AtividadeComProdutos } from '../types/workflow'

let atividadesCache: AtividadeComProdutos[] | null = null

export const clearAtividadesCache = () => {
  atividadesCache = null
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
