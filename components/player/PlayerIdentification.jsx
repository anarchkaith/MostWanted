import Skeleton from '../ui/Skeleton';
import TerminalText from '../ui/TerminalText';
import CurrentPlayerAvatars from './CurrentPlayerAvatars';
import SocialClubProfileLink from './SocialClubProfileLink';
import { createPlayerAvatarSlots } from '../../src/services/playerAvatarState';

export default function PlayerIdentification({ investigation, username, rid, variant, isLoading, error, actions, onOpenAvatar }) {
  const playerName = investigation?.nombre || username || `RID ${rid}`;
  const socialClubName = playerName === `RID ${investigation?.rid || rid}` ? username : playerName;
  const accountStatus = investigation?.accountStatus;
  const stats = [
    { label: 'Reportes previos', value: investigation?.reportInsights ? String(investigation.reportInsights.reportCount ?? 'Desconocido') : 'Desconocido' },
    { label: 'Ultimo registro', value: investigation?.reportInsights?.lastReportAtReadable || investigation?.profile?.lastSeenReadable || 'Desconocido' },
  ];
  const avatarKey = JSON.stringify([investigation?.rid, investigation?.nombre, createPlayerAvatarSlots(investigation?.avatares || [])]);
  return <div className="pbp-overview" role={variant === 'dossier' ? 'group' : undefined} aria-label={variant === 'dossier' ? 'Identidad y acciones del jugador' : undefined}>
    <div className="pbp-identity-panel">
      <div className="pbp-identity-header">
        <div className="pbp-identity-header__copy">
          {variant === 'dossier' && <TerminalText as="h3" className="pbp-panel-title" text="Identificación" />}
          {!investigation?.currentProfile && <div className="pbp-identity-header__eyebrow">{investigation?.reportInsights ? 'Perfil archivado' : 'Identidad sin confirmar'}</div>}
          <div className="pbp-name-row pbp-name-row--primary">
            <div className="pbp-current__name notranslate" translate="no">{playerName}</div>
            <SocialClubProfileLink name={socialClubName} />
          </div>
          <dl className="pbp-identity-rid"><dt>RID (Rockstar ID)</dt><dd>{investigation?.rid || rid || 'Sin confirmar'}</dd></dl>
        </div>
      </div>
      {isLoading || (!investigation && !error) ? <Skeleton label="Cargando identificación y avatares…" rows={4} />
        : investigation && <CurrentPlayerAvatars key={avatarKey} investigation={investigation} onOpen={onOpenAvatar} />}
      <div className="pbp-current__info">
        {accountStatus && <div className="pbp-badge-row">
          {variant === 'dossier' && <span className="pbp-current__label">Situación de la cuenta</span>}
          <span className={`pbp-status-badge pbp-status-badge--${accountStatus.tone || 'neutral'}`}>{accountStatus.label}</span>
          {accountStatus.detail && <span className="pbp-status-detail">{accountStatus.detail}</span>}
        </div>}
      </div>
      {variant !== 'dossier' && <div className="pbp-current__summary">
        {stats.map(item => <div key={item.label} className="pbp-stat-card">
          <div className="pbp-stat-card__label">{item.label}</div>
          <div className="pbp-stat-card__value">{item.value}</div>
        </div>)}
      </div>}
      {variant === 'dossier' && actions}
    </div>
  </div>;
}
