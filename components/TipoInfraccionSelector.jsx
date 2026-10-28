import SpecialTextContent from './ui/SpecialTextContent';

const TipoInfraccionSelector = ({ value, onChange, options, disabled }) => {
  const selected = Array.isArray(value) ? value : [];

  return (
    <div className="tipo-card-grid" role="group" aria-label="Tipos de infraccion">
      {options.map((tipo) => {
        const isActive = selected.includes(tipo.key);
        return (
          <button
            key={tipo.key}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(isActive ? selected.filter((item) => item !== tipo.key) : [...selected, tipo.key])}
            disabled={disabled}
            className={`tipo-card cyber-tile mw-cyber-tile${isActive ? ' tipo-card--active' : ''}`}
          >
            <span className="tipo-card__icon" aria-hidden="true">{tipo.emoji}</span>
            <span className="tipo-card__name"><SpecialTextContent>{tipo.nombre}</SpecialTextContent></span>
            <span className="tipo-card__check" aria-hidden="true">{isActive ? '✓' : '+'}</span>
          </button>
        );
      })}
    </div>
  );
};

export default TipoInfraccionSelector;
