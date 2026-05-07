import React from 'react';

// Emoji indicador de severidad (reemplaza los puntos difíciles de leer)
const PUNTAJE_EMOJI = {
  1: '🟢',
  2: '🟡',
  3: '🟠',
  4: '🔴',
  5: '☠️',
};

export default function EtiquetasSelector({ categorias, etiquetas, setFieldValue, tiposEtiquetas, disabled }) {
  if (!categorias.length) return null;

  const grupos = categorias
    .map(cat => tiposEtiquetas.find(t => t.key === cat))
    .filter(Boolean);

  if (!grupos.length) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {grupos.map(tipo => (
        <div key={tipo.key}>
          {/* Cabecera del grupo */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            marginBottom: '0.45rem',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.72rem',
            letterSpacing: '0.02em',
            color: tipo.color,
            opacity: 0.8,
          }}>
            <span>{tipo.emoji}</span>
            <span>{tipo.nombre}</span>
          </div>

          {/* Chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {tipo.etiquetas.map(etiquetaObj => {
              const isActive = etiquetas.includes(etiquetaObj.nombre);
              const severityEmoji = PUNTAJE_EMOJI[etiquetaObj.puntaje] || '🟢';

              return (
                <button
                  type="button"
                  key={etiquetaObj.nombre}
                  onClick={() => {
                    if (disabled) return;
                    const nuevas = isActive
                      ? etiquetas.filter(e => e !== etiquetaObj.nombre)
                      : [...etiquetas, etiquetaObj.nombre];
                    setFieldValue('labels', nuevas);
                  }}
                  disabled={disabled}
                  aria-pressed={isActive}
                  title={`Severidad: ${etiquetaObj.puntaje}/5`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.32em 0.75em',
                    border: `1px solid ${isActive ? tipo.color : '#2e2e2e'}`,
                    borderRadius: '5px',
                    background: isActive ? `${tipo.color}20` : 'rgba(255,255,255,0.03)',
                    color: isActive ? '#ff5252' : '#cacaca',
                    fontFamily: 'var(--font-typewriter)',
                    fontSize: '0.82rem',
                    fontWeight: isActive ? 500 : 400,
                    letterSpacing: '0.01em',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    opacity: disabled ? 0.45 : 1,
                    transition: 'border-color 0.15s, background 0.15s, color 0.15s',
                    whiteSpace: 'nowrap',
                    userSelect: 'none',
                    boxShadow: isActive ? `0 0 6px ${tipo.color}44` : 'none',
                  }}
                >
                  <span style={{ fontSize: '0.72rem', lineHeight: 1 }}>{severityEmoji}</span>
                  {etiquetaObj.nombre}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* Resumen de seleccionadas */}
      {etiquetas.length > 0 && (
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.71rem',
          color: 'var(--color-text-muted)',
          borderTop: '1px dashed rgba(255,255,255,0.1)',
          paddingTop: '0.5rem',
          lineHeight: 1.8,
        }}>
          {etiquetas.map(e => (
            <span key={e} style={{ marginRight: '0.45rem', color: 'rgba(200,200,200,0.55)', letterSpacing: '0.01em' }}>#{e}</span>
          ))}
        </div>
      )}
    </div>
  );
}
