const PUNTAJE_EMOJI = { 1: '🟢', 2: '🟡', 3: '🟠', 4: '🔴', 5: '☠️' };

export default function EtiquetasSelector({ categorias, etiquetas, setFieldValue, tiposEtiquetas, disabled }) {
  const grupos = categorias.map((cat) => tiposEtiquetas.find((tipo) => tipo.key === cat)).filter(Boolean);
  if (!grupos.length) return null;

  return (
    <div className="threat-labels">
      {grupos.map((tipo) => (
        <div key={tipo.key}>
          <h4 className="threat-labels__heading">{tipo.emoji} {tipo.nombre}</h4>
          <div className="threat-labels__options">
            {tipo.etiquetas.map((etiqueta) => {
              const isActive = etiquetas.includes(etiqueta.nombre);
              return (
                <button
                  type="button"
                  className="threat-label"
                  key={etiqueta.nombre}
                  disabled={disabled}
                  aria-pressed={isActive}
                  title={`Severidad: ${etiqueta.puntaje}/5`}
                  onClick={() => setFieldValue('labels', isActive
                    ? etiquetas.filter((item) => item !== etiqueta.nombre)
                    : [...etiquetas, etiqueta.nombre])}
                >
                  <span aria-hidden="true">{PUNTAJE_EMOJI[etiqueta.puntaje] || '🟢'}</span>
                  {etiqueta.nombre}
                  {isActive && <span aria-hidden="true">✓</span>}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {etiquetas.length > 0 && (
        <p className="threat-labels__summary" aria-live="polite">{etiquetas.length} etiqueta(s) seleccionada(s)</p>
      )}
    </div>
  );
}
