import { useEffect, useMemo, useRef, useState } from 'react';
import { playerCandidates } from '../src/services/casePresentation';
import { fetchArchiveSearch, mergePlayerMatches, searchExcerpt } from '../src/services/playerSearch';
import CyberButtonLabel from './ui/CyberButtonLabel';
import SpecialTextContent from './ui/SpecialTextContent';
import Skeleton from './ui/Skeleton';

function appendResults(current, incoming) {
  return [...new Map([...current, ...incoming].map(item => [`${item.rid}:${item.nickname}`, item])).values()];
}

export default function PersonSearch({ reports, knownPlayers, onSelect, revision }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [remote, setRemote] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(-1);
  const [resultLimit, setResultLimit] = useState(12);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [retry, setRetry] = useState(0);
  const cache = useRef(new Map());
  const lastSearch = useRef('');
  const resultsRef = useRef(null);
  const term = query.trim();
  useEffect(() => { cache.current.clear(); lastSearch.current = ''; setPage(1); }, [revision]);
  const matches = useMemo(() => mergePlayerMatches(
    playerCandidates(reports, term), [...knownPlayers, ...remote], term,
  ), [reports, knownPlayers, remote, term]);

  useEffect(() => {
    const searchKey = `${revision}:${term}`;
    const changed = lastSearch.current !== searchKey;
    if (changed) {
      lastSearch.current = searchKey;
      setRemote([]);
      setResultLimit(12);
      setPage(1);
      setTotal(0);
      setHasMore(false);
    }
    setWarnings([]);
    setActive(-1);
    setLoading(false);
    if (!open || !term) return undefined;
    const currentPage = changed ? 1 : page;
    const key = `${term.toLocaleLowerCase()}:${currentPage}`;
    const saved = cache.current.get(key);
    if (saved) {
      setRemote(current => currentPage === 1 ? saved.items : appendResults(current, saved.items));
      setHasMore(saved.hasMore);
      setTotal(saved.total);
      return undefined;
    }
    const controller = new AbortController();
    const deadline = setTimeout(() => {
      controller.abort();
      setLoading(false);
      setWarnings(current => [...current, 'La búsqueda del archivo superó el tiempo de espera. Las coincidencias disponibles se conservan.']);
    }, 12000);
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const result = await fetchArchiveSearch({ query: term, page: currentPage, signal: controller.signal });
        if (controller.signal.aborted) return;
        cache.current.set(key, result);
        setRemote(current => currentPage === 1 ? result.items : appendResults(current, result.items));
        setHasMore(result.hasMore);
        setTotal(result.total);
      } catch (error) {
        if (!controller.signal.aborted) setWarnings([error.message]);
      } finally {
        clearTimeout(deadline);
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 450);
    return () => { clearTimeout(timer); clearTimeout(deadline); controller.abort(); };
  }, [term, open, revision, page, retry]);

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
    setOpen(true);
  };
  return (
    <div className="person-search" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
      <form role="search" aria-label="Buscar jugadores, reportes y resúmenes" onSubmit={submit}>
        <label htmlFor="person-search">Buscar en MostWanted</label>
        <div className="person-search__row">
          <div className="cyber-input-full mw-cyber-input">
            <input id="person-search" type="search" role="combobox" aria-label="Nombre, RID o palabras clave" aria-autocomplete="list" aria-expanded={open && Boolean(term)} aria-controls="person-search-results" aria-activedescendant={open && active >= 0 && active < resultLimit && matches[active] ? `person-match-${active}` : undefined} value={query} maxLength={100} autoComplete="off" placeholder="Nombre, RID o palabras clave…" onFocus={() => setOpen(true)} onChange={event => { setQuery(event.target.value); setActive(-1); setOpen(true); }} onKeyDown={event => {
              if (event.key === 'Escape') { setOpen(false); setActive(-1); }
              if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                setOpen(true);
                const count = Math.min(matches.length, resultLimit);
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
          {matches.slice(0, resultLimit).map((player, index) => <button type="button" role="option" aria-selected={active === index} id={`person-match-${index}`} key={player.key} onMouseDown={event => event.preventDefault()} onClick={() => choose(player)}>
            <strong translate="no"><SpecialTextContent>{player.nickname || `RID ${player.rid}`}</SpecialTextContent></strong>
            <span><SpecialTextContent>{player.rid ? `RID ${player.rid}` : 'Solo nombre'}{player.count > 0 ? ` · ${player.count} reporte(s)` : ''}</SpecialTextContent></span>
            {player.searchMatches.filter(item => !['Nombre', 'Alias', 'RID'].includes(item.field)).slice(0, 2).map((item, matchIndex) =>
              <span key={matchIndex}><SpecialTextContent>{item.field}{item.reportId ? ` · Reporte #${item.reportId}` : ''}: {searchExcerpt(item.text, term)}</SpecialTextContent></span>)}
          </button>)}
        </div>
        {loading && <Skeleton label="Buscando en reportes y resúmenes…" rows={2} />}
        {!loading && !matches.length && <p role="status">Sin coincidencias en el archivo disponible.</p>}
        {matches.length > 1 && <p>Selecciona al jugador.</p>}
        {!warnings.length && (matches.length > resultLimit || hasMore) && <button type="button" disabled={loading} onClick={() => {
          if (matches.length <= resultLimit && hasMore) setPage(value => value + 1);
          setResultLimit(value => value + 12);
        }}>Mostrar más coincidencias ({Math.min(resultLimit, matches.length)} de {Math.max(total, matches.length)})</button>}
        <button type="button" onClick={() => choose({ nickname: /^\d+$/.test(term) ? '' : term, rid: /^\d+$/.test(term) ? term : '' })}>
          Consultar perfil externo por nombre o RID: <SpecialTextContent>{term}</SpecialTextContent>
        </button>
        {warnings.length > 0 && <>
          <p role="alert">{warnings.join(' · ')}</p>
          <button type="button" disabled={loading} onClick={() => setRetry(value => value + 1)}>Reintentar búsqueda del archivo</button>
        </>}
      </div>
    </div>
  );
}
