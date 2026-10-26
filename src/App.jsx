import React, { useState, useRef, useEffect, useCallback } from 'react';
import InvestigationDesk from '../components/screens/InvestigationDesk';
import ReportDetailModal from '../components/ReportDetailModal';
import HelpModal from '../components/HelpModal';
import AIAssistantBubble from '../components/AIAssistantBubble';
import InterfaceSounds from '../components/InterfaceSounds';
import PersonSearch from '../components/PersonSearch';
import ProfileScreen from '../components/screens/ProfileScreen';
import Skeleton from '../components/ui/Skeleton';
import AppHeader from '../components/layout/AppHeader';
import DeskNavigation from '../components/layout/DeskNavigation';
import SiteFooter from '../components/layout/SiteFooter';
import SessionActions from '../components/layout/SessionActions';
import AccessScreen from '../components/screens/AccessScreen';
import ReportScreen from '../components/screens/ReportScreen';
import useSession from './hooks/useSession';
import useAppNavigation from './hooks/useAppNavigation';
import useReportArchive from './hooks/useReportArchive';
import { handleInternalLink, isSearchLanding } from './services/appNavigation';
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
  const { reportes, setReportes, reportsError, isLoading, refreshReports, voteOnReport, getUserVotes } = useReportArchive();
  const detailReturnPath = useRef('/');
  const formReturnPath = useRef('/');
  const resetDesk = useCallback(() => {
    setSearchPlayer(null);
    setDeskReset(value => value + 1);
  }, []);
  const { path, navigate, isAuthCallback, isValidPath, expedienteId, reportId } = useAppNavigation({ onPopState: resetDesk });
  const { user, capabilities, sessionError, isAuthChecked, login: handleLogin, logout, expireSession } = useSession({ isAuthCallback });
  // Estado para el modal de ayuda
  const [showHelp, setShowHelp] = useState(false);
  // Estado para el modal de detalle
  const [reporteSeleccionado, setReporteSeleccionado] = useState(null);

  // Estado de modo demo (activar con ?demo=true)
  const [isDemo] = useState(() => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('demo') === 'true';
  });

  // Manejar navegación por URL (abrir expediente desde URL)
  useEffect(() => {
    const abrirExpedienteDesdeURL = () => {
      if (reportes.length > 0) {
        let reporte = null;

        const reporteId = reportId;
        if (reporteId) {
          reporte = reportes.find(r => Number(r.id) === reporteId);
        } else if (expedienteId) {
          reporte = reportes.find(r => Number(r.expedienteId) === expedienteId);
        }

        if (reporte) {
          setReporteSeleccionado(reporte);
        } else {
          setReporteSeleccionado(null);
        }
      }
    };

    // Esperar a que los reportes estén cargados
    if (!isLoading) {
      abrirExpedienteDesdeURL();
    }

  }, [isLoading, reportes, path, expedienteId, reportId]);


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
    return refreshReports();
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
  if (isLoading || !isAuthChecked) {
    return (
      <main className="app-container app-loading"><Skeleton label="Cargando sesión y despacho…" rows={8} /></main>
    );
  }

  const canUseReports = Boolean(user) || isDemo;
  const startReport = (player = null) => {
    formReturnPath.current = player?.nickname ? playerPath(player.nickname) : path === '/denunciar' ? formReturnPath.current : path;
    setSearchPlayer(player);
    setReportPlayer(player);
    navigate('/denunciar');
  };
  const returnPath = path === '/denunciar' ? formReturnPath.current
    : path.startsWith('/reporte/') ? detailReturnPath.current : path;
  const archivePath = returnPath === '/perfil' ? '/' : returnPath;
  const isProfileScreen = path === '/perfil' || (path.startsWith('/reporte/') && detailReturnPath.current === '/perfil');
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
        search={!showSearchLanding && personSearch}
        actions={<SessionActions user={user} isDemo={isDemo} canUseReports={canUseReports} isProfileScreen={isProfileScreen} onNavigate={navigate} onLogin={handleLogin} onHelp={() => setShowHelp(true)} />}
      />
      {canUseReports && !showSearchLanding && <DeskNavigation items={[
        { href: `${archivePath}${isDemo ? '?demo=true' : ''}`, number: '01', label: 'Archivo de investigación', current: path !== '/denunciar' && !isProfileScreen,
          onClick: event => handleInternalLink(event, nextPath => { if (path !== nextPath) navigate(nextPath); }, archivePath) },
        ...(path === '/denunciar' ? [{ href: isDemo ? '/denunciar?demo=true' : '/denunciar', number: '02', label: 'Mesa de denuncias', current: true }] : []),
      ]} />}
      {/* Modal de ayuda */}
      <HelpModal open={showHelp} onClose={() => setShowHelp(false)} />
      {sessionError && <p className="rfm-submit-error" role="alert">{sessionError}</p>}

      {showSearchLanding ? (
        <main className="search-landing" aria-labelledby="search-landing-title">
          <div className="search-landing__content">
            <h2 id="search-landing-title">Busca un jugador</h2>
            <p>Consulta su ficha y sus reportes por nombre, alias o RID.</p>
            {personSearch}
            {reportsError && <p className="rfm-submit-error" role="alert">{reportsError}</p>}
          </div>
        </main>
      ) : canUseReports ? (
      <>
      {isProfileScreen ? user ? <ProfileScreen key={user.id} user={user} onNavigate={navigate} onLogout={handleLogout} onOpenReport={handleCardClick} mapReport={mapWordpressReportToReporte} onHelp={() => setShowHelp(true)} revision={caseRevision} /> : <main className="desk-empty"><h2>Mi perfil</h2><p>Inicia sesión para consultar tu cuenta y tus reportes.</p><button type="button" className="cyber-button-small mw-cyber-button" onClick={handleLogin}>Iniciar sesión con Discord</button></main> : path === '/denunciar' ? <ReportScreen onSubmit={handleNewReport} currentUser={user} isDemo={isDemo} initialPlayer={reportPlayer} onReturnToCase={() => navigate(formReturnPath.current)} /> : <InvestigationDesk key={deskReset} initialPlayer={searchPlayer} onPlayerResolved={rememberPlayer} reportsError={reportsError} path={path} onNavigate={navigate} onOpenReport={handleCardClick} onStartReport={startReport} mapReport={mapWordpressReportToReporte} canManageCases={isAuthChecked && Boolean(user) && capabilities.manageCases} revision={caseRevision} />}
      </>
      ) : (
        <AccessScreen onLogin={handleLogin} />
      )}

      {reporteSeleccionado && (
        <ReportDetailModal
          reporte={reporteSeleccionado}
          onClose={handleCloseDetail}
          onVote={handleVote}
        />
      )}

      <SiteFooter />

      <AIAssistantBubble
        isAuthenticated={isAuthChecked && Boolean(user?.id)}
        onSessionExpired={expireSession}
      />
    </div>
  );
}

export default App;
