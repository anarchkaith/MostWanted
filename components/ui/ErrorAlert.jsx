import CyberButtonLabel from './CyberButtonLabel';

const ERROR_MESSAGES = {
  'reports_source_unavailable': {
    title: 'Fuente de reportes no disponible',
    message: 'No pudimos cargar los reportes en este momento. Por favor, intenta de nuevo.',
    icon: '⚠️',
  },
  'wordpress_source_not_configured': {
    title: 'Sistema de reportes no configurado',
    message: 'El servicio de reportes no está disponible. Contacta al administrador.',
    icon: '⚙️',
  },
  'wordpress_source_404': {
    title: 'Jugador no encontrado',
    message: 'No se pudo obtener la información de este jugador. Verifica el nombre o RID.',
    icon: '🔍',
  },
  'player_identity_required': {
    title: 'Información incompleta',
    message: 'Se necesita un nombre o RID para buscar reportes.',
    icon: '❓',
  },
};

function getErrorMessage(error) {
  if (!error || error === '') return null;

  const errorKey = error.toLowerCase();
  
  if (ERROR_MESSAGES[errorKey]) {
    return ERROR_MESSAGES[errorKey];
  }

  if (errorKey.includes('404') || errorKey.includes('http 404')) {
    return {
      title: 'Información no disponible',
      message: 'No se pudo obtener los datos del servidor (Error 404).',
      icon: '🔍',
    };
  }

  if (errorKey.includes('http')) {
    return {
      title: 'Error de conexión',
      message: `No se pudo conectar con el servidor. ${error}`,
      icon: '🌐',
    };
  }

  return {
    title: 'Error al cargar los datos',
    message: error || 'Ocurrió un error inesperado.',
    icon: '⚠️',
  };
}

export default function ErrorAlert({ error, onRetry, retryLabel = 'Reintentar' }) {
  if (!error) return null;

  const errorInfo = getErrorMessage(error);
  
  return (
    <div className="error-alert" role="alert" aria-live="polite">
      <div className="error-alert__header">
        <span className="error-alert__icon">{errorInfo.icon}</span>
        <h3 className="error-alert__title">{errorInfo.title}</h3>
      </div>
      <p className="error-alert__message">{errorInfo.message}</p>
      {onRetry && (
        <button 
          type="button" 
          className="error-alert__retry cyber-button-small mw-cyber-button mw-cyber-button--secondary"
          onClick={onRetry}
          title={retryLabel}
          aria-label={retryLabel}
        >
          <CyberButtonLabel>{retryLabel}</CyberButtonLabel>
        </button>
      )}
    </div>
  );
}
