import { useEffect, useRef, useState } from 'react';

export default function ReportShareLink({ reportId }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const id = Number(reportId);
  const url = Number.isSafeInteger(id) && id > 0 ? `${window.location.origin}/reporte/${id}` : window.location.origin;
  const copy = async () => {
    setError('');
    setCopied(false);
    clearTimeout(timer.current);
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard_unavailable');
      await navigator.clipboard.writeText(url);
    } catch {
      const previousFocus = document.activeElement;
      const input = document.createElement('textarea');
      input.value = url;
      input.setAttribute('aria-label', 'Enlace del reporte');
      document.body.append(input);
      input.select();
      try {
        if (!document.execCommand('copy')) throw new Error('clipboard_copy_rejected');
      } catch (cause) {
        console.error('[reports] No se pudo copiar el enlace.', cause);
        setError('No se pudo copiar el enlace. Puedes seleccionarlo y copiarlo manualmente.');
        return;
      } finally {
        input.remove();
        if (previousFocus?.isConnected) previousFocus.focus();
      }
    }
    setCopied(true);
    timer.current = setTimeout(() => setCopied(false), 2000);
  };
  return <>
    <div className="modal__url-bar">
      <code className="modal__url-code">{url}</code>
      <button type="button" className="modal__url-copy" onClick={copy} title="Copiar al portapapeles" aria-label="Copiar enlace del reporte">
        {copied ? '✓' : '📋'}
      </button>
    </div>
    {error && <p role="alert" className="rfm-submit-error">{error}</p>}
  </>;
}
