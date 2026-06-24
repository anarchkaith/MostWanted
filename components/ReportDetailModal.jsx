import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ReactDOM from 'react-dom';
import VoteSystem from './VoteSystem';
import ImageUpload from './ImageUpload';
import { buildApiUrl } from '../src/services/apiConfig';

/**
 * ReportDetailModal - Modal para ver detalles completos de un reporte
 * Estética de "documento clasificado"
 * Incluye controles de administrador y sistema de votos comunitarios
 */
const ReportDetailModal = ({ reporte, onClose, onValidate, onVote, onEdit, onDelete, isAdmin = false }) => {
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [adminNota, setAdminNota] = useState(reporte?.adminNota || '');
  const [urlCopiada, setUrlCopiada] = useState(false);
  const queryClient = useQueryClient();
  const [evidenciasData, setEvidenciasData] = useState([]);
  const [loadingEvidencias, setLoadingEvidencias] = useState(false);
  const [imagenAmpliada, setImagenAmpliada] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Estados para modo edición
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    usuario: reporte?.usuario || '',
    categoria: reporte?.categoria || 'modder',
    severidad: reporte?.severidad || 'media',
    motivo: reporte?.motivo || '',
    reportadoPor: reporte?.reportadoPor || ''
  });
  const [nuevasEvidencias, setNuevasEvidencias] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [editError, setEditError] = useState(null);

  // Cargar evidencias desde la API usando TanStack Query
  const {
    data: evidenciasCargadas = [],
    isLoading: isLoadingEvidencias,
  } = useQuery({
    queryKey: ['evidencias', reporte?.evidencias],
    queryFn: async () => {
      if (!reporte?.evidencias || reporte.evidencias.length === 0) return [];
      // Si las evidencias ya tienen preview (subidas localmente), no cargar
      if (reporte.evidencias[0]?.preview) {
        return reporte.evidencias;
      }
      const evidenciasCargadas = [];
      for (const evidenciaId of reporte.evidencias) {
        try {
          const response = await fetch(buildApiUrl(`/evidencias/${evidenciaId}`));
          if (response.ok) {
            const data = await response.json();
            evidenciasCargadas.push({
              id: evidenciaId,
              preview: data.imagen,
              nombre: `Evidencia ${evidenciasCargadas.length + 1}`
            });
          }
        } catch (error) {
          console.error('Error cargando evidencia:', evidenciaId, error);
        }
      }
      return evidenciasCargadas;
    },
    enabled: !!reporte?.evidencias && reporte.evidencias.length > 0,
    onSuccess: (data) => setEvidenciasData(data),
  });
  // Mantener compatibilidad con loading
  React.useEffect(() => {
    setLoadingEvidencias(isLoadingEvidencias);
  }, [isLoadingEvidencias]);

  if (!reporte) return null;

  const getExpedienteUrl = (expedienteId) => {
    const id = Number(expedienteId);
    if (!Number.isFinite(id) || id <= 0) return window.location.origin;
    return `${window.location.origin}/expediente/${id}`;
  };

  // Número de expediente (mantener para display visual)
  const numeroExpediente = (reporte.expedienteId ?? reporte.id ?? 0).toString().padStart(4, '0');

  // Generar URL compartible usando el id incremental de expediente
  const urlExpediente = getExpedienteUrl(reporte.expedienteId ?? reporte.id);

  // Copiar URL al portapapeles
  const copiarURL = async () => {
    try {
      await navigator.clipboard.writeText(urlExpediente);
      setUrlCopiada(true);
      setTimeout(() => setUrlCopiada(false), 2000);
    } catch (err) {
      // Fallback para navegadores sin soporte
      const input = document.createElement('input');
      input.value = urlExpediente;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setUrlCopiada(true);
      setTimeout(() => setUrlCopiada(false), 2000);
    }
  };

  // Mapeo de categorías a etiquetas
  const categoryLabels = {
    modder: 'MODDER',
    griffer: 'GRIFFER',
    tramposo: 'TRAMPOSO'
  };

  // Mapeo de severidad
  const severityLabels = {
    critica: 'CRÍTICA',
    alta: 'ALTA',
    media: 'MEDIA',
    baja: 'BAJA'
  };

  // Mapeo de estados de validación
  const validationLabels = {
    pendiente: { label: '⏳ PENDIENTE', color: '#ffaa00' },
    verificado: { label: '✅ VERIFICADO', color: '#22c55e' },
    rechazado: { label: '❌ RECHAZADO', color: '#ff3333' },
    investigando: { label: '🔍 INVESTIGANDO', color: '#3b82f6' }
  };

  // Formatear fecha
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  // Manejar validación
  const handleValidation = (validationStatus) => {
    if (onValidate) {
      onValidate(reporte.id, {
        validacion: validationStatus,
        adminNota: adminNota,
        fechaValidacion: new Date().toISOString()
      });
    }
    setShowAdminPanel(false);
  };

  // Manejar inicio de edición
  const handleStartEdit = () => {
    setEditData({
      usuario: reporte.usuario,
      categoria: reporte.categoria,
      severidad: reporte.severidad,
      motivo: reporte.motivo,
      reportadoPor: reporte.reportadoPor
    });
    setNuevasEvidencias([]);
    setIsEditing(true);
    setEditError(null);
  };

  // Manejar cancelar edición
  const handleCancelEdit = () => {
    setIsEditing(false);
    setNuevasEvidencias([]);
    setEditError(null);
  };

  // Manejar guardar edición
  // Mutación para subir evidencias
  const subirEvidencia = useMutation({
    mutationFn: async (evidencia) => {
      const evResponse = await fetch(buildApiUrl('/evidencias'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reporteId: reporte.id,
          nombreArchivo: evidencia.name || evidencia.nombre || `evidencia_${Date.now()}.png`,
          tipo: evidencia.type || evidencia.tipo || 'image/png',
          imagen: evidencia.base64 || evidencia.preview,
          tamanio: evidencia.size || evidencia.tamanio || 0
        })
      });
      if (!evResponse.ok) throw new Error('Error subiendo evidencia');
      const evData = await evResponse.json();
      return evData.evidencia?.id || evData.id;
    },
  });

  // Mutación para editar reporte
  const editarReporte = useMutation({
    mutationFn: async (reporteActualizado) => {
      const response = await fetch(buildApiUrl(`/reportes/${reporte.id}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reporteActualizado),
      });
      if (!response.ok) throw new Error('Error al guardar los cambios');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['reportes']);
    },
  });

  // Guardar edición usando mutaciones
  const handleSaveEdit = async () => {
    if (!editData.usuario.trim() || !editData.motivo.trim()) {
      setEditError('Usuario y motivo son obligatorios');
      return;
    }
    setIsSaving(true);
    setEditError(null);
    try {
      // Subir nuevas evidencias si hay
      let nuevasEvidenciasIds = [];
      for (const evidencia of nuevasEvidencias) {
        try {
          const evidenciaId = await subirEvidencia.mutateAsync(evidencia);
          if (evidenciaId) nuevasEvidenciasIds.push(evidenciaId);
        } catch (err) {
          console.error('Error subiendo evidencia:', err);
        }
      }
      // Actualizar el reporte
      const reporteActualizado = {
        ...editData,
        evidencias: [
          ...(reporte.evidencias || []),
          ...nuevasEvidenciasIds
        ],
        validacion: reporte.validacion,
        adminNota: reporte.adminNota
      };
      const data = await editarReporte.mutateAsync(reporteActualizado);
      const updatedReporte = data.reporte || data;
      if (nuevasEvidencias.length > 0) {
        setEvidenciasData([...(evidenciasData || []), ...nuevasEvidencias]);
      }
      if (onEdit) {
        onEdit(updatedReporte);
      }
      // Forzar recarga del reporte actualizado para reflejar votos y cambios
      queryClient.invalidateQueries(['reportes']);
      setNuevasEvidencias([]);
      setIsEditing(false);
    } catch (error) {
      console.error('Error guardando edición:', error);
      setEditError('Error al guardar. Intenta de nuevo.');
    } finally {
      setIsSaving(false);
    }
  };

  // Cerrar con Escape
  React.useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  // Cerrar al hacer clic en el overlay
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const currentValidation = validationLabels[reporte.validacion] || validationLabels.pendiente;

  // Modal de confirmación de eliminación
  const deleteConfirmModal = showDeleteConfirm ? ReactDOM.createPortal(
    <div className="delete-confirm-overlay" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.85)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 5000
    }}>
      <div className="delete-confirm-modal" style={{
        background: 'var(--color-gray-dark, #1a1a1a)',
        border: '2px solid #ff3333',
        padding: '2rem',
        maxWidth: '400px',
        width: '90vw',
        textAlign: 'center',
        margin: 'auto',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
      }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
        <h3 style={{
          fontFamily: 'var(--font-stencil, cursive)',
          color: '#ff3333',
          marginBottom: '1rem'
        }}>
          ¿ELIMINAR REPORTE?
        </h3>
        <p style={{
          fontFamily: 'var(--font-typewriter, monospace)',
          color: 'var(--color-cream, #e0e0a0)',
          marginBottom: '0.5rem'
        }}>
          Estás a punto de eliminar permanentemente el expediente de:
        </p>
        <p style={{
          fontFamily: 'var(--font-stencil, cursive)',
          fontSize: '1.5rem',
          color: '#ff3333',
          marginBottom: '1rem'
        }} className="notranslate" translate="no">
          {reporte.usuario}
        </p>
        <p style={{
          fontFamily: 'var(--font-mono, monospace)',
          fontSize: '0.8rem',
          color: '#888',
          marginBottom: '1.5rem'
        }}>
          Esta acción NO se puede deshacer.
        </p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          <button
            className="admin-btn"
            onClick={() => setShowDeleteConfirm(false)}
            disabled={isDeleting}
            style={{
              background: 'rgba(100, 100, 100, 0.3)',
              borderColor: '#666',
              color: '#ccc',
              padding: '0.75rem 1.5rem'
            }}
          >
            Cancelar
          </button>
          <button
            className="admin-btn admin-btn--delete"
            onClick={async () => {
              setIsDeleting(true);
              if (onDelete) {
                await onDelete(reporte.id);
              }
              setIsDeleting(false);
              setShowDeleteConfirm(false);
            }}
            disabled={isDeleting}
            style={{
              background: '#8b0000',
              borderColor: '#ff0000',
              color: '#fff',
              padding: '0.75rem 1.5rem'
            }}
          >
            {isDeleting ? '⏳ Eliminando...' : '🗑️ Sí, Eliminar'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <>
      {deleteConfirmModal}
      <div
        className="modal-overlay"
        onClick={handleOverlayClick}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="modal">
          {/* Header del modal */}
          <header className="modal__header">
            <div className="modal__header-main">
              <h2 className="modal__title" id="modal-title">
                <span aria-hidden="true">📋</span> EXPEDIENTE #{numeroExpediente}
                {isEditing && <span style={{ color: '#ffaa00', marginLeft: '0.5rem' }}>(Editando)</span>}
              </h2>
              <div style={{
                marginTop: '0.4rem',
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: '0.82rem',
                color: 'var(--color-cream-dark, #bfbf8f)',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.85rem',
              }}>
                <span>📅 {formatDate(reporte.fecha)}</span>
                <span>🎮 Reportado por: <strong>{reporte.reportadoPor || 'ANONIMO'}</strong></span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {isAdmin && !isEditing && (
                  <button
                    className="modal__share-btn"
                    onClick={handleStartEdit}
                    title="Editar información del reporte"
                    style={{ background: 'rgba(59, 130, 246, 0.2)', borderColor: '#3b82f6' }}
                  >
                    ✏️ Editar
                  </button>
                )}
              </div>
            </div>
            <button
              className="modal__close"
              onClick={onClose}
              aria-label="Cerrar modal"
            >
              ✕
            </button>
          </header>

          {/* URL compartible */}
          <div className="modal__url-bar">
            <span className="modal__url-label">📎 Enlace directo:</span>
            <code className="modal__url-code">{urlExpediente}</code>
            <button
              className="modal__url-copy"
              onClick={copiarURL}
              title="Copiar al portapapeles"
            >
              {urlCopiada ? '✓' : '📋'}
            </button>
          </div>

          {/* Cuerpo del modal */}
          <div className="modal__body">
            {/* Barra de edición */}
            {isEditing && (
              <div className="report-detail__edit-bar">
                <span>✏️ Modo edición activo</span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    className="admin-btn admin-btn--reject"
                    onClick={handleCancelEdit}
                    disabled={isSaving}
                    style={{ minWidth: '100px' }}
                  >
                    ✕ Cancelar
                  </button>
                  <button
                    className="admin-btn admin-btn--verify"
                    onClick={handleSaveEdit}
                    disabled={isSaving}
                    style={{ minWidth: '100px' }}
                  >
                    {isSaving ? '⏳ Guardando...' : '💾 Guardar'}
                  </button>
                </div>
              </div>
            )}

            {editError && (
              <div className="report-detail__edit-error">
                ⚠️ {editError}
              </div>
            )}

            {/* Usuario */}
            <div className="report-detail__field">
              <div className="report-detail__label">Usuario Reportado</div>
              {isEditing ? (
                <input
                  type="text"
                  className="report-detail__input"
                  value={editData.usuario}
                  onChange={(e) => setEditData({ ...editData, usuario: e.target.value })}
                  placeholder="Nombre del usuario"
                  translate="no"
                />
              ) : (
                <div className="report-detail__value report-detail__value--user notranslate" translate="no">
                  {reporte.usuario}
                </div>
              )}
            </div>

            {/* Categoría y Severidad */}
            <div className="report-detail__field" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '150px' }}>
                <div className="report-detail__label">Categoría</div>
                {isEditing ? (
                  <select
                    className="report-detail__select"
                    value={editData.categoria}
                    onChange={(e) => setEditData({ ...editData, categoria: e.target.value })}
                  >
                    <option value="modder">MODDER</option>
                    <option value="griffer">GRIFFER</option>
                    <option value="tramposo">TRAMPOSO</option>
                  </select>
                ) : (
                  <div className="report-detail__value">
                    <span className={`report-card__tag report-card__tag--${reporte.categoria || 'modder'}`}>
                      {categoryLabels[reporte.categoria] || (reporte.categoria || 'N/A').toUpperCase()}
                    </span>
                  </div>
                )}
              </div>
              <div style={{ flex: 1, minWidth: '150px' }}>
                <div className="report-detail__label">Severidad</div>
                {isEditing ? (
                  <select
                    className="report-detail__select"
                    value={editData.severidad}
                    onChange={(e) => setEditData({ ...editData, severidad: e.target.value })}
                  >
                    <option value="baja">BAJA</option>
                    <option value="media">MEDIA</option>
                    <option value="alta">ALTA</option>
                    <option value="critica">CRÍTICA</option>
                  </select>
                ) : (
                  <div className="report-detail__value">
                    <span className="report-card__severity">
                      <span
                        className={`severity-indicator severity-indicator--${reporte.severidad || 'media'}`}
                        aria-hidden="true"
                      />
                      {severityLabels[reporte.severidad] || (reporte.severidad || 'N/A').toUpperCase()}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Motivo completo */}
            <div className="report-detail__field">
              <div className="report-detail__label">Motivo del Reporte</div>
              {isEditing ? (
                <textarea
                  className="report-detail__textarea"
                  value={editData.motivo}
                  onChange={(e) => setEditData({ ...editData, motivo: e.target.value })}
                  rows={4}
                  placeholder="Describe el motivo del reporte..."
                />
              ) : (
                <div className="report-detail__value">
                  {reporte.motivo}
                </div>
              )}
            </div>

            {/* Evidencia Visual */}
            <div className="report-detail__field">
              <div className="report-detail__label">Evidencia Visual</div>
              {loadingEvidencias ? (
                <div className="report-detail__evidence">
                  <div className="report-detail__evidence-icon" aria-hidden="true">
                    ⏳
                  </div>
                  <div className="report-detail__evidence-text">
                    Cargando evidencias...
                  </div>
                </div>
              ) : (
                <>
                  {/* Galería de evidencias existentes */}
                  {(evidenciasData && evidenciasData.length > 0) || (reporte.evidencias && reporte.evidencias.length > 0) ? (
                    <div className="report-detail__evidence-gallery">
                      {((evidenciasData && evidenciasData.length > 0)
                        ? evidenciasData
                        : (evidenciasCargadas && evidenciasCargadas.length > 0)
                          ? evidenciasCargadas
                          : (reporte.evidencias && Array.isArray(reporte.evidencias))
                            ? reporte.evidencias.map((evidencia, index) => ({ id: evidencia.id || evidencia || index, nombre: `Evidencia ${index + 1}` }))
                            : []
                      ).map((evidencia, index) => (
                        <div key={evidencia.id || index} className="report-detail__evidence-item">
                          {evidencia.preview ? (
                            <img
                              src={evidencia.preview}
                              alt={evidencia.nombre || `Evidencia ${index + 1}`}
                              className="report-detail__evidence-img"
                              onClick={() => setImagenAmpliada(evidencia.preview)}
                              style={{ cursor: 'zoom-in' }}
                            />
                          ) : (
                            <div className="report-detail__evidence-placeholder">
                              📷 {evidencia.nombre || 'Imagen'}
                            </div>
                          )}
                          <span className="report-detail__evidence-name">
                            {evidencia.nombre || `Evidencia ${index + 1}`}
                          </span>
                        </div>
                      ))}
                      {/* Nuevas evidencias pendientes de subir */}
                      {isEditing && nuevasEvidencias.map((evidencia, index) => (
                        <div key={`new-${index}`} className="report-detail__evidence-item" style={{ border: '2px dashed #22c55e' }}>
                          <img
                            src={evidencia.preview}
                            alt={evidencia.nombre || `Nueva ${index + 1}`}
                            className="report-detail__evidence-img"
                            style={{ opacity: 0.8 }}
                          />
                          <span className="report-detail__evidence-name" style={{ color: '#22c55e' }}>
                            ✓ {evidencia.nombre || `Nueva ${index + 1}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : !isEditing ? (
                    <div className="report-detail__evidence">
                      <div className="report-detail__evidence-icon" aria-hidden="true">
                        📷
                      </div>
                      <div className="report-detail__evidence-text">
                        Sin evidencia adjunta
                      </div>
                    </div>
                  ) : null}

                  {/* Uploader en modo edición */}
                  {isEditing && (
                    <div style={{ marginTop: evidenciasData?.length > 0 || nuevasEvidencias.length > 0 ? '1rem' : '0' }}>
                      <ImageUpload
                        onImagesChange={setNuevasEvidencias}
                        maxImages={5 - (evidenciasData?.length || 0) - nuevasEvidencias.length}
                        globalPaste={true}
                      />
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Estado del Caso - basado en validación */}
            <div className="report-detail__field">
              <div className="report-detail__label">Estado del Caso</div>
              {(() => {
                // Determinar estado basado en validación
                const validacion = reporte.validacion || 'pendiente';
                const votosFavor = reporte.votos?.up || 0;
                const votosContra = reporte.votos?.down || 0;
                const votosNetos = votosFavor - votosContra;
                const umbral = 5;

                // Prioridad: Admin > Comunidad > Default
                if (validacion === 'rechazado') {
                  return (
                    <div className="report-detail__value" style={{ borderLeftColor: '#888888' }}>
                      ❌ RECHAZADO - CASO CERRADO
                    </div>
                  );
                }
                if (validacion === 'verificado') {
                  return (
                    <div className="report-detail__value" style={{ borderLeftColor: '#22c55e' }}>
                      ✅ VERIFICADO - CONFIRMADO POR ADMIN
                    </div>
                  );
                }
                if (validacion === 'investigando') {
                  return (
                    <div className="report-detail__value" style={{ borderLeftColor: '#3b82f6' }}>
                      🔍 EN INVESTIGACIÓN
                    </div>
                  );
                }
                // Validación por comunidad
                if (votosNetos <= -umbral) {
                  return (
                    <div className="report-detail__value" style={{ borderLeftColor: '#888888' }}>
                      👎 RECHAZADO POR LA COMUNIDAD
                    </div>
                  );
                }
                if (votosNetos >= umbral) {
                  return (
                    <div className="report-detail__value" style={{ borderLeftColor: '#88cc00' }}>
                      👍 VERIFICADO POR LA COMUNIDAD
                    </div>
                  );
                }
                // Estado por defecto
                return (
                  <div className="report-detail__value" style={{ borderLeftColor: '#ff3333' }}>
                    🔴 ACTIVO - EN VIGILANCIA
                  </div>
                );
              })()}
              {/* Fecha de validación si existe */}
              {reporte.fechaValidacion && (
                <div style={{ fontSize: '0.75rem', opacity: 0.7, marginTop: '0.25rem', paddingLeft: '0.75rem' }}>
                  📅 Validado el {formatDate(reporte.fechaValidacion)}
                </div>
              )}
              {/* Nota del admin si existe */}
              {reporte.adminNota && (
                <div style={{
                  marginTop: '0.5rem',
                  padding: '0.5rem',
                  background: 'rgba(255,255,255,0.05)',
                  borderLeft: '2px solid var(--color-gray-light)',
                  fontSize: '0.85rem',
                  fontStyle: 'italic'
                }}>
                  📝 Nota del Admin: {reporte.adminNota}
                </div>
              )}
            </div>

            {/* Sistema de Votos Comunitarios */}
            <VoteSystem
              reporteId={reporte.id}
              votos={reporte.votos || { up: 0, down: 0, comentarios: [] }}
              userVote={reporte.userVote}
              onVote={onVote}
              umbralVerificacion={5}
            />

            {/* Panel de Administrador */}
            {isAdmin && (
              <div className="report-detail__admin-section">
                <button
                  className="admin-toggle-btn"
                  onClick={() => setShowAdminPanel(!showAdminPanel)}
                >
                  🔐 {showAdminPanel ? 'Ocultar Panel Admin' : 'Panel de Administrador'}
                </button>

                {showAdminPanel && (
                  <div className="admin-panel">
                    <div className="admin-panel__header">
                      ⚙️ ACCIONES DE ADMINISTRADOR
                    </div>

                    <div className="admin-panel__note">
                      <label>Nota del Admin (opcional):</label>
                      <textarea
                        value={adminNota}
                        onChange={(e) => setAdminNota(e.target.value)}
                        placeholder="Agregar notas sobre la investigación..."
                        maxLength={300}
                      />
                    </div>

                    <div className="admin-panel__actions">
                      <button
                        className="admin-btn admin-btn--verify"
                        onClick={() => handleValidation('verificado')}
                      >
                        ✅ Verificar
                      </button>
                      <button
                        className="admin-btn admin-btn--investigate"
                        onClick={() => handleValidation('investigando')}
                      >
                        🔍 Investigar
                      </button>
                      <button
                        className="admin-btn admin-btn--reject"
                        onClick={() => handleValidation('rechazado')}
                      >
                        ❌ Rechazar
                      </button>
                    </div>

                    {/* Sección de Eliminar */}
                    <div className="admin-panel__danger-zone" style={{
                      marginTop: '1.5rem',
                      paddingTop: '1rem',
                      borderTop: '1px dashed rgba(255, 51, 51, 0.3)'
                    }}>
                      <div style={{
                        fontSize: '0.75rem',
                        color: '#ff3333',
                        marginBottom: '0.5rem',
                        fontFamily: 'var(--font-mono, monospace)'
                      }}>
                        ⚠️ ZONA DE PELIGRO
                      </div>
                      <button
                        className="admin-btn admin-btn--delete"
                        onClick={() => setShowDeleteConfirm(true)}
                        style={{
                          width: '100%',
                          background: 'rgba(139, 0, 0, 0.3)',
                          borderColor: '#8b0000',
                          color: '#ff6666'
                        }}
                      >
                        🗑️ Eliminar Reporte Permanentemente
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Visor de imagen ampliada */}
      {imagenAmpliada && (
        <div
          className="image-viewer-overlay"
          onClick={() => setImagenAmpliada(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.95)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 3000,
            cursor: 'zoom-out',
            padding: '20px'
          }}
        >
          <button
            onClick={() => setImagenAmpliada(null)}
            style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              background: 'rgba(255, 51, 51, 0.8)',
              border: 'none',
              color: 'white',
              fontSize: '2rem',
              cursor: 'pointer',
              width: '50px',
              height: '50px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 3001
            }}
            aria-label="Cerrar imagen"
          >
            ✕
          </button>
          <img
            src={imagenAmpliada}
            alt="Evidencia ampliada"
            style={{
              maxWidth: '90vw',
              maxHeight: '90vh',
              objectFit: 'contain',
              border: '3px solid #ff3333',
              boxShadow: '0 0 30px rgba(255, 51, 51, 0.5)'
            }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
};

export default ReportDetailModal;
