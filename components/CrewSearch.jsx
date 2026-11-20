import { useEffect, useRef, useState } from 'react';
import { addCrewToList, fetchCrewSearch, parseCrewList, removeCrewFromList } from '../src/services/crewSearch';
import { normalizeSearchText } from '../src/services/playerSearch';
import Skeleton from './ui/Skeleton';
import SpecialTextContent from './ui/SpecialTextContent';
import CrewChip from './CrewChip';
import CrewCard from './CrewCard';

const DEBOUNCE_MS = 450;
const TIMEOUT_MS = 12000;

const emptySearch = (key = '') => ({ key, crews: [] });

export default function CrewSearch({ id, value, onChange, disabled }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState(emptySearch);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [active, setActive] = useState(-1);
  const [crewMeta, setCrewMeta] = useState({});
  const cache = useRef(new Map());
  const inputRef = useRef(null);
  const term = query.trim();
  const selected = parseCrewList(value);
  const visible = search.crews;

  useEffect(() => {
    setActive(-1);
    setError('');
    if (!term) {
      setSearch(emptySearch());
      setLoading(false);
      return undefined;
    }
    // Sin lista abierta no se busca; los resultados ya cargados se reutilizan al volver a abrirla.
    if (!open) return undefined;
    const key = term.toLocaleLowerCase();
    const saved = cache.current.get(key);
    if (saved) {
      setSearch(saved);
      setLoading(false);
      return undefined;
    }
    setSearch(emptySearch(key));
    const controller = new AbortController();
    const deadline = setTimeout(() => {
      controller.abort();
      setLoading(false);
      setError('La búsqueda de crews superó el tiempo de espera. Puedes usar el nombre escrito.');
    }, TIMEOUT_MS);
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const payload = await fetchCrewSearch({ query: term, signal: controller.signal });
        if (controller.signal.aborted) return;
        const next = { key, crews: payload.crews };
        cache.current.set(key, next);
        setSearch(next);
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause.message);
      } finally {
        clearTimeout(deadline);
        if (!controller.signal.aborted) setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => { clearTimeout(timer); clearTimeout(deadline); controller.abort(); };
  }, [term, open]);

  const choose = crew => {
    onChange(addCrewToList(value, crew.crewName));
    setCrewMeta(previous => ({ ...previous, [normalizeSearchText(crew.crewName)]: { tag: crew.crewTag, colour: crew.crewColour } }));
    setQuery('');
    setOpen(false);
  };
  const chooseTyped = () => choose({ crewName: term });
  const remove = crewName => onChange(removeCrewFromList(value, crewName));

  const handleKeyDown = event => {
    if (event.key === 'Escape') {
      setOpen(false);
      setActive(-1);
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      setActive(current => {
        if (!visible.length) return -1;
        if (current < 0) return event.key === 'ArrowDown' ? 0 : visible.length - 1;
        return (current + (event.key === 'ArrowDown' ? 1 : visible.length - 1)) % visible.length;
      });
      return;
    }
    if (event.key === 'Enter') {
      // Evita que Enter envíe el formulario del reporte mientras se elige una crew.
      event.preventDefault();
      if (active >= 0 && visible[active]) return choose(visible[active]);
      if (term) chooseTyped();
    }
  };

  return (
    <div className="crew-search" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
      {selected.length > 0 && <ul className="crew-search__chips" aria-label="Crews seleccionadas">
        {selected.map(name => {
          const meta = crewMeta[normalizeSearchText(name)] || {};
          return <CrewChip key={name} name={name} tag={meta.tag} colour={meta.colour} disabled={disabled}
            onRemove={() => remove(name)} />;
        })}
      </ul>}
      <div className="cyber-input-full mw-cyber-input">
        <input ref={inputRef} id={id} type="text" role="combobox" aria-autocomplete="list" aria-expanded={open && Boolean(term)}
          aria-controls={`${id}-results`} aria-activedescendant={open && active >= 0 && visible[active] ? `${id}-option-${active}` : undefined}
          className="form-group__input" placeholder="Busca un crew o escribe su nombre" autoComplete="off" maxLength={100}
          value={query} disabled={disabled}
          onFocus={() => setOpen(true)}
          onChange={event => { setQuery(event.target.value); setActive(-1); setOpen(true); }}
          onKeyDown={handleKeyDown} />
      </div>
      <div id={`${id}-results`} className="crew-search__results" hidden={!open || !term}>
        <div role="listbox" aria-label="Crews encontradas">
          {visible.map((crew, index) => <CrewCard key={crew.crewId} id={id} index={index} crew={crew}
            isActive={active === index} onChoose={choose} />)}
        </div>
        {loading && <Skeleton label="Buscando crews…" rows={2} />}
        {!loading && !error && !search.crews.length && <p role="status">Sin coincidencias en Rockstar.</p>}
        {error && <p role="alert">{error}</p>}
        {term && <button type="button" className="crew-search__use-typed" onMouseDown={event => event.preventDefault()} onClick={chooseTyped}>
          Usar “<SpecialTextContent>{term}</SpecialTextContent>” como crew
        </button>}
      </div>
    </div>
  );
}
