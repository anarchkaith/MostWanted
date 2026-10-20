import { useCallback, useEffect, useMemo, useState } from 'react';
import PlayerBackgroundPanel from './PlayerBackgroundPanel';
import CaseStaffPanel from './CaseStaffPanel';
import CyberButtonLabel from './CyberButtonLabel';
import CyberSelect from './CyberSelect';
import { requestCase } from '../src/services/casesService';
import { CASE_STATUSES, VALIDATION_LABELS, filterCaseReports, reportCategories, summarizeVotes, formatCaseDate } from '../src/services/casePresentation';
import { mergePlayerProfile } from '../src/services/playerProfile';

const EMPTY_FILTERS = { category: '', validation: '', from: '', to: '', query: '' };
const PAGE_SIZE = 10;

export default function InvestigationDesk({ initialPlayer, onPlayerResolved, reportsError, path, onNavigate, onOpenReport, onStartReport, mapReport, canManageCases, revision }) {
  const [selection] = useState(initialPlayer);
  const [foundPlayer, setFoundPlayer] = useState(null);
  const [investigationCompleted, setInvestigationCompleted] = useState(false);
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [version, setVersion] = useState(0);
  const onInvestigationChange = useCallback(result => {
    const identity = result ? {
      nickname: result.nombre === `RID ${result.rid}` ? result.username || '' : result.nombre,
      rid: String(result.rid || ''), names: result.profile?.aliases || [], investigation: result,
    } : null;
    setFoundPlayer(identity);
    setInvestigationCompleted(true);
    if (identity) onPlayerResolved(identity);
  }, [onPlayerResolved]);
  const caseId = path.match(/^\/jugador\/([^/]+)$/)?.[1] || '';
  const dossier = payload?.case || null;
  const player = dossier?.player || selection;
  const linkedReports = useMemo(() => (payload?.reports || []).map(mapReport), [payload, mapReport]);
  const filtered = useMemo(() => filterCaseReports(linkedReports, filters), [linkedReports, filters]);
  const categories = useMemo(() => [...new Set(linkedReports.flatMap(reportCategories))], [linkedReports]);
  const votes = useMemo(() => summarizeVotes(linkedReports), [linkedReports]);
  useEffect(() => {
    if (!caseId && !selection) return undefined;
    const controller = new AbortController();
    const params = new URLSearchParams({ username: selection?.nickname || '', rid: selection?.rid || '' });
    setLoading(true);
    setError('');
    requestCase(caseId ? `/${encodeURIComponent(caseId)}` : `/lookup?${params}`, { signal: controller.signal })
      .then(data => {
        setPayload(data);
        if (data.case?.id && !caseId && path === '/') onNavigate(`/jugador/${encodeURIComponent(data.case.id)}`, true);
      })
      .catch(error => { if (!controller.signal.aborted) setError(error.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [caseId, path, selection, revision, version, onNavigate]);

  const updateFilter = (key, value) => { setFilters(current => ({ ...current, [key]: value })); setPage(1); };
  const visiblePage = Math.min(page, Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)));
  const shownReports = filtered.slice((visiblePage - 1) * PAGE_SIZE, visiblePage * PAGE_SIZE);
  const supplemental = player && payload && <>
    <section className="case-section case-classification">
      <h3>Clasificación</h3>
      {dossier?.classification?.text ? <>
        <p className="case-classification__text">{dossier.classification.text}</p>
        <p className="case-muted">Resumen generado con IA · {dossier.classification.reportCount} reporte(s) · {formatCaseDate(dossier.classification.updatedAt, true)}</p>
      </> : <p className="case-muted">{linkedReports.length ? 'El resumen de IA aún no está disponible.' : 'Sin reportes para generar un resumen.'}</p>}
      {dossier?.classification?.stale && <p className="case-muted" role="status">El resumen guardado está pendiente de actualizar con los reportes actuales.</p>}
      {dossier?.classification?.error && <p className="rfm-submit-error" role="alert">{dossier.classification.error}</p>}
      {dossier?.classification?.pending && <p className="case-muted" role="status">Se está generando el resumen. Actualiza la consulta en unos momentos.</p>}
    </section>
    {canManageCases && dossier && !loading && !error && <CaseStaffPanel key={dossier.id} caseId={dossier.id} currentStatus={dossier.status} onChanged={() => setVersion(value => value + 1)} />}
    <section className="case-section"><h3>Verificación comunitaria</h3><div className="case-summary"><div><span>Legítimos</span><strong>{votes.percent === null ? '—' : `${votes.percent}%`}</strong></div><div><span>Falsos</span><strong>{votes.percent === null ? '—' : `${100 - votes.percent}%`}</strong></div><div><span>Votos</span><strong>{votes.total}</strong></div></div>{votes.percent !== null && <meter min="0" max="100" value={votes.percent} aria-label="Porcentaje de votos legítimos" />}<p className="case-muted">{votes.total ? `Resumen de ${linkedReports.length} reportes. Vota en el detalle de cada reporte, no sobre el jugador.` : 'Sin votos. La ausencia de votos no confirma ni rechaza las denuncias.'}</p></section>
  </>;

  return (
    <main className="investigation-desk" id="reportes-lista">
      <header className="desk-intro"><p className="workspace-eyebrow">01 / ARCHIVO DE INVESTIGACIÓN</p><h2>Inteligencia del jugador</h2><p>Perfil, antecedentes y actividad documentada. Busca una persona desde la cabecera para abrir su ficha.</p></header>
      <div className="desk-status" role="status">
        <span><span className="desk-status__signal cyber-glitch-4" aria-hidden="true" />{loading ? 'Consultando expediente…' : payload?.source?.stale ? 'Datos anteriores: actualización pendiente' : payload ? 'Consulta de expediente completada' : 'Selecciona un jugador para abrir su ficha'}</span>
        {payload?.source?.fetchedAt && <span>Fuente: {formatCaseDate(payload.source.fetchedAt, true)}</span>}
        <span>{canManageCases ? 'Staff autorizado' : 'Consulta de antecedentes'}</span>
      </div>
      {reportsError && <p className="rfm-submit-error" role="alert">{reportsError}</p>}
      {error && <div className="rfm-submit-error" role="alert"><p>{error}</p>{payload && <p>Los datos anteriores pueden estar desactualizados.</p>}<button type="button" className="cyber-button-small mw-cyber-button mw-cyber-button--secondary" onClick={() => setVersion(value => value + 1)}>Reintentar consulta</button></div>}
      {payload?.source?.stale && <div className="rfm-submit-error" role="alert"><p>Los datos de WordPress pueden estar desactualizados. {payload.source.error || 'No se pudo completar la actualización.'}</p><button type="button" className="cyber-button-small mw-cyber-button mw-cyber-button--secondary" onClick={() => setVersion(value => value + 1)}>Actualizar expediente</button></div>}
      <div className="desk-columns" aria-busy={loading}>
        <section className="case-file" aria-label="Expediente del jugador">
          <header className="case-file__header">
            <div><p className="workspace-eyebrow">PERFIL / IDENTIDAD Y ANTECEDENTES</p><h2>Ficha de identificación</h2></div>
            {dossier && <>
              <dl className="case-file__metadata"><div><dt>Primera denuncia</dt><dd>{formatCaseDate(linkedReports.map(report => report.fecha).filter(Boolean).sort()[0])}</dd></div><div><dt>Última actualización</dt><dd>{formatCaseDate(dossier.updatedAt, true)}</dd></div></dl>
            </>}
          </header>
          {!player && !caseId && <div className="case-section desk-empty"><h3>Identidad pendiente</h3><p>Busca por nombre o RID para consultar los antecedentes y sus reportes vinculados.</p></div>}
          {player && <>
            <div className="case-file__overview">
              <PlayerBackgroundPanel key={`${player.nickname}:${player.rid}:${revision}`} username={player.nickname || ''} rid={player.rid || ''} reports={linkedReports} investigateToken={1} variant="dossier" onInvestigationChange={onInvestigationChange} />
            <section className="case-section case-management">
              <p className="workspace-eyebrow">CONTROL DEL EXPEDIENTE</p><h3>Situación del caso</h3>
              <div className="case-summary"><div><span>Estado</span><strong>{dossier ? CASE_STATUSES[dossier.status] || dossier.status : payload ? 'Sin caso registrado' : 'Estado no disponible'}</strong></div></div>
              <p className="case-muted">Estado del caso, verificación comunitaria y estado de cuenta son independientes.</p>
              <p className="case-muted">Puedes aportar datos nuevos aunque no haya antecedentes o alguna fuente no esté disponible.</p>
              <button type="button" className="cyber-button-small mw-cyber-button" onClick={() => {
                const target = foundPlayer || player;
                const investigation = target.investigation;
                onStartReport({
                  ...target, investigationCompleted,
                  ...(investigation ? { investigation: {
                    ...investigation,
                    profile: mergePlayerProfile({
                      username: target.nickname, rid: target.rid,
                      profile: investigation.currentProfile, reportInsights: investigation.reportInsights, reports: linkedReports,
                    }),
                  } } : {}),
                });
              }}><CyberButtonLabel>Registrar reporte</CyberButtonLabel></button>
            </section>
            </div>
            {supplemental && <div className="case-supplemental">{supplemental}</div>}
          </>}
        </section>
        <section className="case-reports" aria-labelledby="linked-reports-title">
          <header className="case-reports__header"><p className="workspace-eyebrow">02 / ARCHIVO DE DENUNCIAS</p><h2 id="linked-reports-title" className="cyber-h">Reportes vinculados <span>({payload ? linkedReports.length : '—'})</span></h2><p className="case-muted">{payload ? `Mostrando ${filtered.length} de ${linkedReports.length}` : 'Pendiente de consulta'}</p></header>
          {payload?.nameOnlyReportIds?.length > 0 && <p className="case-association-note" role="status">{payload.nameOnlyReportIds.length} reporte(s) asociado(s) solo por nombre. Esa coincidencia no confirma por sí sola la identidad del jugador.</p>}
          <div className="case-filters">
            <label htmlFor="filter-category">Infracción<CyberSelect id="filter-category" value={filters.category} onChange={value => updateFilter('category', value)} options={[{ value: '', label: 'Todas las infracciones' }, ...categories.map(category => ({ value: category, label: category }))]} /></label>
            <label htmlFor="filter-validation">Validación<CyberSelect id="filter-validation" value={filters.validation} onChange={value => updateFilter('validation', value)} options={[{ value: '', label: 'Todos los estados' }, ...Object.entries(VALIDATION_LABELS).map(([value, label]) => ({ value, label }))]} /></label>
            <label htmlFor="filter-from">Desde<div className="cyber-input-full mw-cyber-input"><input id="filter-from" type="date" value={filters.from} max={filters.to || undefined} onChange={event => updateFilter('from', event.target.value)} /></div></label>
            <label htmlFor="filter-to">Hasta<div className="cyber-input-full mw-cyber-input"><input id="filter-to" type="date" value={filters.to} min={filters.from || undefined} onChange={event => updateFilter('to', event.target.value)} /></div></label>
            <label className="case-filters__search">Buscar en reportes<div className="cyber-input-full mw-cyber-input"><input type="search" value={filters.query} onChange={event => updateFilter('query', event.target.value)} placeholder="Texto o ID…" /></div></label>
            <button type="button" className="cyber-button-small mw-cyber-button mw-cyber-button--secondary" onClick={() => { setFilters(EMPTY_FILTERS); setPage(1); }}><CyberButtonLabel>Limpiar filtros</CyberButtonLabel></button>
          </div>
          {loading && <p className="desk-empty" role="status">Cargando reportes vinculados…</p>}
          {!loading && !linkedReports.length && <p className="desk-empty">{error && !payload ? 'No se pudieron obtener los reportes; no se puede determinar su cantidad.' : player && payload ? 'No hay denuncias vinculadas a esta consulta.' : 'Selecciona una identidad para ver sus reportes.'}</p>}
          {!loading && linkedReports.length > 0 && !filtered.length && <p className="desk-empty">No hay reportes que coincidan con estos filtros.</p>}
          {shownReports.length > 0 && (
            <table className="cyber-table cyber-style-2 case-table">
              <thead><tr>
                <th>Fecha</th><th>Infracción</th><th>Severidad</th><th>Validación</th>
                <th><span className="sr-only">Acciones</span></th>
              </tr></thead>
              <tbody>{shownReports.map(report => (
                <tr key={report.id}>
                  <td data-label="Fecha">{formatCaseDate(report.fecha)}<small>#{report.id}</small>
                    {payload?.nameOnlyReportIds?.some(id => String(id) === String(report.id)) && <small>Asociación solo por nombre</small>}
                  </td>
                  <td data-label="Infracción">{reportCategories(report).join(', ') || 'Sin datos'}</td>
                  <td data-label="Severidad">{report.severidad || 'Desconocida'}</td>
                  <td data-label="Validación"><span className="case-badge">{VALIDATION_LABELS[report.validacion] || report.validacion || 'Sin datos'}</span></td>
                  <td><button type="button" className="cyber-button-small mw-cyber-button mw-cyber-button--secondary" onClick={() => onOpenReport(report)} aria-label={`Ver detalles del reporte ${report.id}`}><CyberButtonLabel>Abrir</CyberButtonLabel></button></td>
                </tr>
              ))}</tbody>
            </table>
          )}
          {filtered.length > PAGE_SIZE && <nav className="case-pagination" aria-label="Páginas de reportes"><button type="button" className="cyber-button-small mw-cyber-button mw-cyber-button--secondary" disabled={visiblePage === 1} onClick={() => setPage(visiblePage - 1)}>Anterior</button><span>{visiblePage} / {Math.ceil(filtered.length / PAGE_SIZE)}</span><button type="button" className="cyber-button-small mw-cyber-button mw-cyber-button--secondary" disabled={visiblePage * PAGE_SIZE >= filtered.length} onClick={() => setPage(visiblePage + 1)}>Siguiente</button></nav>}
        </section>
      </div>
    </main>
  );
}
