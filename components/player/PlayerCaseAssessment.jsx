import { Children, cloneElement, isValidElement } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import Skeleton from '../ui/Skeleton';
import { formatCaseDate } from '../../src/services/casePresentation';
import SpecialTextContent from '../ui/SpecialTextContent';

function withSpecialText(Tag) {
  return function SpecialTextMarkdownElement({ children, ...props }) {
    const attributes = { ...props };
    delete attributes.node;
    return <Tag {...attributes}><SpecialTextContent group>{children}</SpecialTextContent></Tag>;
  };
}

function SpecialTextMarkdownParagraph({ children, ...props }) {
  const attributes = { ...props };
  delete attributes.node;
  const segments = [];
  let segment = [];

  Children.toArray(children).forEach(child => {
    if (isValidElement(child) && child.type === 'br') {
      segments.push(segment);
      segments.push(child);
      segment = [];
    } else {
      segment.push(child);
    }
  });
  segments.push(segment);

  return (
    <p {...attributes}>
      {segments.map((part, index) => (
        Array.isArray(part)
          ? <SpecialTextContent key={`segment-${index}`} group>{part}</SpecialTextContent>
          : cloneElement(part, { key: `break-${index}` })
      ))}
    </p>
  );
}

const markdownComponents = {
  p: SpecialTextMarkdownParagraph,
  h1: withSpecialText('h1'),
  h2: withSpecialText('h2'),
  h3: withSpecialText('h3'),
  h4: withSpecialText('h4'),
  h5: withSpecialText('h5'),
  h6: withSpecialText('h6'),
  li: withSpecialText('li'),
  blockquote: withSpecialText('blockquote'),
  td: withSpecialText('td'),
  th: withSpecialText('th'),
};

export function PlayerCaseClassification({ classification, text, loading }) {
  return <section className="case-section case-classification">
    <h3>Análisis HEX</h3>
    {loading && !text ? <Skeleton label="Cargando análisis HEX…" rows={6} /> : text ? <>
      <div className="case-classification__text">
        <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={markdownComponents}>{text}</ReactMarkdown>
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
