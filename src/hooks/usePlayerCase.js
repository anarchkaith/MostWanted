import { useCallback, useEffect, useState } from 'react';
import { requestCase } from '../services/casesService';

export default function usePlayerCase({ caseId, nickname, rid, revision }) {
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
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
    requestCase(caseId ? `/${encodeURIComponent(caseId)}` : `/lookup?${params}`, { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setPayload(data); })
      .catch(cause => { if (!controller.signal.aborted) setError(cause.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [caseId, nickname, rid, revision, version]);

  return { payload, loading, error, refresh };
}
