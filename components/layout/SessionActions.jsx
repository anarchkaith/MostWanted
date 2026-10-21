import DiscordAvatar from '../ui/DiscordAvatar';
import Button from '../ui/Button';
import { handleInternalLink } from '../../src/services/appNavigation';

export default function SessionActions({ user, isDemo, canUseReports, isProfileScreen, onNavigate, onLogin, onHelp }) {
  return <>
    {user ? <a className="site-user-profile" href="/perfil" aria-current={isProfileScreen ? 'page' : undefined} onClick={event => handleInternalLink(event, onNavigate, '/perfil')}>
      <DiscordAvatar user={user} />
      <span><strong className="notranslate" translate="no">{user.globalName || user.username}</strong><small>Mi perfil</small></span>
    </a> : isDemo ? <Button variant="secondary" onClick={onLogin}>Iniciar sesión con Discord</Button> : null}
    {canUseReports && <Button variant="secondary" onClick={onHelp} aria-label="Ayuda sobre la herramienta">Ayuda</Button>}
  </>;
}
