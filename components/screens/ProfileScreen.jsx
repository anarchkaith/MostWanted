import useOwnedReports from '../../src/hooks/useOwnedReports';
import { formatCaseDate } from '../../src/services/casePresentation';
import DiscordAvatar from '../ui/DiscordAvatar';
import Skeleton from '../ui/Skeleton';
import Button from '../ui/Button';
import PrivateAccountsPanel from '../PrivateAccountsPanel';
import SpecialText from '../ui/SpecialText';

export default function ProfileScreen({ user, onNavigate, onLogout, onOpenReport, mapReport, onHelp, revision }) {
  const { page, setPage, data, loading, error, retry } = useOwnedReports({ userId: user.id, revision });

  return (
    <main className="profile-screen">
      <header className="profile-identity">
        <DiscordAvatar user={user} />
        <div>
          <p className="workspace-eyebrow">Mi cuenta / Discord</p>
          <h2 className="notranslate" translate="no">{user.globalName || user.username}</h2>
          <p className="case-muted">@{user.username}</p>
          {user.loggedAt && <p className="case-muted">Sesión iniciada: {formatCaseDate(user.loggedAt, true)}</p>}
        </div>
      </header>
      <nav className="profile-actions" aria-label="Acciones de mi cuenta">
        <Button variant="secondary" onClick={() => onNavigate('/')}>Buscar jugadores</Button>
        <Button onClick={() => onNavigate('/denunciar')}>Registrar reporte</Button>
        <Button variant="secondary" onClick={onHelp}>Ayuda</Button>
        <Button variant="secondary" onClick={onLogout}>Cerrar sesión</Button>
      </nav>
      {user.id === '343976455400718339' && <PrivateAccountsPanel onNavigate={onNavigate} />}
      <section className="case-reports" aria-labelledby="my-reports-title" aria-busy={loading}>
        <header className="case-reports__header"><h2 id="my-reports-title"><SpecialText>Mis reportes</SpecialText></h2></header>
        <p className="case-muted profile-report-note">Solo tú puedes consultar esta lista. Los reportes anteriores sin una vinculación privada con tu cuenta no aparecen aquí; no se asignan por nombre de usuario.</p>
        {loading && <Skeleton label="Cargando mis reportes…" rows={6} />}
        {error && <div className="rfm-submit-error" role="alert"><p>{error}</p><Button variant="secondary" onClick={retry}>Reintentar</Button></div>}
        {!loading && !error && data && <>
          {data.items.length ? <ul className="profile-reports">
            {data.items.map(report => <li key={report.id}>
              <div className="profile-report-heading"><h3 className="notranslate" translate="no">{report.nickname}</h3><span>#{report.id} · {formatCaseDate(report.createdAt, true)}</span></div>
              <p className="case-muted">{report.categories.join(' · ') || 'Sin infracciones registradas'}</p>
              <p className="profile-report-reason">{report.reason}</p>
              <div className="profile-report-actions">
                <Button variant="secondary" onClick={() => onOpenReport(mapReport(report))}>Ver reporte</Button>
                <Button variant="secondary" onClick={() => onNavigate(`/jugador/${encodeURIComponent(report.rid || report.nickname)}`)}>Ver ficha del jugador</Button>
              </div>
            </li>)}
          </ul> : <p className="desk-empty">No tienes reportes vinculados en esta página.</p>}
          {(page > 1 || data.hasMore) && <nav className="case-pagination" aria-label="Páginas de mis reportes">
            <Button variant="secondary" disabled={page === 1} onClick={() => setPage(value => value - 1)}>Anterior</Button>
            <span>Página {page}</span>
            <Button variant="secondary" disabled={!data.hasMore} onClick={() => setPage(value => value + 1)}>Siguiente</Button>
          </nav>}
        </>}
      </section>
    </main>
  );
}
