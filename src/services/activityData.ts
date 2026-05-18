import { getAtividades } from './api'
import {
  activityProductListPreferencesRepository,
  activityProductSelectionRepository,
  activitySnapshotRepository,
} from './offlineDb'
import type {
  ActivityProductListPreferences,
  ActivityProductListPreferencesSnapshot,
  ActivityProductSelectionsSnapshot,
  ActivitySnapshot,
  AtividadeComProdutos,
  AtividadeElegivelProduto,
  ProdutoAtividade,
} from '../types/workflow'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const toNumberOrNull = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

const createEmptySelectionsSnapshot = (): ActivityProductSelectionsSnapshot => ({
  updatedAt: Date.now(),
  selectionsByActivityId: {},
})

const createEmptyProductListPreferencesSnapshot = (): ActivityProductListPreferencesSnapshot => ({
  updatedAt: Date.now(),
  preferencesByActivityId: {},
})

export const getProdutoAtividadeKey = (produto: Pick<ProdutoAtividade, 'idwffilatrabalho' | 'idwfocorrencia' | 'idproduto'>) =>
  `${produto.idwffilatrabalho}-${produto.idwfocorrencia}-${produto.idproduto}`

const applyLocalSelections = (
  atividades: AtividadeComProdutos[],
  selectionsSnapshot: ActivityProductSelectionsSnapshot | null,
) => {
  if (!selectionsSnapshot) {
    return atividades
  }

  return atividades.map((atividade) => {
    const selectionsForActivity = selectionsSnapshot.selectionsByActivityId[String(atividade.idwfatividade)]

    if (!selectionsForActivity) {
      return atividade
    }

    return {
      ...atividade,
      produtos: atividade.produtos.map((produto) => {
        const productKey = getProdutoAtividadeKey(produto)

        if (!(productKey in selectionsForActivity)) {
          return produto
        }

        return {
          ...produto,
          idwfatividaderealizada: selectionsForActivity[productKey] ?? null,
        }
      }),
    }
  })
}

const toAtividadeElegivelProduto = (value: unknown): AtividadeElegivelProduto | null => {
  if (!isRecord(value)) {
    return null
  }

  const idwfatividaderealizada = toNumberOrNull(value.idwfatividaderealizada)

  if (idwfatividaderealizada === null) {
    return null
  }

  return {
    idwfatividaderealizada,
    atividaderealizada: String(value.atividaderealizada ?? ''),
  }
}

const toProduto = (value: unknown): ProdutoAtividade | null => {
  if (!isRecord(value)) {
    return null
  }

  const idwffilatrabalho = toNumberOrNull(value.idwffilatrabalho)
  const idwfocorrencia = toNumberOrNull(value.idwfocorrencia)
  const idempresa = toNumberOrNull(value.idempresa)
  const idproduto = toNumberOrNull(value.idproduto)

  if (idwffilatrabalho === null || idwfocorrencia === null || idempresa === null || idproduto === null) {
    return null
  }

  return {
    idwffilatrabalho,
    idwfocorrencia,
    idempresa,
    empresa: String(value.empresa ?? ''),
    idproduto,
    codigobarras: String(value.codigobarras ?? ''),
    produto: String(value.produto ?? ''),
    idwfatividaderealizada: toNumberOrNull(value.idwfatividaderealizada),
    observacao: String(value.observacao ?? ''),
    datainclusao: String(value.datainclusao ?? ''),
    horainclusao: String(value.horainclusao ?? ''),
    datavencimento: String(value.datavencimento ?? ''),
    dataprevisaosaida: String(value.dataprevisaosaida ?? ''),
    classificacao: String(value.classificacao ?? ''),
    idfamilia: toNumberOrNull(value.idfamilia),
    familia: String(value.familia ?? ''),
    idgrupo: toNumberOrNull(value.idgrupo),
    grupo: String(value.grupo ?? ''),
    idsetor: toNumberOrNull(value.idsetor),
    setor: String(value.setor ?? ''),
    iddepartamento: toNumberOrNull(value.iddepartamento),
    departamento: String(value.departamento ?? ''),
    classe: String(value.classe ?? ''),
    valorprecovenda: toNumberOrNull(value.valorprecovenda),
    valorcustoaquisicao: toNumberOrNull(value.valorcustoaquisicao),
    diassemvenda: toNumberOrNull(value.diassemvenda),
    dataultimavenda: String(value.dataultimavenda ?? ''),
    qtdultimavenda: toNumberOrNull(value.qtdultimavenda),
    diasentrada: toNumberOrNull(value.diasentrada),
    dataultimaentrada: String(value.dataultimaentrada ?? ''),
    qtdultimaentrada: toNumberOrNull(value.qtdultimaentrada),
    qtdeabastecimento: toNumberOrNull(value.qtdeabastecimento),
    ruptura: toNumberOrNull(value.ruptura),
    qtdestoqueatual: toNumberOrNull(value.qtdestoqueatual),
    fornecedor: String(value.fornecedor ?? ''),
    qtdvendamedia: toNumberOrNull(value.qtdvendamedia),
    qtdestoqueatualcd: toNumberOrNull(value.qtdestoqueatualcd),
    qtdunentrada: toNumberOrNull(value.qtdunentrada),
    recorrencia120dias: toNumberOrNull(value.recorrencia120dias),
    urlImagem: typeof value.urlImagem === 'string' ? value.urlImagem : undefined,
  }
}

const toAtividade = (value: unknown): AtividadeComProdutos | null => {
  if (!isRecord(value)) {
    return null
  }

  const idempresa = toNumberOrNull(value.idempresa)
  const idwfprocesso = toNumberOrNull(value.idwfprocesso)
  const idwfatividade = toNumberOrNull(value.idwfatividade)
  const produtosRaw = Array.isArray(value.produtos) ? value.produtos : (Array.isArray(value.filas) ? value.filas : [])

  if (idempresa === null || idwfprocesso === null || idwfatividade === null) {
    return null
  }

  return {
    idempresa,
    empresa: String(value.empresa ?? ''),
    idwfprocesso,
    wfprocesso: String(value.wfprocesso ?? ''),
    idwfatividade,
    wfatividade: String(value.wfatividade ?? ''),
    atividadeselegiveis: (Array.isArray(value.atividadeselegiveis) ? value.atividadeselegiveis : [])
      .map(toAtividadeElegivelProduto)
      .filter((atividade): atividade is AtividadeElegivelProduto => atividade !== null),
    produtos: produtosRaw
      .map(toProduto)
      .filter((produto): produto is ProdutoAtividade => produto !== null),
  }
}

const extractRawAtividades = (value: unknown): unknown[] => {
  if (Array.isArray(value)) {
    return value
  }

  if (isRecord(value) && Array.isArray(value.atividades)) {
    return value.atividades
  }

  throw new Error('Formato de payload de atividades inválido.')
}

export const saveActivityProductSelections = async (
  activityId: number,
  selectionsByProduct: Record<string, number | null>,
) => {
  const currentSnapshot = await activityProductSelectionRepository.load() ?? createEmptySelectionsSnapshot()
  const nextSnapshot: ActivityProductSelectionsSnapshot = {
    updatedAt: Date.now(),
    selectionsByActivityId: {
      ...currentSnapshot.selectionsByActivityId,
      [String(activityId)]: selectionsByProduct,
    },
  }

  await activityProductSelectionRepository.save(nextSnapshot)
}

export const saveActivityProductListPreferences = async (
  activityId: number,
  preferences: ActivityProductListPreferences,
) => {
  const currentSnapshot = await activityProductListPreferencesRepository.load() ?? createEmptyProductListPreferencesSnapshot()
  const nextSnapshot: ActivityProductListPreferencesSnapshot = {
    updatedAt: Date.now(),
    preferencesByActivityId: {
      ...currentSnapshot.preferencesByActivityId,
      [String(activityId)]: preferences,
    },
  }

  await activityProductListPreferencesRepository.save(nextSnapshot)
}

export const loadActivityProductListPreferences = async (activityId: number) => {
  const snapshot = await activityProductListPreferencesRepository.load()
  if (!snapshot) {
    return null
  }

  return snapshot.preferencesByActivityId[String(activityId)] ?? null
}

export const loadAtividadesWithOfflineFallback = async (): Promise<AtividadeComProdutos[]> => {
  const localSelectionsSnapshot = await activityProductSelectionRepository.load()

  try {
    const rawResponse = await getAtividades()
    const rawAtividades = extractRawAtividades(rawResponse)
    const parsedAtividades = rawAtividades
      .map(toAtividade)
      .filter((atividade): atividade is AtividadeComProdutos => atividade !== null)

    if (rawAtividades.length > 0 && parsedAtividades.length === 0) {
      throw new Error('Não foi possível converter o payload de atividades retornado pela API.')
    }

    const atividadesWithLocalSelections = applyLocalSelections(parsedAtividades, localSelectionsSnapshot)

    const snapshot: ActivitySnapshot = {
      updatedAt: Date.now(),
      atividades: atividadesWithLocalSelections,
    }

    await activitySnapshotRepository.save(snapshot)
    return atividadesWithLocalSelections
  } catch (error) {
    console.warn('[activityData] Falha ao carregar atividades online. Usando snapshot offline.', error)
    const localSnapshot = await activitySnapshotRepository.load()
    return applyLocalSelections(localSnapshot?.atividades ?? [], localSelectionsSnapshot)
  }
}
