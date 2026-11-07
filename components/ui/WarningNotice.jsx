/**
 * Subtle warning notice for non-critical issues (e.g., optional API unavailable).
 * Displays as a small, dismissible notification that doesn't interrupt the user.
 */
import { useState } from 'react';

const WARNING_MESSAGES = {
  'reports_source_unavailable': 'Los datos de reportes no están disponibles en este momento. Se muestran datos anteriores.',
  'wordpress_source_not_configured': 'Información de reportes no disponible.',
  'stale_data': 'Los datos pueden estar desactualizados.',
};

function getWarningMessage(error) {
  if (!error || error === '') return null;
  const errorKey = error.toLowerCase();
  return WARNING_MESSAGES[errorKey] || error;
}

export default function WarningNotice({ error, onDismiss }) {
  const [dismissed, setDismissed] = useState(false);
  
  const message = getWarningMessage(error);
  if (!message || dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  return (
    <div className="warning-notice" role="status" aria-live="polite">
      <span className="warning-notice__icon">⚠</span>
      <span className="warning-notice__text">{message}</span>
      <button
        type="button"
        className="warning-notice__close"
        onClick={handleDismiss}
        aria-label="Descartar aviso"
        title="Descartar"
      >
        ✕
      </button>
    </div>
  );
}
