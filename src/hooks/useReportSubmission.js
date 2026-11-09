import { useRef, useState } from 'react';
import { runReportSubmission } from '../services/reportSubmissionWorkflow';
import { submitWordpressReport, uploadEvidenceImages } from '../services/reportSubmissionService';

export default function useReportSubmission({ user, images, onSaved, imageUploadRef }) {
  const [error, setError] = useState('');
  const [retryAt, setRetryAt] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const pending = useRef(false);
  const submit = async values => {
    if (pending.current) return;
    pending.current = true;
    setError('');
    setRetryAt(null);
    setConfirmation(null);
    try {
      const evidenceError = imageUploadRef?.current?.getValidationError();
      if (evidenceError) throw new Error(evidenceError);
      const result = await runReportSubmission({
        values, images: imageUploadRef?.current?.getImages() || images, user, apiKey: import.meta.env.VITE_API_KEY_IMGBB,
        upload: uploadEvidenceImages, save: submitWordpressReport, onSaved,
      });
      setConfirmation(result);
    } catch (cause) {
      setError(cause.message || 'Error al enviar el reporte. Intenta de nuevo.');
      if (cause.status === 429 && cause.retryAfterSeconds > 0) setRetryAt(Date.now() + cause.retryAfterSeconds * 1000);
    } finally {
      pending.current = false;
    }
  };
  return { submit, error, retryAt, confirmation, closeConfirmation: () => setConfirmation(null) };
}
