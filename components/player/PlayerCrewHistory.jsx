import PlayerObservations from '../PlayerObservations';
import Skeleton from '../ui/Skeleton';
import TerminalText from '../ui/TerminalText';

export default function PlayerCrewHistory({ entries, variant, ready }) {
  if (!ready) return <div className="pbp-crews-panel"><Skeleton label="Cargando crews…" /></div>;
  return <div className="pbp-section pbp-crews-panel">
    {variant === 'dossier' ? <TerminalText as="h3" className="pbp-panel-title" text="Crews y afiliaciones" /> : <div className="pbp-current__label">Crews</div>}
    {entries.length ? <div className="pbp-current__crews">
      {entries.map(crew => <span key={`${crew.name}-${crew.source}`} className="pbp-chip">
        <a href={crew.url} target="_blank" rel="noopener noreferrer"><strong>{crew.name}</strong></a>
        <PlayerObservations entry={crew} />
      </span>)}
    </div> : <div className="pbp-empty">Sin crews registradas.</div>}
  </div>;
}
