import { useRef, useState } from 'react';
import { runReportSubmission } from '../services/reportSubmissionWorkflow';
import { submitWordpressReport, uploadEvidenceImages } from '../services/reportSubmissionService';

export default function useReportSubmission({ user, images, onSaved }) {
  const [error, setError] = useState('');
  const [confirmation, setConfirmation] = useState(null);
  const pending = useRef(false);
  const submit = async values => {
    if (pending.current) return;
    pending.current = true;
    setError('');
    setConfirmation(null);
    try {
      const result = await runReportSubmission({
        values, images, user, apiKey: import.meta.env.VITE_API_KEY_IMGBB,
        upload: uploadEvidenceImages, save: submitWordpressReport, onSaved,
      });
      setConfirmation(result);
    } catch (cause) {
      setError(cause.message || 'Error al enviar el reporte. Intenta de nuevo.');
    } finally {
      pending.current = false;
    }
  };
  return { submit, error, confirmation, closeConfirmation: () => setConfirmation(null) };
}
