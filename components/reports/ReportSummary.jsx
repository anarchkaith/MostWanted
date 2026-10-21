import { CATEGORY_LABELS, normalizeReportSeverity, SEVERITY_LABELS, VALIDATION_LABELS, formatReportDate } from '../../src/services/casePresentation';

export default function ReportSummary({ report }) {
  const severity = normalizeReportSeverity(report.severidad);
  return <>
    <div className="report-detail__field">
      <div className="report-detail__label">Jugador</div>
      <div className="report-detail__value report-detail__value--user notranslate" translate="no">{report.usuario}</div>
    </div>
    <div className="report-detail__field report-detail__classification">
      <div>
        <div className="report-detail__label">Categoría</div>
        <div className="report-detail__value">
          <span className={`report-card__tag report-card__tag--${report.categoria || 'modder'}`}>
            {CATEGORY_LABELS[report.categoria] || (report.categoria || 'N/A').toUpperCase()}
          </span>
        </div>
      </div>
      {severity && <div>
        <div className="report-detail__label">Severidad</div>
        <div className="report-detail__value">
          <span className="report-card__severity"><span className={`severity-indicator severity-indicator--${severity}`} aria-hidden="true" />{SEVERITY_LABELS[severity]}</span>
        </div>
      </div>}
    </div>
    <div className="report-detail__field">
      <div className="report-detail__label">Motivo</div>
      <div className="report-detail__value">{report.motivo}</div>
    </div>
  </>;
}

export function ReportValidation({ report }) {
  return <div className="report-detail__field">
    <div className="report-detail__label">Validación del reporte</div>
    <div className="report-detail__value">{VALIDATION_LABELS[report.validacion] || 'Sin validación registrada'}</div>
    {report.fechaValidacion && <div className="report-detail__validation-date">📅 Validado el {formatReportDate(report.fechaValidacion)}</div>}
    {report.adminNota && <div className="report-detail__historical-note">📝 Nota del Admin: {report.adminNota}</div>}
  </div>;
}
