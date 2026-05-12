import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from 'primereact/button'
import { InputText } from 'primereact/inputtext'
import { Password } from 'primereact/password'
import { Message } from 'primereact/message'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faRightToBracket } from '@fortawesome/free-solid-svg-icons'

interface LoginFormProps {
  onSubmit: (usuario: string, senha: string) => Promise<void>
  isSubmitting: boolean
  feedback: string
}

export function LoginForm({ onSubmit, isSubmitting, feedback }: LoginFormProps) {
  const [usuario, setUsuario] = useState('')
  const [senha, setSenha] = useState('')
  const [validationError, setValidationError] = useState('')

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!usuario.trim() || !senha.trim()) {
      setValidationError('Informe usuário e senha para continuar.')
      return
    }

    setValidationError('')
    try {
      await onSubmit(usuario.trim(), senha)
    } catch {
      // O feedback de erro de autenticação é controlado pelo App.
    }
  }

  return (
    <form className="auth-form" onSubmit={(event) => void handleSubmit(event)}>
      <label className="auth-field">
        <span>Usuário</span>
        <InputText
          className="auth-input"
          autoComplete="username"
          placeholder="Digite o usuário"
          value={usuario}
          onChange={(event) => setUsuario(event.target.value)}
        />
      </label>

      <label className="auth-field">
        <span>Senha</span>
        <Password
          className="auth-input"
          inputClassName="auth-input"
          autoComplete="current-password"
          placeholder="Digite a senha"
          value={senha}
          onChange={(event) => setSenha(event.target.value ?? '')}
          feedback={false}
          toggleMask
        />
      </label>

      <Button
        className="app-btn primary"
        type="submit"
        disabled={isSubmitting}
      >
        <FontAwesomeIcon icon={faRightToBracket} />
        <span>{isSubmitting ? 'Entrando...' : 'Entrar'}</span>
      </Button>

      {(validationError || feedback) && (
        <Message className="auth-feedback" severity="error" text={validationError || feedback} />
      )}
    </form>
  )
}
