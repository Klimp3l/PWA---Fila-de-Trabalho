import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Card } from 'primereact/card'
import { ProgressSpinner } from 'primereact/progressspinner'
import './App.css'
import { validarSessao, login, logout } from './services/api'
import { AppHeader } from './components/AppHeader'
import { LoginPage } from './pages/LoginPage'
import { HomePage } from './pages/HomePage'
import { ActivityProductsPage } from './pages/ActivityProductsPage'
import { clearAtividadesCache } from './hooks/useAtividadesWithOnlineRefresh'

type AuthStatus = 'checking' | 'authenticated' | 'unauthenticated'

function App() {
  const [authStatus, setAuthStatus] = useState<AuthStatus>('checking')
  const [isSubmittingLogin, setIsSubmittingLogin] = useState(false)
  const [authError, setAuthError] = useState('')
  const handleLogoutSuccess = useCallback(() => {
    setAuthStatus('unauthenticated')
    setAuthError('')
  }, [])

  useEffect(() => {
    const loadInitialSession = async () => {
      try {
        setAuthStatus('checking')
        const isValidSession = await validarSessao()
        setAuthStatus(isValidSession ? 'authenticated' : 'unauthenticated')
      } catch {
        setAuthStatus('unauthenticated')
      }
    }
    void loadInitialSession()
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
      const isValidSession = await validarSessao()
      setAuthStatus(isValidSession ? 'authenticated' : 'unauthenticated')
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
      {authStatus === 'checking'
        ? (
          <Card className="panel auth-box auth-box-loading">
            <h2>Validando sessão</h2>
            <div className="resource-loading">
              <ProgressSpinner
                style={{ width: '24px', height: '24px' }}
                strokeWidth="6"
                animationDuration=".9s"
              />
              <p>Verificando credenciais salvas no servidor...</p>
            </div>
          </Card>
        )
        : (
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
        )}
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
