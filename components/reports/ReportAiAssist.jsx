import { useEffect, useRef, useState } from 'react';
import { useFormikContext } from 'formik';
import { TIPOS_ETIQUETAS } from '../tiposEtiquetas';
import { canRequestReportAssist, requestReportAssist, resolveReportAssistSuggestion } from '../../src/services/reportAssist.js';
import { ASSISTANT_NAME } from '../../src/config/assistant.js';

const IDLE = { status: 'idle', suggestion: null, applied: null, error: '' };
const isEmpty = suggestion => !suggestion || (!suggestion.reason && !suggestion.categories.length && !suggestion.labels.length);

// `autoRun` pre-loads infractions from the story when the user has not picked any yet.
export default function ReportAiAssist({ autoRun = false }) {
  const { values, isSubmitting, setFieldValue } = useFormikContext();
  const [state, setState] = useState(IDLE);
  const controllerRef = useRef(null);
  const autoReasonRef = useRef(null);
  const valuesRef = useRef(values);
  valuesRef.current = values;
  useEffect(() => () => controllerRef.current?.abort(), []);

  const ask = async ({ auto = false } = {}) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setState({ ...IDLE, status: 'loading' });
    try {
      const raw = await requestReportAssist(valuesRef.current, { signal: controller.signal });
      const current = valuesRef.current;
      const suggestion = resolveReportAssistSuggestion(raw, current, TIPOS_ETIQUETAS);
      if (isEmpty(suggestion)) {
        setState(auto ? IDLE : { ...IDLE, status: 'complete', error: 'Tu reporte ya está completo. ¡Bien hecho!' });
        return;
      }
      const preload = auto && current.typesOfInfraction.length === 0 && (suggestion.categories.length || suggestion.labels.length);
      if (preload) {
        setFieldValue('typesOfInfraction', [...current.typesOfInfraction, ...suggestion.categories]);
        setFieldValue('labels', [...current.labels, ...suggestion.labels]);
        const rest = { ...suggestion, categories: [], labels: [] };
        setState({ status: 'ready', suggestion: rest, applied: { categories: suggestion.categories, labels: suggestion.labels }, error: '' });
      } else {
        setState({ status: 'ready', suggestion, applied: null, error: '' });
      }
    } catch (error) {
      if (error.name === 'AbortError') return;
      setState(auto ? IDLE : { ...IDLE, status: 'error', error: error.status ? error.message : `No se pudo conectar con ${ASSISTANT_NAME}. Inténtalo más tarde.` });
    }
  };

  const reason = String(values.reason || '').trim();
  useEffect(() => {
    if (!autoRun || isSubmitting || values.typesOfInfraction.length > 0) return;
    if (!canRequestReportAssist(values) || autoReasonRef.current === reason) return;
    autoReasonRef.current = reason;
    ask({ auto: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRun, reason]);

  const update = patch => setState(current => {
    const suggestion = { ...current.suggestion, ...patch };
    if (isEmpty(suggestion) && !current.applied) return IDLE;
    return { ...current, suggestion: isEmpty(suggestion) ? null : suggestion };
  });
  const useReason = () => { setFieldValue('reason', state.suggestion.reason.slice(0, 500)); update({ reason: '' }); };
  const addAll = () => {
    const { categories, labels } = state.suggestion;
    if (categories.length) setFieldValue('typesOfInfraction', [...values.typesOfInfraction, ...categories]);
    if (labels.length) setFieldValue('labels', [...values.labels, ...labels]);
    update({ categories: [], labels: [] });
  };
  const undoPreload = () => {
    const { categories, labels } = state.applied;
    setFieldValue('typesOfInfraction', values.typesOfInfraction.filter(key => !categories.includes(key)));
    setFieldValue('labels', values.labels.filter(label => !labels.includes(label)));
    setState(current => current.suggestion ? { ...current, applied: null } : IDLE);
  };
  const categoryName = key => TIPOS_ETIQUETAS.find(type => type.key === key)?.nombre || key;
  const { status, suggestion, applied, error } = state;

  return <section className="ai-assist" aria-labelledby="ai-assist-title">
    <div className="ai-assist__bar">
      <p id="ai-assist-title" className="ai-assist__title">Ayuda {ASSISTANT_NAME} <span>Experimental</span></p>
      <button type="button" className="ai-assist__trigger" onClick={() => ask()}
        disabled={isSubmitting || status === 'loading' || !canRequestReportAssist(values)}>
        {status === 'loading' ? 'Analizando tu relato…' : suggestion || applied ? 'Probar otra vez' : `✨ Completar con ${ASSISTANT_NAME}`}
      </button>
    </div>
    {status === 'idle' && !suggestion && <p className="ai-assist__hint">{ASSISTANT_NAME} marca infracciones probables según tu relato. Tú decides.</p>}
    <div role="status" aria-live="polite">
      {status === 'loading' && <p className="ai-assist__hint ai-assist__hint--busy">Buscando infracciones en tu relato…</p>}
      {status === 'error' && <p className="ai-assist__hint ai-assist__hint--warn">{error}</p>}
      {status === 'complete' && <p className="ai-assist__hint ai-assist__hint--ok">✓ {error}</p>}
    </div>
    {status === 'ready' && <div className="ai-assist__result">
      {applied && <div className="ai-assist__block ai-assist__block--applied">
        <p className="ai-assist__applied-text">
          HEX marcó {applied.categories.length + applied.labels.length} abajo. Desmarca lo que no corresponda.
        </p>
        <button type="button" className="ai-assist__dismiss ai-assist__undo" onClick={undoPreload}>Deshacer</button>
      </div>}
      {suggestion?.reason && <div className="ai-assist__block">
        <p className="ai-assist__label">Texto más claro (opcional)</p>
        <blockquote>{suggestion.reason}</blockquote>
        <div className="ai-assist__actions">
          <button type="button" className="ai-assist__accept" onClick={useReason}>Usar este texto</button>
          <button type="button" className="ai-assist__dismiss" onClick={() => update({ reason: '' })}>Mantener el mío</button>
        </div>
      </div>}
      {suggestion && (suggestion.categories.length > 0 || suggestion.labels.length > 0) && <div className="ai-assist__block">
        <p className="ai-assist__label">También podrías marcar</p>
        <ul className="ai-assist__chips">
          {suggestion.categories.map(key => <li key={key}>{categoryName(key)}</li>)}
          {suggestion.labels.map(label => <li key={label}>{label}</li>)}
        </ul>
        <div className="ai-assist__actions">
          <button type="button" className="ai-assist__accept" onClick={addAll}>Añadir</button>
          <button type="button" className="ai-assist__dismiss" onClick={() => update({ categories: [], labels: [] })}>No, gracias</button>
        </div>
      </div>}
      {suggestion?.note && <p className="ai-assist__hint">💡 {suggestion.note}</p>}
      <p className="ai-assist__disclaimer">{ASSISTANT_NAME} solo usa lo que escribiste. Revisa todo antes de enviar.</p>
    </div>}
  </section>;
}
