import React, { useEffect, useMemo, useState } from 'react';

/**
 * VoteSystem - Verificacion comunitaria por reporte.
 * - Persiste votos contra WordPress via onVote (async)
 * - Requiere motivo para marcar un reporte como falso
 */
const VoteSystem = ({
  reporteId,
  votos: votosIniciales = { up: 0, down: 0, comentarios: [] },
  onVote,
  umbralVerificacion = 5,
  compact = false,
  userVote: userVoteProp = null,
}) => {
  const [error, setError] = useState('');
  const [showFalseReasonForm, setShowFalseReasonForm] = useState(false);
  const [falseReason, setFalseReason] = useState('');
  const [falseReporterName, setFalseReporterName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [userVote, setUserVote] = useState(userVoteProp);
  const [votos, setVotos] = useState(votosIniciales);

  useEffect(() => {
    setVotos(votosIniciales || { up: 0, down: 0, comentarios: [] });
  }, [votosIniciales]);

  useEffect(() => {
    setUserVote(userVoteProp || null);
  }, [userVoteProp]);

  const comentarios = Array.isArray(votos?.comentarios) ? votos.comentarios : [];
  const votosNetos = Number(votos?.up || 0) - Number(votos?.down || 0);
  const total = Number(votos?.up || 0) + Number(votos?.down || 0);
  const porcentajePositivo = total > 0 ? Math.round((Number(votos?.up || 0) / total) * 100) : 0;
  const esVerificadoComunidad = votosNetos >= umbralVerificacion;
  const esRechazadoComunidad = votosNetos <= -umbralVerificacion;

  const statusText = useMemo(() => {
    if (esVerificadoComunidad) return '✅ VERIFICADO POR LA COMUNIDAD';
    if (esRechazadoComunidad) return '❌ RECHAZADO POR LA COMUNIDAD';
    return '';
  }, [esVerificadoComunidad, esRechazadoComunidad]);

  const submitVote = async ({ voteType, reason = '', voterName = '' }) => {
    if (isLoading || typeof onVote !== 'function') return;

    setError('');
    setIsLoading(true);

    try {
      const result = await onVote(reporteId, { voteType, reason, voterName });
      if (result?.votos) {
        setVotos(result.votos);
      }
      setUserVote(result?.userVote || voteType);
      setShowFalseReasonForm(false);
      setFalseReason('');
      setFalseReporterName('');
    } catch (err) {
      setError(err?.message || 'No se pudo registrar tu voto en este momento.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLegitVote = () => {
    submitVote({ voteType: 'up' });
  };

  const handleFalseVoteClick = () => {
    setError('');

    if (compact) {
      const promptReason = window.prompt('Explica por qué este reporte es falso (minimo 8 caracteres):', '');
      if (promptReason === null) return;
      const trimmed = String(promptReason || '').trim();
      if (trimmed.length < 8) {
        setError('Debes indicar un motivo valido (minimo 8 caracteres).');
        return;
      }
      const promptName = window.prompt('Indica tu nombre para confirmar este reporte como falso:', '');
      if (promptName === null) return;
      const trimmedName = String(promptName || '').trim();
      if (trimmedName.length < 2) {
        setError('Debes indicar tu nombre (minimo 2 caracteres).');
        return;
      }
      submitVote({ voteType: 'down', reason: trimmed, voterName: trimmedName });
      return;
    }

    setShowFalseReasonForm(true);
  };

  const confirmFalseVote = () => {
    const trimmed = String(falseReason || '').trim();
    const trimmedName = String(falseReporterName || '').trim();
    if (trimmed.length < 8) {
      setError('Debes indicar un motivo valido (minimo 8 caracteres).');
      return;
    }
    if (trimmedName.length < 2) {
      setError('Debes indicar el nombre de quien confirma el reporte falso.');
      return;
    }
    submitVote({ voteType: 'down', reason: trimmed, voterName: trimmedName });
  };

  if (compact) {
    return (
      <div className="vote-system vote-system--compact">
        <button
          className={`vote-btn vote-btn--up ${userVote === 'up' ? 'vote-btn--active' : ''} ${isLoading ? 'vote-btn--loading' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            handleLegitVote();
          }}
          aria-label="Votar como legitimo"
          title="Es legitimo"
          disabled={isLoading}
        >
          {isLoading ? '⏳' : '👍'} {Number(votos?.up || 0)}
        </button>

        <button
          className={`vote-btn vote-btn--down ${userVote === 'down' ? 'vote-btn--active' : ''} ${isLoading ? 'vote-btn--loading' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            handleFalseVoteClick();
          }}
          aria-label="Votar como falso"
          title="Es falso"
          disabled={isLoading}
        >
          {isLoading ? '⏳' : '👎'} {Number(votos?.down || 0)}
        </button>

        {error && <div className="vote-system__error">⚠️ {error}</div>}

        <style>{`
          .vote-system--compact {
            display: flex;
            gap: 0.5rem;
            margin-top: 0.5rem;
            align-items: center;
            flex-wrap: wrap;
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

  return (
    <div className="vote-system">
      <div className="vote-system__header">
        <span className="vote-system__title">🗳️ VERIFICACION COMUNITARIA</span>
        {statusText && (
          <span className={`vote-system__badge ${esVerificadoComunidad ? 'vote-system__badge--verified' : 'vote-system__badge--rejected'}`}>
            {statusText}
          </span>
        )}
      </div>

      <div className="vote-system__question">¿Este reporte es legitimo?</div>

      <div className="vote-system__buttons">
        <button
          className={`vote-btn vote-btn--full vote-btn--up ${userVote === 'up' ? 'vote-btn--active' : ''} ${isLoading ? 'vote-btn--loading' : ''}`}
          onClick={handleLegitVote}
          aria-label="Votar como legitimo"
          disabled={isLoading}
        >
          <span className="vote-btn__icon">{isLoading ? '⏳' : '👍'}</span>
          <span className="vote-btn__label">SI, ES LEGITIMO</span>
          <span className="vote-btn__count">{Number(votos?.up || 0)}</span>
        </button>

        <button
          className={`vote-btn vote-btn--full vote-btn--down ${userVote === 'down' ? 'vote-btn--active' : ''} ${isLoading ? 'vote-btn--loading' : ''}`}
          onClick={handleFalseVoteClick}
          aria-label="Votar como falso"
          disabled={isLoading}
        >
          <span className="vote-btn__icon">{isLoading ? '⏳' : '👎'}</span>
          <span className="vote-btn__label">NO, ES FALSO</span>
          <span className="vote-btn__count">{Number(votos?.down || 0)}</span>
        </button>
      </div>

      {showFalseReasonForm && (
        <div className="vote-system__comment-form">
          <div className="vote-system__comment-header">⚠️ Explica por que consideras que este reporte es falso</div>
          <input
            className="vote-system__comment-input"
            value={falseReporterName}
            onChange={(e) => setFalseReporterName(e.target.value)}
            placeholder="Tu nombre (obligatorio)"
            maxLength={80}
            style={{ marginBottom: '0.6rem' }}
          />
          <textarea
            className="vote-system__comment-input"
            value={falseReason}
            onChange={(e) => setFalseReason(e.target.value)}
            placeholder="Detalla el motivo (minimo 8 caracteres)..."
            maxLength={500}
            rows={4}
          />
          <div className="vote-system__comment-actions">
            <button
              className="vote-system__comment-btn vote-system__comment-btn--cancel"
              onClick={() => {
                setShowFalseReasonForm(false);
                setFalseReason('');
                setFalseReporterName('');
                setError('');
              }}
              disabled={isLoading}
            >
              Cancelar
            </button>
            <button
              className="vote-system__comment-btn vote-system__comment-btn--confirm"
              onClick={confirmFalseVote}
              disabled={isLoading}
            >
              {isLoading ? '⏳ Guardando...' : '👎 Confirmar voto falso'}
            </button>
          </div>
        </div>
      )}

      {error && <div className="vote-system__error">⚠️ {error}</div>}

      <div className="vote-system__progress">
        <div className="vote-system__progress-bar">
          <div className="vote-system__progress-fill vote-system__progress-fill--up" style={{ width: `${porcentajePositivo}%` }} />
          <div className="vote-system__progress-fill vote-system__progress-fill--down" style={{ width: `${100 - porcentajePositivo}%` }} />
        </div>
        <div className="vote-system__progress-labels">
          <span className="vote-system__progress-label vote-system__progress-label--up">{porcentajePositivo}% legitimo</span>
          <span className="vote-system__progress-label vote-system__progress-label--down">{100 - porcentajePositivo}% falso</span>
        </div>
      </div>

      <div className="vote-system__info">
        <span className="vote-system__score">
          Puntuacion: <strong style={{ color: votosNetos >= 0 ? '#22c55e' : '#ef4444' }}>{votosNetos >= 0 ? '+' : ''}{votosNetos}</strong>
        </span>
        {!esVerificadoComunidad && !esRechazadoComunidad && (
          <span className="vote-system__threshold">Faltan <strong>{Math.max(0, umbralVerificacion - Math.abs(votosNetos))}</strong> votos para definir estado</span>
        )}
      </div>

      {userVote && (
        <div className="vote-system__user-vote">Tu voto actual: {userVote === 'up' ? '👍 Legitimo' : '👎 Falso'}</div>
      )}

      {comentarios.length > 0 && (
        <div className="vote-system__comments">
          <div className="vote-system__comments-title">
            💬 {comentarios.length} motivo{comentarios.length !== 1 ? 's' : ''} de voto falso
          </div>
          <div className="vote-system__comments-list">
            {comentarios.map((item, index) => (
              <div key={`${item.fecha || 'f'}-${index}`} className={`vote-system__comment vote-system__comment--${item.tipo || 'down'}`}>
                <span className="vote-system__comment-icon">{item.tipo === 'up' ? '👍' : '👎'}</span>
                <div className="vote-system__comment-text">
                  <div>{item.comentario}</div>
                  <div className="vote-system__comment-author">por {item.autor || 'Comunidad'}</div>
                </div>
                <span className="vote-system__comment-date">{new Date(item.fecha || Date.now()).toLocaleDateString('es-ES')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`
        .vote-system {
          background: var(--color-gray-dark, #1a1a1a);
          border: 2px solid var(--color-gray-light, #3a3a3a);
          padding: 1rem;
          margin-top: 1rem;
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
        }

        .vote-system__badge--verified {
          background: linear-gradient(135deg, #22c55e, #16a34a);
          color: #000;
        }

        .vote-system__badge--rejected {
          background: linear-gradient(135deg, #ef4444, #dc2626);
          color: #fff;
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

        .vote-system__comment-form {
          margin-top: 0.25rem;
          margin-bottom: 1rem;
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

        .vote-system__comment-btn--confirm {
          background: #ef4444;
          color: #fff;
        }

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
          color: var(--color-cream-dark, #d0d0a9);
          gap: 0.5rem;
          flex-wrap: wrap;
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

        .vote-system__comments {
          margin-top: 1rem;
          border-top: 1px dashed var(--color-gray-light, #3a3a3a);
          padding-top: 0.75rem;
        }

        .vote-system__comments-title {
          width: 100%;
          color: var(--color-cream, #e0e0a0);
          font-family: var(--font-mono, monospace);
          font-size: 0.82rem;
          padding: 0.5rem;
        }

        .vote-system__comments-list {
          margin-top: 0.75rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          max-height: 220px;
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

        .vote-system__comment-author {
          opacity: 0.7;
          margin-top: 0.25rem;
          font-size: 0.75rem;
          font-family: var(--font-mono, monospace);
        }

        .vote-system__comment-date {
          flex-shrink: 0;
          font-family: var(--font-mono, monospace);
          font-size: 0.65rem;
          opacity: 0.5;
        }

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
