import { useId, useRef } from 'react';
import useDialog from '../../src/hooks/useDialog';

export default function ReportSubmissionConfirmation({ result, onClose, onAccept, canReturn, returnFocusRef }) {
  const dialog = useRef(null);
  const firstButton = useRef(null);
  const title = useId();
  useDialog(dialog, { onClose, initialFocusRef: firstButton, returnFocusRef });
  const delivery = result.discordDelivery;
  return <div className="rfm-confirmation-overlay">
    <div ref={dialog} className="rfm-confirmation" role="dialog" aria-modal="true" aria-labelledby={title} tabIndex={-1}>
      <div className="rfm-confirmation__icon" aria-hidden="true">✅</div>
      <h2 id={title}>{delivery?.ok && !result.warning ? 'Reporte guardado' : 'Reporte guardado con avisos'}</h2>
      <p>Jugador: <span className="notranslate" translate="no" style={{ color: '#e8e8b8', fontWeight: 700 }}>{result.nickname}</span></p>
      <div className={`rfm-delivery-status rfm-delivery-status--${delivery?.ok ? 'success' : 'warning'}`}>
        {delivery?.ok ? 'Sincronizado con el bot de Discord.'
          : `No se pudo confirmar el envio al bot de Discord${delivery?.message ? `: ${delivery.message}` : '.'}`}
      </div>
      {result.warning && <p className="rfm-delivery-status rfm-delivery-status--warning" role="status">{result.warning}</p>}
      <a href="https://support.rockstargames.com/request/gta-v/online-play-support/report-another-player/pc" target="_blank" rel="noopener noreferrer" className="rfm-support-link">
        Reportarlo tambien en Rockstar Support
      </a>
      <div className="rfm-confirmation__actions">
        {canReturn && <button ref={firstButton} type="button" className="cyber-button-small mw-cyber-button mw-cyber-button--secondary" onClick={onAccept}>Volver al expediente</button>}
        <button ref={canReturn ? undefined : firstButton} type="button" onClick={onClose} className="cyber-button-small mw-cyber-button mw-cyber-button--secondary">✏️ Volver y editar</button>
        <button type="button" onClick={onAccept} className="cyber-button-small mw-cyber-button">✔ Aceptar</button>
      </div>
    </div>
  </div>;
}
