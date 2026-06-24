import type {
  ActivitySyncQueueItem,
  ActivitySyncQueueSource,
  AtividadeComProdutos,
  ProdutoAtividade,
} from '../types/workflow'
import { getActivityScopeKey, getProdutoAtividadeKey } from './activityData'

interface CreateActivitySyncQueueItemParams {
  atividade: AtividadeComProdutos
  source: ActivitySyncQueueSource
  selectedActivitiesByProduct?: Record<string, number | null>
  products?: ProdutoAtividade[]
}

export const getQueueItemProductKeys = (item: ActivitySyncQueueItem) => {
  return new Set((item.products ?? []).map((product) => product.productKey))
}

export const getPackageProductKeys = (item: ActivitySyncQueueItem) => {
  const productKeysFromSnapshot = (item.products ?? []).map((product) => product.productKey)
  if (productKeysFromSnapshot.length > 0) {
    return productKeysFromSnapshot
  }

  return item.payload.encaminhamentos
    .map((encaminhamento) => {
      const matchedProduct = item.atividade.produtos.find((produto) => (
        produto.idwffilatrabalho === encaminhamento.idwffilatrabalho
        && produto.idwfocorrencia === encaminhamento.idwfocorrencia
      ))

      return matchedProduct ? getProdutoAtividadeKey(matchedProduct) : null
    })
    .filter((value): value is string => value !== null)
}

export const getPackageSelectedActivitiesByProduct = (item: ActivitySyncQueueItem) => {
  const selectedActivitiesByProduct: Record<string, number | null> = {}

  const productsFromSnapshot = item.products ?? []
  if (productsFromSnapshot.length > 0) {
    productsFromSnapshot.forEach((product) => {
      selectedActivitiesByProduct[product.productKey] = product.idwfatividadeencaminhamento
    })
    return selectedActivitiesByProduct
  }

  item.payload.encaminhamentos.forEach((encaminhamento) => {
    const matchedProduct = item.atividade.produtos.find((produto) => (
      produto.idwffilatrabalho === encaminhamento.idwffilatrabalho
      && produto.idwfocorrencia === encaminhamento.idwfocorrencia
    ))

    if (!matchedProduct) {
      return
    }

    const productKey = getProdutoAtividadeKey(matchedProduct)
    selectedActivitiesByProduct[productKey] = encaminhamento.idwfatividadeencaminhamento
  })

  return selectedActivitiesByProduct
}

export const createActivitySyncQueueItem = ({
  atividade,
  source,
  selectedActivitiesByProduct,
  products,
}: CreateActivitySyncQueueItemParams): ActivitySyncQueueItem | null => {
  const availableProducts = products ?? atividade.produtos
  const selectedProducts = availableProducts
    .map((produto) => {
      const productKey = getProdutoAtividadeKey(produto)
      const selectedValue = selectedActivitiesByProduct?.[productKey] ?? produto.idwfatividaderealizada

      if (selectedValue === null) {
        return null
      }

      return {
        produto,
        productKey,
        selectedValue,
      }
    })
    .filter((value): value is { produto: ProdutoAtividade, productKey: string, selectedValue: number } => value !== null)

  if (selectedProducts.length === 0) {
    return null
  }

  const now = Date.now()
  const submissionId = `${now}-${Math.random().toString(36).slice(2, 10)}`
  const activityKey = getActivityScopeKey(atividade)

  return {
    submissionId,
    activityKey,
    activityId: atividade.idwfatividade,
    source,
    atividade,
    payload: {
      idwfprocesso: atividade.idwfprocesso,
      encaminhamentos: selectedProducts.map(({ produto, selectedValue }) => ({
        idwfocorrencia: produto.idwfocorrencia,
        idwffilatrabalho: produto.idwffilatrabalho,
        idwfatividadeencaminhamento: selectedValue,
        observacao: produto.observacao ?? '',
        qtdproduzido: produto.qtdproduzido ?? null,
        qtdestoquecorreta: produto.qtdestoquecorreta ?? null,
        datavalidade: produto.datavalidade ?? '',
      })),
    },
    productCount: selectedProducts.length,
    products: selectedProducts.map(({ produto, selectedValue, productKey }) => ({
      productKey,
      idproduto: produto.idproduto,
      codigobarras: produto.codigobarras,
      produto: produto.produto,
      idwffilatrabalho: produto.idwffilatrabalho,
      idwfocorrencia: produto.idwfocorrencia,
      idwfatividadeencaminhamento: selectedValue,
      observacao: produto.observacao ?? '',
      qtdproduzido: produto.qtdproduzido ?? null,
      qtdestoquecorreta: produto.qtdestoquecorreta ?? null,
      datavalidade: produto.datavalidade ?? '',
    })),
    status: 'pending',
    errorMessage: null,
    retryCount: 0,
    createdAt: now,
    updatedAt: now,
  }
}
