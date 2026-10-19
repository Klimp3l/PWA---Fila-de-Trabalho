import { getAtividades, getColunasAplicativo } from './api'
import {
  activityProductListPreferencesRepository,
  activityProductSelectionRepository,
  activitySnapshotRepository,
  activitySyncQueueRepository,
} from './offlineDb'
import type {
  ActivitySyncQueueItem,
  ActivitySyncQueueSnapshot,
  AtividadeProdutoColumn,
  ActivityProductListPreferences,
  ActivityProductListPreferencesSnapshot,
  ActivityProductSelectionsSnapshot,
  ActivitySnapshot,
  AtividadeComProdutos,
  CatalogoColunaExcecao,
  CatalogoColunasAplicativo,
  AtividadeElegivelProduto,
  CampoUsoAplicacao,
  ProdutoEan,
  ProdutoAtividade,
} from '../types/workflow'
import { resolveActivityDigitalDefault } from '../components/product-list/utils'

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

export const getActivityScopeKey = (
  activity: Pick<AtividadeComProdutos, 'idwfatividade' | 'idempresa'>,
) => `${activity.idwfatividade}-${activity.idempresa}`

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
    const scopeKey = getActivityScopeKey(atividade)
    const selectionsForActivity = selectionsSnapshot.selectionsByActivityId[scopeKey]
      ?? selectionsSnapshot.selectionsByActivityId[String(atividade.idwfatividade)]
    const fieldValuesForActivity = selectionsSnapshot.fieldValuesByActivityId?.[scopeKey]
      ?? selectionsSnapshot.fieldValuesByActivityId?.[String(atividade.idwfatividade)]

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

        const selectedActivityId = selectionsForActivity[productKey] ?? null
        const selectedActivity = atividade.atividadeselegiveis.find(
          (item) => item.idwfatividaderealizada === selectedActivityId,
        )
        const digitalDefault = resolveActivityDigitalDefault(selectedActivity, atividade.columns)
        const savedFieldValues = fieldValuesForActivity?.[productKey]

        return {
          ...produto,
          idwfatividaderealizada: selectedActivityId,
          camposDigitais: savedFieldValues
            ? {
                ...(produto.camposDigitais ?? {}),
                ...savedFieldValues,
              }
            : digitalDefault
            ? {
                ...(produto.camposDigitais ?? {}),
                [digitalDefault.field]: digitalDefault.value,
              }
            : produto.camposDigitais,
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
    nomeCampoDigital: typeof value.nomecampodigital === 'string'
      ? value.nomecampodigital.trim() || null
      : (typeof value.nomeCampoDigital === 'string' ? value.nomeCampoDigital.trim() || null : null),
    valorDefaultCampoDigital: value.valordefaultcampodigital == null && value.valorDefaultCampoDigital == null
      ? null
      : String(value.valordefaultcampodigital ?? value.valorDefaultCampoDigital),
  }
}

const toProdutoEan = (value: unknown): ProdutoEan | null => {
  if (!isRecord(value)) {
    return null
  }

  const ean = String(value.ean ?? '').trim()

  if (!ean) {
    return null
  }

  return {
    ean,
    quantidade: toNumberOrNull(value.quantidade),
  }
}

const toAtividadeProdutoColumnsFromGroups = (value: unknown): Record<string, AtividadeProdutoColumn> => {
  if (!Array.isArray(value)) {
    return {}
  }

  const columns: Record<string, AtividadeProdutoColumn> = {}

  value.forEach((rawGroup) => {
    if (!isRecord(rawGroup) || !Array.isArray(rawGroup.itens)) {
      return
    }

    rawGroup.itens.forEach((rawItem) => {
      if (!isRecord(rawItem)) {
        return
      }

      const key = typeof rawItem.key === 'string' ? rawItem.key.trim() : ''
      if (!key) {
        return
      }

      const normalizedType = String(rawItem.type ?? 'input')
      const allowedTypes: AtividadeProdutoColumn['type'][] = ['select', 'multipleSelect', 'input', 'inputNumber', 'date', 'boolean']
      const type = allowedTypes.includes(normalizedType as AtividadeProdutoColumn['type'])
        ? normalizedType as AtividadeProdutoColumn['type']
        : 'input'

      const inputType = rawItem.inputType as AtividadeProdutoColumn['inputType']

      columns[key] = {
        label: String(rawItem.label ?? key),
        type,
        inputType,
        searchable: Boolean(rawItem.searchable),
        sortable: Boolean(rawItem.sortable),
        icon: typeof rawItem.icon === 'string' ? rawItem.icon : undefined,
        defaultVisible: Boolean(rawItem.defaultVisible),
        options: Array.isArray(rawItem.options)
          ? rawItem.options.map((option) => String(option))
          : undefined,
      }
    })
  })

  return columns
}

const toBooleanFlag = (value: unknown) =>
  value === true || value === 'S' || value === 's' || value === 'true' || value === 1

const toCamposUsoAplicacao = (value: unknown): CampoUsoAplicacao[] | null => {
  let raw = value
  if (isRecord(raw) && typeof raw.value === 'string') {
    raw = raw.value
  }

  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (!trimmed) {
      return null
    }
    try {
      raw = JSON.parse(trimmed) as unknown
    } catch {
      return null
    }
  }

  if (!Array.isArray(raw)) {
    return null
  }

  const seen = new Set<string>()
  const items = raw.flatMap((item) => {
    if (!isRecord(item)) {
      return []
    }
    const campo = String(item.campo ?? item.key ?? '').trim().toLowerCase()
    if (!campo || seen.has(campo)) {
      return []
    }
    seen.add(campo)
    return [{ campo, visual: toBooleanFlag(item.visual) }]
  })

  return items.length > 0 ? items : null
}

const toProduto = (
  value: unknown,
  columns: Record<string, AtividadeProdutoColumn>,
): ProdutoAtividade | null => {
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

  const camposDigitais = Object.entries(columns).reduce<NonNullable<ProdutoAtividade['camposDigitais']>>(
    (accumulator, [field, config]) => {
      if (!config.inputType || !(field in value)) {
        return accumulator
      }

      const fieldValue = value[field]
      if (
        fieldValue === null
        || typeof fieldValue === 'string'
        || typeof fieldValue === 'number'
        || typeof fieldValue === 'boolean'
        || (Array.isArray(fieldValue) && fieldValue.every((item) => typeof item === 'string'))
      ) {
        accumulator[field] = fieldValue
      }
      return accumulator
    },
    {},
  )

  return {
    idwffilatrabalho,
    idwfocorrencia,
    idempresa,
    empresa: String(value.empresa ?? ''),
    idproduto,
    codigobarras: String(value.codigobarras ?? ''),
    ean: (Array.isArray(value.ean) ? value.ean : [])
      .map(toProdutoEan)
      .filter((item): item is ProdutoEan => item !== null),
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
    datavalidade: String(value.datavalidade ?? ''),
    qtdproduzido: toNumberOrNull(value.qtdproduzido),
    qtdestoquecorreta: toNumberOrNull(value.qtdestoquecorreta),
    qtdrevisada: toNumberOrNull(value.qtdrevisada),
    datavencimentorevisada: String(value.datavencimentorevisada ?? ''),
    saldoestoquedataproxima: toNumberOrNull(value.saldoestoquedataproxima),
    diasparavencimento: toNumberOrNull(value.diasparavencimento),
    qtdvendidoaposconferencia: toNumberOrNull(value.qtdvendidoaposconferencia),
    camposDigitais,
    urlImagem: typeof value.urlImagem === 'string' ? value.urlImagem : undefined,
  }
}

const COLUMN_TYPES: AtividadeProdutoColumn['type'][] = ['select', 'multipleSelect', 'input', 'inputNumber', 'date', 'boolean']

const toColumnType = (value: unknown): AtividadeProdutoColumn['type'] => {
  const normalizedType = String(value ?? 'input')
  return COLUMN_TYPES.includes(normalizedType as AtividadeProdutoColumn['type'])
    ? normalizedType as AtividadeProdutoColumn['type']
    : 'input'
}

const toColumnInputType = (value: unknown): AtividadeProdutoColumn['inputType'] => {
  if (value == null || value === '') {
    return undefined
  }

  const normalizedType = String(value)
  return COLUMN_TYPES.includes(normalizedType as AtividadeProdutoColumn['type'])
    ? normalizedType as AtividadeProdutoColumn['inputType']
    : undefined
}

const parseJsonValue = (value: unknown) => {
  if (typeof value !== 'string') {
    return value
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return value
  }

  try {
    return JSON.parse(trimmed) as unknown
  } catch {
    return value
  }
}

const toCatalogoExcecoes = (value: unknown): CatalogoColunasAplicativo['excecoes'] => {
  const raw = parseJsonValue(value)
  if (!isRecord(raw)) {
    return {}
  }

  return Object.entries(raw).reduce<CatalogoColunasAplicativo['excecoes']>((accumulator, [activityId, fields]) => {
    const fieldMap = parseJsonValue(fields)
    if (!isRecord(fieldMap)) {
      return accumulator
    }

    const patches = Object.entries(fieldMap).reduce<Record<string, CatalogoColunaExcecao>>((fieldAccumulator, [field, patch]) => {
      const patchValue = parseJsonValue(patch)
      if (!isRecord(patchValue)) {
        return fieldAccumulator
      }

      fieldAccumulator[field] = {
        type: typeof patchValue.type === 'string' ? patchValue.type : undefined,
        inputType: patchValue.inputType == null ? null : String(patchValue.inputType),
      }
      return fieldAccumulator
    }, {})

    accumulator[activityId] = patches
    return accumulator
  }, {})
}

export const toCatalogoColunasAplicativo = (value: unknown): CatalogoColunasAplicativo | null => {
  let raw = parseJsonValue(value)
  if (Array.isArray(raw)) {
    raw = raw[0]
  }
  if (!isRecord(raw)) {
    return null
  }
  if (!('grupos' in raw) && isRecord(raw.catalogo)) {
    raw = raw.catalogo
  }
  if (!isRecord(raw)) {
    return null
  }

  const grupos = parseJsonValue(raw.grupos)
  if (!Array.isArray(grupos)) {
    return null
  }

  return {
    grupos: grupos as CatalogoColunasAplicativo['grupos'],
    excecoes: toCatalogoExcecoes(raw.excecoes),
  }
}

const applyColumnExceptions = (
  columns: Record<string, AtividadeProdutoColumn>,
  exception: Record<string, CatalogoColunaExcecao> | undefined,
) => {
  if (!exception) {
    return columns
  }

  const nextColumns = { ...columns }
  Object.entries(exception).forEach(([key, patch]) => {
    const current = nextColumns[key]
    if (!current) {
      return
    }

    nextColumns[key] = {
      ...current,
      ...(patch.type != null ? { type: toColumnType(patch.type) } : {}),
      ...('inputType' in patch ? { inputType: toColumnInputType(patch.inputType) } : {}),
    }
  })

  return nextColumns
}

const resolveAtividadeColumns = (
  value: Record<string, unknown>,
  idwfatividade: number,
  catalogo: CatalogoColunasAplicativo | null,
) => {
  const ownGroups = Array.isArray(value.groupcolumns) && value.groupcolumns.length > 0
    ? value.groupcolumns
    : null
  const groups = ownGroups ?? catalogo?.grupos ?? []
  const columns = toAtividadeProdutoColumnsFromGroups(groups)

  if (ownGroups) {
    return {
      columns,
      groupcolumns: ownGroups,
    }
  }

  return {
    columns: applyColumnExceptions(columns, catalogo?.excecoes[String(idwfatividade)]),
    groupcolumns: [] as AtividadeComProdutos['groupcolumns'],
  }
}

const toAtividade = (
  value: unknown,
  catalogo: CatalogoColunasAplicativo | null = null,
): AtividadeComProdutos | null => {
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

  const { columns, groupcolumns } = resolveAtividadeColumns(value, idwfatividade, catalogo)

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
      .map((produto) => toProduto(produto, columns))
      .filter((produto): produto is ProdutoAtividade => produto !== null),
    groupcolumns,
    columns,
    camposUsoAplicacao: toCamposUsoAplicacao(value.camposusoaplicacao ?? value.camposUsoAplicacao),
  }
}

const ensureAtividadeColumns = (
  atividade: AtividadeComProdutos,
  catalogo: CatalogoColunasAplicativo | null | undefined,
) => {
  if (!catalogo || Object.keys(atividade.columns ?? {}).length > 0) {
    return atividade
  }

  const columns = applyColumnExceptions(
    toAtividadeProdutoColumnsFromGroups(catalogo.grupos),
    catalogo.excecoes[String(atividade.idwfatividade)],
  )

  return {
    ...atividade,
    columns,
    produtos: atividade.produtos.map((produto) => toProduto(produto, columns) ?? produto),
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
  activityScopeKey: string,
  selectionsByProduct: Record<string, number | null>,
  fieldValuesByProduct: Record<string, NonNullable<ProdutoAtividade['camposDigitais']>>,
) => {
  const currentSnapshot = await activityProductSelectionRepository.load() ?? createEmptySelectionsSnapshot()
  const nextSnapshot: ActivityProductSelectionsSnapshot = {
    updatedAt: Date.now(),
    selectionsByActivityId: {
      ...currentSnapshot.selectionsByActivityId,
      [activityScopeKey]: selectionsByProduct,
    },
    fieldValuesByActivityId: {
      ...(currentSnapshot.fieldValuesByActivityId ?? {}),
      [activityScopeKey]: fieldValuesByProduct,
    },
  }

  await activityProductSelectionRepository.save(nextSnapshot)
}

export const saveActivityProductListPreferences = async (
  activityScopeKey: string,
  preferences: ActivityProductListPreferences,
) => {
  const currentSnapshot = await activityProductListPreferencesRepository.load() ?? createEmptyProductListPreferencesSnapshot()
  const nextSnapshot: ActivityProductListPreferencesSnapshot = {
    updatedAt: Date.now(),
    preferencesByActivityId: {
      ...currentSnapshot.preferencesByActivityId,
      [activityScopeKey]: preferences,
    },
  }

  await activityProductListPreferencesRepository.save(nextSnapshot)
}

export const loadActivityProductListPreferences = async (activityScopeKey: string) => {
  const snapshot = await activityProductListPreferencesRepository.load()
  if (!snapshot) {
    return null
  }

  return snapshot.preferencesByActivityId[activityScopeKey] ?? null
}

export const removeActivityProductSelections = async (
  activityScopeKey: string,
) => {
  const currentSnapshot = await activityProductSelectionRepository.load()
  if (!currentSnapshot) {
    return
  }

  if (!(activityScopeKey in currentSnapshot.selectionsByActivityId)) {
    return
  }

  const nextSelections = { ...currentSnapshot.selectionsByActivityId }
  const nextFieldValues = { ...(currentSnapshot.fieldValuesByActivityId ?? {}) }
  delete nextSelections[activityScopeKey]
  delete nextFieldValues[activityScopeKey]

  const nextSnapshot: ActivityProductSelectionsSnapshot = {
    updatedAt: Date.now(),
    selectionsByActivityId: nextSelections,
    fieldValuesByActivityId: nextFieldValues,
  }

  await activityProductSelectionRepository.save(nextSnapshot)
}

export const loadActivitySyncQueueItems = async (
  userScope?: string,
): Promise<ActivitySyncQueueItem[]> => {
  const snapshot = await activitySyncQueueRepository.load(userScope)
  if (!snapshot) {
    return []
  }

  const snapshotRecord = snapshot as ActivitySyncQueueSnapshot & { itemsByActivityId?: Record<string, ActivitySyncQueueItem> }
  const itemsBySubmissionId = snapshotRecord.itemsBySubmissionId
    ?? snapshotRecord.itemsByActivityId
    ?? {}

  return Object.values(itemsBySubmissionId)
    .sort((left, right) => right.updatedAt - left.updatedAt)
}

export const upsertActivitySyncQueueItem = async (
  item: ActivitySyncQueueItem,
  userScope?: string,
) => {
  const currentSnapshotRaw = await activitySyncQueueRepository.load(userScope)
  const currentSnapshotRecord = (currentSnapshotRaw as ActivitySyncQueueSnapshot & { itemsByActivityId?: Record<string, ActivitySyncQueueItem> } | null)
  const currentItemsBySubmissionId = currentSnapshotRecord?.itemsBySubmissionId
    ?? currentSnapshotRecord?.itemsByActivityId
    ?? {}

  const nextSnapshot: ActivitySyncQueueSnapshot = {
    updatedAt: Date.now(),
    itemsBySubmissionId: {
      ...currentItemsBySubmissionId,
      [item.submissionId]: {
        ...item,
        updatedAt: Date.now(),
      },
    },
  }

  await activitySyncQueueRepository.save(nextSnapshot, userScope)
}

export const removeActivitySyncQueueItem = async (
  submissionId: string,
) => {
  const currentSnapshotRaw = await activitySyncQueueRepository.load()
  if (!currentSnapshotRaw) {
    return
  }

  const currentSnapshotRecord = currentSnapshotRaw as ActivitySyncQueueSnapshot & { itemsByActivityId?: Record<string, ActivitySyncQueueItem> }
  const nextItems = {
    ...(currentSnapshotRecord.itemsBySubmissionId
      ?? currentSnapshotRecord.itemsByActivityId
      ?? {}),
  }
  delete nextItems[submissionId]

  const nextSnapshot: ActivitySyncQueueSnapshot = {
    updatedAt: Date.now(),
    itemsBySubmissionId: nextItems,
  }

  await activitySyncQueueRepository.save(nextSnapshot)
}

export const removeOldSuccessfulSyncQueueItems = async (
  olderThanMs: number,
  userScope?: string,
) => {
  const snapshot = await activitySyncQueueRepository.load(userScope)
  if (!snapshot) {
    return
  }

  const snapshotRecord = snapshot as ActivitySyncQueueSnapshot & { itemsByActivityId?: Record<string, ActivitySyncQueueItem> }
  const currentItemsBySubmissionId = snapshotRecord.itemsBySubmissionId
    ?? snapshotRecord.itemsByActivityId
    ?? {}

  const now = Date.now()
  const nextItemsBySubmissionId = Object.entries(currentItemsBySubmissionId).reduce<Record<string, ActivitySyncQueueItem>>(
    (accumulator, [submissionId, item]) => {
      const referenceTimestamp = Math.max(item.updatedAt ?? 0, item.createdAt ?? 0)
      const isOldSuccess = item.status === 'success' && now - referenceTimestamp > olderThanMs

      if (!isOldSuccess) {
        accumulator[submissionId] = item
      }

      return accumulator
    },
    {},
  )

  const nextSnapshot: ActivitySyncQueueSnapshot = {
    updatedAt: Date.now(),
    itemsBySubmissionId: nextItemsBySubmissionId,
  }

  await activitySyncQueueRepository.save(nextSnapshot, userScope)
}

const throwIfAborted = (signal?: AbortSignal) => {
  if (signal?.aborted) {
    throw signal.reason instanceof Error
      ? signal.reason
      : new DOMException('A operação foi cancelada.', 'AbortError')
  }
}

const isAbortError = (error: unknown, signal?: AbortSignal) =>
  signal?.aborted === true
  || (error instanceof DOMException && error.name === 'AbortError')

export const loadAtividadesWithOfflineFallback = async (
  userScope: string,
  signal?: AbortSignal,
): Promise<AtividadeComProdutos[]> => {
  throwIfAborted(signal)
  const localSelectionsSnapshot = await activityProductSelectionRepository.load(userScope)
  throwIfAborted(signal)

  try {
    const [rawResponse, catalogResponse] = await Promise.all([
      getAtividades(undefined, signal),
      getColunasAplicativo(undefined, signal).catch((error: unknown) => {
        if (isAbortError(error, signal)) {
          throw error
        }
        console.warn('[activityData] Falha ao carregar o catálogo de colunas.', error)
        return null
      }),
    ])
    throwIfAborted(signal)
    const catalogoColunas = toCatalogoColunasAplicativo(catalogResponse)
    const rawAtividades = extractRawAtividades(rawResponse)
    const parsedAtividades = rawAtividades
      .map((atividade) => toAtividade(atividade, catalogoColunas))
      .filter((atividade): atividade is AtividadeComProdutos => atividade !== null)

    if (rawAtividades.length > 0 && parsedAtividades.length === 0) {
      throw new Error('Não foi possível converter o payload de atividades retornado pela API.')
    }

    const atividadesWithLocalSelections = applyLocalSelections(parsedAtividades, localSelectionsSnapshot)

    const snapshot: ActivitySnapshot = {
      updatedAt: Date.now(),
      atividades: atividadesWithLocalSelections,
      catalogoColunas,
    }

    throwIfAborted(signal)
    await activitySnapshotRepository.save(snapshot, userScope)
    throwIfAborted(signal)
    return atividadesWithLocalSelections
  } catch (error) {
    if (isAbortError(error, signal)) {
      throw error
    }

    console.warn('[activityData] Falha ao carregar atividades online. Usando snapshot offline.', error)
    const localSnapshot = await activitySnapshotRepository.load(userScope)
    throwIfAborted(signal)
    const atividadesOffline = (localSnapshot?.atividades ?? []).map((atividade) =>
      ensureAtividadeColumns(atividade, localSnapshot?.catalogoColunas),
    )
    return applyLocalSelections(atividadesOffline, localSelectionsSnapshot)
  }
}
