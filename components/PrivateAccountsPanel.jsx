import { useEffect, useState } from 'react';
import { buildApiUrl } from '../src/services/apiConfig';
import { readApiResponse } from '../src/services/jsonResponse';
import { formatCaseDate } from '../src/services/casePresentation';
import DiscordAvatar from './ui/DiscordAvatar';
import Button from './ui/Button';
import Skeleton from './ui/Skeleton';

export default function PrivateAccountsPanel({ onNavigate }) {
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setData(null);
    async function load() {
      try {
        const response = await fetch(`${buildApiUrl('/admin/accounts')}?page=${page}`, {
          credentials: 'include', cache: 'no-store', signal: controller.signal,
        });
        const payload = await readApiResponse(response, 'No se pudieron consultar las cuentas privadas.');
        if (payload.ok !== true || !Array.isArray(payload.items) || typeof payload.hasMore !== 'boolean'
            || payload.items.some(item => !item?.identity?.id || !Array.isArray(item.reportIds))) {
          throw new Error('Formato de cuentas privadas inválido.');
        }
        if (!controller.signal.aborted) setData(payload);
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause.message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    load();
    return () => controller.abort();
  }, [page, revision]);
  return <section className="case-reports" aria-busy={loading}>
    <h2>Administración privada / Usuarios MostWanted</h2>
    <p className="case-muted">Identidades actuales verificadas de Discord. La actividad no representa cada clic. Los datos históricos ausentes no se reconstruyen.</p>
    {loading && <Skeleton label="Cargando cuentas privadas…" rows={4} />}
    {error && <div role="alert" className="rfm-submit-error"><p>{error}</p><Button onClick={() => setRevision(value => value + 1)}>Reintentar</Button></div>}
    {data && <>
      <ul className="profile-reports">{data.items.map(item => <li key={item.identity.id}>
        <div className="profile-identity"><DiscordAvatar user={item.identity} /><div>
          <h3>{item.identity.globalName || item.identity.username || item.identity.id}</h3>
          {item.identity.username && <p>@{item.identity.username}</p>}
        </div></div>
        <dl>
          <dt>ID de Discord</dt><dd>{item.identity.id}</dd>
          {item.identity.email && <><dt>Correo</dt><dd>{item.identity.email}</dd></>}
          {[[item.firstAccess, 'Primer acceso registrado'], [item.lastLogin, 'Último login'], [item.lastAccess, 'Última actividad']].map(([value, label]) =>
            value ? <div key={label}><dt>{label}</dt><dd>{formatCaseDate(value, true)}</dd></div> : null)}
          {item.lastEvent && <><dt>Último evento</dt><dd>{item.lastEvent}</dd></>}
        </dl>
        <h4>Reportes vinculados (hasta 50)</h4>
        <div className="profile-report-actions">{item.reportIds.map(id =>
          <Button key={id} variant="secondary" onClick={() => onNavigate(`/reporte/${id}`)}>Reporte #{id}</Button>)}</div>
      </li>)}</ul>
      {!data.items.length && <p>No hay cuentas registradas en esta página. Se necesita el backend y plugin actualizados, y un nuevo acceso autenticado.</p>}
      {(page > 1 || data.hasMore) && <nav className="case-pagination" aria-label="Páginas de cuentas privadas">
        <Button disabled={page === 1} onClick={() => setPage(value => value - 1)}>Anterior</Button>
        <span>Página {page}</span>
        <Button disabled={!data.hasMore} onClick={() => setPage(value => value + 1)}>Siguiente</Button>
      </nav>}
    </>}
  </section>;
}
