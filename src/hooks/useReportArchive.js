import { useCallback, useEffect, useState } from 'react';
import { clearLegacyReportArchive, readUserVotes } from '../services/reportArchive.js';
import { mapWordpressReportToReporte } from '../services/reportViewModel.js';
import { fetchReportById, submitWordpressCommunityVerificationVote } from '../services/reportSubmissionService.js';
import { registerReportVote } from '../services/reportVoting.js';

export default function useReportArchive({ userId, reportId }) {
  const [reportes, setReportes] = useState([]);
  const [reportsError, setReportsError] = useState('');
  const [loadingId, setLoadingId] = useState(null);
  const getUserVotes = useCallback(() => readUserVotes(localStorage), []);
  useEffect(() => {
    setReportes([]);
    setReportsError(clearLegacyReportArchive(localStorage));
  }, [userId]);
  useEffect(() => {
    if (!userId || !reportId) return undefined;
    const controller = new AbortController();
    setLoadingId(reportId);
    setReportsError('');
    fetchReportById({ reportId, signal: controller.signal }).then(report => {
      if (controller.signal.aborted) return;
      const current = { ...mapWordpressReportToReporte(report), userVote: getUserVotes()[report.id] || null };
      setReportes([current]);
    }).catch(error => {
      if (controller.signal.aborted) return;
      console.error('[reports] No se pudo consultar el reporte.', error);
      setReportes([]);
      setReportsError(error.message);
    }).finally(() => { if (!controller.signal.aborted) setLoadingId(null); });
    return () => controller.abort();
  }, [userId, reportId, getUserVotes]);
  const voteOnReport = async (id, payload, user) => {
    const result = await registerReportVote({
      request: submitWordpressCommunityVerificationVote, storage: localStorage,
      input: { ...payload, reportId: id }, user,
    });
    setReportes(current => current.map(report =>
      String(report.id) === String(id) ? { ...report, votos: result.votos, userVote: result.userVote } : report));
    if (result.warning) setReportsError(result.warning);
    return result;
  };
  return { reportes, setReportes, reportsError, isLoading: Boolean(userId && reportId && loadingId === reportId), voteOnReport, getUserVotes };
}
