import type { ProdutoAtividade } from '../../types/workflow'

export const DEFAULT_PRODUCT_IMAGE = `${import.meta.env.BASE_URL}default.png`
export const ALWAYS_VISIBLE_FIELDS = ['produto', 'codigobarras']
export const DEFAULT_ROWS_PER_PAGE = 4
export const SWIPE_THRESHOLD = 60

export type FieldMeta = { label: string, type: 'string' | 'number' | 'currency' }

export const FIELD_LABELS: Record<string, FieldMeta> = {
  idwffilatrabalho: {
    label: 'ID fila',
    type: 'number',
  },
  idwfocorrencia: {
    label: 'ID ocorrência',
    type: 'number',
  },
  idempresa: {
    label: 'ID empresa',
    type: 'number',
  },
  empresa: {
    label: 'Empresa',
    type: 'string',
  },
  idproduto: {
    label: 'ID produto',
    type: 'number',
  },
  codigobarras: {
    label: 'Código de barras',
    type: 'string',
  },
  produto: {
    label: 'Produto',
    type: 'string',
  },
  idwfatividaderealizada: {
    label: 'ID atividade realizada',
    type: 'number',
  },
  observacao: {
    label: 'Observação',
    type: 'string',
  },
  datainclusao: {
    label: 'Data inclusão',
    type: 'string',
  },
  horainclusao: {
    label: 'Hora inclusão',
    type: 'string',
  },
  datavencimento: {
    label: 'Data vencimento',
    type: 'string',
  },
  dataprevisaosaida: {
    label: 'Data previsão saída',
    type: 'string',
  },
  classificacao: {
    label: 'Classificação',
    type: 'string',
  },
  idfamilia: {
    label: 'ID família',
    type: 'number',
  },
  familia: {
    label: 'Família',
    type: 'string',
  },
  idgrupo: {
    label: 'ID grupo',
    type: 'number',
  },
  grupo: {
    label: 'Grupo',
    type: 'string',
  },
  idsetor: {
    label: 'ID setor',
    type: 'number',
  },
  setor: {
    label: 'Setor',
    type: 'string',
  },
  iddepartamento: {
    label: 'ID departamento',
    type: 'number',
  },
  departamento: {
    label: 'Departamento',
    type: 'string',
  },
  classe: {
    label: 'Classe',
    type: 'string',
  },
  valorprecovenda: {
    label: 'Preço venda',
    type: 'currency',
  },
  valorcustoaquisicao: {
    label: 'Custo aquisição',
    type: 'currency',
  },
  diassemvenda: {
    label: 'Dias sem venda',
    type: 'number',
  },
  dataultimavenda: {
    label: 'Data última venda',
    type: 'string',
  },
  qtdultimavenda: {
    label: 'Quantidade última venda',
    type: 'number',
  },
  diasentrada: {
    label: 'Dias entrada',
    type: 'number',
  },
  dataultimaentrada: {
    label: 'Data última entrada',
    type: 'string',
  },
  qtdultimaentrada: {
    label: 'Quantidade última entrada',
    type: 'number',
  },
  qtdeabastecimento: {
    label: 'Quantidade abastecimento',
    type: 'number',
  },
  ruptura: {
    label: 'Ruptura',
    type: 'number',
  },
  qtdestoqueatual: {
    label: 'Estoque atual',
    type: 'number',
  },
  fornecedor: {
    label: 'Fornecedor',
    type: 'string',
  },
  qtdvendamedia: {
    label: 'Quantidade venda média',
    type: 'number',
  },
  qtdestoqueatualcd: {
    label: 'Estoque atual CD',
    type: 'number',
  },
  qtdunentrada: {
    label: 'Quantidade unidade entrada',
    type: 'number',
  },
  recorrencia120dias: {
    label: 'Recorrência 120 dias',
    type: 'number',
  },
  urlImagem: {
    label: 'URL imagem',
    type: 'string',
  },
} satisfies Record<keyof ProdutoAtividade, FieldMeta>

export const EXCLUDED_SELECT_FIELDS = new Set([
  ...ALWAYS_VISIBLE_FIELDS,
  'urlImagem',
  'iddepartamento',
  'idsetor',
  'idgrupo',
  'idfamilia',
])

export const EXCLUDED_SEARCHABLE_FIELDS = new Set([
  'urlImagem',
  'iddepartamento',
  'idsetor',
  'idgrupo',
  'idfamilia',
  'departamento',
  'setor',
  'grupo',
  'familia',
  'idempresa',
  'observacao',
  'idwfocorrencia',
  'idwffilatrabalho',
  'idwfatividaderealizada',
])

export const EXCLUDED_ORDERABLE_FIELDS = new Set([
  'urlImagem',
  'iddepartamento',
  'idsetor',
  'idgrupo',
  'idfamilia',
  'codigobarras',
  'observacao',
  'idempresa',
  'idproduto',
  'idwfocorrencia',
  'idwffilatrabalho',
  'idwfatividaderealizada',
])

export const DEFAULT_OPTIONAL_FIELDS = ['valorprecovenda', 'qtdestoqueatual']
export const MARKET_FIELD_KEYS = ['departamento', 'setor', 'grupo', 'familia'] as const
export type MarketFieldKey = typeof MARKET_FIELD_KEYS[number]
export const MARKET_FIELD_INDEX = MARKET_FIELD_KEYS.reduce((accumulator, field, index) => {
  accumulator[field] = index
  return accumulator
}, {} as Record<MarketFieldKey, number>)

export const CARD_INTERACTIVE_SELECTOR = [
  'button',
  'input',
  'select',
  'textarea',
  'a',
  'label',
  '[role="button"]',
  '[role="switch"]',
  '.p-dropdown',
  '.p-inputtext',
  '.p-checkbox',
  '.p-inputswitch',
].join(', ')
