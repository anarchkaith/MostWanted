import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import PlayerAvatarImage from './PlayerAvatarImage';
import useDialog from '../src/hooks/useDialog';

export default function ImageViewer({ image, onClose, variant = 'avatar' }) {
  const closeRef = useRef(null);
  const dialogRef = useRef(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [image.src]);
  useDialog(dialogRef, { onClose, initialFocusRef: closeRef });
  return createPortal(
    <div ref={dialogRef} className={`image-viewer${variant === 'evidence' ? ' image-viewer--evidence' : ''}`} role="dialog" aria-modal="true" aria-label={image.label} tabIndex={-1} onClick={event => {
      if (variant === 'evidence' && event.target === event.currentTarget) onClose();
    }}>
      <button ref={closeRef} type="button" className="site-help" data-ui-sound="reject" onClick={onClose} aria-label="Cerrar imagen ampliada">Cerrar ×</button>
      {failed && <p role="alert">No se pudo cargar la imagen. Cierra esta vista para volver al expediente.</p>}
      <div className="image-viewer__stage">
        <PlayerAvatarImage src={image.src} alt={image.label} normalizeAlpha={image.normalizeAlpha} onError={() => setFailed(true)} />
      </div>
    </div>, document.body,
  );
}
