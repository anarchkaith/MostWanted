import { useCallback, useEffect, useState } from 'react';
import { requestCase } from '../services/casesService';

const CLASSIFICATION_POLL_MS = 3000;
const CLASSIFICATION_TIMEOUT_MS = 120000;

function isClassificationPending(classification) {
  return !classification || classification.pending || (classification.stale && !classification.error);
}

export default function usePlayerCase({ caseId, nickname, rid, revision }) {
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [summaryError, setSummaryError] = useState('');
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion(value => value + 1), []);

  useEffect(() => {
    if (!caseId && !nickname && !rid) {
      setLoading(false);
      return undefined;
    }
    const controller = new AbortController();
    const params = new URLSearchParams({ username: nickname || '', rid: rid || '' });
    setLoading(true);
    setError('');
    setSummaryError('');
    requestCase(caseId ? `/${encodeURIComponent(caseId)}` : `/lookup?${params}`, { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setPayload(data); })
      .catch(cause => { if (!controller.signal.aborted) setError(cause.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [caseId, nickname, rid, revision, version]);

  const dossierId = payload?.case?.id;
  const sourceStale = Boolean(payload?.source?.stale);
  const classification = payload?.case?.classification;
  const shouldPoll = Boolean(dossierId && payload?.reports?.length
    && (classification?.pending || (!sourceStale && isClassificationPending(classification))));
  useEffect(() => {
    if (loading || !shouldPoll || summaryError) return undefined;
    const controller = new AbortController();
    let timer;
    const deadline = window.setTimeout(() => {
      controller.abort();
      setSummaryError('El análisis HEX tarda más de lo esperado. Intentá actualizarlo.');
    }, CLASSIFICATION_TIMEOUT_MS);
    const poll = async () => {
      try {
        const result = await requestCase(`/${encodeURIComponent(dossierId)}/classification`, { signal: controller.signal });
        if (controller.signal.aborted) return;
        if (!Object.hasOwn(result, 'classification')
          || (result.classification !== null && (typeof result.classification !== 'object' || Array.isArray(result.classification)))) {
          throw new Error('Respuesta de clasificación no válida.');
        }
        setPayload(current => current?.case?.id === dossierId
          ? { ...current, case: { ...current.case, classification: result.classification } }
          : current);
        if (result.classification?.pending || (!sourceStale && isClassificationPending(result.classification))) {
          timer = window.setTimeout(poll, CLASSIFICATION_POLL_MS);
        }
      } catch (cause) {
        if (controller.signal.aborted) return;
        console.error('[cases] No se pudo actualizar el análisis HEX.', cause);
        setSummaryError('No se pudo actualizar el análisis HEX. Intentá de nuevo.');
      }
    };
    timer = window.setTimeout(poll, CLASSIFICATION_POLL_MS);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
      window.clearTimeout(deadline);
    };
  }, [dossierId, shouldPoll, sourceStale, loading, summaryError, caseId, nickname, rid, revision, version]);

  return { payload, loading, error, summaryPending: shouldPoll, summaryError, refresh };
}
