import Skeleton from '../ui/Skeleton';
import PlayerObservations from '../PlayerObservations';
import CurrentPlayerAvatars from './CurrentPlayerAvatars';
import PlayerAvatarHistory from './PlayerAvatarHistory';
import SocialClubProfileLink from './SocialClubProfileLink';

const formatDate = time => new Date(time * 1000).toLocaleDateString('es-ES');

function NameList({ entries }) {
  return <ol className="dz-names">
    {entries.map((entry, index) => <li key={`${entry.name}-${entry.time}-${index}`} className="dz-names__item">
      <div className="dz-names__main">
        <strong className="dz-names__name notranslate" translate="no">{entry.name}</strong>
        {entry.time > 0 && <time className="dz-names__date" dateTime={new Date(entry.time * 1000).toISOString()}>{formatDate(entry.time)}</time>}
      </div>
      <SocialClubProfileLink name={entry.name} />
    </li>)}
  </ol>;
}

function CrewList({ entries }) {
  return <ul className="dz-crews">
    {entries.map(crew => <li key={`${crew.name}-${crew.source}`} className="dz-crews__item">
      <a className="dz-crews__name" href={crew.url} target="_blank" rel="noopener noreferrer">{crew.name}</a>
      <PlayerObservations entry={crew} />
    </li>)}
  </ul>;
}

export default function PlayerDossierFile({
  investigation, username, rid, isLoading, error, names, crews, historicalAvatars, onOpenAvatar,
  classification = null, verification = null, caseManagement = null,
}) {
  const ready = Boolean(investigation);
  const showHistory = ready || !error;
  const playerName = investigation?.nombre || username || `RID ${rid}`;
  const socialClubName = playerName === `RID ${investigation?.rid || rid}` ? username : playerName;
  const accountStatus = investigation?.accountStatus;
  const loadingIdentity = isLoading || (!ready && !error);

  const hasAvatars = Boolean(investigation?.avatares?.length) || historicalAvatars.length > 0;
  const shownRid = investigation?.rid || rid;

  return <div className="dz-file">
    <section className="dz-identity" aria-label="Identificación">
      <div className="dz-identity__body">
        <div className="dz-identity__main">
          <div className="dz-identity__name">
            <p className="dz-identity__player notranslate" translate="no">{playerName}</p>
            {accountStatus && <span className={`dz-stamp dz-stamp--${accountStatus.tone || 'neutral'}`}>{accountStatus.label}</span>}
            <SocialClubProfileLink name={socialClubName} />
          </div>
          {shownRid && <span className="dz-rid">RID {shownRid}</span>}

          {showHistory && (!ready || names.length > 0) && <div className="dz-subsection">
            <h4 className="dz-label">Nombres y alias</h4>
            {!ready ? <Skeleton label="Cargando nombres y alias…" rows={3} />
              : <NameList entries={names} />}
          </div>}

          {ready && crews.length > 0 && <div className="dz-subsection">
            <h4 className="dz-label">Crews y afiliaciones</h4>
            <CrewList entries={crews} />
          </div>}
        </div>

        {(loadingIdentity || hasAvatars) && <aside className="dz-identity__media" aria-label="Avatares del jugador">
          {loadingIdentity
            ? <Skeleton label="Cargando avatares…" rows={2} />
            : investigation && <CurrentPlayerAvatars key={`${investigation.rid}:${investigation.nombre}`} investigation={investigation} onOpen={onOpenAvatar} label="Avatares actuales" />}
          {ready && historicalAvatars.length > 0 && <PlayerAvatarHistory avatars={historicalAvatars} playerName={investigation.nombre} onOpen={onOpenAvatar} label="Avatares anteriores" />}
        </aside>}
      </div>
    </section>

    {(classification || verification) && <div className="dz-analysis" role="group" aria-label="Análisis y valoración del caso">
      {classification && <div className="dz-section dz-analysis__item">{classification}</div>}
      {verification && <div className="dz-section dz-analysis__item">{verification}</div>}
    </div>}

    {caseManagement}
  </div>;
}
