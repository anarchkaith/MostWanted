import PlayerObservations from '../PlayerObservations';
import Skeleton from '../ui/Skeleton';
import TerminalText from '../ui/TerminalText';
import SocialClubProfileLink from './SocialClubProfileLink';

export default function PlayerNameHistory({ entries, variant, ready }) {
  if (!ready) return <div className="pbp-names-panel"><Skeleton label="Cargando nombres y alias…" rows={5} /></div>;
  if (!entries.length) return null;
  const isDossier = variant === 'dossier';
  return <div className="pbp-section pbp-names-panel">
    {isDossier ? <TerminalText as="h3" className="pbp-panel-title" text="Nombres y alias" /> : <div className="pbp-current__label">Nombres</div>}
    <ol className="pbp-history-list" aria-label="Historial de nombres con fechas y fuentes">
      {entries.map((entry, index) => <li key={`${entry.name}-${entry.time}-${index}`} className="pbp-history-item">
        <div className="pbp-name-row">
          <strong className="notranslate" translate="no">{entry.name}</strong>
          <SocialClubProfileLink name={entry.name} />
        </div>
        {isDossier
          ? entry.time > 0 && <time className="pbp-history-time" dateTime={new Date(entry.time * 1000).toISOString()}>{new Date(entry.time * 1000).toLocaleDateString('es-ES')}</time>
          : <PlayerObservations entry={entry} />}
      </li>)}
    </ol>
  </div>;
}
