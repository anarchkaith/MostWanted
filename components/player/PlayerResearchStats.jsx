import { useEffect, useMemo, useRef, useState } from 'react';
import CyberSelect from '../ui/CyberSelect';
import ErrorAlert from '../ui/ErrorAlert';
import Skeleton from '../ui/Skeleton';
import SpecialText from '../ui/SpecialText';
import PlayerIntelSignals from './PlayerIntelSignals';
import {
  DEFAULT_SOCIAL_CLUB_PLATFORM, SOCIAL_CLUB_CAREER_SECTIONS, SOCIAL_CLUB_PLATFORMS,
  buildCareerGroups, buildCareerModel, buildWeaponGroups, fetchSocialClubCareer, searchCareerGroups,
} from '../../src/services/socialClubCareer';
import '../../styles/PlayerResearchStats.css';
import { careerAwardLevelLabel } from '../../src/services/socialClubCareerEs';

const RING_RADIUS = 36;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

function StatList({ rows }) {
  if (!rows.length) return null;
  return <dl className="player-research__records">
    {rows.map((row, index) => <div key={`${row.key}-${index}`}>
      <dt>{row.label}</dt><dd>{row.value}</dd>
    </div>)}
  </dl>;
}

function rateLabel(rate, approximate) {
  if (rate === null) return '—';
  const percent = rate * 100;
  const prefix = approximate ? '≈' : '';
  if (percent > 0 && percent < 1) return `${prefix}<1%`;
  if (percent > 99 && percent < 100) return `${prefix}>99%`;
  return `${prefix}${Math.round(percent)}%`;
}

function ResultCard({ result }) {
  const rate = rateLabel(result.rate, result.approximate);
  return <li className="player-research__duel">
    <header>
      <h5>{result.name}</h5>
      {result.rate !== null && <svg viewBox="0 0 96 96" role="img" aria-label={`${rate} de victorias`}>
        <circle className="player-research__ring-track" cx="48" cy="48" r={RING_RADIUS} />
        <circle className="player-research__ring-value" cx="48" cy="48" r={RING_RADIUS}
          strokeDasharray={`${RING_LENGTH * result.rate} ${RING_LENGTH}`} transform="rotate(-90 48 48)" />
        <text x="48" y="54" textAnchor="middle">{rate}</text>
      </svg>}
    </header>
    {result.primary.length > 0 && <dl className="player-research__score">
      {result.primary.map(row => <div key={row.key}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}
    </dl>}
    <StatList rows={result.details} />
  </li>;
}

function MoneyBars({ rows, className }) {
  return <ul className={className}>
    {rows.map((row, index) => <li key={`${row.key}-${index}`}>
      <div><span>{row.label}</span><strong>{row.value}</strong></div>
      {row.ratio !== null && <span className="player-research__bar" aria-hidden="true">
        <span style={{ width: `${row.ratio * 100}%` }} />
      </span>}
    </li>)}
  </ul>;
}

function CareerRows({ rows, showSkills = false }) {
  if (!rows.length) return <p className="player-research__empty">Sin registros para esta categoría.</p>;
  return <dl className="player-research__records">
    {rows.map((row, index) => {
      const skill = showSkills && row.skillAmount !== undefined;
      return <div key={`${row.key}-${index}`} className={row.level ? 'player-research__award' : undefined}>
        <dt>{row.label}</dt>
        <dd>
          <span>{row.value}</span>
          {skill && <small> / 100</small>}
          {row.level && <span className={`player-research__level player-research__level--${row.level}`}>{careerAwardLevelLabel(row.level)}</span>}
          {skill && <meter min="0" max="100" value={row.skillAmount} aria-label={`${row.label}: ${row.value} de 100`} />}
        </dd>
      </div>;
    })}
  </dl>;
}

function CategoryTabs({ groups, selected, onSelect, label }) {
  if (groups.length < 2) return null;
  return <div className="player-research__tabs player-research__category-tabs" role="tablist" aria-label={label}>
    {groups.map((group, index) => <button key={group.name} id={`player-research-category-tab-${index}`}
      type="button" role="tab" aria-controls={`player-research-category-panel-${index}`}
      aria-selected={String(group.name === selected)} onClick={() => onSelect(group.name)}>
      {group.label}<span>{group.rows.length}</span>
    </button>)}
  </div>;
}

function CareerSectionContent({ section, payload, groups, selectedCategory, onSelectCategory, filter, onFilter }) {
  if (section === 'weapons') {
    const weapons = buildWeaponGroups(payload.rows, payload.categories)
      .filter(weapon => !filter || weapon.searchable.includes(filter.toLocaleLowerCase()));
    return <>
      <label className="player-research__filter">
        <span>Filtrar armas</span>
        <input type="search" value={filter} onChange={event => onFilter(event.target.value)} placeholder="Nombre del arma…" />
      </label>
      <p className="player-research__note">{weapons.length} armas · ordenadas por bajas registradas.</p>
      <div className="player-research__weapon-grid">
        {weapons.map(weapon => <section className="player-research__weapon" key={weapon.name}>
          <header><h5>{weapon.label}</h5>{weapon.kills >= 0 && <span>{Math.round(weapon.kills).toLocaleString('es')} bajas</span>}</header>
          <CareerRows rows={weapon.rows} />
        </section>)}
        {!weapons.length && <p className="player-research__empty">No hay armas que coincidan con la búsqueda.</p>}
      </div>
    </>;
  }

  const group = groups.find(item => item.name === selectedCategory) || groups[0];
  if (!group) return <p className="player-research__empty">Esta sección no tiene categorías.</p>;
  if (section === 'stats') {
    const searching = filter.trim().length > 0;
    const visible = searching ? searchCareerGroups(groups, filter) : [group];
    const matches = visible.reduce((count, item) => count + item.rows.length, 0);
    return <div className="player-research__stats">
      <div className="player-research__stats-toolbar">
        <label className="player-research__filter">
          <span>Buscar en estadísticas</span>
          <input type="search" value={filter} onChange={event => onFilter(event.target.value)} placeholder="Nombre, valor o categoría…" />
        </label>
        <p className="player-research__note" role="status">{searching
          ? `${matches} ${matches === 1 ? 'coincidencia' : 'coincidencias'}`
          : `${groups.length} ${groups.length === 1 ? 'categoría' : 'categorías'}`}</p>
      </div>
      {!searching && <CategoryTabs groups={groups} selected={group.name} onSelect={onSelectCategory} label="Categorías de estadísticas" />}
      {!visible.length && <p className="player-research__empty">No hay estadísticas que coincidan con la búsqueda.</p>}
      {visible.map(item => {
        const index = groups.indexOf(group);
        const tabbed = !searching && groups.length > 1;
        return <section className="player-research__stats-group" key={item.name} role={tabbed ? 'tabpanel' : undefined}
          id={tabbed ? `player-research-category-panel-${index}` : undefined}
          aria-labelledby={tabbed ? `player-research-category-tab-${index}` : undefined} tabIndex={tabbed ? 0 : undefined}>
          <header className="player-research__section-heading">
            <h5>{item.label}</h5><span>{item.rows.length} {item.rows.length === 1 ? 'registro' : 'registros'}</span>
          </header>
          <CareerRows rows={item.rows} showSkills={item.name === 'Skills'} />
        </section>;
      })}
    </div>;
  }
  const groupIndex = groups.indexOf(group);
  const rows = group.rows.filter(row => !filter
    || `${row.label} ${row.value}`.toLocaleLowerCase().includes(filter.toLocaleLowerCase()));
  return <>
    <CategoryTabs groups={groups} selected={group.name} onSelect={onSelectCategory} label="Categorías de carrera" />
    <label className="player-research__filter">
      <span>Filtrar registros</span>
      <input type="search" value={filter} onChange={event => onFilter(event.target.value)} placeholder="Nombre o valor…" />
    </label>
    <div role={groups.length > 1 ? 'tabpanel' : undefined}
      id={groups.length > 1 ? `player-research-category-panel-${groupIndex}` : undefined}
      aria-labelledby={groups.length > 1 ? `player-research-category-tab-${groupIndex}` : undefined}
      tabIndex={groups.length > 1 ? 0 : undefined}>
      <p className="player-research__note">{rows.length} de {group.rows.length} registros · {group.label}</p>
      <CareerRows rows={rows} />
    </div>
  </>;
}

export default function PlayerResearchStats({ rid }) {
  const [platform, setPlatform] = useState(DEFAULT_SOCIAL_CLUB_PLATFORM);
  const [section, setSection] = useState('overview');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [filter, setFilter] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ status: 'loading', payload: null, error: '' });
  const cache = useRef(new Map());

  useEffect(() => {
    const controller = new AbortController();
    const key = `${rid}:${platform}:${section}`;
    const cached = cache.current.get(key);
    if (cached) {
      setState({ status: 'ready', payload: cached, error: '' });
      return () => controller.abort();
    }
    setState({ status: 'loading', payload: null, error: '' });
    fetchSocialClubCareer({ rid, platform, section, signal: controller.signal })
      .then(payload => {
        cache.current.set(key, payload);
        setState({ status: 'ready', payload, error: '' });
      })
      .catch(error => {
        if (error.name !== 'AbortError') setState({ status: 'error', payload: null, error: error.message });
      });
    return () => controller.abort();
  }, [rid, platform, section, attempt]);

  const model = useMemo(() => state.payload?.hasCareer && section === 'overview'
    ? buildCareerModel(state.payload.rows) : null, [state.payload, section]);
  const groups = useMemo(() => state.payload?.hasCareer && section !== 'overview' && section !== 'weapons'
    ? buildCareerGroups(state.payload.rows, state.payload.categories) : [], [state.payload, section]);
  useEffect(() => {
    setSelectedCategory('');
    setFilter('');
  }, [platform, section]);
  const platformLabel = SOCIAL_CLUB_PLATFORMS.find(option => option.value === platform)?.label || platform;
  const sectionLabel = SOCIAL_CLUB_CAREER_SECTIONS.find(option => option.value === section)?.label || section;

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

      <PlayerIntelSignals rid={rid} platform={platform} platformLabel={platformLabel} />

      <nav className="player-research__tabs player-research__section-tabs" role="tablist" aria-label="Secciones de carrera">
        {SOCIAL_CLUB_CAREER_SECTIONS.map(item => <button key={item.value} id={`player-research-tab-${item.value}`}
          type="button" role="tab" aria-controls={`player-research-panel-${item.value}`}
          aria-selected={String(section === item.value)} onClick={() => setSection(item.value)}>{item.label}</button>)}
      </nav>

      <div id={`player-research-panel-${section}`} role="tabpanel" aria-labelledby={`player-research-tab-${section}`} tabIndex={0}>
        {state.status === 'loading' && <Skeleton label={`Consultando ${sectionLabel.toLocaleLowerCase()}…`} rows={4} />}
        {state.status === 'error' && <ErrorAlert error={state.error} onRetry={() => setAttempt(count => count + 1)} />}
        {state.status === 'ready' && !state.payload?.hasCareer && <p className="player-research__empty">Sin datos de carrera para {platformLabel}.</p>}

        {model && <div className="player-research__career">
        {model.overview.length > 0 && <section className="player-research__section">
          <div className="player-research__section-heading">
            <h4>Resumen de carrera</h4>
            <span>Datos informados por Social Club</span>
          </div>
          <dl className="player-research__overview">
            {model.overview.map((row, index) => <div key={`${row.key}-${index}`}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}
          </dl>
          {model.overview.some(row => row.key === 'TOTAL_PLAYING_TIME') && <p className="player-research__note">
            El tiempo del resumen puede diferir del tiempo en línea de otras estadísticas.
          </p>}
        </section>}

        {model.competitive.length > 0 && <section className="player-research__section">
          <div className="player-research__section-heading">
            <h4>Resultados competitivos</h4>
            <span>Victorias, partidas y marcas por actividad</span>
          </div>
          <ul className="player-research__duels" aria-label="Resultados competitivos">
            {model.competitive.map(result => <ResultCard key={result.name} result={result} />)}
          </ul>
          {model.competitive.some(result => result.rate !== null) && <p className="player-research__note">
            El anillo muestra el porcentaje de victorias, redondeado.
            {model.competitive.some(result => result.approximate) && ' ≈ indica cifras abreviadas por la fuente.'}
          </p>}
        </section>}

        <div className="player-research__panels">
          {model.criminal.length > 0 && <section className="player-research__panel">
            <div className="player-research__section-heading"><h4>Historial criminal</h4></div>
            <StatList rows={model.criminal} />
          </section>}

          {(model.cash.totals.length > 0 || model.cash.sources.length > 0 || model.cash.details.length > 0) &&
            <section className="player-research__panel">
              <div className="player-research__section-heading"><h4>Actividad financiera</h4></div>
              {model.cash.totals.length > 0 && <>
                <MoneyBars rows={model.cash.totals} className="player-research__money-totals" />
                {model.cash.totals.some(row => row.ratio !== null) && <p className="player-research__note">
                  Ingresos y gastos: escala relativa al monto mayor.
                </p>}
              </>}
              {model.cash.sources.length > 0 && <div className="player-research__details">
                <h5>Fuentes de ingresos registradas</h5>
                <MoneyBars rows={model.cash.sources} className="player-research__money-sources" />
                <p className="player-research__note">Escala relativa a la fuente mayor; los importes pueden superponerse y no sumar el total.</p>
              </div>}
              <StatList rows={model.cash.details} />
            </section>}

          {(model.skills.length > 0 || model.skillDetails.length > 0) && <section className="player-research__panel">
            <div className="player-research__section-heading">
              <h4>Habilidades</h4><span>Escala de 0 a 100</span>
            </div>
            {model.skills.length > 0 && <ul className="player-research__skills">
              {model.skills.map((skill, index) => <li key={`${skill.key}-${index}`}>
                <div><span>{skill.label}</span><strong>{skill.value}<small> / 100</small></strong></div>
                <meter min="0" max="100" value={skill.amount} aria-label={`${skill.label}: ${skill.value} de 100`} />
              </li>)}
            </ul>}
            <StatList rows={model.skillDetails} />
          </section>}

          {model.additional.map(category => <section className="player-research__panel" key={category.name}>
            <div className="player-research__section-heading"><h4>{category.name}</h4></div>
            <StatList rows={category.rows} />
          </section>)}
        </div>
        </div>}

        {state.status === 'ready' && state.payload?.hasCareer && section !== 'overview' && <>
        <div className="player-research__section-heading player-research__data-heading">
          <h4>{sectionLabel}</h4>
          <span>{state.payload.rows.length} registros disponibles</span>
        </div>
        {section === 'weapons'
          ? <CareerSectionContent section={section} payload={state.payload} filter={filter} onFilter={setFilter} />
          : <CareerSectionContent section={section} payload={state.payload} groups={groups}
            selectedCategory={selectedCategory} onSelectCategory={setSelectedCategory}
            filter={filter} onFilter={setFilter} />}
        </>}
      </div>
    </section>
  );
}
