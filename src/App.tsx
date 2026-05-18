import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import { SESSION_INVALID_EVENT, login, logout } from './services/api'
import { AppHeader } from './components/AppHeader'
import { LoginPage } from './pages/LoginPage'
import { HomePage } from './pages/HomePage'
import { ActivityProductsPage } from './pages/ActivityProductsPage'
import { clearAtividadesCache } from './hooks/useAtividadesWithOnlineRefresh'
import { clearOfflineActivityData } from './services/offlineDb'

type AuthStatus = 'authenticated' | 'unauthenticated'
const AUTH_STORAGE_KEY = 'odw:is-authenticated'

function App() {
  const [authStatus, setAuthStatus] = useState<AuthStatus>(() =>
    localStorage.getItem(AUTH_STORAGE_KEY) === 'true' ? 'authenticated' : 'unauthenticated',
  )
  const [isSubmittingLogin, setIsSubmittingLogin] = useState(false)
  const [authError, setAuthError] = useState('')
  const handleLogoutSuccess = useCallback(() => {
    localStorage.removeItem(AUTH_STORAGE_KEY)
    setAuthStatus('unauthenticated')
    setAuthError('')
  }, [])

  useEffect(() => {
    const handleSessionInvalid = () => {
      clearAtividadesCache()
      void clearOfflineActivityData()
      localStorage.removeItem(AUTH_STORAGE_KEY)
      setAuthStatus('unauthenticated')
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
      clearAtividadesCache()
      await clearOfflineActivityData()
      localStorage.setItem(AUTH_STORAGE_KEY, 'true')
      setAuthStatus('authenticated')
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
            >
              <HomePage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/home/atividade/:activityId"
          element={(
            <ProtectedRoute
              isAuthenticated={authStatus === 'authenticated'}
              onLogoutSuccess={handleLogoutSuccess}
              showHeader={false}
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
}

function ProtectedRoute({
  isAuthenticated,
  onLogoutSuccess,
  children,
  showHeader = true,
}: ProtectedRouteProps) {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [isSubmittingLogout, setIsSubmittingLogout] = useState(false)

  const handleLogout = useCallback(async () => {
    try {
      setIsSubmittingLogout(true)
      await logout()
      clearAtividadesCache()
      await clearOfflineActivityData()
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
        />
      )}
      {children}
    </>
  )
}

export default App
