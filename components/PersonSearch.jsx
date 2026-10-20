import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchWordpressPlayerInsights } from '../src/services/reportSubmissionService';
import { playerCandidates } from '../src/services/casePresentation';
import { mergePlayerMatches } from '../src/services/playerSearch';
import { lookupCachedPlayer } from './backgroundInvestigation';
import CyberButtonLabel from './CyberButtonLabel';

export default function PersonSearch({ reports, knownPlayers, onSelect }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [remote, setRemote] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(-1);
  const cache = useRef(new Map());
  const resultsRef = useRef(null);
  const term = query.trim();
  const matches = useMemo(() => mergePlayerMatches(
    playerCandidates(reports, term), [...knownPlayers, ...remote], term,
  ), [reports, knownPlayers, remote, term]);

  useEffect(() => {
    setRemote([]);
    setWarnings([]);
    setActive(-1);
    setLoading(false);
    if (!open || term.length < 2) return undefined;
    const key = term.toLocaleLowerCase();
    const saved = cache.current.get(key);
    if (saved) {
      setRemote(saved);
      return undefined;
    }
    const controller = new AbortController();
    const deadline = setTimeout(() => {
      controller.abort();
      setLoading(false);
      setWarnings(current => [...current, 'La búsqueda externa superó el tiempo de espera. Las coincidencias disponibles se conservan. Vuelve a escribir para reintentar.']);
    }, 12000);
    setLoading(true);
    const timer = setTimeout(async () => {
      const found = [];
      const results = await Promise.allSettled([
        fetchWordpressPlayerInsights({
          ...(/^\d+$/.test(term) ? { rid: term } : { username: term }), signal: controller.signal,
        }),
        lookupCachedPlayer(term, controller.signal),
      ].map((request, index) => request.then(player => {
        if (controller.signal.aborted || !player) return;
        const source = index === 0 ? 'Archivo WordPress' : 'Social Club / sc-cache';
        found.push({ ...player, nickname: player.username || player.nickname, count: player.reportCount || 0, source });
        setRemote([...found]);
      })));
      if (controller.signal.aborted) return;
      clearTimeout(deadline);
      const errors = [];
      results.forEach((result, index) => {
        const source = index === 0 ? 'Archivo WordPress' : 'Social Club / sc-cache';
        if (result.status === 'rejected') {
          errors.push(`${source}: ${result.reason.message}`);
        }
      });
      if (!errors.length) cache.current.set(key, found);
      setRemote(found);
      setWarnings(errors);
      setLoading(false);
    }, 450);
    return () => { clearTimeout(timer); clearTimeout(deadline); controller.abort(); };
  }, [term, open]);

  useEffect(() => {
    if (open && active >= 0) resultsRef.current?.querySelector(`#person-match-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const choose = player => {
    setOpen(false);
    setQuery('');
    onSelect(player);
  };
  const submit = event => {
    event.preventDefault();
    if (!term) return;
    if (active >= 0 && matches[active]) return choose(matches[active]);
    if (matches.length === 1) return choose(matches[0]);
    if (matches.length > 1) { setOpen(true); return; }
    choose({ nickname: /^\d+$/.test(term) ? '' : term, rid: /^\d+$/.test(term) ? term : '' });
  };
  return (
    <div className="person-search" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
      <form role="search" aria-label="Buscar personas" onSubmit={submit}>
        <label htmlFor="person-search">BUSCAR PERSONA / NOMBRE O RID</label>
        <div className="person-search__row">
          <div className="cyber-input-full mw-cyber-input">
            <input id="person-search" type="search" role="combobox" aria-label="Nombre de jugador o RID" aria-autocomplete="list" aria-expanded={open && Boolean(term)} aria-controls="person-search-results" aria-activedescendant={open && active >= 0 && active < 12 && matches[active] ? `person-match-${active}` : undefined} value={query} autoComplete="off" placeholder="Nombre, alias o RID…" onFocus={() => setOpen(true)} onChange={event => { setQuery(event.target.value); setActive(-1); setOpen(true); }} onKeyDown={event => {
              if (event.key === 'Escape') { setOpen(false); setActive(-1); }
              if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                setOpen(true);
                const count = Math.min(matches.length, 12);
                setActive(current => {
                  if (!count) return -1;
                  if (current < 0) return event.key === 'ArrowDown' ? 0 : count - 1;
                  return (current + (event.key === 'ArrowDown' ? 1 : count - 1)) % count;
                });
              }
            }} />
          </div>
          <button type="submit" className="cyber-button-small mw-cyber-button" disabled={!term}><CyberButtonLabel>Buscar</CyberButtonLabel></button>
        </div>
      </form>
      <div ref={resultsRef} className="person-search__results" hidden={!open || !term}>
        <div id="person-search-results" role="listbox" aria-label="Personas encontradas">
          {matches.slice(0, 12).map((player, index) => <button type="button" role="option" aria-selected={active === index} id={`person-match-${index}`} key={player.key} onMouseDown={event => event.preventDefault()} onClick={() => choose(player)}>
            <strong translate="no">{player.nickname || `RID ${player.rid}`}</strong>
            <span>{player.rid ? `RID ${player.rid}` : 'Solo nombre'} · {player.sources.join(' / ')}{player.count > 0 ? ` · ${player.count} reporte(s)` : ''}</span>
          </button>)}
        </div>
        {loading && <p role="status">Buscando en archivo y caché…</p>}
        {!loading && !matches.length && <p role="status">No se encontraron coincidencias disponibles. Pulsa Buscar para analizar este nombre o RID.</p>}
        {matches.length > 1 && <p>Selecciona una identidad; un nombre compartido no confirma que sea la misma persona.</p>}
        {matches.length > 12 && <p>Mostrando 12 de {matches.length} coincidencias. Precisa el nombre o utiliza el RID.</p>}
        {warnings.length > 0 && <p role="alert">{warnings.join(' · ')}</p>}
      </div>
    </div>
  );
}
