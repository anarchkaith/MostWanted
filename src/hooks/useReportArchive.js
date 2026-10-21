import { useCallback, useEffect, useState } from 'react';
import { loadReportArchive, prepareReportArchive, readUserVotes } from '../services/reportArchive.js';
import { fetchWordpressReportsSnapshot } from '../services/reportSubmissionService.js';

export default function useReportArchive() {
  const [reportes, setReportes] = useState([]);
  const [reportsError, setReportsError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const getUserVotes = useCallback(() => readUserVotes(localStorage), []);
  const fetchReportsFromAPI = useCallback(async signal => {
    const result = await loadReportArchive({
      fetchPage: fetchWordpressReportsSnapshot, storage: localStorage, signal,
    });
    if (!signal?.aborted) setReportsError(result.warning);
    return result.reports;
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    fetchReportsFromAPI(controller.signal)
      .then(reports => {
        if (!controller.signal.aborted) setReportes(prepareReportArchive(reports, getUserVotes()));
      })
      .catch(error => {
        if (controller.signal.aborted) return;
        console.error('[reports] No se pudo cargar el archivo.', error);
        setReportsError(error.message);
      })
      .finally(() => { if (!controller.signal.aborted) setIsLoading(false); });
    return () => controller.abort();
  }, [fetchReportsFromAPI, getUserVotes]);
  return { reportes, setReportes, reportsError, isLoading, fetchReportsFromAPI, getUserVotes };
}
