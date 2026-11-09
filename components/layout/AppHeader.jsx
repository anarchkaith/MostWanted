import CyberButtonLabel from '../ui/CyberButtonLabel';
import { handleInternalLink } from '../../src/services/appNavigation.js';

export default function AppHeader({ search = null, actions = null, onNavigate }) {
  return (
    <header className="site-header">
      <a href="/inicio" className="site-brand" onClick={event => handleInternalLink(event, onNavigate, '/inicio')}>
        <img src="/Logo.png" alt="Kaith's Rebels" width="44" height="44" />
        <h1><CyberButtonLabel>MOST WANTED</CyberButtonLabel></h1>
      </a>
      {search}
      <div className="site-header__actions">{actions}</div>
    </header>
  );
}
