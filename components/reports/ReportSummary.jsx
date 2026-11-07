import { CATEGORY_LABELS, formatCaseDate, reportCategories, severityClassName } from '../../src/services/casePresentation';
import { normalizeReportLabels } from '../../src/services/reportViewModel';
import { reportEvidence } from '../../src/services/reportEvidence';
import { resolvePlayerRid } from '../../shared/playerIdentity';
import { buildCrewLink } from '../../shared/crewLink';
import CurrentPlayerAvatars from '../player/CurrentPlayerAvatars';
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

export default function ReportSummary({ report, onOpenAvatar }) {
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
      <div className="report-detail__identity">
        {avatars.length > 0 && <div className="report-detail__avatars">
          <CurrentPlayerAvatars key={`${report.id}-${avatars.map(avatar => avatar.src).join('|')}`}
            label="Avatar"
            investigation={{ nombre: report.usuario, avatares: avatars.map((avatar, index) => ({ index, avatarUrl: avatar.src })) }}
            onOpen={onOpenAvatar} />
        </div>}
        <div className="report-detail__identity-content">
          <div className="report-detail__label">Jugador</div>
          <div className="report-detail__name notranslate" translate="no">
            <SpecialTextContent group>{report.usuario}</SpecialTextContent>
          </div>
          {aliases.length > 0 && <div className="report-detail__aliases">
            <span>Otros nombres registrados</span>
            <span className="notranslate" translate="no">{aliases.join(', ')}</span>
          </div>}
          {(rid || crews.length > 0) && <div className="report-detail__identity-meta">
            {rid && <div className="report-detail__metadata">
              <span className="report-detail__metadata-label">RID</span>
              <span className="notranslate" translate="no">{rid}</span>
            </div>}
            {crews.length > 0 && <div className="report-detail__metadata">
              <span className="report-detail__metadata-label">Crews</span>
              {crews.map((crew, index) => <a className="notranslate" translate="no" key={`${crew.url}-${index}`}
                href={crew.url} target="_blank" rel="noopener noreferrer">{crew.name}</a>)}
            </div>}
          </div>}
        </div>
      </div>
      <div className="report-detail__field report-detail__classification">
        <div>
          <div className="report-detail__label">Tipos de infracción</div>
          <div className="report-detail__value">
            {categories.length ? <div className="case-tags">{categories.map(category => <span key={category} className={`case-badge ${severityClassName(category)}`}>
              <SpecialTextContent group>{CATEGORY_LABELS[category] || String(category).toUpperCase()}</SpecialTextContent>
            </span>)}</div> : 'Sin infracciones registradas'}
          </div>
        </div>
      </div>
      {labels.length > 0 && <DetailField label="Etiquetas">
        <div className="report-detail__tags">{labels.map((item, index) => <span className="report-detail__tag" key={`${item.label}-${index}`}>
          <span>{item.label}{item.detail && <span className="report-detail__tag-detail"> — {item.detail}</span>}</span>
        </span>)}</div>
      </DetailField>}
      {INVESTIGATION_LABELS[report.investigation_status] && <DetailField label="Investigación de identidad">
        {INVESTIGATION_LABELS[report.investigation_status]}
      </DetailField>}
      {incidentDate && Number.isFinite(incidentDate.getTime()) && <DetailField label="Fecha y hora del incidente">
        {formatCaseDate(incidentDate.toISOString(), true)}
      </DetailField>}
      <div className="report-detail__field">
        <div className="report-detail__label">Motivo</div>
        <div className="report-detail__value"><SpecialTextContent group>{report.motivo}</SpecialTextContent></div>
      </div>
    </>
  </SpecialTextContent>;
}
