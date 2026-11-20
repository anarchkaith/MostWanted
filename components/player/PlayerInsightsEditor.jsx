import { useState } from 'react';
import { savePlayerInsightsEdit } from '../../src/services/playerEditing';

const ALIAS_LIMIT = 30;
const ALIAS_MAX_LENGTH = 64;

export default function PlayerInsightsEditor({ insights, username, rid, onSaved }) {
  const [isEditing, setIsEditing] = useState(false);
  const [aliases, setAliases] = useState([]);
  const [draft, setDraft] = useState('');
  const [activeCrew, setActiveCrew] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  const crews = insights?.crews || [];

  const startEditing = () => {
    setAliases(insights?.manualAliases || []);
    setActiveCrew(insights?.activeCrew || '');
    setDraft('');
    setError(null);
    setIsEditing(true);
  };

  const addAlias = () => {
    const alias = draft.trim();
    if (!alias) return;
    if (alias.length > ALIAS_MAX_LENGTH) return setError(`El alias no puede superar ${ALIAS_MAX_LENGTH} caracteres.`);
    if (aliases.length >= ALIAS_LIMIT) return setError(`Podés agregar hasta ${ALIAS_LIMIT} alias manuales.`);
    if (aliases.some(item => item.toLowerCase() === alias.toLowerCase())) return setError('Ese alias ya está en la lista.');
    setAliases([...aliases, alias]);
    setDraft('');
    setError(null);
  };

  const save = async () => {
    setIsSaving(true);
    setError(null);
    try {
      await savePlayerInsightsEdit({
        username: insights?.username || username,
        rid: rid || insights?.rid || '',
        changes: { aliases, activeCrew },
      });
      setIsEditing(false);
      onSaved?.();
    } catch (cause) {
      setError(cause.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isEditing) {
    return <div className="pbp-editor">
      <button type="button" className="cyber-button-small mw-cyber-button" onClick={startEditing}>Editar jugador</button>
    </div>;
  }

  return <form className="pbp-editor" onSubmit={event => { event.preventDefault(); save(); }}>
    <div className="pbp-current__label">Alias manuales</div>
    <div className="pbp-current__crews">
      {aliases.map(alias => <span key={alias} className="pbp-chip">
        <strong>{alias}</strong>{' '}
        <button type="button" aria-label={`Quitar alias ${alias}`} onClick={() => setAliases(aliases.filter(item => item !== alias))}>×</button>
      </span>)}
    </div>
    <div className="pbp-editor__row">
      <input type="text" value={draft} maxLength={ALIAS_MAX_LENGTH} placeholder="Nuevo alias" aria-label="Nuevo alias"
        onChange={event => setDraft(event.target.value)}
        onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); addAlias(); } }} />
      <button type="button" className="cyber-button-small mw-cyber-button" onClick={addAlias}>Agregar alias</button>
    </div>

    <label className="pbp-current__label" htmlFor="pbp-active-crew">Crew activo</label>
    <select id="pbp-active-crew" value={activeCrew} onChange={event => setActiveCrew(event.target.value)}>
      <option value="">Sin crew activo</option>
      {crews.map(crew => <option key={crew} value={crew}>{crew}</option>)}
    </select>

    {error && <p className="pbp-status pbp-status--error" role="alert">{error}</p>}
    <div className="pbp-editor__row">
      <button type="submit" className="cyber-button-small mw-cyber-button" disabled={isSaving}>{isSaving ? 'Guardando…' : 'Guardar'}</button>
      <button type="button" className="cyber-button-small mw-cyber-button" disabled={isSaving} onClick={() => setIsEditing(false)}>Cancelá</button>
    </div>
  </form>;
}
