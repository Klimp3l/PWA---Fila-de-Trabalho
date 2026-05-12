import { Button } from 'primereact/button'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowRightFromBracket, faCloud, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons'

interface AppHeaderProps {
  isOnline: boolean
  canLogout: boolean
  onLogout: () => Promise<void>
  isSubmittingLogout: boolean
}

export function AppHeader({
  isOnline,
  canLogout,
  onLogout,
  isSubmittingLogout,
}: AppHeaderProps) {
  return (
    <header className="app-topbar">
      <div className="app-title">
        <h1>Fila de Trabalho</h1>
      </div>
      <strong className={isOnline ? 'status-pill online' : 'status-pill offline'}>
        <FontAwesomeIcon icon={isOnline ? faCloud : faTriangleExclamation} />
        {isOnline ? 'Online' : 'Offline'}
      </strong>
      {canLogout && (
        <Button
          className="app-btn danger"
          onClick={() => void onLogout()}
          disabled={isSubmittingLogout}
          outlined
        >
          <FontAwesomeIcon icon={faArrowRightFromBracket} />
          <span>{isSubmittingLogout ? 'Saindo...' : 'Sair'}</span>
        </Button>
      )}
    </header>
  )
}
