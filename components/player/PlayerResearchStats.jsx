import { useEffect, useMemo, useState } from 'react';
import CyberSelect from '../ui/CyberSelect';
import ErrorAlert from '../ui/ErrorAlert';
import Skeleton from '../ui/Skeleton';
import SpecialText from '../ui/SpecialText';
import { DEFAULT_SOCIAL_CLUB_PLATFORM, SOCIAL_CLUB_PLATFORMS, buildCareerModel, fetchSocialClubCareer } from '../../src/services/socialClubCareer';
import '../../styles/PlayerResearchStats.css';

const CATEGORY_LABELS = {
  Overview: 'Resumen',
  Competitive: 'Competitivo',
  'Criminal Record': 'Historial criminal',
  Cash: 'Dinero',
  Skills: 'Habilidades',
};
const RING_RADIUS = 36;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

export default function PlayerResearchStats({ rid }) {
  const [platform, setPlatform] = useState(DEFAULT_SOCIAL_CLUB_PLATFORM);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ status: 'loading', payload: null, error: '' });

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading', payload: null, error: '' });
    fetchSocialClubCareer({ rid, platform, signal: controller.signal })
      .then(payload => setState({ status: 'ready', payload, error: '' }))
      .catch(error => {
        if (error.name !== 'AbortError') setState({ status: 'error', payload: null, error: error.message });
      });
    return () => controller.abort();
  }, [rid, platform, attempt]);

  const model = useMemo(() => state.payload?.hasCareer ? buildCareerModel(state.payload.rows) : null, [state.payload]);
  const platformLabel = SOCIAL_CLUB_PLATFORMS.find(option => option.value === platform)?.label || platform;

  return (
    <section className="player-research" aria-labelledby="player-research-title" aria-busy={state.status === 'loading'}>
      <header className="player-research__header">
        <div>
          <p className="player-research__eyebrow">Social Club · Investigación</p>
          <h3 id="player-research-title"><SpecialText>Estadísticas de carrera</SpecialText></h3>
        </div>
        <CyberSelect id="player-research-platform" aria-label="Plataforma" value={platform}
          options={SOCIAL_CLUB_PLATFORMS} onChange={setPlatform} />
      </header>

      {state.status === 'loading' && <Skeleton label="Consultando estadísticas…" rows={4} />}
      {state.status === 'error' && <ErrorAlert error={state.error} onRetry={() => setAttempt(count => count + 1)} />}
      {state.status === 'ready' && !model && <p className="player-research__empty">Sin datos de carrera para {platformLabel}.</p>}

      {model && <>
        <dl className="player-research__overview">
          {model.overview.map(row => <div key={row.key}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}
        </dl>

        {model.duels.length > 0 && <ul className="player-research__duels" aria-label="Tasa de victorias">
          {model.duels.map(duel => {
            const percent = Math.round(duel.rate * 100);
            return <li key={duel.name}>
              <svg viewBox="0 0 96 96" role="img" aria-label={`${duel.name}: ${percent}% de victorias`}>
                <circle className="player-research__ring-track" cx="48" cy="48" r={RING_RADIUS} />
                <circle className="player-research__ring-value" cx="48" cy="48" r={RING_RADIUS}
                  strokeDasharray={`${RING_LENGTH * duel.rate} ${RING_LENGTH}`} transform="rotate(-90 48 48)" />
                <text x="48" y="54" textAnchor="middle">{percent}%</text>
              </svg>
              <div>
                <strong>{duel.name}</strong>
                <span>{duel.won.toLocaleString('es')} victorias · {duel.lost.toLocaleString('es')} derrotas</span>
              </div>
            </li>;
          })}
        </ul>}

        <div className="player-research__panels">
          {model.categories.map(category => <article className="player-research__panel" key={category.name}>
            <h4>{CATEGORY_LABELS[category.name] || category.name}</h4>
            {category.items.length > 0 && <ul className="player-research__bars">
              {category.items.map(item => <li key={item.key}>
                <div><span>{item.label}</span><strong>{item.value}</strong></div>
                <span className="player-research__bar" aria-hidden="true"><span style={{ width: `${item.ratio * 100}%` }} /></span>
              </li>)}
            </ul>}
            {category.texts.length > 0 && <dl className="player-research__texts">
              {category.texts.map(row => <div key={row.key}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}
            </dl>}
          </article>)}
        </div>
      </>}
    </section>
  );
}
