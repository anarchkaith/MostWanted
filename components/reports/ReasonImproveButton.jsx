import { useEffect, useRef, useState } from 'react';
import { useFormikContext } from 'formik';
import { REPORT_ASSIST_MIN_REASON, requestReportAssist } from '../../src/services/reportAssist.js';

export default function ReasonImproveButton({ maxReasonLength }) {
  const { values, isSubmitting, setFieldValue } = useFormikContext();
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const [undoState, setUndoState] = useState(null);
  const controllerRef = useRef(null);
  useEffect(() => () => controllerRef.current?.abort(), []);

  const reason = String(values.reason || '').trim();
  const canImprove = reason.length >= REPORT_ASSIST_MIN_REASON;
  const canUndo = undoState !== null && values.reason === undoState.improved;

  const improve = async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setStatus('loading');
    setMessage('');
    try {
      const suggestion = await requestReportAssist(values, { signal: controller.signal });
      const improved = String(suggestion?.reason || '').trim().slice(0, maxReasonLength);
      if (!improved || improved === reason) {
        setStatus('idle');
        setMessage('Tu texto ya está claro.');
        return;
      }
      setUndoState({ previous: values.reason, improved });
      setFieldValue('reason', improved);
      setStatus('done');
    } catch (error) {
      if (error.name === 'AbortError') return;
      setStatus('error');
      setMessage(error.message || 'HEX no está disponible ahora.');
    }
  };

  const undo = () => {
    setFieldValue('reason', undoState.previous);
    setUndoState(null);
    setStatus('idle');
  };

  return <div className="reason-improve">
    <div className="reason-improve__row">
      {canUndo
        ? <button type="button" className="reason-improve__btn" onClick={undo}>Deshacer</button>
        : <button type="button" className="reason-improve__btn" onClick={improve}
          disabled={!canImprove || isSubmitting || status === 'loading'}>
          {status === 'loading' ? 'Mejorando…' : 'Mejorar con HEX'}
        </button>}
      <div role="status" aria-live="polite">
        {canUndo && <span className="reason-improve__msg reason-improve__msg--ok">Texto mejorado. Revísalo antes de enviar.</span>}
        {!canUndo && message && <span className="reason-improve__msg">{message}</span>}
      </div>
    </div>
  </div>;
}
