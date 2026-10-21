import { useEffect, useState } from 'react';
import { buildApiUrl } from '../services/apiConfig';
import { fetchOwnedReports } from '../services/ownedReports';

export default function useOwnedReports({ userId, revision }) {
  const [page, setPage] = useState(1);
  const [version, setVersion] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setData(null);
    fetchOwnedReports({ endpoint: buildApiUrl('/reports/mine'), page, signal: controller.signal })
      .then(payload => { if (!controller.signal.aborted) setData(payload); })
      .catch(cause => {
        if (!controller.signal.aborted) setError(cause.message || 'No se pudieron consultar tus reportes.');
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [userId, page, version, revision]);
  return { page, setPage, data, loading, error, retry: () => setVersion(value => value + 1) };
}
