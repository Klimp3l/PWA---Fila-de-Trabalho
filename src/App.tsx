import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import { SESSION_INVALID_EVENT, getInfoUsuario, login, logout } from './services/api'
import { AppHeader } from './components/AppHeader'
import { LoginPage } from './pages/LoginPage'
import { HomePage } from './pages/HomePage'
import { ActivityProductsPage } from './pages/ActivityProductsPage'
import { clearAtividadesCache } from './hooks/useAtividadesWithOnlineRefresh'
import { setOfflineDataUserScope } from './services/offlineDb'

type AuthStatus = 'authenticated' | 'unauthenticated'
const AUTH_STORAGE_KEY = 'odw:is-authenticated'
const AUTH_USER_LABEL_STORAGE_KEY = 'odw:user-label'

const getUserLabelFromStorage = () => {
  if (typeof window === 'undefined') {
    return ''
  }

  return window.localStorage.getItem(AUTH_USER_LABEL_STORAGE_KEY) ?? ''
}

function App() {
  const [authStatus, setAuthStatus] = useState<AuthStatus>(() =>
    localStorage.getItem(AUTH_STORAGE_KEY) === 'true' ? 'authenticated' : 'unauthenticated',
  )
  const [userLabel, setUserLabel] = useState(getUserLabelFromStorage)
  const [isSubmittingLogin, setIsSubmittingLogin] = useState(false)
  const [authError, setAuthError] = useState('')
  const handleLogoutSuccess = useCallback(() => {
    setOfflineDataUserScope(null)
    localStorage.removeItem(AUTH_STORAGE_KEY)
    localStorage.removeItem(AUTH_USER_LABEL_STORAGE_KEY)
    setAuthStatus('unauthenticated')
    setUserLabel('')
    setAuthError('')
  }, [])

  useEffect(() => {
    const handleSessionInvalid = () => {
      clearAtividadesCache()
      setOfflineDataUserScope(null)
      localStorage.removeItem(AUTH_STORAGE_KEY)
      localStorage.removeItem(AUTH_USER_LABEL_STORAGE_KEY)
      setAuthStatus('unauthenticated')
      setUserLabel('')
      setAuthError('Sua sessão expirou. Faça login novamente.')
    }

    window.addEventListener(SESSION_INVALID_EVENT, handleSessionInvalid)
    return () => {
      window.removeEventListener(SESSION_INVALID_EVENT, handleSessionInvalid)
    }
  }, [])

  const handleLogin = useCallback(async (usuario: string, senha: string) => {
    try {
      setIsSubmittingLogin(true)
      setAuthError('')
      await login({
        usuario: usuario.trim(),
        senha,
      })
      const userInfo = await getInfoUsuario()
      const userIdScope = userInfo?.idusuario !== null && userInfo?.idusuario !== undefined
        ? `id:${userInfo.idusuario}`
        : usuario.trim().toLocaleLowerCase('pt-BR')
      const nextUserLabel = userInfo?.nome?.trim()
        ? `${userInfo.nome.trim()} (${userInfo.usuario || usuario.trim()})`
        : (userInfo?.usuario?.trim() || usuario.trim())

      clearAtividadesCache()
      setOfflineDataUserScope(userIdScope)
      localStorage.setItem(AUTH_STORAGE_KEY, 'true')
      localStorage.setItem(AUTH_USER_LABEL_STORAGE_KEY, nextUserLabel)
      setAuthStatus('authenticated')
      setUserLabel(nextUserLabel)
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Erro inesperado ao autenticar.'
      setAuthStatus('unauthenticated')
      setAuthError(`Falha no login: ${errorMessage}`)
      throw error
    } finally {
      setIsSubmittingLogin(false)
    }
  }, [])

  return (
    <main className="app-shell">
      <Routes>
        <Route
          path="/login"
          element={(
            <LoginPage
              onLogin={handleLogin}
              isSubmittingLogin={isSubmittingLogin}
              feedback={authError}
              isAuthenticated={authStatus === 'authenticated'}
            />
          )}
        />
        <Route
          path="/home"
          element={(
            <ProtectedRoute
              isAuthenticated={authStatus === 'authenticated'}
              onLogoutSuccess={handleLogoutSuccess}
              userLabel={userLabel}
            >
              <HomePage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/home/atividade/:activityId/empresa/:companyId"
          element={(
            <ProtectedRoute
              isAuthenticated={authStatus === 'authenticated'}
              onLogoutSuccess={handleLogoutSuccess}
              showHeader={false}
              userLabel={userLabel}
            >
              <ActivityProductsPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="*"
          element={(
            <Navigate
              to={authStatus === 'authenticated' ? '/home' : '/login'}
              replace
            />
          )}
        />
      </Routes>
    </main>
  )
}

interface ProtectedRouteProps {
  isAuthenticated: boolean
  onLogoutSuccess: () => void
  children: ReactNode
  showHeader?: boolean
  userLabel: string
}

function ProtectedRoute({
  isAuthenticated,
  onLogoutSuccess,
  children,
  showHeader = true,
  userLabel,
}: ProtectedRouteProps) {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [isSubmittingLogout, setIsSubmittingLogout] = useState(false)

  const handleLogout = useCallback(async () => {
    try {
      setIsSubmittingLogout(true)
      await logout()
      clearAtividadesCache()
      onLogoutSuccess()
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Erro inesperado ao encerrar sessão.'
      console.error(errorMessage)
    } finally {
      setIsSubmittingLogout(false)
    }
  }, [onLogoutSuccess])

  useEffect(() => {
    const updateNetworkStatus = () => {
      setIsOnline(navigator.onLine)
    }

    updateNetworkStatus()

    window.addEventListener('online', updateNetworkStatus)
    window.addEventListener('offline', updateNetworkStatus)

    return () => {
      window.removeEventListener('online', updateNetworkStatus)
      window.removeEventListener('offline', updateNetworkStatus)
    }
  }, [])

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return (
    <>
      {showHeader && (
        <AppHeader
          isOnline={isOnline}
          canLogout={isAuthenticated}
          onLogout={handleLogout}
          isSubmittingLogout={isSubmittingLogout}
          userLabel={userLabel}
        />
      )}
      {children}
    </>
  )
}

export default App
