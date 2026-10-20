import React, { useState, useRef, useEffect, useCallback } from 'react';
import InvestigationDesk from '../components/InvestigationDesk';
import ReportDetailModal from '../components/ReportDetailModal';
import ReportFormModal from '../components/ReportFormModal';
import HelpModal from '../components/HelpModal';
import AIAssistantBubble from '../components/AIAssistantBubble';
import CyberButtonLabel from '../components/CyberButtonLabel';
import InterfaceSounds from '../components/InterfaceSounds';
import PersonSearch from '../components/PersonSearch';
import { buildApiUrl, getApiBaseUrl } from './services/apiConfig';
import { assignExpedienteIds } from './services/expedienteIds';
import { normalizeReportValidation } from './services/casePresentation';
import { resolvePlayerRid } from '../shared/playerIdentity';
import {
  fetchWordpressReportsSnapshot,
  submitWordpressCommunityVerificationVote,
} from './services/reportSubmissionService';

/**
 * App - Componente principal de MOST WANTED
 * SPA para tracking de modders, griffers y ardidos
 * Kaith's Rebels Crew
 * 
 * URLs soportadas:
 * - / - Lista de todos los reportes
 * - /expediente/:id - Ver expediente por ID incremental
 * - /?admin=1 - Modo administrador
 */

// Base URL de la API (solo desde .env)
const API_BASE_URL = getApiBaseUrl();

// Obtener referencia de expediente desde la URL.
const getExpedienteFromURL = () => {
  const path = window.location.pathname;

  const byExpedienteId = path.match(/^\/expediente\/(\d+)$/);
  if (byExpedienteId && byExpedienteId[1]) {
    return { expedienteId: Number(byExpedienteId[1]), usuario: '' };
  }

  // Compatibilidad con enlaces viejos /usuario/:nombre
  const byUsuario = path.match(/^\/usuario\/(.+)$/);
  if (byUsuario && byUsuario[1]) {
    return {
      expedienteId: null,
      usuario: decodeURIComponent(byUsuario[1]).replace(/_/g, ' '),
    };
  }

  return { expedienteId: null, usuario: '' };
};

// Enlace estable a un reporte por su ID de WordPress (lo usan los botones del embed de Discord).
const getReporteIdFromURL = () => {
  const match = window.location.pathname.match(/^\/reporte\/(\d+)$/);
  return match ? Number(match[1]) : null;
};

const DISCORD_AUTH_URL = buildApiUrl('/auth/discord');
const RETURN_PATH_STORAGE_KEY = 'mostwanted_return_path';

const mapCategoriaLegacy = (categorias = [], categoriaActual = '') => {
  if (categoriaActual) return categoriaActual;
  const first = Array.isArray(categorias) ? categorias[0] : '';
  if (first === 'MODDER') return 'modder';
  if (first === 'GRIFFER') return 'griffer';
  if (first === 'GLITCHER' || first === 'ACOSO-RAID') return 'ardido';
  return 'ardido';
};

const mapCategoriaFromWordpressType = (categories = []) => {
  const firstType = Array.isArray(categories) && categories.length > 0 ? String(categories[0]).toUpperCase() : '';
  if (firstType === 'MODDER') return 'modder';
  if (firstType === 'GRIFFER') return 'griffer';
  return 'ardido';
};

const mapSeveridadFromWordpressLabels = (labels = []) => {
  const merged = Array.isArray(labels)
    ? labels
      .map((entry) => {
        if (typeof entry === 'string') return entry;
        if (entry && typeof entry === 'object') return `${entry.label || ''} ${entry.detail || ''}`;
        return '';
      })
      .join(' ')
      .toLowerCase()
    : '';
  if (merged.includes('critic')) return 'critica';
  if (merged.includes('alto') || merged.includes('high')) return 'alta';
  if (merged.includes('bajo') || merged.includes('low')) return 'baja';
  if (merged.includes('medi')) return 'media';
  return '';
};

const normalizeComentariosFromCommunityVerification = (communityVerification = {}) => {
  const confirmations = Array.isArray(communityVerification?.confirmations)
    ? communityVerification.confirmations
    : [];

  return confirmations
    .filter((entry) => String(entry?.reason || '').trim() !== '')
    .map((entry) => ({
      tipo: 'down',
      comentario: String(entry?.reason || '').trim(),
      autor: 'Comunidad',
      fecha: new Date().toISOString(),
    }));
};

const mapWordpressReportToReporte = (report = {}) => {
  const evidence = Array.isArray(report?.evidence) ? report.evidence : [];
  const usuario = String(report?.nickname || report?.title || '').trim();

  const communityVerification = report?.communityVerification || {};
  const normalizedComments = normalizeComentariosFromCommunityVerification(communityVerification);

  return {
    id: Number(report?.id) || Date.now(),
    usuario: usuario || 'USUARIO_SIN_NOMBRE',
    motivo: report?.content || 'Reporte registrado en MostWanted.',
    reportadoPor: 'ANONIMO',
    categoria: mapCategoriaFromWordpressType(report?.categories || []),
    fecha: report?.createdAt || report?.date || '',
    evidencia: evidence[0]?.url || '',
    evidencias: evidence.map((item, index) => ({
      id: `${report?.id || 'report'}-evidence-${index}`,
      preview: item?.url || '',
      nombre: item?.name || `Evidencia ${index + 1}`,
      tipo: item?.contentType || 'image/png',
    })).filter((item) => item.preview),
    estado: 'activo',
    severidad: report?.severidad || report?.severity || (report?.labels?.length ? mapSeveridadFromWordpressLabels(report.labels) : ''),
    validacion: normalizeReportValidation(report?.validacion || report?.validation),
    votos: {
      up: Number(communityVerification?.up) || 0,
      down: Number(communityVerification?.down) || 0,
      comentarios: normalizedComments,
    },
    wpRid: resolvePlayerRid(report),
    categories: Array.isArray(report?.categories) ? report.categories : [],
  };
};

const normalizeReporte = (reporte = {}) => {
  const id = reporte.id ?? Date.now();
  const categoria = mapCategoriaLegacy(reporte.categorias, reporte.categoria);
  const severidad = reporte.severidad ?? 'media';
  const fecha = reporte.fecha ?? new Date().toISOString().slice(0, 10);

  return {
    ...reporte,
    id,
    usuario: reporte.usuario || 'USUARIO_SIN_NOMBRE',
    categoria,
    severidad,
    fecha,
    reportadoPor: 'ANONIMO',
    validacion: reporte.validacion ?? 'pendiente'
  };
};


function App() {
  const [path, setPath] = useState(window.location.pathname);
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
  const [reportsError, setReportsError] = useState('');
  const [capabilities, setCapabilities] = useState({ manageCases: false });
  const detailReturnPath = useRef('/');
  const formReturnPath = useRef('/');
  const navigate = useCallback((nextPath, replace = false) => {
    const previousPath = window.location.pathname;
    window.history[replace ? 'replaceState' : 'pushState']({}, '', `${nextPath}${window.location.search}`);
    setPath(nextPath);
    if (nextPath === '/denunciar' || previousPath === '/denunciar') window.scrollTo(0, 0);
  }, []);
  useEffect(() => {
    if (window.location.pathname === '/' && window.location.hash === '#reportar') navigate('/denunciar', true);
  }, [navigate]);
  useEffect(() => {
    const onPopState = () => {
      setPath(window.location.pathname);
      if (window.location.pathname === '/') { setSearchPlayer(null); setDeskReset(value => value + 1); }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);
  // Estado para el modal de ayuda
  const [showHelp, setShowHelp] = useState(false);
  // Estado para los reportes (incluyendo nuevos enviados)
  const [reportes, setReportes] = useState([]);

  // Estado para el modal de detalle
  const [reporteSeleccionado, setReporteSeleccionado] = useState(null);

  // Estado de carga
  const [isLoading, setIsLoading] = useState(true);

  // Estado de modo admin (activar con ?admin=1 o localStorage)
  const [isAdmin, setIsAdmin] = useState(false);

  // Estado de modo demo (activar con ?demo=true)
  const [isDemo] = useState(() => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('demo') === 'true';
  });

  // Estado para el usuario autenticado
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('discord_user')) || null;
    } catch {
      return null;
    }
  });
  const [isAuthChecked, setIsAuthChecked] = useState(false);

  useEffect(() => {
    if (window.location.pathname === '/auth-callback') return undefined;

    let active = true;
    fetch(buildApiUrl('/auth/me'), { credentials: 'include' })
      .then(async (response) => {
        if (!response.ok) {
          return { authenticated: false, user: null };
        }
        return response.json();
      })
      .then((data) => {
        if (!active) return;
        if (data?.authenticated && data?.user?.id) {
          setUser(data.user);
          setCapabilities(data.capabilities || { manageCases: false });
          localStorage.setItem('discord_user', JSON.stringify(data.user));
        } else {
          setUser(null);
          localStorage.removeItem('discord_user');
        }
      })
      .catch(() => {
        if (!active) return;
        setUser(null);
        localStorage.removeItem('discord_user');
      })
      .finally(() => {
        if (active) setIsAuthChecked(true);
      });

    return () => {
      active = false;
    };
  }, []);

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

  // Detectar si estamos en /auth-callback
  const isAuthCallback = path === '/auth-callback';
  const isValidPath = path === '/' || path === '/denunciar' || /^\/(usuario\/.+|expediente\/\d+|reporte\/\d+|jugador\/[^/]+)$/.test(path);

  useEffect(() => {
    if (isAuthCallback) {
      fetch(buildApiUrl('/auth/me'), {
        credentials: 'include',
      })
        .then((res) => (res.ok ? res.json() : { authenticated: false, user: null }))
        .then((data) => {
          if (data?.authenticated && data?.user) {
            setUser(data.user);
            localStorage.setItem('discord_user', JSON.stringify(data.user));
          } else {
            localStorage.removeItem('discord_user');
          }
          window.location.href = sessionStorage.getItem(RETURN_PATH_STORAGE_KEY) || '/';
          sessionStorage.removeItem(RETURN_PATH_STORAGE_KEY);
        })
        .catch(() => {
          localStorage.removeItem('discord_user');
          window.location.href = sessionStorage.getItem(RETURN_PATH_STORAGE_KEY) || '/';
          sessionStorage.removeItem(RETURN_PATH_STORAGE_KEY);
        });
    }
  }, [isAuthCallback]);

  // Manejar navegación por URL (abrir expediente desde URL)
  useEffect(() => {
    const abrirExpedienteDesdeURL = () => {
      const referencia = getExpedienteFromURL();
      if (reportes.length > 0) {
        let reporte = null;

        const reporteId = getReporteIdFromURL();
        if (reporteId) {
          reporte = reportes.find(r => Number(r.id) === reporteId);
        } else if (referencia?.expedienteId) {
          reporte = reportes.find(r => Number(r.expedienteId) === Number(referencia.expedienteId));
        } else if (referencia?.usuario) {
          reporte = reportes.find(r =>
            String(r.usuario || '').toLowerCase() === referencia.usuario.toLowerCase() ||
            String(r.usuario || '').toLowerCase().replace(/\s+/g, '_') === referencia.usuario.toLowerCase()
          );
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

  }, [isLoading, reportes, path]);


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

  // Cargar votos de usuario desde localStorage
  const getUserVotes = () => {
    try {
      return JSON.parse(localStorage.getItem('mostwanted_user_votes') || '{}');
    } catch {
      return {};
    }
  };

  // Carga inicial de reportes para la UI (API WordPress /reports + persistencia local)
  const fetchReportsFromAPI = async () => {
    try {
      const reports = [];
      let page = 1;

      while (true) {
        const snapshot = await fetchWordpressReportsSnapshot({ perPage: 100, page });
        const pageReports = Array.isArray(snapshot?.items) ? snapshot.items : [];
        reports.push(...pageReports);
        if (pageReports.length < 100) break;
        page += 1;
      }

      const mapped = reports.map(mapWordpressReportToReporte);

      // Persistencia local para fallback offline y continuidad visual.
      localStorage.setItem('mostwanted_reportes', JSON.stringify(mapped));
      setReportsError('');
      return mapped;
    } catch (error) {
      console.error('Error consultando WordPress reports snapshot:', error);
      setReportsError('No se pudo actualizar el archivo. Las coincidencias locales pueden estar desactualizadas.');
      const local = localStorage.getItem('mostwanted_reportes');
      if (local) return JSON.parse(local);
      return [];
    }
  };

  // Al cargar reportes, incluir el voto del usuario en cada uno
  useEffect(() => {
    const fetchReportes = async () => {
      setIsLoading(true);
      let data = [];
      try {
        data = await fetchReportsFromAPI();
      } catch (e) {
        // Si falla, intenta cargar de localStorage
        const local = localStorage.getItem('mostwanted_reportes');
        if (local) {
          data = JSON.parse(local);
        } else {
          data = [];
        }
      }
      const userVotes = getUserVotes();
      // Mapear userVote a cada reporte
      data = data.map(r => ({
        ...normalizeReporte(r),
        userVote: userVotes[r.id] || r.userVote || null
      }));
      setReportes(assignExpedienteIds(data));
      setIsLoading(false);
    };
    fetchReportes();
  }, []);

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

  // Botón de login/logout
  const handleLogin = () => {
    const currentPath = `${window.location.pathname}${window.location.search}`;
    if (currentPath !== '/') {
      sessionStorage.setItem(RETURN_PATH_STORAGE_KEY, currentPath);
    }
    window.location.href = DISCORD_AUTH_URL;
  };
  const handleLogout = () => {
    fetch(buildApiUrl('/auth/logout'), {
      method: 'POST',
      credentials: 'include',
    }).catch(() => undefined);
    setUser(null);
    setCapabilities({ manageCases: false });
    localStorage.removeItem('discord_user');
  };

  if (isAuthCallback) return <main className="desk-empty" role="status">Iniciando sesión con Discord…</main>;
  if (!isValidPath) return <main className="desk-empty"><h1>Página no encontrada</h1><a href="/">Volver al inicio</a></main>;

  // Mostrar loading
  if (isLoading) {
    return (
      <div className="app-container" style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        flexDirection: 'column',
        gap: '1rem'
      }}>
        <div style={{ fontSize: '4rem', animation: 'pulse 1s ease-in-out infinite' }}>☠️</div>
        <div style={{ fontFamily: 'var(--font-stencil)', color: 'var(--color-red-alert)' }}>
          CARGANDO EXPEDIENTES...
        </div>
      </div>
    );
  }

  const canUseReports = Boolean(user) || isDemo;
  const startReport = (player = null) => {
    formReturnPath.current = path === '/denunciar' ? formReturnPath.current : path;
    setReportPlayer(player);
    navigate('/denunciar');
  };

  return (
    <div className={`app-container${canUseReports ? '' : ' app-container--access'}`} style={{ position: 'relative' }}>


      {/* ============ ADMIN BANNER ============ */}
      {isAdmin && (
        <div className="admin-mode-banner">
          🔐 MODO ADMINISTRADOR ACTIVO
          <button
            className="admin-mode-toggle"
            onClick={() => {
              setIsAdmin(false);
              localStorage.removeItem('mostwanted_admin');
            }}
          >
            ✕ Desactivar
          </button>
        </div>
      )}

      {/* ============ HEADER ============ */}
      <header className="site-header">
        <div className="site-brand">
          <img src="/Logo.png" alt="Kaith's Rebels" width="44" height="44" />
          <div>
            <span className="site-brand__eyebrow">KAITH'S REBELS / DIVISIÓN H.E.X.</span>
            <h1>MOST WANTED<span className="site-brand__glitch cyber-glitch-2" aria-hidden="true">MOST WANTED</span></h1>
            <span className="site-brand__department">DESPACHO DE INVESTIGACIÓN COMUNITARIA</span>
          </div>
        </div>
        {canUseReports && <PersonSearch reports={reportes} knownPlayers={knownPlayers} onSelect={player => {
          setSearchPlayer(player);
          setDeskReset(value => value + 1);
          navigate('/');
        }} />}
        {/* Información de usuario y botón de login/logout */}
        <div className="site-header__actions">
          <InterfaceSounds />
          {canUseReports && <button type="button" className="cyber-button-small mw-cyber-button" onClick={() => path === '/denunciar' ? navigate(formReturnPath.current) : startReport()}>
            <CyberButtonLabel>{path === '/denunciar' ? 'Volver al despacho' : 'Registrar reporte'}</CyberButtonLabel>
          </button>}
          {user ? (
            <>
              <span className="site-header__username notranslate" translate="no">{user.username}</span>
              <button className="cyber-button-small mw-cyber-button mw-cyber-button--secondary" onClick={handleLogout}>
                <CyberButtonLabel>Cerrar sesión</CyberButtonLabel>
              </button>
            </>
          ) : isDemo ? (
            <button className="cyber-button-small mw-cyber-button mw-cyber-button--secondary" onClick={handleLogin}>
              <CyberButtonLabel>Iniciar sesión con Discord</CyberButtonLabel>
            </button>
          ) : null}
          {canUseReports && (
            <button className="cyber-button-small mw-cyber-button mw-cyber-button--secondary" onClick={() => setShowHelp(true)} aria-label="Ayuda sobre la herramienta">
              <CyberButtonLabel>Ayuda</CyberButtonLabel>
            </button>
          )}
        </div>
      </header>
      {canUseReports && <nav className="desk-navigation" aria-label="Áreas del despacho">
        <a href={isDemo ? '/?demo=true' : '/'} aria-current={path !== '/denunciar' ? 'page' : undefined} onClick={event => { if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); setSearchPlayer(null); setDeskReset(value => value + 1); navigate('/'); } }}>
          <span aria-hidden="true">01</span> Archivo de investigación
        </a>
        <a href={isDemo ? '/denunciar?demo=true' : '/denunciar'} aria-current={path === '/denunciar' ? 'page' : undefined} onClick={event => { if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); if (path !== '/denunciar') startReport(); } }}>
          <span aria-hidden="true">02</span> Mesa de denuncias
        </a>
        <span className="desk-navigation__notice">Registro comunitario · No es una autoridad policial</span>
      </nav>}
      {/* Modal de ayuda */}
      <HelpModal open={showHelp} onClose={() => setShowHelp(false)} />

      {canUseReports ? (
      <>
      {path === '/denunciar' ? <main id="reportar" className="report-workspace">
        <div className="workspace-intro">
          <div>
            <p className="workspace-eyebrow">02 / MESA DE DENUNCIAS</p>
            <h2 className="cyber-h">Registrar un reporte</h2>
            <p>Identifica al jugador, documenta lo ocurrido y envía la información a H.E.X.</p>
          </div>
          <span className="workspace-intro__code" aria-hidden="true">HEX / REPORT_01</span>
        </div>
        <ReportFormModal onSubmit={handleNewReport} currentUser={user} isDemo={isDemo} initialPlayer={reportPlayer} onReturnToCase={() => navigate(formReturnPath.current)} />
      </main> : <InvestigationDesk key={deskReset} initialPlayer={searchPlayer} onPlayerResolved={rememberPlayer} reportsError={reportsError} path={path} onNavigate={navigate} onOpenReport={handleCardClick} onStartReport={startReport} mapReport={mapWordpressReportToReporte} canManageCases={isAuthChecked && Boolean(user) && capabilities.manageCases} revision={caseRevision} />}
      </>
      ) : (
        <main className="desk-access-stage">
          <section className="desk-access" aria-labelledby="desk-access-title">
          <p className="workspace-eyebrow">H.E.X. / CONTROL DE ACCESO</p>
          <h2 id="desk-access-title" className="cyber-h">Acceso al despacho</h2>
          <p>Inicia sesión para consultar expedientes y documentar reportes de la comunidad.</p>
          <button
            type="button"
            onClick={handleLogin}
            className="cyber-button mw-cyber-button"
          >
            <CyberButtonLabel>Iniciar sesión con Discord</CyberButtonLabel>
          </button>
          </section>
        </main>
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

      <footer className="site-footer">
        <span className="site-footer__text">H.E.X. / Archivo de investigación comunitaria</span>
        <span className="site-footer__version" style={{ marginLeft: '8px' }}>v{__APP_VERSION__}</span>
        <img src="/Logo.png" width="20" style={{ marginLeft: '8px' }} alt="Kaith's Rebels" className="site-footer__logo" />
      </footer>

      <AIAssistantBubble
        isAuthenticated={isAuthChecked && Boolean(user?.id)}
        onSessionExpired={() => {
          setUser(null);
          localStorage.removeItem('discord_user');
        }}
      />
    </div>
  );
}

export default App;
