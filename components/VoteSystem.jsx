import React, { useState, useEffect } from 'react';
// import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

/**
 * VoteSystem - Sistema de votos comunitarios
 * Permite a la comunidad validar reportes con comentarios opcionales
 * Usa la API /api/votos para persistir en la base de datos
 * 
 * Props:
 * - reporteId: ID del reporte
 * - votos: objeto con { up: number, down: number } (valores iniciales)
 * - onVote: callback (reporteId, nuevosDatos) => void
 * - umbralVerificacion: votos netos para verificar (default: 5)
 * - compact: modo compacto para las tarjetas (default: false)
 */
const VoteSystem = ({
  reporteId,
  votos: votosIniciales = { up: 0, down: 0 },
  onVote,
  umbralVerificacion = 5,
  compact = false,
  userVote: userVoteProp = null
}) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const [error, setError] = useState(null);
  const [showCommentForm, setShowCommentForm] = useState(false);
  const [comentario, setComentario] = useState('');
  const [mostrarComentarios, setMostrarComentarios] = useState(false);
  // Estado local para el voto del usuario (persistente)
  const [userVote, setUserVote] = useState(userVoteProp);
  const [isLoading, setIsLoading] = useState(false);
  const comentarios = votosIniciales.comentarios || [];
  const votos = votosIniciales;
  const votosNetos = votos.up - votos.down;
  const porcentajePositivo = votos.up + votos.down > 0
    ? Math.round((votos.up / (votos.up + votos.down)) * 100)
    : 0;
  const esVerificadoComunidad = votosNetos >= umbralVerificacion;
  const esRechazadoComunidad = votosNetos <= -umbralVerificacion;

  // Leer voto del usuario desde localStorage al montar
  useEffect(() => {
    const votosUsuario = JSON.parse(localStorage.getItem('mostwanted_user_votes') || '{}');
    if (votosUsuario[reporteId]) {
      setUserVote(votosUsuario[reporteId]);
    }
  }, [reporteId]);

  // Sincronizar userVote local con prop
  useEffect(() => {
    setUserVote(userVoteProp);
  }, [userVoteProp]);

  // Manejar voto
  const handleVote = (tipo) => {
    if (isLoading || userVote) return; // No permitir votar dos veces
    setError(null);
    setIsLoading(true);
    setTimeout(() => {
      let nuevosVotos = { ...votos };
      let nuevoUserVote = userVote;
      if (tipo === 'up') {
        nuevosVotos.up = nuevosVotos.up + 1;
        nuevoUserVote = 'up';
      } else if (tipo === 'down') {
        nuevosVotos.down = nuevosVotos.down + 1;
        nuevoUserVote = 'down';
      }
      setUserVote(nuevoUserVote);
      setIsLoading(false);
      // Guardar voto en localStorage
      const votosUsuario = JSON.parse(localStorage.getItem('mostwanted_user_votes') || '{}');
      votosUsuario[reporteId] = nuevoUserVote;
      localStorage.setItem('mostwanted_user_votes', JSON.stringify(votosUsuario));
      if (onVote) {
        onVote(reporteId, nuevosVotos);
      }
    }, 300);
  };

  // Manejar quitar voto
  const handleRemoveVote = () => {
    if (!userVote) return;
    setIsLoading(true);
    setTimeout(() => {
      let nuevosVotos = { ...votos };
      if (userVote === 'up') {
        nuevosVotos.up = Math.max(0, nuevosVotos.up - 1);
      } else if (userVote === 'down') {
        nuevosVotos.down = Math.max(0, nuevosVotos.down - 1);
      }
      setUserVote(null);
      setIsLoading(false);
      // Quitar voto de localStorage
      const votosUsuario = JSON.parse(localStorage.getItem('mostwanted_user_votes') || '{}');
      delete votosUsuario[reporteId];
      localStorage.setItem('mostwanted_user_votes', JSON.stringify(votosUsuario));
      if (onVote) {
        onVote(reporteId, nuevosVotos);
      }
    }, 300);
  };

  // Modo compacto para las tarjetas
  if (compact) {
    return (
      <div className="vote-system vote-system--compact">
        <button
          className={`vote-btn vote-btn--up ${userVote === 'up' ? 'vote-btn--active' : ''} ${isLoading ? 'vote-btn--loading' : ''}`}
          onClick={(e) => { e.stopPropagation(); handleVote('up'); }}
          aria-label="Votar como legítimo"
          title="Es legítimo"
          disabled={isLoading}
        >
          {isLoading && userVote !== 'up' ? '⏳' : '👍'} {votos.up}
        </button>
        <button
          className={`vote-btn vote-btn--down ${userVote === 'down' ? 'vote-btn--active' : ''} ${isLoading ? 'vote-btn--loading' : ''}`}
          onClick={(e) => { e.stopPropagation(); handleVote('down'); }}
          aria-label="Votar como falso"
          title="Es falso"
          disabled={isLoading}
        >
          {isLoading && userVote !== 'down' ? '⏳' : '👎'} {votos.down}
        </button>

        <style>{`
          .vote-system--compact {
            display: flex;
            gap: 0.5rem;
            margin-top: 0.5rem;
          }

          .vote-system--compact .vote-btn {
            background: var(--color-gray-dark, #1a1a1a);
            border: 1px solid var(--color-gray-light, #3a3a3a);
            color: var(--color-cream, #e0e0a0);
            padding: 0.25rem 0.5rem;
            font-family: var(--font-mono, monospace);
            font-size: 0.75rem;
            cursor: pointer;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            gap: 0.25rem;
          }

          .vote-system--compact .vote-btn:hover {
            transform: scale(1.05);
          }

          .vote-system--compact .vote-btn--up:hover,
          .vote-system--compact .vote-btn--up.vote-btn--active {
            background: rgba(34, 197, 94, 0.3);
            border-color: #22c55e;
            color: #22c55e;
          }

          .vote-system--compact .vote-btn--down:hover,
          .vote-system--compact .vote-btn--down.vote-btn--active {
            background: rgba(239, 68, 68, 0.3);
            border-color: #ef4444;
            color: #ef4444;
          }
        `}</style>
      </div>
    );
  }

  // Modo completo para el modal de detalle
  return (
    <div className={`vote-system ${isAnimating ? 'vote-system--animating' : ''}`}>
      <div className="vote-system__header">
        <span className="vote-system__title">🗳️ VERIFICACIÓN COMUNITARIA</span>
        {esVerificadoComunidad && (
          <span className="vote-system__badge vote-system__badge--verified">
            ✅ VERIFICADO POR LA COMUNIDAD
          </span>
        )}
        {esRechazadoComunidad && (
          <span className="vote-system__badge vote-system__badge--rejected">
            ❌ RECHAZADO POR LA COMUNIDAD
          </span>
        )}
      </div>

      <div className="vote-system__question">
        ¿Este reporte es legítimo?
      </div>

      <div className="vote-system__buttons">
        <button
          className={`vote-btn vote-btn--full vote-btn--up ${userVote === 'up' ? 'vote-btn--active' : ''} ${isLoading ? 'vote-btn--loading' : ''}`}
          onClick={() => handleVote('up')}
          aria-label="Votar como legítimo"
          disabled={isLoading}
        >
          <span className="vote-btn__icon">{isLoading ? '⏳' : '👍'}</span>
          <span className="vote-btn__label">SÍ, ES LEGÍTIMO</span>
          <span className="vote-btn__count">{votos.up}</span>
        </button>

        <button
          className={`vote-btn vote-btn--full vote-btn--down ${userVote === 'down' ? 'vote-btn--active' : ''} ${isLoading ? 'vote-btn--loading' : ''}`}
          onClick={() => handleVote('down')}
          aria-label="Votar como falso"
          disabled={isLoading}
        >
          <span className="vote-btn__icon">{isLoading ? '⏳' : '👎'}</span>
          <span className="vote-btn__label">NO, ES FALSO</span>
          <span className="vote-btn__count">{votos.down}</span>
        </button>
      </div>

      {/* Mensaje de error */}
      {error && (
        <div className="vote-system__error">
          ⚠️ {error}
        </div>
      )}

      {/* Barra de progreso */}
      <div className="vote-system__progress">
        <div className="vote-system__progress-bar">
          <div
            className="vote-system__progress-fill vote-system__progress-fill--up"
            style={{ width: `${porcentajePositivo}%` }}
          />
          <div
            className="vote-system__progress-fill vote-system__progress-fill--down"
            style={{ width: `${100 - porcentajePositivo}%` }}
          />
        </div>
        <div className="vote-system__progress-labels">
          <span className="vote-system__progress-label vote-system__progress-label--up">
            {porcentajePositivo}% legítimo
          </span>
          <span className="vote-system__progress-label vote-system__progress-label--down">
            {100 - porcentajePositivo}% falso
          </span>
        </div>
      </div>

      {/* Info sobre verificación */}
      <div className="vote-system__info">
        <span className="vote-system__score">
          Puntuación: <strong style={{ color: votosNetos >= 0 ? '#22c55e' : '#ef4444' }}>
            {votosNetos >= 0 ? '+' : ''}{votosNetos}
          </strong>
        </span>
        <span className="vote-system__threshold">
          {!esVerificadoComunidad && !esRechazadoComunidad && (
            <>Faltan <strong>{umbralVerificacion - Math.abs(votosNetos)}</strong> votos para verificar</>
          )}
        </span>
      </div>

      {userVote && (
        <div className="vote-system__user-vote">
          Tu voto: {userVote === 'up' ? '👍 Legítimo' : '👎 Falso'}
          <span className="vote-system__change-hint">(clic para cambiar)</span>
        </div>
      )}

      {/* Formulario de comentario para voto negativo */}
      {showCommentForm && (
        <div className="vote-system__comment-form">
          <div className="vote-system__comment-header">
            ⚠️ ¿Por qué crees que este reporte es falso?
          </div>
          <textarea
            className="vote-system__comment-input"
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            placeholder="Explica tu razón (opcional, máx. 200 caracteres)..."
            maxLength={200}
            rows={3}
          />
          <div className="vote-system__comment-actions">
            <button
              className="vote-system__comment-btn vote-system__comment-btn--cancel"
              onClick={handleCancelVote}
            >
              Cancelar
            </button>
            <button
              className="vote-system__comment-btn vote-system__comment-btn--confirm"
              onClick={handleConfirmVote}
            >
              👎 Confirmar voto
            </button>
          </div>
        </div>
      )}

      {/* Sección de comentarios */}
      {comentarios.length > 0 && (
        <div className="vote-system__comments">
          <button
            className="vote-system__comments-toggle"
            onClick={() => setMostrarComentarios(!mostrarComentarios)}
          >
            💬 {comentarios.length} comentario{comentarios.length !== 1 ? 's' : ''} de la comunidad
            <span>{mostrarComentarios ? '▲' : '▼'}</span>
          </button>

          {mostrarComentarios && (
            <div className="vote-system__comments-list">
              {comentarios.map((c, index) => (
                <div key={index} className={`vote-system__comment vote-system__comment--${c.tipo}`}>
                  <span className="vote-system__comment-icon">
                    {c.tipo === 'up' ? '👍' : '👎'}
                  </span>
                  <span className="vote-system__comment-text">{c.comentario}</span>
                  <span className="vote-system__comment-date">
                    {new Date(c.fecha).toLocaleDateString('es-ES')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {userVote && (
        <button onClick={handleRemoveVote} disabled={isLoading} className="remove-vote-btn">
          Quitar voto
        </button>
      )}

      <style>{`
        .vote-system {
          background: var(--color-gray-dark, #1a1a1a);
          border: 2px solid var(--color-gray-light, #3a3a3a);
          padding: 1rem;
          margin-top: 1rem;
        }

        .vote-system--animating {
          animation: voteShake 0.3s ease;
        }

        @keyframes voteShake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-2px); }
          75% { transform: translateX(2px); }
        }

        .vote-system__header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin-bottom: 0.75rem;
        }

        .vote-system__title {
          font-family: var(--font-stencil, 'Black Ops One', cursive);
          font-size: 0.9rem;
          color: var(--color-cream, #e0e0a0);
          letter-spacing: 1px;
        }

        .vote-system__badge {
          font-family: var(--font-mono, monospace);
          font-size: 0.7rem;
          padding: 0.25rem 0.5rem;
          font-weight: bold;
          animation: badgePulse 2s ease-in-out infinite;
        }

        .vote-system__badge--verified {
          background: linear-gradient(135deg, #22c55e, #16a34a);
          color: #000;
        }

        .vote-system__badge--rejected {
          background: linear-gradient(135deg, #ef4444, #dc2626);
          color: #fff;
        }

        @keyframes badgePulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.8; }
        }

        .vote-system__question {
          font-family: var(--font-typewriter, 'Special Elite', monospace);
          font-size: 1rem;
          color: var(--color-cream, #e0e0a0);
          margin-bottom: 1rem;
          text-align: center;
        }

        .vote-system__buttons {
          display: flex;
          gap: 1rem;
          margin-bottom: 1rem;
        }

        .vote-btn--full {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.25rem;
          padding: 0.75rem;
          background: var(--color-black, #0a0a0a);
          border: 2px solid var(--color-gray-light, #3a3a3a);
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .vote-btn--full:hover {
          transform: scale(1.02);
        }

        .vote-btn--full.vote-btn--up:hover,
        .vote-btn--full.vote-btn--up.vote-btn--active {
          border-color: #22c55e;
          background: rgba(34, 197, 94, 0.15);
          box-shadow: 0 0 15px rgba(34, 197, 94, 0.3);
        }

        .vote-btn--full.vote-btn--down:hover,
        .vote-btn--full.vote-btn--down.vote-btn--active {
          border-color: #ef4444;
          background: rgba(239, 68, 68, 0.15);
          box-shadow: 0 0 15px rgba(239, 68, 68, 0.3);
        }

        .vote-btn__icon {
          font-size: 1.5rem;
        }

        .vote-btn__label {
          font-family: var(--font-stencil, 'Black Ops One', cursive);
          font-size: 0.75rem;
          color: var(--color-cream, #e0e0a0);
          letter-spacing: 1px;
        }

        .vote-btn__count {
          font-family: var(--font-mono, monospace);
          font-size: 1.25rem;
          font-weight: bold;
          color: var(--color-cream, #e0e0a0);
        }

        .vote-btn--up .vote-btn__count { color: #22c55e; }
        .vote-btn--down .vote-btn__count { color: #ef4444; }

        .vote-system__progress {
          margin-bottom: 0.75rem;
        }

        .vote-system__progress-bar {
          display: flex;
          height: 8px;
          background: var(--color-black, #0a0a0a);
          border: 1px solid var(--color-gray-light, #3a3a3a);
          overflow: hidden;
        }

        .vote-system__progress-fill {
          transition: width 0.3s ease;
        }

        .vote-system__progress-fill--up {
          background: linear-gradient(90deg, #22c55e, #16a34a);
        }

        .vote-system__progress-fill--down {
          background: linear-gradient(90deg, #ef4444, #dc2626);
        }

        .vote-system__progress-labels {
          display: flex;
          justify-content: space-between;
          margin-top: 0.25rem;
        }

        .vote-system__progress-label {
          font-family: var(--font-mono, monospace);
          font-size: 0.7rem;
        }

        .vote-system__progress-label--up { color: #22c55e; }
        .vote-system__progress-label--down { color: #ef4444; }

        .vote-system__info {
          display: flex;
          justify-content: space-between;
          font-family: var(--font-mono, monospace);
          font-size: 0.75rem;
          color: var(--color-cream-dark, #d0d0a98);
        }

        .vote-system__user-vote {
          margin-top: 0.75rem;
          padding-top: 0.75rem;
          border-top: 1px dashed var(--color-gray-light, #3a3a3a);
          font-family: var(--font-mono, monospace);
          font-size: 0.8rem;
          color: var(--color-cream, #e0e0a0);
          text-align: center;
        }

        .vote-system__change-hint {
          opacity: 0.5;
          margin-left: 0.5rem;
          font-size: 0.7rem;
        }

        /* Formulario de comentario */
        .vote-system__comment-form {
          margin-top: 1rem;
          padding: 1rem;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid #ef4444;
        }

        .vote-system__comment-header {
          font-family: var(--font-stencil, 'Black Ops One', cursive);
          font-size: 0.85rem;
          color: #ef4444;
          margin-bottom: 0.75rem;
        }

        .vote-system__comment-input {
          width: 100%;
          background: var(--color-black, #0a0a0a);
          border: 1px solid var(--color-gray-light, #3a3a3a);
          color: var(--color-cream, #e0e0a0);
          font-family: var(--font-typewriter, 'Special Elite', monospace);
          font-size: 0.85rem;
          padding: 0.75rem;
          resize: vertical;
          min-height: 60px;
        }

        .vote-system__comment-input:focus {
          outline: none;
          border-color: #ef4444;
        }

        .vote-system__comment-actions {
          display: flex;
          gap: 0.5rem;
          margin-top: 0.75rem;
          justify-content: flex-end;
        }

        .vote-system__comment-btn {
          padding: 0.5rem 1rem;
          font-family: var(--font-mono, monospace);
          font-size: 0.8rem;
          cursor: pointer;
          border: none;
          transition: all 0.2s ease;
        }

        .vote-system__comment-btn--cancel {
          background: var(--color-gray-dark, #1a1a1a);
          border: 1px solid var(--color-gray-light, #3a3a3a);
          color: var(--color-cream, #e0e0a0);
        }

        .vote-system__comment-btn--cancel:hover {
          background: var(--color-gray-light, #3a3a3a);
        }

        .vote-system__comment-btn--confirm {
          background: #ef4444;
          color: #fff;
        }

        .vote-system__comment-btn--confirm:hover {
          background: #dc2626;
        }

        /* Sección de comentarios */
        .vote-system__comments {
          margin-top: 1rem;
          border-top: 1px dashed var(--color-gray-light, #3a3a3a);
          padding-top: 0.75rem;
        }

        .vote-system__comments-toggle {
          width: 100%;
          background: transparent;
          border: none;
          color: var(--color-cream, #e0e0a0);
          font-family: var(--font-mono, monospace);
          font-size: 0.8rem;
          cursor: pointer;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.5rem;
          transition: background 0.2s ease;
        }

        .vote-system__comments-toggle:hover {
          background: rgba(255, 255, 255, 0.05);
        }

        .vote-system__comments-list {
          margin-top: 0.75rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          max-height: 200px;
          overflow-y: auto;
        }

        .vote-system__comment {
          display: flex;
          align-items: flex-start;
          gap: 0.5rem;
          padding: 0.5rem;
          background: var(--color-black, #0a0a0a);
          font-size: 0.8rem;
        }

        .vote-system__comment--up {
          border-left: 2px solid #22c55e;
        }

        .vote-system__comment--down {
          border-left: 2px solid #ef4444;
        }

        .vote-system__comment-icon {
          flex-shrink: 0;
        }

        .vote-system__comment-text {
          flex: 1;
          color: var(--color-cream, #e0e0a0);
          font-family: var(--font-typewriter, 'Special Elite', monospace);
        }

        .vote-system__comment-date {
          flex-shrink: 0;
          font-family: var(--font-mono, monospace);
          font-size: 0.65rem;
          opacity: 0.5;
        }

        /* Estados de carga y error */
        .vote-btn--loading {
          opacity: 0.7;
          cursor: wait;
        }

        .vote-system__error {
          background: rgba(239, 68, 68, 0.2);
          border: 1px solid #ef4444;
          color: #fca5a5;
          padding: 0.5rem 0.75rem;
          font-family: var(--font-mono, monospace);
          font-size: 0.8rem;
          margin-top: 0.5rem;
          text-align: center;
        }

        @media (max-width: 480px) {
          .vote-system__buttons {
            flex-direction: column;
          }

          .vote-system__header {
            flex-direction: column;
            text-align: center;
          }

          .vote-system__info {
            flex-direction: column;
            gap: 0.25rem;
            text-align: center;
          }

          .vote-system__comment-actions {
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
};

export default VoteSystem;
