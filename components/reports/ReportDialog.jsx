import { useEffect, useRef } from 'react';
import CyberButtonLabel from '../ui/CyberButtonLabel';

// Mantiene el contenido montado al cerrarse para no perder un borrador si el usuario pulsa Esc.
export default function ReportDialog({ open, onClose, children }) {
  const dialogRef = useRef(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal?.();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return <dialog ref={dialogRef} className="report-dialog" aria-labelledby="report-dialog-title"
    onCancel={event => { event.preventDefault(); onClose(); }}>
    <div className="report-dialog__header">
      <h2 id="report-dialog-title" className="report-dialog__title">Registrar reporte</h2>
      <button type="button" className="cyber-button-small mw-cyber-button mw-cyber-button--secondary" onClick={onClose}>
        <CyberButtonLabel>Cerrar</CyberButtonLabel>
      </button>
    </div>
    {children}
  </dialog>;
}
