import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import PlayerAvatarImage from './PlayerAvatarImage';

export default function ImageViewer({ image, onClose }) {
  const closeRef = useRef(null);
  const dialogRef = useRef(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [image.src]);
  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current.focus();
    const onKeyDown = event => {
      if (event.key === 'Escape') { event.stopPropagation(); onClose(); }
      if (event.key === 'Tab') {
        const controls = [...dialogRef.current.querySelectorAll('button:not(:disabled), a[href]')];
        const index = controls.indexOf(document.activeElement);
        const next = (index + (event.shiftKey ? -1 : 1) + controls.length) % controls.length;
        event.preventDefault();
        controls[next]?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, [onClose]);
  return createPortal(
    <div ref={dialogRef} className="image-viewer" role="dialog" aria-modal="true" aria-label={image.label}>
      <button ref={closeRef} type="button" className="site-help" data-ui-sound="reject" onClick={onClose} aria-label="Cerrar imagen ampliada">Cerrar ×</button>
      {failed && <p role="alert">No se pudo cargar la imagen. Cierra esta vista para volver al expediente.</p>}
      <div className="image-viewer__stage">
        <PlayerAvatarImage src={image.src} alt={image.label} normalizeAlpha={image.normalizeAlpha} onError={() => setFailed(true)} />
      </div>
    </div>, document.body,
  );
}
