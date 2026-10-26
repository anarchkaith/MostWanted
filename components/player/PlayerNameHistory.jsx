import PlayerObservations from '../PlayerObservations';
import Skeleton from '../ui/Skeleton';
import TerminalText from '../ui/TerminalText';
import SocialClubProfileLink from './SocialClubProfileLink';

export default function PlayerNameHistory({ entries, variant, ready }) {
  if (!ready) return <div className="pbp-names-panel"><Skeleton label="Cargando nombres y alias…" rows={5} /></div>;
  return <div className="pbp-section pbp-names-panel">
    {variant === 'dossier' ? <TerminalText as="h3" className="pbp-panel-title" text="Nombres y alias" /> : <div className="pbp-current__label">Nombres</div>}
    {entries.length ? <ol className="pbp-history-list" aria-label="Historial de nombres con fechas y fuentes">
      {entries.map((entry, index) => <li key={`${entry.name}-${entry.time}-${index}`} className="pbp-history-item">
        <div className="pbp-name-row">
          <strong className="notranslate" translate="no">{entry.name}</strong>
          <SocialClubProfileLink name={entry.name} />
        </div>
        <PlayerObservations entry={entry} />
      </li>)}
    </ol> : <div className="pbp-empty">Sin alias detectados.</div>}
  </div>;
}
