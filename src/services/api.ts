const DEFAULT_API_BASE_URL = ''
const EXEC_TAREFA_APELIDO = 'HEAVEN-wfg-fila-trabalho-mobile-backend'
const SESSION_APELIDO = 'HEAVEN-wfg-fila-trabalho-mobile-backend-login'
const DEFAULT_SESSION_TKEY = '8d5f28f7-1ca4-499f-805f-80a63f2845d7'

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL
const SESSION_TKEY = import.meta.env.VITE_SESSION_TKEY?.trim() || DEFAULT_SESSION_TKEY

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const normalizeBaseUrl = (baseUrl: string) => baseUrl.replace(/\/+$/, '')

const buildExecTarefaUrl = (baseUrl: string) => {
  const normalized = normalizeBaseUrl(baseUrl)
  return `${normalized}/bdoserver2.7/odwctrl?action=execTarefa&apelido=${EXEC_TAREFA_APELIDO}`
}

const buildSessionValidationUrl = (baseUrl: string) => {
  const normalized = normalizeBaseUrl(baseUrl)
  return `${normalized}/bdoserver2.7/odwctrl?action=getParameters&apelido=${SESSION_APELIDO}&scriptFunction=getSession&tKey=${SESSION_TKEY}`
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

interface SessionValidationResponse {
  success?: unknown
}

const parseJson = async (response: Response): Promise<unknown> => {
  return response.json() as Promise<unknown>
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

  const response = await fetch(buildLoginUrl(baseUrl), {
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
  await fetch(buildLoginUrl(baseUrl) + '?action=logout', {
    method: 'GET'
  })
}

export const validarSessao = async (
  baseUrl = API_BASE_URL
): Promise<boolean> => {
  const response = await fetch(buildSessionValidationUrl(baseUrl), {
    method: 'GET',
    credentials: 'include',
  })

  const parsed = await parseJson(response)
  const parsedRecord = isRecord(parsed) ? (parsed as SessionValidationResponse) : {}
  return Boolean(parsedRecord.success)
}

export const getAtividades = async (
  baseUrl = API_BASE_URL,
): Promise<unknown> => {
  const response = await fetch(buildExecTarefaUrl(baseUrl) + '&scriptFunction=getAtividades', {
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
  const response = await fetch(buildExecTarefaUrl(baseUrl) + '&scriptFunction=getMercadologicos', {
    method: 'GET',
    credentials: 'include',
  })

  const parsed = await parseJson(response)
  return parsed
}