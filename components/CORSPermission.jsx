const DEFAULT_CORS_PERMISSION_URL = 'https://cors-anywhere.herokuapp.com/https://mostwanted.kaithsrebels.com/';

export default function CORSPermission({
  href = DEFAULT_CORS_PERMISSION_URL,
  variant = 'inline',
  open = true,
  onClose = null,
}) {
  if (variant === 'modal') {
    if (!open) return null;

    return (
      <div className="modal-overlay" style={{ zIndex: 3100 }} onClick={onClose || undefined}>
        <div
          className="modal"
          style={{ maxWidth: 480 }}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="modal__header">
            <span className="modal__title">Permiso CORS requerido</span>
            <button
              className="modal__close"
              onClick={onClose || undefined}
              aria-label="Cerrar aviso de CORS"
              type="button"
            >
              ✕
            </button>
          </div>
          <div className="modal__body" style={{ color: 'var(--color-cream, #f4eada)' }}>
            <p style={{ marginTop: 0 }}>
              No se pudieron cargar los avatares porque el proxy de CORS no esta habilitado.
            </p>
            <p>
              Abre CORS Anywhere y activa el acceso para continuar viendo los avatares del jugador.
            </p>
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="modal__share-btn"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: '0.35rem',
                textDecoration: 'none',
                '--accent': '#9efeff',
              }}
            >
              Habilitar CORS
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        border: '1px solid rgba(255, 102, 102, 0.45)',
        background: 'linear-gradient(180deg, rgba(255, 72, 72, 0.12), rgba(20, 10, 10, 0.92))',
        color: '#ffd4d4',
        borderRadius: 6,
        padding: '0.6rem 0.7rem',
        fontFamily: 'var(--font-mono, Courier New, monospace)',
        fontSize: '0.74rem',
        lineHeight: 1.45,
      }}
    >
      Necesita permisos de CORS para visualizar los avatares. Activa el proxy en{' '}
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          color: '#9efeff',
          textDecoration: 'underline',
          textUnderlineOffset: '0.15rem',
        }}
      >
        CORS Anywhere
      </a>
      .
    </div>
  );
}