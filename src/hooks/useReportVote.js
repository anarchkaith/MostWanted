import { useEffect, useRef, useState } from 'react';

const EMPTY_VOTES = { up: 0, down: 0, comentarios: [] };

export default function useReportVote({ reportId, initialVotes = EMPTY_VOTES, initialVote = null, onVote }) {
  const [votos, setVotos] = useState(initialVotes);
  const [userVote, setUserVote] = useState(initialVote);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const pending = useRef(false);
  useEffect(() => { setVotos(initialVotes); }, [initialVotes]);
  useEffect(() => { setUserVote(initialVote); }, [initialVote]);

  const submitVote = async input => {
    if (pending.current) return false;
    setError('');
    setWarning('');
    if (typeof onVote !== 'function') {
      setError('La votación no está disponible en esta vista.');
      return false;
    }
    pending.current = true;
    setIsLoading(true);
    try {
      const result = await onVote(reportId, input);
      if (!result?.votos || !['up', 'down'].includes(result.userVote)) {
        throw new Error('No se recibió la confirmación del voto. Actualiza el reporte antes de reintentar.');
      }
      setVotos(result.votos);
      setUserVote(result.userVote);
      setWarning(result.warning || '');
      return true;
    } catch (cause) {
      setError(cause.message || 'No se pudo registrar tu voto en este momento.');
      return false;
    } finally {
      pending.current = false;
      setIsLoading(false);
    }
  };
  return { votos, userVote, isLoading, error, warning, setError, submitVote };
}
