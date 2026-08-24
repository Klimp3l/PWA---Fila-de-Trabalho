import { useCallback, useEffect, useRef, useState } from 'react'
import { loadAtividadesWithOfflineFallback } from '../services/activityData'
import type { AtividadeComProdutos, CamposDigitais } from '../types/workflow'

interface AtividadesCacheEntry {
  userScope: string
  atividades: AtividadeComProdutos[]
}

let atividadesCache: AtividadesCacheEntry | null = null
let cacheGeneration = 0
const activeRequests = new Set<AbortController>()

export const clearAtividadesCache = () => {
  cacheGeneration += 1
  atividadesCache = null
  activeRequests.forEach((controller) => controller.abort())
  activeRequests.clear()
}

export const syncActivitySelectionsInCache = (
  activityScopeKey: string,
  selectionsByProduct: Record<string, number | null>,
  fieldValuesByProduct: Record<string, CamposDigitais>,
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

  atividadesCache = {
    ...atividadesCache,
    atividades: atividadesCache.atividades.map((atividade) => {
      if (atividade.idwfatividade !== activityId || atividade.idempresa !== companyId) {
        return atividade
      }

      return {
        ...atividade,
        produtos: atividade.produtos.map((produto) => {
          const productKey = `${produto.idwffilatrabalho}-${produto.idwfocorrencia}-${produto.idproduto}`

          if (!(productKey in selectionsByProduct)) {
            return produto
          }

          return {
            ...produto,
            idwfatividaderealizada: selectionsByProduct[productKey] ?? null,
            camposDigitais: {
              ...(produto.camposDigitais ?? {}),
              ...(fieldValuesByProduct[productKey] ?? {}),
            },
          }
        }),
      }
    }),
  }
}

export const removeActivityFromCache = (activityId: number) => {
  if (atividadesCache === null) {
    return
  }

  atividadesCache = {
    ...atividadesCache,
    atividades: atividadesCache.atividades.filter((atividade) => atividade.idwfatividade !== activityId),
  }
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

  atividadesCache = {
    ...atividadesCache,
    atividades: atividadesCache.atividades.map((atividade) => {
      if (atividade.idwfatividade !== activityId || atividade.idempresa !== companyId) {
        return atividade
      }

      return {
        ...atividade,
        produtos: atividade.produtos.filter((produto) => {
          const productKey = `${produto.idwffilatrabalho}-${produto.idwfocorrencia}-${produto.idproduto}`
          return !productKeys.has(productKey)
        }),
      }
    }),
  }
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
  userScope: string,
  logContext: string,
  options?: UseAtividadesWithOnlineRefreshOptions
): UseAtividadesWithOnlineRefreshResult {
  const shouldLoad = options?.enabled ?? true
  const getCachedAtividades = () =>
    atividadesCache?.userScope === userScope ? atividadesCache.atividades : null
  const [atividades, setAtividades] = useState<AtividadeComProdutos[]>(() => getCachedAtividades() ?? [])
  const [isLoading, setIsLoading] = useState(shouldLoad && getCachedAtividades() === null)
  const activeControllerRef = useRef<AbortController | null>(null)
  const requestSequenceRef = useRef(0)

  const fetchAtividades = useCallback(async () => {
    activeControllerRef.current?.abort()
    const controller = new AbortController()
    const requestSequence = ++requestSequenceRef.current
    const requestGeneration = cacheGeneration
    activeControllerRef.current = controller
    activeRequests.add(controller)
    setIsLoading(true)

    try {
      const parsedAtividades = await loadAtividadesWithOfflineFallback(userScope, controller.signal)
      if (
        controller.signal.aborted
        || requestSequence !== requestSequenceRef.current
        || requestGeneration !== cacheGeneration
      ) {
        return
      }

      atividadesCache = {
        userScope,
        atividades: parsedAtividades,
      }
      setAtividades(parsedAtividades)
    } catch (error) {
      if (controller.signal.aborted) {
        return
      }
      throw error
    } finally {
      activeRequests.delete(controller)
      if (
        !controller.signal.aborted
        && requestSequence === requestSequenceRef.current
        && requestGeneration === cacheGeneration
      ) {
        setIsLoading(false)
        activeControllerRef.current = null
      }
    }
  }, [userScope])

  const reloadAtividades = useCallback(async () => {
    await fetchAtividades()
  }, [fetchAtividades])

  useEffect(() => {
    if (!shouldLoad) {
      setIsLoading(false)
      return () => {
        activeControllerRef.current?.abort()
      }
    }

    const cachedAtividades = atividadesCache?.userScope === userScope
      ? atividadesCache.atividades
      : null

    if (cachedAtividades !== null) {
      setAtividades(cachedAtividades)
      setIsLoading(false)
      return () => {
        activeControllerRef.current?.abort()
      }
    }

    setAtividades([])
    void fetchAtividades().catch((error) => {
      console.warn(`[${logContext}] Falha ao carregar atividades.`, error)
    })

    return () => {
      requestSequenceRef.current += 1
      activeControllerRef.current?.abort()
      activeControllerRef.current = null
    }
  }, [fetchAtividades, logContext, shouldLoad, userScope])

  return {
    atividades,
    isLoading,
    reloadAtividades,
  }
}
