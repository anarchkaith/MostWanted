import { useEffect, useState } from 'react';

function formatRemaining(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  return `${minutes}:${String(totalSeconds % 60).padStart(2, '0')}`;
}

export default function SubmitErrorMessage({ message, retryAt, errorRef }) {
  const [, setTick] = useState(0);
  const waiting = Boolean(retryAt) && retryAt > Date.now();

  useEffect(() => {
    if (!waiting) return undefined;
    const id = setInterval(() => {
      setTick(value => value + 1);
      if (Date.now() >= retryAt) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [retryAt, waiting]);

  if (!message) return null;

  return <div ref={errorRef} className="rfm-submit-error" role="alert" tabIndex={-1}>
    {retryAt
      ? waiting
        ? <>⚠ Has enviado demasiados reportes. Podrás volver a reportar en <span aria-hidden="true">{formatRemaining(retryAt - Date.now())}</span>.</>
        : <>⚠ Ya puedes volver a enviar el reporte.</>
      : <>⚠ {message}</>}
  </div>;
}
