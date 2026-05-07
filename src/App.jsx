import React, { useState, useMemo, useEffect, useCallback } from 'react';
import reportesData from '../data/reportes.json';
import ReportCard from '../components/ReportCard';
import ReportDetailModal from '../components/ReportDetailModal';
import ReportFormModal from '../components/ReportFormModal';
import HelpModal from '../components/HelpModal';
import AIAssistantBubble from '../components/AIAssistantBubble';
import { buildApiUrl, getApiBaseUrl } from './services/apiConfig';

/**
 * App - Componente principal de MOST WANTED
 * SPA para tracking de modders, griffers y tramposos
 * Kaith's Rebels Crew
 * 
 * URLs soportadas:
 * - / - Lista de todos los reportes
 * - /0001 - Ver expediente #0001
 * - /?admin=1 - Modo administrador
 */

// Formatear ID de expediente usando el nombre de usuario (URL-safe)
const formatExpediente = (usuario) => {
  if (!usuario) return '';
  // Convertir a minúsculas y reemplazar espacios/caracteres especiales
  return `/usuario/${encodeURIComponent(usuario.toLowerCase().replace(/\s+/g, '_'))}`;
};

// Base URL de la API (solo desde .env)
const API_BASE_URL = getApiBaseUrl();

// Obtener usuario desde la URL (solo si ruta es /usuario/:nombre_usuario)
const getExpedienteFromURL = () => {
  const path = window.location.pathname;
  // Solo buscar si la ruta es /usuario/...
  const match = path.match(/^\/usuario\/(.+)$/);
  if (match && match[1]) {
    // Decodificar y normalizar el nombre
    return decodeURIComponent(match[1]).replace(/_/g, ' ');
  }
  return null;
};

const DISCORD_CLIENT_ID = import.meta.env.VITE_DISCORD_CLIENT_ID;
const DISCORD_REDIRECT_URI = import.meta.env.VITE_DISCORD_REDIRECT_URI;
const DISCORD_AUTH_URL = `https://discord.com/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(DISCORD_REDIRECT_URI)}&response_type=code&scope=identify`;

const mapCategoriaLegacy = (categorias = [], categoriaActual = '') => {
  if (categoriaActual) return categoriaActual;
  const first = Array.isArray(categorias) ? categorias[0] : '';
  if (first === 'MODDER') return 'modder';
  if (first === 'GRIFFER') return 'griffer';
  if (first === 'GLITCHER' || first === 'ACOSO-RAID') return 'tramposo';
  return 'tramposo';
};

const normalizeReporte = (reporte = {}) => {
  const id = reporte.id ?? Date.now();
  const categoria = mapCategoriaLegacy(reporte.categorias, reporte.categoria);
  const severidad = reporte.severidad || 'media';
  const fecha = reporte.fecha || new Date().toISOString().slice(0, 10);

  return {
    ...reporte,
    id,
    usuario: reporte.usuario || 'USUARIO_SIN_NOMBRE',
    categoria,
    severidad,
    fecha,
    reportadoPor: reporte.reportadoPor || reporte.contacto || 'ANONIMO',
    validacion: reporte.validacion || 'pendiente'
  };
};


function App() {
  // Estado para el modal de ayuda
  const [showHelp, setShowHelp] = useState(false);
  // Estado para los reportes (incluyendo nuevos enviados)
  const [reportes, setReportes] = useState([]);

  // Estado para el filtro activo
  const [filtroActivo, setFiltroActivo] = useState('todos');

  // Estado para los filtros de validación (chips múltiples)
  const [filtrosValidacion, setFiltrosValidacion] = useState([]);

  // Estado para la búsqueda
  const [busqueda, setBusqueda] = useState('');

  // Estado para el modal de detalle
  const [reporteSeleccionado, setReporteSeleccionado] = useState(null);
  const [showLista, setShowLista] = useState(false);

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
  const isAuthCallback = window.location.pathname === '/auth-callback';
  const isHome = window.location.pathname === '/';
  const isUsuario = /^\/usuario\/.+/.test(window.location.pathname);

  // Mostrar error si la ruta es inválida (no redirigir)
  if (!isHome && !isUsuario && !isAuthCallback) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🚫</div>
        <div style={{ fontSize: 24, marginBottom: 8 }}>Página no encontrada</div>
        <div style={{ fontSize: 16, color: '#888' }}>
          La dirección ingresada no existe. <a href="/">Volver al inicio</a>.
        </div>
      </div>
    );
  }

  // Mostrar loader si estamos en /auth-callback
  if (isAuthCallback) {
    useEffect(() => {
      const url = new URL(window.location.href);
      const code = url.searchParams.get('code');
      if (code && !user) {
        fetch(`${buildApiUrl('/discord-auth')}?code=${encodeURIComponent(code)}`)
          .then(res => res.json())
          .then(data => {
            if (data.user) {
              setUser(data.user);
              localStorage.setItem('discord_user', JSON.stringify(data.user));
            }
            window.location.href = '/';
          });
      } else if (!code) {
        window.location.href = '/';
      }
    }, [user]);
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>☠️</div>
        <div style={{ fontSize: 20 }}>Iniciando sesión con Discord...</div>
      </div>
    );
  }

  // Manejar navegación por URL (abrir expediente desde URL)
  useEffect(() => {
    const abrirExpedienteDesdeURL = () => {
      const usuarioBuscado = getExpedienteFromURL();
      if (usuarioBuscado && reportes.length > 0) {
        // Buscar por nombre de usuario (case-insensitive)
        const reporte = reportes.find(r =>
          r.usuario.toLowerCase() === usuarioBuscado.toLowerCase() ||
          r.usuario.toLowerCase().replace(/\s+/g, '_') === usuarioBuscado.toLowerCase()
        );
        if (reporte) {
          setReporteSeleccionado(reporte);
        }
      }
    };

    // Esperar a que los reportes estén cargados
    if (!isLoading) {
      abrirExpedienteDesdeURL();
    }

    // Escuchar cambios en la navegación (botón atrás/adelante)
    const handlePopState = () => {
      const usuarioBuscado = getExpedienteFromURL();
      if (usuarioBuscado) {
        const reporte = reportes.find(r =>
          r.usuario.toLowerCase() === usuarioBuscado.toLowerCase() ||
          r.usuario.toLowerCase().replace(/\s+/g, '_') === usuarioBuscado.toLowerCase()
        );
        setReporteSeleccionado(reporte || null);
      } else {
        setReporteSeleccionado(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isLoading, reportes]);

  // useEffect desactivado: ya no se cargan reportes desde el canal de Discord

  useEffect(() => {
    const channelId = import.meta.env.VITE_DISCORD_ID_CHANNEL;
    if (!channelId) {
      setIsLoading(false);
      return;
    }
    /* fetch(`/.netlify/functions/discord-channel-messages?channelId=${channelId}`)
      .then(res => res.json())
      .then(data => {
        console.log('Mensajes del canal Discord:', data);
        setReportes(data);
      })
      .catch(err => {
        console.error('Error al leer mensajes de Discord:', err);
      })
      .finally(() => setIsLoading(false)); */
    setIsLoading(false)
  }, []);


  // Filtrar reportes basándose en categoría, validación y búsqueda
  const reportesFiltrados = useMemo(() => {
    return reportes.filter(reporte => {
      // Validar que el reporte tenga los campos necesarios
      if (!reporte || !reporte.usuario) return false;

      // Filtro por categoría
      const cumpleFiltro = filtroActivo === 'todos' || reporte.categoria === filtroActivo;

      // Filtro por estado de validación (chips múltiples)
      const estadoValidacion = reporte.validacion || 'pendiente';
      const cumpleValidacion = filtrosValidacion.length === 0 || filtrosValidacion.includes(estadoValidacion);

      // Filtro por búsqueda (nombre de usuario)
      const cumpleBusqueda = reporte.usuario.toLowerCase().includes(busqueda.toLowerCase());

      return cumpleFiltro && cumpleValidacion && cumpleBusqueda;
    });
  }, [reportes, filtroActivo, filtrosValidacion, busqueda]);

  // Categorías para los botones de filtro
  const categorias = [
    { id: 'todos', label: 'TODOS', icon: '📋' },
    { id: 'modder', label: 'MODDERS', icon: '🔧' },
    { id: 'griffer', label: 'GRIFFERS', icon: '💀' },
    { id: 'tramposo', label: 'TRAMPOSOS', icon: '🎯' }
  ];

  // Estados de validación para filtros (chips toggle)
  const estadosValidacion = [
    { id: 'pendiente', label: 'PENDIENTE', icon: '⏳' },
    { id: 'verificado', label: 'VERIFICADO', icon: '✅' },
    { id: 'investigando', label: 'INVESTIGANDO', icon: '🔍' },
    { id: 'rechazado', label: 'RECHAZADO', icon: '❌' }
  ];

  // Toggle para chips de validación
  const toggleFiltroValidacion = (id) => {
    setFiltrosValidacion(prev =>
      prev.includes(id)
        ? prev.filter(f => f !== id)
        : [...prev, id]
    );
  };

  // Manejar clic en una tarjeta (actualiza URL con nombre de usuario)
  const handleCardClick = (reporte) => {
    setReporteSeleccionado(reporte);
    // Actualizar URL sin recargar la página usando el nombre de usuario
    const nuevaURL = `${formatExpediente(reporte.usuario)}${window.location.search}`;
    window.history.pushState({ usuario: reporte.usuario }, '', nuevaURL);
  };

  // Cerrar modal de detalle (volver a la lista)
  const handleCloseDetail = () => {
    setReporteSeleccionado(null);
    // Volver a la URL base
    const baseURL = `/${window.location.search}`;
    window.history.pushState({}, '', baseURL);
  };

  // Manejar nuevo reporte enviado
  const handleNewReport = (nuevoReporte, submissionResult = null) => {
    const nuevoNormalizado = normalizeReporte({
      ...nuevoReporte,
      id: Date.now(),
      fecha: new Date().toISOString().slice(0, 10),
      reportadoPor: nuevoReporte.contacto || 'ANONIMO',
      botSyncStatus: submissionResult?.botDelivery?.ok ? 'delivered' : 'pending',
      botSyncAt: new Date().toISOString(),
      botSyncReportId: submissionResult?.reportId ?? submissionResult?.botDelivery?.reportId ?? null,
      botSyncError: submissionResult?.botDelivery?.ok ? '' : (submissionResult?.botDelivery?.message || submissionResult?.warning || '')
    });
    const nuevosReportes = [nuevoNormalizado, ...reportes];
    setReportes(nuevosReportes);
    // Guardar en localStorage para persistencia
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

  // Carga inicial de reportes para la UI (JSON local + persistencia local)
  const fetchReportsFromAPI = async () => {
    const local = localStorage.getItem('mostwanted_reportes');
    if (local) return JSON.parse(local);
    return reportesData;
  };

  // Al cargar reportes, incluir el voto del usuario en cada uno
  useEffect(() => {
    const fetchReportes = async () => {
      // Aquí va la lógica real de carga de reportes
      let data = [];
      try {
        // Si tienes una función fetchReportsFromAPI, úsala aquí
        data = await fetchReportsFromAPI();
      } catch (e) {
        // Si falla, intenta cargar de localStorage
        const local = localStorage.getItem('mostwanted_reportes');
        if (local) {
          data = JSON.parse(local);
        } else {
          data = reportesData;
        }
      }
      const userVotes = getUserVotes();
      // Mapear userVote a cada reporte
      data = data.map(r => ({
        ...normalizeReporte(r),
        userVote: userVotes[r.id] || null
      }));
      setReportes(data);
    };
    fetchReportes();
  }, []);

  // Cuando el usuario vota, actualizar también el userVote en el estado
  const handleVote = (reporteId, nuevosVotos) => {
    setReportes(prev => prev.map(r =>
      r.id === reporteId
        ? { ...r, votos: nuevosVotos, userVote: getUserVotes()[reporteId] || null }
        : r
    ));
    // ...existing code para guardar en localStorage y/o enviar a API...
  };

  // Botón de login/logout
  const handleLogin = () => {
    window.location.href = DISCORD_AUTH_URL;
  };
  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('discord_user');
  };

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

  return (
    <div className="app-container" style={{ position: 'relative' }}>


      {/* Botón de ayuda flotante, arriba a la derecha */}
      <button className="help-btn" onClick={() => setShowHelp(true)} aria-label="Ayuda sobre la herramienta" title="¿Qué es esto?" style={{ position: 'fixed', top: 24, right: 32, zIndex: 3001 }}>
        ?
      </button>
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
      <header className="header" style={{ position: 'relative' }}>
        <h1 className="header__title" data-text="MOST WANTED">MOST WANTED</h1>
        <p className="header__subtitle">Modders, Griffers y Tramposos</p>
        <div className="header__logo">
          <span className="header__logo-icon" aria-hidden="true">☠️</span>
          <span>KAITH'S REBELS</span>
          <img
            src="/Logo.png"
            alt="Logo de Kaith's Rebels"
            style={{ width: 26, height: 26, objectFit: 'contain', filter: 'drop-shadow(0 0 4px rgba(255, 51, 51, 0.35))' }}
          />
        </div>
        {/* Información de usuario y botón de login/logout */}
        {/* <div className="header__user-info" style={{ position: 'absolute', top: 16, right: 16, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
          {user ? (
            <>
              <button onClick={handleLogout} style={{ background: '#5865F2', color: 'white', border: 'none', padding: '8px 16px', borderRadius: 4, fontWeight: 'bold', marginBottom: 4 }}>
                Cerrar sesión
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                <img src={`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`} alt="avatar" style={{ width: 32, height: 32, borderRadius: '50%' }} />
                <span style={{ fontWeight: 'bold', color: '#5865F2' }}>{user.username}#{user.discriminator}</span>
              </div>
            </>
          ) : (
            <button onClick={handleLogin} style={{ background: '#5865F2', color: 'white', border: 'none', padding: '8px 16px', borderRadius: 4, fontWeight: 'bold' }}>
              Iniciar sesión con Discord
            </button>
          )}
        </div> */}
      </header>
      {/* Modal de ayuda */}
      <HelpModal open={showHelp} onClose={() => setShowHelp(false)} />

      {/* ============ FORMULARIO DE REPORTE ============ */}
      <main style={{ padding: 'var(--spacing-lg) 0' }}>
        <ReportFormModal onSubmit={handleNewReport} currentUser={user} isDemo={isDemo} />
      </main>

      <section style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--spacing-lg)' }}>
        <button
          type="button"
          className="report-btn"
          onClick={() => setShowLista(prev => !prev)}
          aria-expanded={showLista}
          aria-controls="reportes-lista"
        >
          {showLista ? 'Ocultar lista de reportes' : `Mostrar lista (${reportesFiltrados.length})`}
        </button>
      </section>

      {showLista && (
        <>
          <section className="controls">
            <div className="controls__filters">
              {categorias.map(categoria => (
                <button
                  key={categoria.id}
                  type="button"
                  className={`filter-btn ${filtroActivo === categoria.id ? 'filter-btn--active' : ''}`}
                  data-category={categoria.id}
                  onClick={() => setFiltroActivo(categoria.id)}
                >
                  {categoria.icon} {categoria.label}
                </button>
              ))}
            </div>

            <div className="controls__row">
              <div className="controls__chips">
                {estadosValidacion.map(estado => (
                  <button
                    key={estado.id}
                    type="button"
                    className={`chip ${filtrosValidacion.includes(estado.id) ? 'chip--active' : ''}`}
                    data-validation={estado.id}
                    onClick={() => toggleFiltroValidacion(estado.id)}
                  >
                    {estado.icon} {estado.label}
                  </button>
                ))}
              </div>
              <span className="form-group__hint">
                Mostrando {reportesFiltrados.length} de {reportes.length}
              </span>
            </div>

            <div className="controls__search">
              <input
                type="text"
                className="search-input"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por usuario..."
              />
            </div>
          </section>

          <section id="reportes-lista" className="reports-grid">
            {reportesFiltrados.length > 0 ? (
              reportesFiltrados.map(reporte => (
                <ReportCard
                  key={`${filtroActivo}-${filtrosValidacion.join('-')}-${busqueda}-${reporte.id}`}
                  reporte={reporte}
                  onClick={handleCardClick}
                  onVote={handleVote}
                />
              ))
            ) : (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: 'var(--color-cream-dark)', padding: '1rem 0' }}>
                No hay reportes que coincidan con los filtros actuales.
              </div>
            )}
          </section>
        </>
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

      <footer style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '20px 0 28px', marginTop: 'var(--spacing-xxl)', borderTop: '1px solid var(--color-gray-medium)', opacity: 0.45, pointerEvents: 'none', userSelect: 'none' }} className="site-footer">
        <span className="site-footer__text">Desarrollado por Kaith's Rebels</span>
        <img src="/Logo.png" width="20" style={{ marginLeft: '8px' }} alt="Kaith's Rebels" className="site-footer__logo" />
      </footer>

      <AIAssistantBubble />
    </div>
  );
}

export default App;
