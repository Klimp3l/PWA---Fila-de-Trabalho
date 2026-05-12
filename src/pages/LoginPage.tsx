import { Navigate } from 'react-router-dom'
import { Card } from 'primereact/card'
import { LoginForm } from '../components/LoginForm'

interface LoginPageProps {
  onLogin: (usuario: string, senha: string) => Promise<void>
  isSubmittingLogin: boolean
  feedback: string
  isAuthenticated?: boolean
}

export function LoginPage({
  onLogin,
  isSubmittingLogin,
  feedback,
  isAuthenticated = false,
}: LoginPageProps) {
  if (isAuthenticated) {
    return <Navigate to="/home" replace />
  }

  return (
    <Card className="panel auth-box">
      <h2>Acesse sua fila de trabalho</h2>
      <p>Entre com seu usuário para carregar suas atividades.</p>
      <LoginForm
        onSubmit={onLogin}
        isSubmitting={isSubmittingLogin}
        feedback={feedback}
      />
    </Card>
  )
}
