const DEFAULT_API_BASE_URL = ''
const EXEC_TAREFA_APELIDO = 'HEAVEN-wfg-fila-trabalho-mobile-backend'
const SESSION_INVALID_HEADER = 'odw_redirect'
export const SESSION_INVALID_EVENT = 'odw:session-invalid'

export const API_BASE_URL = import.meta.env.DEV
  ? window.location.origin
  : import.meta.env.VITE_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const normalizeBaseUrl = (baseUrl: string) => baseUrl.replace(/\/+$/, '')

const buildExecTarefaUrl = (baseUrl: string) => {
  const normalized = normalizeBaseUrl(baseUrl)
  return `${normalized}/bdoserver2.7/odwctrl?action=execTarefa&apelido=${EXEC_TAREFA_APELIDO}`
}

const buildLoginUrl = (baseUrl: string) => {
  const normalized = normalizeBaseUrl(baseUrl)
  return `${normalized}/bdoserver2.7/odwctrl`
}

const bytesToHex = (bytes: Uint8Array) =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')

export const getHashSHA1 = async (value: string) => {
  const encoder = new TextEncoder()
  const hashBuffer = await crypto.subtle.digest('SHA-1', encoder.encode(value))
  return bytesToHex(new Uint8Array(hashBuffer))
}

export interface LoginPayload {
  usuario: string
  senha: string
}

export interface LoginResponse {
  result?: string
  url?: string
  status?: string
  msg?: string
}

export interface UsuarioInfo {
  idusuario: number | null
  usuario: string
  nome: string
  email: string
  telefonecelular: string
}

export interface EncaminhamentoUpdateItem {
  idwfocorrencia: number
  idwfatividadeencaminhamento: number
  observacao: string
  idwffilatrabalho: number
}

export interface EncaminhamentoUpdatePayload {
  idwfprocesso: number
  encaminhamentos: EncaminhamentoUpdateItem[]
}

const parseJson = async (response: Response): Promise<unknown> => {
  return response.json() as Promise<unknown>
}

const toNumberOrNull = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

const toUsuarioInfo = (value: unknown): UsuarioInfo | null => {
  if (!isRecord(value)) {
    return null
  }

  return {
    idusuario: toNumberOrNull(value.idusuario),
    usuario: String(value.usuario ?? ''),
    nome: String(value.nome ?? ''),
    email: String(value.email ?? ''),
    telefonecelular: String(value.telefonecelular ?? ''),
  }
}

const extractFirstUserInfoRecord = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value[0]
  }

  if (isRecord(value) && Array.isArray(value.rows)) {
    return value.rows[0]
  }

  return value
}

const isSessionInvalidResponse = (response: Response) => {
  const redirectHeader = response.headers.get(SESSION_INVALID_HEADER)
  return typeof redirectHeader === 'string' && redirectHeader.trim() !== ''
}

const notifySessionInvalid = () => {
  window.dispatchEvent(new Event(SESSION_INVALID_EVENT))
}

const fetchWithSessionValidation = async (
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> => {
  const response = await fetch(input, init)

  if (isSessionInvalidResponse(response)) {
    notifySessionInvalid()
    throw new Error('Sessão inválida. Faça login novamente.')
  }

  return response
}

export const login = async (
  payload: LoginPayload,
  baseUrl = API_BASE_URL,
): Promise<LoginResponse> => {
  const hashedPassword = await getHashSHA1(payload.senha)
  const body = new URLSearchParams({
    usr: payload.usuario,
    pwd: `!${hashedPassword}`,
    action: 'login'
  })

  const response = await fetchWithSessionValidation(buildLoginUrl(baseUrl), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    },
    credentials: 'include',
    body,
  })

  const parsed = await parseJson(response)
  const parsedRecord = isRecord(parsed) ? parsed : {}
  const responseStatus = parsedRecord.status

  if (responseStatus === 'error') {
    const errorMessage = typeof parsedRecord.msg === 'string'
      ? parsedRecord.msg
      : 'Login não autorizado pelo servidor.'
    throw new Error(errorMessage)
  }

  return parsedRecord as LoginResponse
}

export const logout = async (
  baseUrl = API_BASE_URL
) => {
  await fetchWithSessionValidation(buildLoginUrl(baseUrl) + '?action=logout', {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    },
  })
}

export const getAtividades = async (
  baseUrl = API_BASE_URL,
): Promise<unknown> => {
  const response = await fetchWithSessionValidation(buildExecTarefaUrl(baseUrl) + '&scriptFunction=getAtividades', {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
  })

  const parsed = await parseJson(response)
  return parsed
}

export const getMercadologicos = async (
  baseUrl = API_BASE_URL,
): Promise<unknown> => {
  const response = await fetchWithSessionValidation(buildExecTarefaUrl(baseUrl) + '&scriptFunction=getMercadologicos', {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
  })

  const parsed = await parseJson(response)
  return parsed
}

export const getInfoUsuario = async (
  baseUrl = API_BASE_URL,
): Promise<UsuarioInfo | null> => {
  const response = await fetchWithSessionValidation(buildExecTarefaUrl(baseUrl) + '&scriptFunction=getInfoUsuario', {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
  })

  const parsed = await parseJson(response)
  const firstRecord = extractFirstUserInfoRecord(parsed)
  return toUsuarioInfo(firstRecord)
}

export const updateEncaminhamentos = async (
  payload: EncaminhamentoUpdatePayload,
  baseUrl = API_BASE_URL,
): Promise<unknown> => {
  const body = new URLSearchParams({
    wffilatrabalho: JSON.stringify(payload),
  })

  const response = await fetchWithSessionValidation(buildExecTarefaUrl(baseUrl) + '&scriptFunction=update', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    },
    body,
  })

  const responseText = await response.text()
  if (!responseText.trim()) {
    return null
  }

  try {
    return JSON.parse(responseText) as unknown
  } catch {
    return responseText
  }
}