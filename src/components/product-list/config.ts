export const DEFAULT_PRODUCT_IMAGE = `${import.meta.env.BASE_URL}default.png`
export const ALWAYS_VISIBLE_FIELDS = ['produto']
export const DEFAULT_ROWS_PER_PAGE = 4
export const SWIPE_THRESHOLD = 60

export const MARKET_FIELD_KEYS = ['departamento', 'setor', 'grupo', 'familia'] as const
export type MarketFieldKey = typeof MARKET_FIELD_KEYS[number]
export const MARKET_FIELD_LABELS: Record<MarketFieldKey, string> = {
  departamento: 'Departamento',
  setor: 'Setor',
  grupo: 'Grupo',
  familia: 'Família',
}
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
