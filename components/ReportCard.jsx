import VoteSystem from './VoteSystem';
import { normalizeReportSeverity, SEVERITY_LABELS } from '../src/services/casePresentation';

/**
 * ReportCard - Componente para mostrar una ficha individual de reporte
 * Estética punk/grunge con efectos de glitch en hover
 * Muestra estado de validación y votos comunitarios
 */
const ReportCard = ({ reporte, onClick, onVote }) => {
  // Mapeo de categorías a etiquetas legibles
  const categoryLabels = {
    modder: 'MODDER',
    griffer: 'GRIFFER',
    ardido: 'ARDIDO'
  };

  // Mapeo de validación
  const validationIcons = {
    pendiente: '⏳',
    verificado: '✅',
    rechazado: '❌',
    investigando: '🔍'
  };

  // Mapeo de etiquetas de validación para admin
  const validationLabels = {
    verificado: 'VERIFICADO POR ADMIN',
    rechazado: 'RECHAZADO POR ADMIN',
    investigando: 'EN INVESTIGACIÓN'
  };

  // Formatear fecha
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return '--/--/----';
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const categoria = reporte.categoria || 'ardido';
  const severidad = normalizeReportSeverity(reporte.severidad);
  const validationStatus = reporte.validacion || 'pendiente';
  const hasEvidencias = (reporte.evidencias && reporte.evidencias.length > 0) || Boolean(reporte.evidencia);

  return (
    <article
      className={`report-card cyber-tile mw-cyber-tile ${validationStatus === 'verificado' ? 'report-card--verified' : ''} ${validationStatus === 'rechazado' ? 'report-card--rejected' : ''} ${validationStatus === 'investigando' ? 'report-card--investigating' : ''}`}
      onClick={() => onClick(reporte)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(reporte);
        }
      }}
      aria-label={`Ver detalles del reporte de ${reporte.usuario || 'usuario desconocido'}`}
    >
      {/* Banner de acción de admin */}
      {validationStatus !== 'pendiente' && (
        <div className={`report-card__admin-banner report-card__admin-banner--${validationStatus}`}>
          {validationIcons[validationStatus]} {validationLabels[validationStatus]}
        </div>
      )}

      {/* Header con usuario y tag */}
      <header className="report-card__header">
        <h3 className="report-card__user notranslate" translate="no">{reporte.usuario || 'USUARIO_SIN_NOMBRE'}</h3>
        <span className={`report-card__tag report-card__tag--${categoria}`}>
          {categoryLabels[categoria] || categoria.toUpperCase()}
        </span>
      </header>

      {/* Motivo truncado */}
      <p className="report-card__motivo">
        {reporte.motivo}
      </p>

      {/* Footer con fecha y severidad */}
      <footer className="report-card__footer">
        <span className="report-card__date">
          📅 {formatDate(reporte.fecha)}
          {hasEvidencias && <span title="Tiene evidencias"> 📎</span>}
        </span>
        {severidad && <span className="report-card__severity">
          <span
            className={`severity-indicator severity-indicator--${severidad}`}
            aria-hidden="true"
          />
          {SEVERITY_LABELS[severidad]}
        </span>}
      </footer>

      {/* Votos comunitarios (modo compacto) */}
      <VoteSystem
        reporteId={reporte.id}
        votos={reporte.votos || { up: 0, down: 0, comentarios: [] }}
        userVote={reporte.userVote}
        onVote={onVote}
        compact={true}
      />
    </article>
  );
};

export default ReportCard;
