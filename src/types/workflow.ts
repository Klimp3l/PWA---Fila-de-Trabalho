export interface AtividadeElegivelProduto {
  idwfatividaderealizada: number
  atividaderealizada: string
}

export interface AtividadeProdutoColumn {
  label: string
  type: 'select' | 'multipleSelect' | 'input' | 'inputNumber' | 'date' | 'boolean'
  searchable: boolean
  sortable: boolean
  icon?: string
  options?: string[]
  defaultVisible?: boolean
}

export interface ProdutoAtividade {
  idwffilatrabalho: number
  idwfocorrencia: number
  idempresa: number
  empresa: string
  idproduto: number
  codigobarras: string
  produto: string
  idwfatividaderealizada: number | null
  observacao: string
  datainclusao: string
  horainclusao: string
  datavencimento: string
  dataprevisaosaida: string
  classificacao: string
  idfamilia: number | null
  familia: string
  idgrupo: number | null
  grupo: string
  idsetor: number | null
  setor: string
  iddepartamento: number | null
  departamento: string
  classe: string
  valorprecovenda: number | null
  valorcustoaquisicao: number | null
  diassemvenda: number | null
  dataultimavenda: string
  qtdultimavenda: number | null
  diasentrada: number | null
  dataultimaentrada: string
  qtdultimaentrada: number | null
  qtdeabastecimento: number | null
  ruptura: number | null
  qtdestoqueatual: number | null
  fornecedor: string
  qtdvendamedia: number | null
  qtdestoqueatualcd: number | null
  qtdunentrada: number | null
  recorrencia120dias: number | null
  /** Enviado pela API em alguns fluxos; usado para imagem do produto na lista. */
  urlImagem?: string
}

export interface AtividadeComProdutos {
  idempresa: number
  empresa: string
  idwfprocesso: number
  wfprocesso: string
  idwfatividade: number
  wfatividade: string
  atividadeselegiveis: AtividadeElegivelProduto[]
  produtos: ProdutoAtividade[]
  columns: Record<string, AtividadeProdutoColumn>
}

export interface ActivitySnapshot {
  updatedAt: number
  atividades: AtividadeComProdutos[]
}

export interface ActivityProductSelectionsSnapshot {
  updatedAt: number
  /**
   * Chave: escopo da atividade (`idwfatividade-idempresa`)
   * Valor: mapa da chave do produto para `idwfatividaderealizada` escolhido.
   */
  selectionsByActivityId: Record<string, Record<string, number | null>>
}

export interface ActivityProductListPreferences {
  layout: 'list' | 'grid'
  visibleFields: string[]
  sortField: string
  sortDirection: 1 | -1
  showForwardedProducts: boolean
}

export interface ActivityProductListPreferencesSnapshot {
  updatedAt: number
  /**
   * Chave: escopo da atividade (`idwfatividade-idempresa`)
   * Valor: preferências de exibição da lista de produtos.
   */
  preferencesByActivityId: Record<string, ActivityProductListPreferences>
}

export interface EncaminhamentoSyncPayloadItem {
  idwfocorrencia: number
  idwfatividadeencaminhamento: number
  observacao: string
  idwffilatrabalho: number
}

export interface EncaminhamentoSyncPayload {
  idwfprocesso: number
  encaminhamentos: EncaminhamentoSyncPayloadItem[]
}

export type ActivitySyncQueueStatus = 'pending' | 'processing' | 'error' | 'success'
export type ActivitySyncQueueSource = 'home' | 'product-list'

export interface ActivitySyncQueueProductSnapshot {
  productKey: string
  idproduto: number
  codigobarras: string
  produto: string
  idwffilatrabalho: number
  idwfocorrencia: number
  idwfatividadeencaminhamento: number
  observacao: string
}

export interface ActivitySyncQueueItem {
  submissionId: string
  activityKey: string
  activityId: number
  source: ActivitySyncQueueSource
  atividade: AtividadeComProdutos
  payload: EncaminhamentoSyncPayload
  productCount: number
  products: ActivitySyncQueueProductSnapshot[]
  status: ActivitySyncQueueStatus
  errorMessage: string | null
  createdAt: number
  updatedAt: number
}

export interface ActivitySyncQueueSnapshot {
  updatedAt: number
  itemsBySubmissionId: Record<string, ActivitySyncQueueItem>
}
