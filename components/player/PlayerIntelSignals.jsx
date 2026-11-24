import { useEffect, useState } from 'react';
import ErrorAlert from '../ui/ErrorAlert';
import Skeleton from '../ui/Skeleton';
import { fetchPlayerIntel } from '../../src/services/socialClubCareer';

const SEVERITY_LABELS = { alta: 'Alta', media: 'Media', baja: 'Baja' };
const SEVERITIES = ['alta', 'media', 'baja'];

const count = value => Math.round(value).toLocaleString('es');
const percent = value => `${Math.round(value * 100)}%`;

const METRICS = [
  { key: 'rank', label: 'Rango', signal: 'rank_over_cap', format: count },
  { key: 'kdRatio', label: 'K/D contra jugadores', format: value => value.toFixed(2) },
  { key: 'accuracy', label: 'Impactos / disparos registrados', format: percent },
  { key: 'headshotRate', label: 'Tiros a la cabeza', format: percent },
  { key: 'rpPerHour', label: 'RP por hora', format: count },
  { key: 'hoursOnline', label: 'Horas en línea', format: count },
];

/**
 * Señales de incongruencia calculadas por el servidor a partir de Social Club y del historial de nombres.
 */
export default function PlayerIntelSignals({ rid, platform, platformLabel }) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ status: 'loading', intel: null, error: '' });

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading', intel: null, error: '' });
    fetchPlayerIntel({ rid, signal: controller.signal })
      .then(intel => setState({ status: 'ready', intel, error: '' }))
      .catch(error => {
        if (error.name !== 'AbortError') setState({ status: 'error', intel: null, error: error.message });
      });
    return () => controller.abort();
  }, [rid, attempt]);

  const { intel } = state;
  const metrics = intel?.platforms.find(entry => entry.platform === platform)?.metrics;
  const visibleSignals = intel?.signals.filter(entry => !entry.platform || entry.platform === platform) || [];
  const flagged = new Map(visibleSignals.map(entry => [entry.id, entry.severity]));
  const otherPlatforms = intel ? intel.platforms.filter(entry => entry.platform !== platform)
    .map(entry => ({ ...entry, total: intel.signals.filter(item => item.platform === entry.platform).length }))
    .filter(entry => entry.total > 0) : [];
  const total = visibleSignals.length;

  return (
    <section className="player-intel" aria-labelledby="player-intel-title" aria-busy={state.status === 'loading'}>
      <header className="player-intel__header">
        <h4 id="player-intel-title">Señales de incongruencia</h4>
        {intel?.found && <p className="player-intel__tally" aria-label="Señales por severidad">
          {SEVERITIES.map(severity => {
            const amount = visibleSignals.filter(entry => entry.severity === severity).length;
            return <span key={severity} className={`player-intel__badge player-intel__badge--${severity}`} data-empty={amount === 0}>
              {amount} {SEVERITY_LABELS[severity].toLowerCase()}
            </span>;
          })}
        </p>}
      </header>

      {state.status === 'loading' && <Skeleton label="Analizando incongruencias…" rows={2} />}
      {state.status === 'error' && <ErrorAlert error={state.error} onRetry={() => setAttempt(value => value + 1)} />}
      {state.status === 'ready' && !intel.found && <p className="player-intel__empty">No se encontró la cuenta en Social Club.</p>}

      {state.status === 'ready' && intel.found && <>
        {total > 0 && <div className="player-intel__meter" role="img"
          aria-label={SEVERITIES.map(severity => `${visibleSignals.filter(entry => entry.severity === severity).length} ${SEVERITY_LABELS[severity].toLowerCase()}`).join(', ')}>
          {SEVERITIES.map(severity => {
            const amount = visibleSignals.filter(entry => entry.severity === severity).length;
            return amount > 0 && <span key={severity} className={`player-intel__meter-${severity}`} style={{ flexGrow: amount }} />;
          })}
        </div>}

        {metrics && <dl className="player-intel__metrics">
          {METRICS.filter(metric => Number.isFinite(metrics[metric.key])).map(metric => {
            const severity = metric.signal && flagged.get(metric.signal);
            return <div key={metric.key} className={severity ? `player-intel__metric--${severity}` : undefined}>
              <dt>{metric.label}</dt>
              <dd>{metric.format(metrics[metric.key])}</dd>
            </div>;
          })}
        </dl>}

        {!metrics && <p className="player-intel__empty">Sin estadísticas disponibles de {platformLabel} para evaluar.</p>}
        {total === 0
          ? metrics && <p className="player-intel__empty">No se detectaron señales en {platformLabel} con los datos disponibles.</p>
          : <ul className="player-intel__signals">
            {visibleSignals.map(entry => <li key={`${entry.id}-${entry.platform || 'cuenta'}`} className={`player-intel__signal player-intel__signal--${entry.severity}`}>
              <div className="player-intel__signal-head">
                <span className={`player-intel__badge player-intel__badge--${entry.severity}`}>{SEVERITY_LABELS[entry.severity]}</span>
                <strong>{entry.title}</strong>
                {!entry.platform && <span className="player-intel__scope">Cuenta</span>}
              </div>
              <p>{entry.detail}</p>
              <small>Valor {entry.value} · umbral {entry.threshold}</small>
            </li>)}
          </ul>}

        {otherPlatforms.length > 0 && <p className="player-intel__note">
          También hay señales en {otherPlatforms.map(entry => `${entry.label} (${entry.total})`).join(', ')}.
        </p>}
        {intel.limitations?.length > 0 && <ul className="player-intel__limits">
          {intel.limitations.map(text => <li key={text}>{text}</li>)}
        </ul>}
        <p className="player-intel__note">Las métricas son informativas. Solo se señalan límites verificables; el dinero no se evalúa. Una incongruencia puede ser un error de la fuente, no prueba uso de mods. No encontrar señales tampoco descarta su uso.</p>
      </>}
    </section>
  );
}
