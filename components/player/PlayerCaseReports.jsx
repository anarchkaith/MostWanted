import { useMemo, useState } from 'react';
import CyberButtonLabel from '../ui/CyberButtonLabel';
import CyberSelect from '../ui/CyberSelect';
import Skeleton from '../ui/Skeleton';
import { SEVERITY_LABELS, VALIDATION_LABELS, normalizeReportSeverity, filterCaseReports, reportCategories, formatCaseDate } from '../../src/services/casePresentation';

const EMPTY_FILTERS = { category: '', validation: '', from: '', to: '', query: '' };
const PAGE_SIZE = 10;

export default function PlayerCaseReports({ reports, payload, player, caseId, loading, error, onOpenReport }) {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const filtered = useMemo(() => filterCaseReports(reports, filters), [reports, filters]);
  const categories = useMemo(() => [...new Set(reports.flatMap(reportCategories))], [reports]);
  const updateFilter = (key, value) => { setFilters(current => ({ ...current, [key]: value })); setPage(1); };
  const visiblePage = Math.min(page, Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)));
  const shownReports = filtered.slice((visiblePage - 1) * PAGE_SIZE, visiblePage * PAGE_SIZE);
  const hasSeverity = reports.some(report => normalizeReportSeverity(report.severidad));
  return <section className="case-reports" aria-labelledby="linked-reports-title">
    <header className="case-reports__header"><h2 id="linked-reports-title">Reportes <span>({payload ? reports.length : '—'})</span></h2>{payload && filtered.length !== reports.length && <p className="case-report-count" role="status" aria-live="polite">{filtered.length} resultados</p>}</header>
    {loading && (player || caseId) && <Skeleton label="Cargando reportes del jugador…" rows={4} />}
    {payload?.nameOnlyReportIds?.length > 0 && <p className="case-association-note" role="status">{payload.nameOnlyReportIds.length} reporte(s) solo por nombre; identidad sin confirmar.</p>}
    {reports.length > 0 && <div className="case-filters" role="group" aria-label="Filtrar reportes">
      <label htmlFor="filter-category">Infracción<CyberSelect id="filter-category" value={filters.category} onChange={value => updateFilter('category', value)} options={[{ value: '', label: 'Todas las infracciones' }, ...categories.map(category => ({ value: category, label: category }))]} /></label>
      <label htmlFor="filter-validation">Validación<CyberSelect id="filter-validation" value={filters.validation} onChange={value => updateFilter('validation', value)} options={[{ value: '', label: 'Todos los estados' }, ...Object.entries(VALIDATION_LABELS).map(([value, label]) => ({ value, label }))]} /></label>
      <label htmlFor="filter-from">Desde<div className="cyber-input-full mw-cyber-input"><input id="filter-from" type="date" value={filters.from} max={filters.to || undefined} onChange={event => updateFilter('from', event.target.value)} /></div></label>
      <label htmlFor="filter-to">Hasta<div className="cyber-input-full mw-cyber-input"><input id="filter-to" type="date" value={filters.to} min={filters.from || undefined} onChange={event => updateFilter('to', event.target.value)} /></div></label>
      <label className="case-filters__search">Buscar en reportes<div className="cyber-input-full mw-cyber-input"><input type="search" value={filters.query} onChange={event => updateFilter('query', event.target.value)} placeholder="Nombre, motivo o número" /></div></label>
      <button type="button" className="cyber-button-small mw-cyber-button mw-cyber-button--secondary" onClick={() => { setFilters(EMPTY_FILTERS); setPage(1); }}><CyberButtonLabel>Limpiar filtros</CyberButtonLabel></button>
    </div>}
    {!loading && !reports.length && <p className="desk-empty">{error && !payload ? 'No se pudieron cargar los reportes.' : player && payload ? 'Sin reportes registrados.' : 'Sin jugador seleccionado.'}</p>}
    {!loading && reports.length > 0 && !filtered.length && <p className="desk-empty">No hay reportes que coincidan con estos filtros.</p>}
    {shownReports.length > 0 && <table className="cyber-table cyber-style-2 case-table">
      <caption className="sr-only">Reportes del jugador. Usa Ver reporte para consultar las evidencias y votar.</caption>
      <thead><tr>
        <th scope="col">Fecha / reporte</th><th scope="col">Infracción</th>{hasSeverity && <th scope="col">Severidad</th>}<th scope="col">Validación</th>
        <th scope="col">Detalle</th>
      </tr></thead>
      <tbody>{shownReports.map(report => <tr key={report.id}>
        <td data-label="Fecha"><span className="case-report-reference"><time>{formatCaseDate(report.fecha)}</time><small>#{report.id}</small></span>
          {payload?.nameOnlyReportIds?.some(id => String(id) === String(report.id)) && <small>Asociación solo por nombre</small>}
        </td>
        <td data-label="Infracción">{reportCategories(report).join(', ') || 'Sin datos'}</td>
        {hasSeverity && <td data-label="Severidad">{SEVERITY_LABELS[normalizeReportSeverity(report.severidad)] || '—'}</td>}
        <td data-label="Validación"><span className="case-badge">{VALIDATION_LABELS[report.validacion] || report.validacion || 'Sin datos'}</span></td>
        <td><button type="button" className="cyber-button-small mw-cyber-button mw-cyber-button--secondary" onClick={() => onOpenReport(report)} aria-label={`Ver detalles del reporte ${report.id}`}><CyberButtonLabel>Ver reporte</CyberButtonLabel></button></td>
      </tr>)}</tbody>
    </table>}
    {filtered.length > PAGE_SIZE && <nav className="case-pagination" aria-label="Páginas de reportes"><button type="button" className="cyber-button-small mw-cyber-button mw-cyber-button--secondary" disabled={visiblePage === 1} onClick={() => setPage(visiblePage - 1)}>Anterior</button><span>{visiblePage} / {Math.ceil(filtered.length / PAGE_SIZE)}</span><button type="button" className="cyber-button-small mw-cyber-button mw-cyber-button--secondary" disabled={visiblePage * PAGE_SIZE >= filtered.length} onClick={() => setPage(visiblePage + 1)}>Siguiente</button></nav>}
  </section>;
}
