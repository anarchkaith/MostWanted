import React, { useCallback } from 'react';

const TipoInfraccionSelector = ({ value, onChange, options, disabled }) => {
  const toggleTipo = (tipoKey) => {
    if (disabled) return;
    const selected = Array.isArray(value) ? value : [];
    const isActive = selected.includes(tipoKey);
    onChange(isActive ? selected.filter(i => i !== tipoKey) : [...selected, tipoKey]);
  };

  const handleMouseMove = useCallback((e) => {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const dx = (e.clientX - rect.left - rect.width / 2) / (rect.width / 2);
    const dy = (e.clientY - rect.top - rect.height / 2) / (rect.height / 2);
    el.style.setProperty('--rx', `${-dy * 9}deg`);
    el.style.setProperty('--ry', `${dx * 9}deg`);
    el.style.setProperty('--mx', `${((e.clientX - rect.left) / rect.width) * 100}%`);
    el.style.setProperty('--my', `${((e.clientY - rect.top) / rect.height) * 100}%`);
  }, []);

  const handleMouseLeave = useCallback((e) => {
    const el = e.currentTarget;
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');
  }, []);

  return (
    <div className="tipo-card-grid" role="group" aria-label="Tipos de infraccion">
      {options.map((tipo) => {
        const isActive = Array.isArray(value) && value.includes(tipo.key);
        return (
          <button
            key={tipo.key}
            type="button"
            aria-pressed={isActive}
            onClick={() => toggleTipo(tipo.key)}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            disabled={disabled}
            className={`tipo-card${isActive ? ' tipo-card--active' : ''}`}
          >
            <span className="tipo-card__icon" aria-hidden="true">{tipo.emoji}</span>
            <span className="tipo-card__name">{tipo.nombre}</span>
          </button>
        );
      })}

      <style>{`
        .tipo-card-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
          gap: 0.8rem;
        }

        .tipo-card {
          --rx: 0deg;
          --ry: 0deg;
          --mx: 50%;
          --my: 50%;

          min-height: 128px;
          border: 1px solid rgba(255, 255, 255, 0.16);
          background: linear-gradient(165deg, rgba(18, 18, 18, 0.95) 10%, rgba(7, 7, 7, 0.98) 80%);
          color: var(--color-cream, #e8e8b8);
          cursor: pointer;
          padding: 0.9rem 0.6rem;
          border-radius: 10px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0.55rem;
          transition: transform 0.55s ease, box-shadow 0.25s ease, border-color 0.22s ease;
          position: relative;
          overflow: hidden;
          transform-style: preserve-3d;
          transform: perspective(700px) rotateX(var(--rx)) rotateY(var(--ry));
        }

        /* Scanline sweep on hover */
        .tipo-card::before {
          content: '';
          position: absolute;
          left: 0; right: 0;
          height: 40%;
          top: -40%;
          background: linear-gradient(
            to bottom,
            transparent,
            rgba(0, 255, 255, 0.09) 50%,
            transparent
          );
          pointer-events: none;
          border-radius: inherit;
        }

        .tipo-card:hover::before {
          animation: tcScan 0.95s cubic-bezier(0.4, 0, 0.6, 1) forwards;
        }

        @keyframes tcScan {
          0%   { top: -40%; opacity: 1; }
          100% { top: 140%; opacity: 0; }
        }

        /* Cursor spotlight */
        .tipo-card::after {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(
            circle at var(--mx) var(--my),
            rgba(0, 255, 255, 0.2) 0%,
            rgba(0, 255, 255, 0.05) 38%,
            transparent 62%
          );
          opacity: 0;
          transition: opacity 0.22s;
          pointer-events: none;
          border-radius: inherit;
        }

        .tipo-card:hover::after {
          opacity: 1;
        }

        .tipo-card:hover {
          border-color: rgba(0, 255, 255, 0.5);
          box-shadow: 0 10px 32px rgba(0, 0, 0, 0.5), 0 0 16px rgba(0, 255, 255, 0.14);
        }

        .tipo-card:disabled {
          opacity: 0.55;
          cursor: not-allowed;
          transform: none !important;
          box-shadow: none;
        }

        .tipo-card--active {
          border-color: rgba(255, 51, 51, 0.8);
          background: linear-gradient(165deg, rgba(28, 8, 8, 0.95) 10%, rgba(10, 4, 4, 0.98) 80%);
          box-shadow: 0 0 18px rgba(255, 51, 51, 0.22), inset 0 0 0 1px rgba(255, 51, 51, 0.18);
        }

        .tipo-card--active::after {
          background: radial-gradient(
            circle at var(--mx) var(--my),
            rgba(255, 80, 80, 0.2) 0%,
            rgba(255, 51, 51, 0.05) 38%,
            transparent 62%
          );
        }

        .tipo-card--active:hover {
          border-color: rgba(255, 51, 51, 0.95);
          box-shadow: 0 10px 32px rgba(0, 0, 0, 0.55), 0 0 22px rgba(255, 51, 51, 0.28);
        }

        .tipo-card__icon {
          font-size: 2.05rem;
          line-height: 1;
          transform: translateZ(20px);
          filter: drop-shadow(0 0 6px rgba(255, 255, 255, 0.15));
          transition: filter 0.22s, transform 0.22s;
        }

        .tipo-card:hover .tipo-card__icon {
          filter: drop-shadow(0 0 12px rgba(0, 255, 255, 0.5));
          transform: translateZ(28px) scale(1.08);
        }

        .tipo-card--active .tipo-card__icon {
          filter: drop-shadow(0 0 10px rgba(255, 100, 100, 0.5));
        }

        .tipo-card--active:hover .tipo-card__icon {
          filter: drop-shadow(0 0 14px rgba(255, 80, 80, 0.65));
          transform: translateZ(28px) scale(1.08);
        }

        .tipo-card__name {
          font-family: var(--font-stencil);
          font-size: 0.76rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          text-align: center;
          line-height: 1.2;
          max-width: 95%;
          transform: translateZ(8px);
        }

        @media (max-width: 520px) {
          .tipo-card-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .tipo-card { min-height: 115px; }
          .tipo-card__icon { font-size: 1.85rem; }
        }
      `}</style>
    </div>
  );
};

export default TipoInfraccionSelector;
