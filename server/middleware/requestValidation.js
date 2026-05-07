/**
 * Valida que el body sea un objeto no-array.
 * @param {{ allowEmpty?: boolean, message?: string }} opts
 */
export function requireObjectBody({ allowEmpty = false, message } = {}) {
  const errorMsg = message || 'El cuerpo de la peticion es invalido.';
  return function (req, res, next) {
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return res.status(400).json({ error: errorMsg });
    }
    if (!allowEmpty && Object.keys(body).length === 0) {
      return res.status(400).json({ error: errorMsg });
    }
    return next();
  };
}

/**
 * Mapea errores upstream (timeout / red) a una respuesta unificada 502.
 * @param {Error} error
 * @param {string} timeoutMessage
 * @param {string} fallbackMessage
 */
export function mapUpstreamError(error, timeoutMessage, fallbackMessage) {
  const isTimeout = error instanceof Error && error.name === 'TimeoutError';
  return {
    status: 502,
    payload: {
      error: isTimeout ? timeoutMessage : fallbackMessage,
      details: error instanceof Error ? error.message : 'fallo desconocido',
    },
  };
}
