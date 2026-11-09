import React, { useState, useRef, useEffect, useCallback } from 'react';
import InvestigationDesk from '../components/screens/InvestigationDesk';
import ReportDetailModal from '../components/ReportDetailModal';
import HelpModal from '../components/HelpModal';
import AIAssistantBubble from '../components/AIAssistantBubble';
import TerminalText from '../components/ui/TerminalText';
import InterfaceSounds from '../components/InterfaceSounds';
import PersonSearch from '../components/PersonSearch';
import ProfileScreen from '../components/screens/ProfileScreen';
import PrivateAccountsPanel from '../components/PrivateAccountsPanel';
import LandingScreen from '../components/screens/LandingScreen';
import Skeleton from '../components/ui/Skeleton';
import AppHeader from '../components/layout/AppHeader';
import SiteFooter from '../components/layout/SiteFooter';
import SessionActions from '../components/layout/SessionActions';
import AccessScreen from '../components/screens/AccessScreen';
import ReportScreen from '../components/screens/ReportScreen';
import ReportFormModal from '../components/ReportFormModal';
import ReportDialog from '../components/reports/ReportDialog';
import useSession from './hooks/useSession';
import useAppNavigation from './hooks/useAppNavigation';
import useReportArchive from './hooks/useReportArchive';
import { isSearchLanding } from './services/appNavigation';
import { mapWordpressReportToReporte } from './services/reportViewModel';
import { resolvePlayerRid } from '../shared/playerIdentity';
import { playerPath } from './services/playerRoute';

function App() {
  const [caseRevision, setCaseRevision] = useState(0);
  const [deskReset, setDeskReset] = useState(0);
  const [reportPlayer, setReportPlayer] = useState(null);
  const [searchPlayer, setSearchPlayer] = useState(null);
  const [knownPlayers, setKnownPlayers] = useState([]);
  const rememberPlayer = useCallback(player => {
    if (!player) return;
    setKnownPlayers(current => [
      ...current.filter(item => player.rid ? item.rid !== player.rid : item.nickname !== player.nickname),
      { ...player, source: 'Analizado en esta sesión' },
    ]);
  }, []);
  const detailReturnPath = useRef('/');
  const formReturnPath = useRef('/');
  const resetDesk = useCallback(() => {
    setSearchPlayer(null);
    setDeskReset(value => value + 1);
  }, []);
  const { path, navigate, isAuthCallback, isValidPath, expedienteId, reportId } = useAppNavigation({ onPopState: resetDesk });
  const { user, capabilities, sessionError, isAuthChecked, login: handleLogin, logout, expireSession } = useSession({ isAuthCallback });
  const { reportes, setReportes, reportsError, isLoading, voteOnReport, getUserVotes } = useReportArchive({ userId: user?.id, reportId });
  // Estado para el modal de ayuda
  const [showHelp, setShowHelp] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  useEffect(() => { setReportModalOpen(false); }, [path]);
  // Estado para el modal de detalle
  const [reporteSeleccionado, setReporteSeleccionado] = useState(null);
  useEffect(() => {
    setKnownPlayers([]);
    setSearchPlayer(null);
    setReportPlayer(null);
    setReporteSeleccionado(null);
  }, [user?.id]);
  const hasReportPlayerName = typeof reportPlayer?.nickname === 'string' && reportPlayer.nickname.trim().length > 0;

  // The first title comes from the server-rendered metadata; keep the tab title in sync after SPA navigation.
  const initialTitlePath = useRef(path);
  useEffect(() => {
    if (initialTitlePath.current === path) return;
    initialTitlePath.current = null;
    const playerMatch = path.match(/^\/(?:jugador|usuario)\/([^/]+)/);
    let name = '';
    if (playerMatch) {
      try { name = decodeURIComponent(playerMatch[1]); } catch { name = playerMatch[1]; }
    }
    const reportMatch = path.match(/^\/reporte\/(\d+)/);
    document.title = playerMatch ? `Perfil de ${name} · MostWanted`
      : reportMatch ? `Reporte #${reportMatch[1]} · MostWanted`
        : path === '/denunciar' && hasReportPlayerName ? `Reportar a ${reportPlayer.nickname} · MostWanted`
          : 'MOST WANTED · Reportes de modders y griefers de GTA Online';
  }, [path, hasReportPlayerName, reportPlayer?.nickname]);

  // Estado de modo demo (activar con ?demo=true)
  const [isDemo] = useState(() => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('demo') === 'true';
  });

  useEffect(() => {
    if (!isLoading && reportId) {
      setReporteSeleccionado(reportes.find(report => Number(report.id) === reportId) || null);
    }
  }, [isLoading, reportes, reportId]);


  const handleCardClick = (reporte) => {
    detailReturnPath.current = path.startsWith('/reporte/') ? detailReturnPath.current : path;
    const existing = reportes.find(item => item.id === reporte.id);
    const selected = { ...existing, ...reporte, userVote: existing?.userVote || getUserVotes()[reporte.id] || null };
    setReportes(current => current.some(item => item.id === selected.id)
      ? current.map(item => item.id === selected.id ? selected : item)
      : [...current, selected]);
    setReporteSeleccionado(selected);
    navigate(`/reporte/${reporte.id}`);
  };

  // Cerrar modal de detalle (volver a la lista)
  const handleCloseDetail = () => {
    setReporteSeleccionado(null);
    navigate(detailReturnPath.current);
  };

  // Manejar nuevo reporte enviado
  const handleNewReport = async (nuevoReporte, submissionResult = null) => {
    const refreshedPlayer = {
      nickname: submissionResult?.player?.nickname || nuevoReporte.nickname,
      rid: resolvePlayerRid(submissionResult?.player || {}) || resolvePlayerRid(nuevoReporte),
    };
    setSearchPlayer(refreshedPlayer);
    rememberPlayer(refreshedPlayer);
    formReturnPath.current = refreshedPlayer.nickname ? playerPath(refreshedPlayer.nickname) : '/';
    setCaseRevision(value => value + 1);
    return { warning: '' };
  };

  // Cuando el usuario vota, persistir en WordPress y refrescar el reporte local.
  const handleVote = async (reporteId, votePayload = {}) => {
    const result = await voteOnReport(reporteId, votePayload, user);
    setCaseRevision(value => value + 1);
    return result;
  };

  const handleLogout = async () => {
    if (await logout()) {
      setReporteSeleccionado(null);
      navigate('/', true);
    }
  };

  if (isAuthCallback) return <main className="app-container app-loading"><Skeleton label="Iniciando sesión con Discord…" rows={6} /></main>;
  if (!isValidPath) return <main className="desk-empty"><h1>Página no encontrada</h1><a href="/">Volver al inicio</a></main>;

  // Mostrar loading
  if (!isAuthChecked) {
    return (
      <main className="app-container app-loading"><Skeleton label="Cargando sesión y despacho…" rows={8} /></main>
    );
  }

  const canUseReports = Boolean(user) || isDemo;
  const isLandingPage = path === '/inicio' || (path === '/' && !canUseReports);
  if (!canUseReports && !isLandingPage) return <AccessScreen onLogin={handleLogin} error={sessionError} />;
  const startReport = (player = null) => {
    setSearchPlayer(player);
    setReportPlayer(player);
    setReportModalOpen(true);
  };
  const returnPath = path === '/denunciar' ? formReturnPath.current
    : path.startsWith('/reporte/') ? detailReturnPath.current : path;
  const isProfileScreen = path === '/perfil' || (path.startsWith('/reporte/') && detailReturnPath.current === '/perfil');
  const isAdminScreen = path === '/admin' || (path.startsWith('/reporte/') && detailReturnPath.current === '/admin');
  const openAdminReport = nextPath => {
    const match = /^\/reporte\/(\d+)$/.exec(nextPath);
    if (match) {
      detailReturnPath.current = '/admin';
      setReporteSeleccionado(null);
    }
    navigate(nextPath);
  };
  const showSearchLanding = canUseReports && isSearchLanding(path, searchPlayer);
  const personSearch = canUseReports && <PersonSearch revision={caseRevision} reports={reportes} knownPlayers={knownPlayers} onSelect={player => {
    setSearchPlayer(player);
    setDeskReset(value => value + 1);
    navigate(playerPath(player.nickname || player.rid));
  }} />;

  return (
    <div className={`app-container${canUseReports ? '' : ' app-container--access'}${showSearchLanding ? ' app-container--search' : ''}`} style={{ position: 'relative' }}>
      <InterfaceSounds />

      {/* ============ HEADER ============ */}
      <AppHeader
        onNavigate={navigate}
        search={!showSearchLanding && !isAdminScreen && personSearch}
        actions={<SessionActions user={user} isDemo={isDemo} canUseReports={canUseReports} isProfileScreen={isProfileScreen} onNavigate={navigate} onLogin={handleLogin} onHelp={() => setShowHelp(true)} />}
      />
      {/* Modal de ayuda */}
      <HelpModal open={showHelp} onClose={() => setShowHelp(false)} />
      {user && isLoading && reportId && !reporteSeleccionado && <Skeleton label="Cargando reporte…" rows={4} />}
      {sessionError && <p className="rfm-submit-error" role="alert">{sessionError}</p>}
      {user && expedienteId && <p className="rfm-submit-error" role="alert">Este enlace antiguo usa una numeración temporal que ya no está disponible. Busca al jugador o abre el enlace estable del reporte.</p>}
      {isAdminScreen && user && capabilities.viewAccounts && reportId && !reporteSeleccionado && <p className="rfm-submit-error" role="alert">Este reporte no está disponible en el archivo público. Puede estar sin publicar o haberse retirado. <a href="/admin" onClick={event => { event.preventDefault(); navigate('/admin'); }}>Volver al panel</a></p>}

      {showSearchLanding ? (
        <main className="search-landing" aria-labelledby="search-landing-title">
          <div className="search-landing__content">
            <h2 id="search-landing-title"><TerminalText text="Busca un jugador" /></h2>
            <p>Consulta su ficha y sus reportes por nombre, alias o RID.</p>
            {personSearch}
            {reportsError && <p className="rfm-submit-error" role="alert">{reportsError}</p>}
          </div>
        </main>
      ) : isLandingPage ? (
        <LandingScreen onLogin={canUseReports ? () => navigate('/') : handleLogin} />
      ) : canUseReports ? (
      <>
      {isAdminScreen ? user && capabilities.viewAccounts ? <PrivateAccountsPanel key={user.id} onNavigate={openAdminReport} /> : <main className="desk-empty"><h2>Acceso restringido</h2><p>Solo el administrador autorizado puede consultar este panel.</p></main> : isProfileScreen ? user ? <ProfileScreen key={user.id} user={user} canViewAccounts={capabilities.viewAccounts} onNavigate={navigate} onLogout={handleLogout} onOpenReport={handleCardClick} mapReport={mapWordpressReportToReporte} revision={caseRevision} /> : <main className="desk-empty"><h2>Mi perfil</h2><p>Inicia sesión para consultar tu cuenta y tus reportes.</p><button type="button" className="cyber-button-small mw-cyber-button" onClick={handleLogin}>Iniciar sesión con Discord</button></main> : path === '/denunciar' && hasReportPlayerName ? <ReportScreen onSubmit={handleNewReport} currentUser={user} isDemo={isDemo} initialPlayer={reportPlayer} onReturnToCase={() => navigate(formReturnPath.current)} /> : <InvestigationDesk key={deskReset} initialPlayer={searchPlayer} onPlayerResolved={rememberPlayer} reportsError={reportsError} path={path} onNavigate={navigate} onOpenReport={handleCardClick} onStartReport={startReport} mapReport={mapWordpressReportToReporte} canManageCases={isAuthChecked && Boolean(user) && capabilities.manageCases} revision={caseRevision} />}
      {reportPlayer && !isProfileScreen && !isAdminScreen && path !== '/denunciar' && (
        <ReportDialog open={reportModalOpen} onClose={() => setReportModalOpen(false)}>
          <ReportFormModal key={reportPlayer.nickname} onSubmit={handleNewReport} currentUser={user} isDemo={isDemo} initialPlayer={reportPlayer} onReturnToCase={() => setReportModalOpen(false)} />
        </ReportDialog>
      )}
      </>
      ) : (
        <AccessScreen onLogin={handleLogin} />
      )}

      {user && reporteSeleccionado && (
        <ReportDetailModal
          key={`${reporteSeleccionado.id}:${user?.id || ''}`}
          reporte={reporteSeleccionado}
          onClose={handleCloseDetail}
          onVote={handleVote}
          currentUser={user}
          onUpdated={report => {
            const updated = { ...mapWordpressReportToReporte(report), userVote: getUserVotes()[report.id] || null };
            setReporteSeleccionado(current => current?.id === updated.id ? updated : current);
            setReportes(current => current.map(item => item.id === updated.id ? updated : item));
            setCaseRevision(value => value + 1);
          }}
        />
      )}

      <SiteFooter />

      <AIAssistantBubble
        reports={user ? reportes : []}
        isAuthenticated={isAuthChecked && Boolean(user?.id)}
        onSessionExpired={expireSession}
      />
    </div>
  );
}

export default App;
