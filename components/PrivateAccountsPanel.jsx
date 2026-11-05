import { useEffect, useState } from 'react';
import { buildApiUrl } from '../src/services/apiConfig';
import { readApiResponse } from '../src/services/jsonResponse';
import { validateAccountDashboard } from '../src/services/accountDashboard';
import { formatCaseDate } from '../src/services/casePresentation';
import { handleInternalLink } from '../src/services/appNavigation';
import DiscordAvatar from './ui/DiscordAvatar';
import Button from './ui/Button';
import Skeleton from './ui/Skeleton';
import Modal from './ui/Modal';
import '../styles/AdminDashboard.css';

const INITIAL_FILTERS = { search: '', status: 'all', minReports: '', maxReports: '', sort: 'lastAccess' };
const displayDate = value => value ? formatCaseDate(value, true) : 'Sin registro';

export default function PrivateAccountsPanel({ onNavigate }) {
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState(INITIAL_FILTERS);
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const selectedAccount = data?.items.find(item => item.identity.id === selectedId);

  useEffect(() => { setData(null); setSelectedId(null); }, [page, filters]);

  useEffect(() => {
    const controller = new AbortController();
    let pending = false;
    async function load() {
      if (pending) return;
      pending = true;
      setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams({ page: String(page) });
        Object.entries(filters).forEach(([key, value]) => { if (value !== '') params.set(key, value); });
        const response = await fetch(`${buildApiUrl('/admin/accounts')}?${params}`, {
          credentials: 'include', cache: 'no-store', signal: controller.signal,
        });
        if (!controller.signal.aborted && (response.status === 401 || response.status === 403)) setData(null);
        const payload = validateAccountDashboard(await readApiResponse(response, 'No se pudo consultar el panel privado.'));
        if (!controller.signal.aborted) setData(payload);
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause.message);
      } finally {
        pending = false;
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    const refreshVisible = () => { if (document.visibilityState === 'visible') load(); };
    load();
    const interval = window.setInterval(refreshVisible, 60 * 1000);
    document.addEventListener('visibilitychange', refreshVisible);
    return () => {
      controller.abort();
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', refreshVisible);
    };
  }, [page, filters, revision]);

  const field = key => ({ value: draft[key], onChange: event => setDraft(current => ({ ...current, [key]: event.target.value })) });
  const applyFilters = event => {
    event.preventDefault();
    setPage(1);
    setFilters({ ...draft });
  };
  const clearFilters = () => {
    setDraft(INITIAL_FILTERS);
    setFilters(INITIAL_FILTERS);
    setPage(1);
  };

  return <main className="admin-dashboard" aria-labelledby="admin-title">
    <header className="admin-heading">
      <div>
        <p className="workspace-eyebrow">H.E.X. / Control de plataforma / Acceso restringido</p>
        <h1 id="admin-title">Centro de <span>administración</span></h1>
        <p>Usuarios, presencia y contribuciones. Datos privados de cuentas verificadas.</p>
      </div>
      <Button variant="secondary" disabled={loading} onClick={() => setRevision(value => value + 1)}>Actualizar datos</Button>
    </header>
    <p className="admin-sync" role="status">{loading ? 'Consultando registros…' : data ? `Última consulta: ${displayDate(data.generatedAt)} · Actualización cada 60 s con esta pestaña visible` : 'Sin datos disponibles'}</p>
    {error && <div role="alert" className="rfm-submit-error"><p>{error}</p>
      {data && <p>Los datos mostrados corresponden a la última consulta correcta; pueden estar desactualizados.</p>}
      <Button onClick={() => setRevision(value => value + 1)}>Reintentar</Button>
    </div>}
    {loading && !data && <Skeleton label="Cargando estadísticas y usuarios…" rows={6} />}
    {data && <section className="admin-metrics" aria-label="Estadísticas globales, sin filtros">
      {[
        ['01', 'Usuarios registrados', data.summary.users, 'Identidades sincronizadas'],
        ['02', 'Actividad reciente', data.summary.recentlyActive, 'Usuarios · últimos 5 minutos'],
        ['03', 'Con sesión vigente', data.summary.usersWithSession, `Sesiones abiertas: ${data.summary.sessions}`],
        ['04', 'Reportes vinculados', data.summary.reports, 'Total exacto · sin límite de 50'],
      ].map(([index, label, value, note]) => <article className="admin-metric" key={index}>
        <span className="admin-metric__index">{index} /</span><h2>{label}</h2><strong>{value.toLocaleString('es')}</strong><p>{note}</p>
      </article>)}
    </section>}
    <aside className="admin-notice">
      <strong>Sesión vigente ≠ persona conectada.</strong> Actividad reciente significa una petición autenticada o una pestaña visible en los últimos 5 minutos.
      Las sesiones caducadas o cerradas no cuentan. Los reportes históricos sin propietario no se atribuyen por nombre.
      {data?.summary.unsyncedUsers > 0 && <p role="alert">Hay {data.summary.unsyncedUsers} usuarios con sesión cuya ficha privada no se ha sincronizado. Se incluyen en los indicadores de presencia, pero aún no en el listado.</p>}
    </aside>
    <section className="admin-directory" aria-labelledby="admin-users-title" aria-busy={loading}>
      <header className="admin-directory__heading"><h2 id="admin-users-title">Registro de usuarios</h2><span>{data ? `Coincidencias: ${data.total}` : 'Consulta privada'}</span></header>
      <form className="admin-filters" onSubmit={applyFilters}>
        <label className="admin-filters__search">Buscar usuario
          <input type="search" maxLength={200} placeholder="Nombre, usuario, correo o ID de Discord" {...field('search')} />
        </label>
        <label>Presencia<select {...field('status')}>
          <option value="all">Todos los usuarios</option><option value="recent">Actividad reciente</option>
          <option value="session">Con sesión vigente</option><option value="offline">Sin sesión vigente</option>
        </select></label>
        <label>Reportes desde<input type="number" min="0" step="1" placeholder="0" {...field('minReports')} /></label>
        <label>Reportes hasta<input type="number" min={draft.minReports || '0'} step="1" placeholder="Sin límite" {...field('maxReports')} /></label>
        <label>Ordenar<select {...field('sort')}>
          <option value="lastAccess">Última actividad</option><option value="reports">Más reportes</option>
          <option value="name">Nombre A–Z</option><option value="firstAccess">Registro más reciente</option>
        </select></label>
        <div className="admin-filters__actions"><Button type="submit" disabled={loading}>Aplicar filtros</Button><Button variant="secondary" onClick={clearFilters}>Limpiar</Button></div>
      </form>
      {data && <>
        <div className="admin-table-scroll" tabIndex={0} role="region" aria-label="Tabla de usuarios, desplazable horizontalmente">
          <table className="admin-table">
            <thead><tr><th scope="col">Identidad verificada</th><th scope="col">Presencia</th><th scope="col">Reportes</th><th scope="col">Último acceso registrado</th><th scope="col">Detalle privado</th></tr></thead>
            <tbody>{data.items.map(item => <tr key={item.identity.id}>
              <td><div className="admin-user"><DiscordAvatar user={item.identity} /><div>
                <strong className="notranslate" translate="no">{item.identity.globalName || item.identity.username || item.identity.id}</strong>
                <small className="notranslate" translate="no">@{item.identity.username || 'Sin usuario'}</small><small>{item.identity.id}</small>
              </div></div></td>
              <td><span className={`admin-presence${item.recentlyActive ? ' admin-presence--recent' : ''}`}>
                {item.recentlyActive ? 'Actividad reciente' : item.sessionCount ? 'Sesión vigente' : 'Sin sesión'}</span>
                <small>Sesiones vigentes: {item.sessionCount}</small></td>
              <td><strong className="admin-report-count">{item.reportCount.toLocaleString('es')}</strong></td>
              <td>{displayDate(item.lastAccess)}<small>Último login: {displayDate(item.lastLogin)}</small></td>
              <td><Button variant="secondary" aria-haspopup="dialog"
                aria-label={`Ver ficha privada de ${item.identity.globalName || item.identity.username || item.identity.id}`}
                onClick={() => setSelectedId(item.identity.id)}>Ver ficha privada</Button></td>
            </tr>)}</tbody>
          </table>
        </div>
        {!data.items.length && <div className="desk-empty"><h3>No hay usuarios para esta consulta</h3><p>Prueba otros filtros. Solo aparecen cuentas sincronizadas con el backend actualizado.</p></div>}
        <nav className="case-pagination" aria-label="Páginas de usuarios">
          <Button variant="secondary" disabled={page === 1 || loading} onClick={() => setPage(value => value - 1)}>Anterior</Button>
          <span>Página {page} de {Math.max(page, Math.ceil(data.total / 20))}</span>
          <Button variant="secondary" disabled={!data.hasMore || loading} onClick={() => setPage(value => value + 1)}>Siguiente</Button>
        </nav>
      </>}
    </section>
    {selectedAccount && <Modal title="Ficha privada de usuario" maxWidth="800px" onClose={() => setSelectedId(null)}
      dialogProps={{ className: 'modal admin-account-modal' }}>
      <div className="admin-user">
        <DiscordAvatar user={selectedAccount.identity} />
        <div><strong className="notranslate" translate="no">{selectedAccount.identity.globalName || selectedAccount.identity.username || selectedAccount.identity.id}</strong>
          <span className="notranslate" translate="no">@{selectedAccount.identity.username || 'Sin usuario'}</span></div>
      </div>
      {error && <p role="alert" className="rfm-submit-error">No se pudo actualizar la consulta. Esta ficha puede estar desactualizada.</p>}
      <dl className="admin-account-fields">
        <div><dt>ID de Discord</dt><dd>{selectedAccount.identity.id}</dd></div>
        <div><dt>Correo de Discord</dt><dd>{selectedAccount.identity.email || 'Discord no lo proporcionó'}</dd></div>
        <div><dt>Primer acceso registrado</dt><dd>{displayDate(selectedAccount.firstAccess)}</dd></div>
        <div><dt>Última actividad registrada</dt><dd>{displayDate(selectedAccount.lastAccess)}</dd></div>
        <div><dt>Último inicio de sesión</dt><dd>{displayDate(selectedAccount.lastLogin)}</dd></div>
        <div><dt>Último evento</dt><dd>{{ login: 'Inicio de sesión', active: 'Actividad', report: 'Envío de reporte' }[selectedAccount.lastEvent] || selectedAccount.lastEvent || 'Sin registro'}</dd></div>
        <div><dt>Presencia</dt><dd>{selectedAccount.recentlyActive ? 'Actividad reciente' : selectedAccount.sessionCount ? 'Sesión vigente' : 'Sin sesión'}</dd></div>
        <div><dt>Inicios contabilizados desde 0.6.15</dt><dd>{selectedAccount.loginCount}</dd></div>
      </dl>
      <h3>Sesiones vigentes ({selectedAccount.sessionCount})</h3>
      {selectedAccount.sessions.length ? <ul className="admin-account-sessions">{selectedAccount.sessions.map((session, index) => <li key={index}>
        <strong>Sesión {index + 1}</strong>
        <dl><div><dt>Inicio</dt><dd>{displayDate(session.loggedAt)}</dd></div>
          <div><dt>Actividad</dt><dd>{displayDate(session.lastActivity)}</dd></div>
          <div><dt>Caduca</dt><dd>{displayDate(session.expiresAt)}</dd></div></dl>
      </li>)}</ul> : <p>Sin sesiones vigentes.</p>}
      <h3>Reportes vinculados ({selectedAccount.reportCount})</h3>
      {selectedAccount.reportCount > selectedAccount.reportIds.length && <p>Se enlazan hasta 50 reportes recientes. El contador y los filtros incluyen todos.</p>}
      {selectedAccount.reportIds.length ? <div className="admin-report-links">{selectedAccount.reportIds.map(id =>
        <a key={id} href={`/reporte/${id}`} onClick={event => handleInternalLink(event, onNavigate, `/reporte/${id}`)}>#{id}</a>)}</div> : <p>Sin reportes vinculados.</p>}
      <p className="admin-privacy">Información privada. Sesión vigente no significa persona conectada.</p>
    </Modal>}
    <p className="admin-privacy">Información privada de administración. No se muestran tokens, cookies, contraseñas ni identificadores de sesión. El historial anterior al registro no puede reconstruirse.</p>
  </main>;
}
