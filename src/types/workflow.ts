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
   * Chave: id da atividade (`idwfatividade`)
   * Valor: mapa da chave do produto para `idwfatividaderealizada` escolhido.
   */
  selectionsByActivityId: Record<string, Record<string, number | null>>
}

export interface ActivityProductListPreferences {
  layout: 'list' | 'grid'
  visibleFields: string[]
  sortField: string
  sortDirection: 1 | -1
}

export interface ActivityProductListPreferencesSnapshot {
  updatedAt: number
  /**
   * Chave: id da atividade (`idwfatividade`)
   * Valor: preferências de exibição da lista de produtos.
   */
  preferencesByActivityId: Record<string, ActivityProductListPreferences>
}
