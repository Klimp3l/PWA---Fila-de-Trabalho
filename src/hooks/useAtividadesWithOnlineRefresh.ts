import { useCallback, useEffect, useState } from 'react'
import { loadAtividadesWithOfflineFallback } from '../services/activityData'
import type { AtividadeComProdutos } from '../types/workflow'

interface UseAtividadesWithOnlineRefreshResult {
  atividades: AtividadeComProdutos[]
  isLoading: boolean
  reloadAtividades: () => Promise<void>
}

export function useAtividadesWithOnlineRefresh(logContext: string): UseAtividadesWithOnlineRefreshResult {
  const [atividades, setAtividades] = useState<AtividadeComProdutos[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const reloadAtividades = useCallback(async () => {
    const parsedAtividades = await loadAtividadesWithOfflineFallback()
    setAtividades(parsedAtividades)
  }, [])

  useEffect(() => {
    const loadAtividades = async () => {
      setIsLoading(true)

      try {
        await reloadAtividades()
      } finally {
        setIsLoading(false)
      }
    }

    const refreshAtividades = async () => {
      try {
        await reloadAtividades()
      } catch (error) {
        console.warn(`[${logContext}] Falha ao atualizar atividades após reconexão.`, error)
      }
    }

    const handleOnline = () => {
      void refreshAtividades()
    }

    void loadAtividades()
    window.addEventListener('online', handleOnline)

    return () => {
      window.removeEventListener('online', handleOnline)
    }
  }, [logContext, reloadAtividades])

  return {
    atividades,
    isLoading,
    reloadAtividades,
  }
}
