import { useId, useRef } from 'react';
import useDialog from '../../src/hooks/useDialog';
import { TIPOS_ETIQUETAS } from '../tiposEtiquetas';
import SpecialTextContent from '../ui/SpecialTextContent';

const INVESTIGATION_STATUS_LABELS = {
  not_attempted: 'No intentada',
  pending: 'Pendiente',
  resolved: 'Resuelta',
  not_found: 'Sin resultados',
};

function displayValue(value) {
  if (Array.isArray(value)) {
    const items = value.map(item => typeof item === 'string' ? item.trim() : String(item ?? '').trim()).filter(Boolean);
    return items.length ? items.join(', ') : 'No especificado';
  }
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return typeof value === 'string' && value.trim() ? value.trim() : 'No especificado';
}

function displayCategories(categories) {
  const items = Array.isArray(categories) ? categories : [];
  return items.length
    ? items.map(key => {
      const category = TIPOS_ETIQUETAS.find(item => item.key === key);
      return category ? `${category.emoji} ${category.nombre}` : String(key);
    }).join(', ')
    : 'No especificado';
}

function displayIncidentTime(value) {
  if (value === null || value === undefined || value === '') return 'No especificada';
  const numeric = Number(value);
  const date = Number.isFinite(numeric)
    ? new Date(numeric > 1e12 ? numeric : numeric * 1000)
    : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString('es-ES') : String(value);
}

function safeHttpUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return '';
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : '';
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
    return '';
  }
}

function ConfirmationField({ label, children }) {
  return <div className="report-detail__field">
    <div className="report-detail__label">{label}</div>
    <div className="report-detail__value">{children}</div>
  </div>;
}

export default function ReportSubmissionConfirmation({ result, onClose, onAccept, canReturn, returnFocusRef }) {
  const dialog = useRef(null);
  const firstButton = useRef(null);
  const title = useId();
  useDialog(dialog, { onClose, initialFocusRef: firstButton, returnFocusRef });
  const delivery = result.discordDelivery;
  const report = result.report || {};
  const evidence = Array.isArray(result.evidence) ? result.evidence : [];
  return <div className="rfm-confirmation-overlay">
    <div ref={dialog} className="rfm-confirmation" role="dialog" aria-modal="true" aria-labelledby={title} tabIndex={-1}>
      <div className="rfm-confirmation__icon" aria-hidden="true">✅</div>
      <h2 id={title}>{delivery?.ok && !result.warning ? 'Reporte guardado' : 'Reporte guardado con avisos'}</h2>
      <p>Jugador: <span className="notranslate" translate="no" style={{ color: '#e8e8b8', fontWeight: 700 }}>{result.nickname}</span></p>
      <section className="rfm-confirmation__report" aria-label="Información del reporte enviado">
        <ConfirmationField label="RID">{displayValue(report.rid)}</ConfirmationField>
        <ConfirmationField label="Estado de investigación">
          {INVESTIGATION_STATUS_LABELS[report.investigation_status] || displayValue(report.investigation_status)}
        </ConfirmationField>
        <ConfirmationField label="Crews">{displayValue(report.crews)}</ConfirmationField>
        <ConfirmationField label="Otros nombres conocidos">{displayValue(report.aliases)}</ConfirmationField>
        <ConfirmationField label="IP del incidente">{displayValue(report.ip)}</ConfirmationField>
        <ConfirmationField label="Fecha y hora del incidente">{displayIncidentTime(report.time)}</ConfirmationField>
        <ConfirmationField label="Categorías">{displayCategories(report.typesOfInfraction)}</ConfirmationField>
        <ConfirmationField label="Etiquetas">{displayValue(report.labels)}</ConfirmationField>
        <ConfirmationField label="Motivo"><span className="rfm-confirmation__multiline">{displayValue(report.reason)}</span></ConfirmationField>
        <ConfirmationField label="Avatar 1">
          {safeHttpUrl(report.avatar1)
            ? <a href={safeHttpUrl(report.avatar1)} target="_blank" rel="noopener noreferrer">{report.avatar1}</a>
            : displayValue(report.avatar1)}
        </ConfirmationField>
        <ConfirmationField label="Avatar 2">
          {safeHttpUrl(report.avatar2)
            ? <a href={safeHttpUrl(report.avatar2)} target="_blank" rel="noopener noreferrer">{report.avatar2}</a>
            : displayValue(report.avatar2)}
        </ConfirmationField>
        <ConfirmationField label="Evidencias">
          {evidence.length
            ? <ul className="rfm-confirmation__evidence">{evidence.map((item, index) => {
              const url = safeHttpUrl(item?.url);
              return <li key={`${url || item?.name || 'evidence'}-${index}`}>
                {url ? <a href={url} target="_blank" rel="noopener noreferrer">{displayValue(item?.name || `Evidencia ${index + 1}`)}</a>
                  : displayValue(item?.name || `Evidencia ${index + 1}`)}
                {item?.contentType ? ` · ${item.contentType}` : ''}
                {Number.isFinite(Number(item?.size)) && Number(item.size) > 0 ? ` · ${item.size} bytes` : ''}
              </li>;
            })}</ul>
            : 'Sin evidencia adjunta'}
        </ConfirmationField>
      </section>
      <div className={`rfm-delivery-status rfm-delivery-status--${delivery?.ok ? 'success' : 'warning'}`}>
        {delivery?.ok ? 'Sincronizado con el bot de Discord.'
          : `No se pudo confirmar el envio al bot de Discord${delivery?.message ? `: ${delivery.message}` : '.'}`}
      </div>
      {result.warning && <p className="rfm-delivery-status rfm-delivery-status--warning" role="status">{result.warning}</p>}
      <a href="https://support.rockstargames.com/request/gta-v/online-play-support/report-another-player/pc" target="_blank" rel="noopener noreferrer" className="rfm-support-link">
        Reportarlo tambien en Rockstar Support
      </a>
      <div className="rfm-confirmation__actions">
        {canReturn && <button ref={firstButton} type="button" className="cyber-button-small mw-cyber-button mw-cyber-button--secondary" onClick={onAccept}><SpecialTextContent>Volver al expediente</SpecialTextContent></button>}
        <button ref={canReturn ? undefined : firstButton} type="button" onClick={onClose} className="cyber-button-small mw-cyber-button mw-cyber-button--secondary"><SpecialTextContent>✏️ Volver y editar</SpecialTextContent></button>
        <button type="button" onClick={onAccept} className="cyber-button-small mw-cyber-button"><SpecialTextContent>✔ Aceptar</SpecialTextContent></button>
      </div>
    </div>
  </div>;
}
