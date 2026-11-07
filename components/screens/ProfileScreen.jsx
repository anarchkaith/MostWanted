import { useState } from 'react';
import useOwnedReports from '../../src/hooks/useOwnedReports';
import { formatCaseDate } from '../../src/services/casePresentation';
import { isRockstarPlayerAvatar } from '../../src/services/playerAvatars';
import { handleInternalLink } from '../../src/services/appNavigation';
import PlayerAvatarImage from '../PlayerAvatarImage';
import DiscordAvatar from '../ui/DiscordAvatar';
import Skeleton from '../ui/Skeleton';
import Button from '../ui/Button';
import SpecialText from '../ui/SpecialText';

function ReportAvatar({ report }) {
  const avatars = [report.avatar1, report.avatar2].filter(url => typeof url === 'string' && /^https?:\/\//i.test(url));
  const [index, setIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const src = avatars[index];
  return <div className="profile-report-avatar">
    {src ? <>
      {!loaded && <Skeleton label="Cargando avatar…" rows={1} className="mw-skeleton--avatar" />}
      <PlayerAvatarImage src={src} alt="" loading="lazy" normalizeAlpha={isRockstarPlayerAvatar(src)}
        onLoad={() => setLoaded(true)} onError={() => { setLoaded(false); setIndex(value => value + 1); }} />
    </> : <span className="profile-report-avatar__fallback" aria-hidden="true">{String(report.nickname || '?').charAt(0).toUpperCase()}</span>}
  </div>;
}

export default function ProfileScreen({ user, canViewAccounts, onNavigate, onLogout, onOpenReport, mapReport, revision }) {
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
        <Button variant="secondary" onClick={onLogout}>Cerrar sesión</Button>
        {canViewAccounts === true && <Button variant="secondary" onClick={() => onNavigate('/admin')}>Administración</Button>}
      </nav>
      <section className="case-reports" aria-labelledby="my-reports-title" aria-busy={loading}>
        <header className="case-reports__header"><h2 id="my-reports-title"><SpecialText>Mis reportes</SpecialText></h2></header>
        <p className="case-muted profile-report-note">Solo tú puedes consultar esta lista. Los reportes anteriores sin una vinculación privada con tu cuenta no aparecen aquí; no se asignan por nombre de usuario.</p>
        {loading && <Skeleton label="Cargando mis reportes…" rows={6} />}
        {error && <div className="rfm-submit-error" role="alert"><p>{error}</p><Button variant="secondary" onClick={retry}>Reintentar</Button></div>}
        {!loading && !error && data && <>
          {data.items.length ? <ul className="profile-report-grid" aria-label="Reportes vinculados a tu cuenta">
            {data.items.map(report => <li key={report.id} className="profile-report-card">
              <div className="profile-report-card__media">
                <ReportAvatar key={`${report.id}:${report.avatar1}:${report.avatar2}`} report={report} />
                <div className="profile-report-card__name">
                  <strong className="notranslate" translate="no">{report.nickname}</strong>
                  <small>#{report.id} · {formatCaseDate(report.createdAt, true)}</small>
                </div>
              </div>
              <div className="profile-report-card__body">
                <div className="profile-report-categories">{report.categories.length
                  ? report.categories.map((category, index) => <span key={`${category}:${index}`}>{category}</span>)
                  : <span>Sin infracciones</span>}</div>
                <div className="profile-report-actions">
                  <Button variant="secondary" onClick={() => onOpenReport(mapReport(report))} aria-label={`Ver reporte #${report.id}`}>Ver reporte</Button>
                  <a href={`/jugador/${encodeURIComponent(report.rid || report.nickname)}`}
                    onClick={event => handleInternalLink(event, onNavigate, `/jugador/${encodeURIComponent(report.rid || report.nickname)}`)}
                    aria-label={`Ver ficha de ${report.nickname}`}>Ficha ↗</a>
                </div>
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
