import React, { useMemo, useState } from 'react';
import usePlayerInvestigation from './usePlayerInvestigation';
import ImageViewer from './ImageViewer';
import { mergePlayerProfile } from '../src/services/playerProfile';
import PlayerIdentification from './player/PlayerIdentification';
import PlayerAvatarHistory from './player/PlayerAvatarHistory';
import PlayerNameHistory from './player/PlayerNameHistory';
import PlayerCrewHistory from './player/PlayerCrewHistory';
import Skeleton from './ui/Skeleton';

const normalizeName = value => String(value || '').trim().toLowerCase();

export default function PlayerBackgroundPanel({
  username = '',
  rid = '',
  variant = 'default',
  onInvestigationChange = null,
  investigateToken = 0,
  initialInvestigation = null,
  reports = null,
  onInvestigatingChange = null,
  caseManagement = null,
  classification = null,
  verification = null,
}) {
  const request = useMemo(() => investigateToken > 0 ? { username, rid, token: investigateToken } : null, [username, rid, investigateToken]);
  const { investigation, isLoading, error } = usePlayerInvestigation({
    request, initialInvestigation, onChange: onInvestigationChange, onLoadingChange: onInvestigatingChange,
  });
  const [expandedAvatar, setExpandedAvatar] = useState(null);
  const closeAvatar = React.useCallback(() => setExpandedAvatar(null), []);

  const displayedProfile = useMemo(() => investigation ? mergePlayerProfile({
    username, rid: investigation.rid || rid, profile: investigation.currentProfile,
    reportInsights: investigation.reportInsights, reports: reports || [], currentAvatars: investigation.avatares || [],
  }) : null, [investigation, username, rid, reports]);
  const displayedName = normalizeName(investigation?.nombre || displayedProfile?.name);
  const otherNameEntries = useMemo(() => (displayedProfile?.nameHistory || [])
    .filter(entry => normalizeName(entry.name) !== displayedName), [displayedProfile, displayedName]);
  const crewEntries = displayedProfile?.crewHistory || [];
  const avatarHistory = investigation && (
    <PlayerAvatarHistory avatars={displayedProfile?.historicalAvatars || []} playerName={investigation.nombre} onOpen={setExpandedAvatar} />
  );
  const showHistory = Boolean(investigation || !error);
  const namesPanel = showHistory && <PlayerNameHistory entries={otherNameEntries} variant={variant} ready={Boolean(investigation)} />;
  const crewsPanel = showHistory && <PlayerCrewHistory entries={crewEntries} variant={variant} ready={Boolean(investigation)} />;
  const hasCrews = Boolean(investigation && crewEntries.length);
  const hasArchivedAvatars = Boolean(investigation && displayedProfile?.historicalAvatars.length);

  if ((!username || username.trim().length === 0) && !rid) {
    return null;
  }

  // Mantener el panel visible cuando hay carga o error para informar estado de APIs.
  if (variant !== 'dossier' && !investigation?.nombre && !isLoading && !error) {
    return null;
  }

  return (
    <>
      {expandedAvatar && <ImageViewer image={expandedAvatar} onClose={closeAvatar} />}
      <div className={`player-background-panel${variant === 'dossier' ? ' player-background-panel--dossier' : ''}`}>
        <div className="pbp-header">
          <span className="pbp-icon">🔍</span>
          <span className="pbp-title">FICHA DE ANTECEDENTES</span>
        </div>

        <div className="pbp-content">
          {isLoading && (
            <Skeleton label="Cargando información del jugador…" rows={2} />
          )}

          {error && (
            <div className="pbp-status pbp-status--error" role="alert">
              <strong className="pbp-status__title">Error en la investigación</strong>
              <span className="pbp-status__detail">{error}</span>
            </div>
          )}
          {investigation?.warnings?.map(warning => <p className="pbp-status-detail" role="status" key={warning}>{warning}</p>)}

          {variant === 'dossier' && <>
            <div className="pbp-current">
              <PlayerIdentification investigation={investigation} username={username} rid={rid} variant={variant}
                isLoading={isLoading} error={error} onOpenAvatar={setExpandedAvatar}>
                {namesPanel}
                {hasArchivedAvatars && avatarHistory}
              </PlayerIdentification>
            </div>
            {(classification || verification) && <div className="pbp-assessment" role="group" aria-label="Análisis y valoración del caso">
              {classification}
              {verification}
            </div>}
            {hasCrews && <div className="pbp-history" role="group" aria-label="Antecedentes del jugador">{crewsPanel}</div>}
            {caseManagement}
          </>}

          {variant !== 'dossier' && investigation && <div className="pbp-current">
            <PlayerIdentification investigation={investigation} username={username} rid={rid} variant={variant}
              isLoading={isLoading} error={error} onOpenAvatar={setExpandedAvatar} />
            <section className="pbp-intel-panel" aria-label="Historial del jugador">
              <h3 className="pbp-panel-title">Historial</h3>
              {namesPanel}
              {crewsPanel}
              {avatarHistory}
            </section>
          </div>}
        </div>
      </div>
    </>
  );
}
