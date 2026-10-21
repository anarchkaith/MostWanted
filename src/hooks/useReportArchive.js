import { useCallback, useEffect, useState } from 'react';
import { loadReportArchive, prepareReportArchive, readUserVotes } from '../services/reportArchive.js';
import { fetchWordpressReportsSnapshot, submitWordpressCommunityVerificationVote } from '../services/reportSubmissionService.js';
import { registerReportVote } from '../services/reportVoting.js';

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
    return result;
  }, []);
  const refreshReports = useCallback(async () => {
    try {
      const result = await fetchReportsFromAPI();
      setReportes(prepareReportArchive(result.reports, getUserVotes()));
      return { warning: result.warning };
    } catch (error) {
      console.error('[reports] No se pudo refrescar el archivo después del envío.', error);
      setReportsError('El reporte se guardó, pero no se pudo actualizar el archivo. Recarga para consultar los datos actuales.');
      throw error;
    }
  }, [fetchReportsFromAPI, getUserVotes]);
  const voteOnReport = async (reportId, payload, user) => {
    if (!reportes.some(report => String(report.id) === String(reportId))) {
      throw new Error('No se encontró el reporte para registrar el voto.');
    }
    const result = await registerReportVote({
      request: submitWordpressCommunityVerificationVote, storage: localStorage,
      input: { ...payload, reportId }, user,
    });
    setReportes(current => current.map(report =>
      String(report.id) === String(reportId) ? { ...report, votos: result.votos, userVote: result.userVote } : report));
    if (result.warning) setReportsError(result.warning);
    return result;
  };
  useEffect(() => {
    const controller = new AbortController();
    fetchReportsFromAPI(controller.signal)
      .then(result => {
        if (!controller.signal.aborted) setReportes(prepareReportArchive(result.reports, getUserVotes()));
      })
      .catch(error => {
        if (controller.signal.aborted) return;
        console.error('[reports] No se pudo cargar el archivo.', error);
        setReportsError(error.message);
      })
      .finally(() => { if (!controller.signal.aborted) setIsLoading(false); });
    return () => controller.abort();
  }, [fetchReportsFromAPI, getUserVotes]);
  return { reportes, setReportes, reportsError, isLoading, refreshReports, voteOnReport, getUserVotes };
}
