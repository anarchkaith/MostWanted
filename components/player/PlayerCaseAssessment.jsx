import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import Skeleton from '../ui/Skeleton';
import { formatCaseDate } from '../../src/services/casePresentation';

export function PlayerCaseClassification({ classification, text, loading }) {
  return <section className="case-section case-classification">
    <h3>Análisis HEX</h3>
    {loading && !text ? <Skeleton label="Cargando análisis HEX…" rows={6} /> : text ? <>
      <div className="case-classification__text">
        <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{text}</ReactMarkdown>
      </div>
      <p className="case-muted">Resumen generado por HEX · {classification.reportCount} reporte(s) · {formatCaseDate(classification.updatedAt, true)}</p>
    </> : null}
    {classification?.stale && <p className="case-muted" role="status">Resumen pendiente de actualizar.</p>}
    {classification?.error && <p className="rfm-submit-error" role="alert">{classification.error}</p>}
    {!loading && classification?.pending && <Skeleton label="Generando análisis HEX…" rows={3} />}
  </section>;
}

export function PlayerCommunityVerification({ votes, loading }) {
  return <section className="case-section case-verification">
    <h3>Verificación comunitaria</h3>
    {loading ? <Skeleton label="Cargando votos de los reportes…" /> : <>
      <dl className="case-votes">
        <div><dt>Reportes legítimos</dt><dd>{votes.percent === null ? '—' : `${votes.percent}%`}</dd></div>
        <div><dt>Reportes falsos</dt><dd>{votes.percent === null ? '—' : `${100 - votes.percent}%`}</dd></div>
        <div><dt>Votos emitidos</dt><dd>{votes.total}</dd></div>
      </dl>
      {votes.percent !== null && <meter min="0" max="100" value={votes.percent} aria-label="Porcentaje de votos legítimos" />}
    </>}
  </section>;
}
