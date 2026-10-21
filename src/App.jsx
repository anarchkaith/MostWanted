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
import AdminBanner from '../components/layout/AdminBanner';
import SessionActions from '../components/layout/SessionActions';
import AccessScreen from '../components/screens/AccessScreen';
import ReportScreen from '../components/screens/ReportScreen';
import useSession from './hooks/useSession';
import useAppNavigation from './hooks/useAppNavigation';
import useReportArchive from './hooks/useReportArchive';
import { handleInternalLink } from './services/appNavigation';
import { getApiBaseUrl } from './services/apiConfig';
import { assignExpedienteIds } from './services/expedienteIds';
import { mapWordpressReportToReporte, normalizeReporte, normalizeComentariosFromCommunityVerification } from './services/reportViewModel';
import { resolvePlayerRid } from '../shared/playerIdentity';
import { playerPath } from './services/playerRoute';
import {
  submitWordpressCommunityVerificationVote,
} from './services/reportSubmissionService';

const API_BASE_URL = getApiBaseUrl();

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
  const { reportes, setReportes, reportsError, isLoading, fetchReportsFromAPI, getUserVotes } = useReportArchive();
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

  // Estado de modo admin (activar con ?admin=1 o localStorage)
  const [isAdmin, setIsAdmin] = useState(false);

  // Estado de modo demo (activar con ?demo=true)
  const [isDemo] = useState(() => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('demo') === 'true';
  });

  // Verificar URL de expediente y modo admin al cargar
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const adminParam = urlParams.get('admin');
    const storedAdmin = localStorage.getItem('mostwanted_admin');

    if (adminParam === '1' || adminParam === 'true') {
      setIsAdmin(true);
      localStorage.setItem('mostwanted_admin', 'true');
    } else if (storedAdmin === 'true') {
      setIsAdmin(true);
    }
  }, []);

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
    try {
      const data = await fetchReportsFromAPI();
      const userVotes = getUserVotes();
      const normalizados = assignExpedienteIds(data).map(r => ({
        ...normalizeReporte(r),
        userVote: userVotes[r.id] || null,
      }));

      setReportes(normalizados);
      return;
    } catch (error) {
      console.warn('No se pudo refrescar desde WordPress tras el envio. Se aplicara fallback local.', error);
    }

    const usuarioFallback = String(nuevoReporte?.nickname || nuevoReporte?.username || nuevoReporte?.usuario || '').trim();

    const nuevoNormalizado = normalizeReporte({
      ...nuevoReporte,
      id: Date.now(),
      usuario: usuarioFallback || 'USUARIO_SIN_NOMBRE',
      fecha: new Date().toISOString().slice(0, 10),
      reportadoPor: 'ANONIMO',
      botSyncStatus: submissionResult?.botDelivery?.ok ? 'delivered' : 'pending',
      botSyncAt: new Date().toISOString(),
      botSyncError: submissionResult?.botDelivery?.ok ? '' : (submissionResult?.botDelivery?.message || submissionResult?.warning || '')
    });

    const nuevosReportes = assignExpedienteIds([nuevoNormalizado, ...reportes]);
    setReportes(nuevosReportes);
    localStorage.setItem('mostwanted_reportes', JSON.stringify(nuevosReportes));
  };

  // Manejar validación de reporte por admin
  const handleValidate = useCallback(async (reporteId, validacion) => {
    try {
      // Actualizar en la API
      const response = await fetch(`${API_BASE_URL}/reportes/${reporteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          validacion: validacion.validacion,
          adminNota: validacion.adminNota,
          fechaValidacion: validacion.fechaValidacion
        })
      });

      if (!response.ok) throw new Error('Error al validar');

      const data = await response.json();
      const reporteActualizado = data.reporte;

      // Actualizar estado local
      const reportesActualizados = reportes.map(reporte =>
        reporte.id === reporteId ? { ...reporte, ...reporteActualizado } : reporte
      );

      setReportes(reportesActualizados);
      localStorage.setItem('mostwanted_reportes', JSON.stringify(reportesActualizados));

      // Actualizar el reporte seleccionado si es el mismo
      if (reporteSeleccionado && reporteSeleccionado.id === reporteId) {
        setReporteSeleccionado({ ...reporteSeleccionado, ...reporteActualizado });
      }
    } catch (error) {
      console.error('Error al validar reporte:', error);
      // Fallback a localStorage si la API falla
      const reportesActualizados = reportes.map(reporte => {
        if (reporte.id === reporteId) {
          return {
            ...reporte,
            validacion: validacion.validacion,
            adminNota: validacion.adminNota,
            fechaValidacion: validacion.fechaValidacion
          };
        }
        return reporte;
      });

      setReportes(reportesActualizados);
      localStorage.setItem('mostwanted_reportes', JSON.stringify(reportesActualizados));

      if (reporteSeleccionado && reporteSeleccionado.id === reporteId) {
        const actualizado = reportesActualizados.find(r => r.id === reporteId);
        setReporteSeleccionado(actualizado);
      }
    }
  }, [reportes, reporteSeleccionado]);

  // Manejar edición de reporte por admin
  const handleEdit = useCallback((reporteActualizado) => {
    // Mapear votosFavor/votosContra a votos.up/votos.down
    const votos = {
      up: reporteActualizado.votosFavor ?? (reporteActualizado.votos?.up ?? 0),
      down: reporteActualizado.votosContra ?? (reporteActualizado.votos?.down ?? 0),
      comentarios: reporteActualizado.comentariosVotos || []
    };
    const reporteConVotos = { ...reporteActualizado, votos };
    const reportesActualizados = reportes.map(reporte =>
      reporte.id === reporteConVotos.id ? reporteConVotos : reporte
    );

    setReportes(reportesActualizados);
    // Guardar edición individual en localStorage por id
    const edits = JSON.parse(localStorage.getItem('mostwanted_edits') || '{}');
    edits[reporteConVotos.id] = { ...reporteConVotos };
    localStorage.setItem('mostwanted_edits', JSON.stringify(edits));
    localStorage.setItem('mostwanted_reportes', JSON.stringify(reportesActualizados));

    // Actualizar el reporte seleccionado
    setReporteSeleccionado(reporteConVotos);
  }, [reportes]);

  // Manejar eliminación de reporte por admin
  const handleDelete = useCallback(async (reporteId) => {
    try {
      // Eliminar en la API
      const response = await fetch(`${API_BASE_URL}/reportes/${reporteId}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Error al eliminar');

      // Actualizar estado local
      const reportesActualizados = reportes.filter(reporte => reporte.id !== reporteId);
      setReportes(reportesActualizados);
      localStorage.setItem('mostwanted_reportes', JSON.stringify(reportesActualizados));

      // Cerrar el modal si el reporte eliminado es el seleccionado
      if (reporteSeleccionado && reporteSeleccionado.id === reporteId) {
        setReporteSeleccionado(null);
      }
    } catch (error) {
      console.error('Error al eliminar reporte:', error);
      // Fallback a localStorage si la API falla
      const reportesActualizados = reportes.filter(reporte => reporte.id !== reporteId);
      setReportes(reportesActualizados);
      localStorage.setItem('mostwanted_reportes', JSON.stringify(reportesActualizados));

      if (reporteSeleccionado && reporteSeleccionado.id === reporteId) {
        setReporteSeleccionado(null);
      }
    }
  }, [reportes, reporteSeleccionado]);

  // Cuando el usuario vota, persistir en WordPress y refrescar el reporte local.
  const handleVote = async (reporteId, votePayload = {}) => {
    const reporteActual = reportes.find((item) => item.id === reporteId);
    if (!reporteActual) {
      throw new Error('No se encontró el reporte para registrar el voto.');
    }

    const voteType = votePayload?.voteType;
    const reason = String(votePayload?.reason || '').trim();
    const voterNameInput = String(votePayload?.voterName || '').trim();

    if (!['up', 'down'].includes(voteType)) {
      throw new Error('El tipo de voto es invalido.');
    }

    if (voteType === 'down' && reason.length < 8) {
      throw new Error('Debes explicar por qué el reporte es falso (minimo 8 caracteres).');
    }

    if (voteType === 'down' && voterNameInput.length < 2) {
      throw new Error('Debes indicar el nombre de quien confirma el reporte falso.');
    }

    const voterName = voterNameInput || (user?.username
      ? (user?.discriminator && user.discriminator !== '0'
        ? `${user.username}#${user.discriminator}`
        : user.username)
      : 'Comunidad');

    const voteResponse = await submitWordpressCommunityVerificationVote({
      reportId: Number(reporteActual?.id),
      voteType,
      reason,
      voterName,
    });

    const communityVerification = voteResponse?.communityVerification || {};
    const up = Number(communityVerification?.up) || 0;
    const down = Number(communityVerification?.down) || 0;
    const comentarios = normalizeComentariosFromCommunityVerification(communityVerification);

    const votosUsuario = JSON.parse(localStorage.getItem('mostwanted_user_votes') || '{}');
    votosUsuario[reporteId] = voteType;
    localStorage.setItem('mostwanted_user_votes', JSON.stringify(votosUsuario));

    let updatedSelected = null;
    const updatedReportes = reportes.map((item) => {
      if (item.id !== reporteId) return item;
      const nextItem = {
        ...item,
        votos: { up, down, comentarios },
        userVote: voteType,
      };
      updatedSelected = nextItem;
      return nextItem;
    });

    setReportes(updatedReportes);
    setCaseRevision(value => value + 1);
    localStorage.setItem('mostwanted_reportes', JSON.stringify(updatedReportes));

    if (updatedSelected && reporteSeleccionado?.id === reporteId) {
      setReporteSeleccionado(updatedSelected);
    }

    return {
      userVote: voteType,
      votos: { up, down, comentarios },
    };
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

  return (
    <div className={`app-container${canUseReports ? '' : ' app-container--access'}`} style={{ position: 'relative' }}>
      <InterfaceSounds />

      {/* ============ ADMIN BANNER ============ */}
      {isAdmin && <AdminBanner onDisable={() => {
        setIsAdmin(false);
        localStorage.removeItem('mostwanted_admin');
      }} />}

      {/* ============ HEADER ============ */}
      <AppHeader
        search={canUseReports && <PersonSearch revision={caseRevision} reports={reportes} knownPlayers={knownPlayers} onSelect={player => {
          setSearchPlayer(player);
          setDeskReset(value => value + 1);
          navigate(playerPath(player.nickname || player.rid));
        }} />}
        actions={<SessionActions user={user} isDemo={isDemo} canUseReports={canUseReports} isProfileScreen={isProfileScreen} onNavigate={navigate} onLogin={handleLogin} onHelp={() => setShowHelp(true)} />}
      />
      {canUseReports && <DeskNavigation items={[
        { href: `${archivePath}${isDemo ? '?demo=true' : ''}`, number: '01', label: 'Archivo de investigación', current: path !== '/denunciar' && !isProfileScreen,
          onClick: event => handleInternalLink(event, nextPath => { if (path !== nextPath) navigate(nextPath); }, archivePath) },
        ...(path === '/denunciar' ? [{ href: isDemo ? '/denunciar?demo=true' : '/denunciar', number: '02', label: 'Mesa de denuncias', current: true }] : []),
      ]} />}
      {/* Modal de ayuda */}
      <HelpModal open={showHelp} onClose={() => setShowHelp(false)} />
      {sessionError && <p className="rfm-submit-error" role="alert">{sessionError}</p>}

      {canUseReports ? (
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
          onValidate={handleValidate}
          onVote={handleVote}
          onEdit={handleEdit}
          onDelete={handleDelete}
          isAdmin={isAdmin}
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
