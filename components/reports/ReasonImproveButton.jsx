import { useEffect, useRef, useState } from 'react';
import { useFormikContext } from 'formik';
import { REPORT_ASSIST_MIN_REASON, requestReportAssist } from '../../src/services/reportAssist.js';
import { diffWords } from '../../src/services/reasonDiff.js';

export default function ReasonImproveButton({ maxReasonLength }) {
  const { values, isSubmitting, setFieldValue } = useFormikContext();
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const [proposal, setProposal] = useState(null);
  const controllerRef = useRef(null);
  useEffect(() => () => controllerRef.current?.abort(), []);

  const reason = String(values.reason || '').trim();
  const canImprove = reason.length >= REPORT_ASSIST_MIN_REASON;
  const isLoading = status === 'loading';

  const improve = async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setStatus('loading');
    setMessage('');
    setProposal(null);
    try {
      const suggestion = await requestReportAssist(values, { signal: controller.signal });
      const improved = String(suggestion?.reason || '').trim().slice(0, maxReasonLength);
      if (!improved || improved === reason) {
        setStatus('idle');
        setMessage('Tu texto ya está claro.');
        return;
      }
      setProposal({ improved, segments: diffWords(values.reason, improved) });
      setStatus('idle');
    } catch (error) {
      if (error.name === 'AbortError') return;
      setStatus('error');
      setMessage(error.message || 'HEX no está disponible ahora.');
    }
  };

  const acceptImproved = () => {
    setFieldValue('reason', proposal.improved);
    setProposal(null);
  };

  return <div className="reason-improve">
    <div className="reason-improve__row">
      <button type="button" className="reason-improve__btn" onClick={improve}
        disabled={!canImprove || isSubmitting || isLoading || Boolean(proposal)}>
        {isLoading ? 'Mejorando…' : 'Mejorar con HEX'}
      </button>
      <div role="status" aria-live="polite">
        {isLoading && <span className="reason-improve__msg">HEX está revisando tu texto…</span>}
        {!proposal && !isLoading && message && <span className="reason-improve__msg">{message}</span>}
      </div>
    </div>
    {isLoading && <div className="reason-improve__loader" aria-hidden="true"><span className="reason-improve__loader-bar" /></div>}
    {proposal && <div className="reason-improve__compare">
      <p className="reason-improve__diff" aria-label="Comparación entre tu texto y la versión mejorada">
        {proposal.segments.map((segment, index) => segment.type === 'same'
          ? <span key={index}>{segment.text}</span>
          : segment.type === 'removed'
            ? <del key={index} className="reason-improve__removed">{segment.text}</del>
            : <ins key={index} className="reason-improve__added">{segment.text}</ins>)}
      </p>
      <div className="reason-improve__row">
        <button type="button" className="reason-improve__btn" onClick={acceptImproved}>Usar mejorado</button>
        <button type="button" className="reason-improve__btn" onClick={() => setProposal(null)}>Mantener original</button>
      </div>
    </div>}
  </div>;
}
