import { CATEGORY_LABELS, VALIDATION_LABELS, formatReportDate } from '../../src/services/casePresentation';
import SpecialTextContent from '../ui/SpecialTextContent';

export default function ReportSummary({ report }) {
  return <SpecialTextContent>
    <>
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
      </div>
      <div className="report-detail__field">
        <div className="report-detail__label">Motivo</div>
        <div className="report-detail__value">{report.motivo}</div>
      </div>
    </>
  </SpecialTextContent>;
}

export function ReportValidation({ report }) {
  return <SpecialTextContent>
    <div className="report-detail__field">
      <div className="report-detail__label">Validación del reporte</div>
      <div className="report-detail__value">{VALIDATION_LABELS[report.validacion] || 'Sin validación registrada'}</div>
      {report.fechaValidacion && <div className="report-detail__validation-date">📅 Validado el {formatReportDate(report.fechaValidacion)}</div>}
      {report.adminNota && <div className="report-detail__historical-note">📝 Nota del Admin: {report.adminNota}</div>}
    </div>
  </SpecialTextContent>;
}
