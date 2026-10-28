import { CATEGORY_LABELS, SEVERITY_LABELS, VALIDATION_LABELS, formatCaseDate, formatReportDate, reportCategories } from '../../src/services/casePresentation';
import { normalizeReportLabels } from '../../src/services/reportViewModel';
import { reportEvidence } from '../../src/services/reportEvidence';
import { resolvePlayerRid } from '../../shared/playerIdentity';
import { buildCrewLink } from '../../shared/crewLink';
import SpecialTextContent from '../ui/SpecialTextContent';

const INVESTIGATION_LABELS = {
  not_attempted: 'No intentada',
  pending: 'Pendiente',
  resolved: 'Resuelta',
  not_found: 'Sin resultados',
};

function DetailField({ label, children }) {
  return <div className="report-detail__field">
    <div className="report-detail__label">{label}</div>
    <div className="report-detail__value">{children}</div>
  </div>;
}

export default function ReportSummary({ report }) {
  const rid = resolvePlayerRid(report);
  const categories = reportCategories(report);
  const labels = normalizeReportLabels(report.labels || report.etiquetas);
  const aliases = Array.isArray(report.aliases) ? report.aliases.filter(Boolean) : [];
  const crews = (Array.isArray(report.crews) ? report.crews : []).map(buildCrewLink).filter(Boolean);
  const avatars = reportEvidence({ evidence: [report.avatar1, report.avatar2].filter(Boolean) }).filter(item => item.src);
  const timestamp = Number(report.time);
  const incidentDate = timestamp > 0 && Number.isFinite(timestamp)
    ? new Date(timestamp * (timestamp < 1e12 ? 1000 : 1)) : null;
  return <SpecialTextContent>
    <>
      <div className="report-detail__field">
        <div className="report-detail__label">Jugador</div>
        <div className="report-detail__value report-detail__value--user notranslate" translate="no">
          <SpecialTextContent group>{report.usuario}</SpecialTextContent>
        </div>
      </div>
      {rid && <DetailField label="RID"><span className="notranslate" translate="no">{rid}</span></DetailField>}
      <div className="report-detail__field report-detail__classification">
        <div>
          <div className="report-detail__label">Tipos de infracción</div>
          <div className="report-detail__value">
            {categories.length ? <div className="case-tags">{categories.map(category => <span key={category} className="case-badge">
              <SpecialTextContent group>{CATEGORY_LABELS[category] || String(category).toUpperCase()}</SpecialTextContent>
            </span>)}</div> : 'Sin infracciones registradas'}
          </div>
        </div>
      </div>
      {labels.length > 0 && <DetailField label="Etiquetas">
        <ul className="report-detail__list">{labels.map((item, index) => <li key={`${item.label}-${index}`}>
          <strong>{item.label}</strong>{item.detail && <span> — {item.detail}</span>}
        </li>)}</ul>
      </DetailField>}
      {SEVERITY_LABELS[report.severidad] && <DetailField label="Severidad">{SEVERITY_LABELS[report.severidad]}</DetailField>}
      {INVESTIGATION_LABELS[report.investigation_status] && <DetailField label="Investigación de identidad">
        {INVESTIGATION_LABELS[report.investigation_status]}
      </DetailField>}
      {incidentDate && Number.isFinite(incidentDate.getTime()) && <DetailField label="Fecha y hora del incidente">
        {formatCaseDate(incidentDate.toISOString(), true)}
      </DetailField>}
      {aliases.length > 0 && <DetailField label="Otros nombres registrados">
        <span className="notranslate" translate="no">{aliases.join(', ')}</span>
      </DetailField>}
      {crews.length > 0 && <DetailField label="Crews">
        <ul className="report-detail__list">{crews.map((crew, index) => <li key={`${crew.url}-${index}`}>
          <a className="notranslate" translate="no" href={crew.url} target="_blank" rel="noopener noreferrer">{crew.name}</a>
        </li>)}</ul>
      </DetailField>}
      {avatars.length > 0 && <DetailField label="Avatares registrados en el reporte">
        <ul className="report-detail__list">{avatars.map((avatar, index) => <li key={avatar.id}>
          <a href={avatar.src} target="_blank" rel="noopener noreferrer">Ver avatar {index + 1}</a>
        </li>)}</ul>
      </DetailField>}
      <div className="report-detail__field">
        <div className="report-detail__label">Motivo</div>
        <div className="report-detail__value"><SpecialTextContent group>{report.motivo}</SpecialTextContent></div>
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
