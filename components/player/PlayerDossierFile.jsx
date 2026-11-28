import Skeleton from '../ui/Skeleton';
import PlayerObservations from '../PlayerObservations';
import CurrentPlayerAvatars from './CurrentPlayerAvatars';
import PlayerAvatarHistory from './PlayerAvatarHistory';
import SocialClubProfileLink from './SocialClubProfileLink';
import CrewChip from '../CrewChip';
import { getCrewPrivacyLabel } from '../../src/services/crewSearch';

const formatDate = time => new Date(time * 1000).toLocaleDateString('es-ES');
const CREW_TYPES = { chatterBoxes: 'Conversadores', thrillSeekers: 'Buscadores de emociones', rebels: 'Rebeldes', soldiers: 'Soldados', allStars: 'Estrellas' };

function crewCreatedAt(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) || date.getUTCFullYear() < 2000
    ? '' : date.toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function CrewDetails({ details }) {
  if (!details) return null;
  const privacy = getCrewPrivacyLabel(details);
  const created = crewCreatedAt(details.createdAt);
  const type = CREW_TYPES[details.crewType];
  return <>
    {details.crewMotto && <p className="dz-crews__motto" translate="no">“{details.crewMotto}”</p>}
    <dl className="dz-crews__facts">
      {Number.isSafeInteger(details.memberCount) && details.memberCount >= 0 && <div>
        <dt>Integrantes</dt><dd>{details.memberCount.toLocaleString('es')}</dd>
      </div>}
      {details.division && <div><dt>División</dt><dd>{details.division}</dd></div>}
      {type && <div><dt>Tipo</dt><dd>{type}</dd></div>}
      {privacy && <div><dt>Acceso</dt><dd>{privacy}</dd></div>}
      {created && <div><dt>Creada</dt><dd>{created}</dd></div>}
    </dl>
  </>;
}

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
    {entries.map(crew => <li key={crew.socialClub ? `social-club-${crew.socialClub.id}` : `history-${crew.name}`} className="dz-crews__item">
      {crew.socialClub && <img className="dz-crews__emblem"
        src={`https://prod.cloud.rockstargames.com/crews/sc/6266/${crew.socialClub.id}/publish/emblem/emblem_256.png`}
        alt="" loading="lazy" onError={event => { event.currentTarget.hidden = true; }} />}
      <div className="dz-crews__info">
        <div className="dz-crews__identity">
          <a className="dz-crews__name" href={crew.url} target="_blank" rel="noopener noreferrer" translate="no">{crew.name}</a>
          {crew.socialClub?.tag && <CrewChip as="span" name={crew.name} tag={crew.socialClub.tag} colour={crew.socialClub.color} />}
        </div>
        <CrewDetails details={crew.socialClub?.details} />
        <PlayerObservations entry={crew} />
      </div>
    </li>)}
  </ul>;
}

export default function PlayerDossierFile({
  investigation, username, rid, isLoading, error, names, crews, historicalAvatars, onOpenAvatar,
  classification = null, verification = null, caseManagement = null,
  crewLookup = { status: 'idle' }, onRetryCrew,
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

          {ready && (crews.length > 0 || ['loading', 'error', 'not-found', 'details-error'].includes(crewLookup.status)) && <div className="dz-subsection">
            <h4 className="dz-label">Crews y afiliaciones</h4>
            <CrewList entries={crews} />
            {crewLookup.status === 'loading' && <Skeleton label="Consultando crew de Social Club…" rows={1} />}
            {crewLookup.status === 'error' && <p className="dz-crews__error" role="alert">
              No se pudo consultar la crew de Social Club: {crewLookup.error} <button type="button" onClick={onRetryCrew}>Reintentar</button>
            </p>}
            {crewLookup.status === 'not-found' && <p className="dz-crews__error">No se encontró una cuenta de Social Club con este RID en la búsqueda.</p>}
            {crewLookup.status === 'details-error' && <p className="dz-crews__error" role="alert">
              No se pudieron consultar los detalles de la crew. <button type="button" onClick={onRetryCrew}>Reintentar</button>
            </p>}
            {crewLookup.detailsStatus === 'not_found' && <p className="dz-crews__error">
              No se encontraron detalles para el ID de esta crew.
            </p>}
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
