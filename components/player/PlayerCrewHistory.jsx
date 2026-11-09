import PlayerObservations from '../PlayerObservations';
import Skeleton from '../ui/Skeleton';

export default function PlayerCrewHistory({ entries, ready }) {
  if (!ready) return <div className="pbp-crews-panel"><Skeleton label="Cargando crews…" /></div>;
  if (!entries.length) return null;
  return <div className="pbp-section pbp-crews-panel">
    <div className="pbp-current__label">Crews</div>
    <div className="pbp-current__crews">
      {entries.map(crew => <span key={`${crew.name}-${crew.source}`} className="pbp-chip">
        <a href={crew.url} target="_blank" rel="noopener noreferrer"><strong>{crew.name}</strong></a>
        <PlayerObservations entry={crew} />
      </span>)}
    </div>
  </div>;
}
