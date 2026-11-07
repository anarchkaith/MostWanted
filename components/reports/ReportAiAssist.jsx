import { useEffect, useRef, useState } from 'react';
import { useFormikContext } from 'formik';
import { TIPOS_ETIQUETAS } from '../tiposEtiquetas';
import { canRequestReportAssist, requestReportAssist, resolveReportAssistSuggestion } from '../../src/services/reportAssist.js';

export default function ReportAiAssist() {
  const { values, isSubmitting, setFieldValue } = useFormikContext();
  const [state, setState] = useState({ status: 'idle', suggestion: null, error: '' });
  const controllerRef = useRef(null);
  useEffect(() => () => controllerRef.current?.abort(), []);

  const ask = async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setState({ status: 'loading', suggestion: null, error: '' });
    try {
      const raw = await requestReportAssist(values, { signal: controller.signal });
      const suggestion = resolveReportAssistSuggestion(raw, values, TIPOS_ETIQUETAS);
      const empty = !suggestion || (!suggestion.reason && !suggestion.categories.length && !suggestion.labels.length);
      setState(empty
        ? { status: 'complete', suggestion: null, error: 'Tu reporte ya está completo. ¡Bien hecho!' }
        : { status: 'ready', suggestion, error: '' });
    } catch (error) {
      if (error.name !== 'AbortError') setState({ status: 'error', suggestion: null, error: error.status ? error.message : 'No se pudo conectar con la ayuda IA. Inténtalo más tarde.' });
    }
  };

  const update = patch => setState(current => {
    const suggestion = { ...current.suggestion, ...patch };
    const done = !suggestion.reason && !suggestion.categories.length && !suggestion.labels.length;
    return done ? { status: 'idle', suggestion: null, error: '' } : { ...current, suggestion };
  });
  const useReason = () => { setFieldValue('reason', state.suggestion.reason.slice(0, 500)); update({ reason: '' }); };
  const addAll = () => {
    const { categories, labels } = state.suggestion;
    if (categories.length) setFieldValue('typesOfInfraction', [...values.typesOfInfraction, ...categories]);
    if (labels.length) setFieldValue('labels', [...values.labels, ...labels]);
    update({ categories: [], labels: [] });
  };
  const categoryName = key => TIPOS_ETIQUETAS.find(type => type.key === key)?.nombre || key;
  const { status, suggestion, error } = state;

  return <section className="ai-assist" aria-labelledby="ai-assist-title">
    <div className="ai-assist__bar">
      <p id="ai-assist-title" className="ai-assist__title">Ayuda IA <span>Experimental</span></p>
      <button type="button" className="ai-assist__trigger" onClick={ask}
        disabled={isSubmitting || status === 'loading' || !canRequestReportAssist(values)}>
        {status === 'loading' ? 'Pensando…' : suggestion ? 'Probar otra vez' : '✨ Mejorar mi reporte'}
      </button>
    </div>
    {status === 'idle' && !suggestion && <p className="ai-assist__hint">Escribe lo que pasó con tus palabras y la IA te propone un texto más claro y las conductas que faltan. Tú decides qué usar.</p>}
    <div role="status" aria-live="polite">
      {status === 'error' && <p className="ai-assist__hint ai-assist__hint--warn">{error}</p>}
      {status === 'complete' && <p className="ai-assist__hint ai-assist__hint--ok">✓ {error}</p>}
    </div>
    {status === 'ready' && suggestion && <div className="ai-assist__result">
      {suggestion.reason && <div className="ai-assist__block">
        <p className="ai-assist__label">Texto sugerido</p>
        <blockquote>{suggestion.reason}</blockquote>
        <div className="ai-assist__actions">
          <button type="button" className="ai-assist__accept" onClick={useReason}>Usar este texto</button>
          <button type="button" className="ai-assist__dismiss" onClick={() => update({ reason: '' })}>Mantener el mío</button>
        </div>
      </div>}
      {(suggestion.categories.length > 0 || suggestion.labels.length > 0) && <div className="ai-assist__block">
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
      {suggestion.note && <p className="ai-assist__hint">💡 {suggestion.note}</p>}
      <p className="ai-assist__disclaimer">La IA solo reordena lo que escribiste. Nunca agrega pruebas: revisa el texto antes de enviarlo.</p>
    </div>}
  </section>;
}
