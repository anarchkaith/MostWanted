/**
 * Rate limiter in-memory para protección contra DDoS.
 * Implementa ventana deslizante por IP sin dependencias externas.
 */

/** @typedef {{ timestamps: number[], blocked: boolean, blockedUntil: number }} IpRecord */

/** @type {Map<string, IpRecord>} */
const store = new Map();

// Limpiar IPs inactivas cada 5 minutos para evitar memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of store.entries()) {
    const isExpiredBlock = record.blocked && now > record.blockedUntil;
    const isInactive = record.timestamps.length === 0;
    if (isExpiredBlock || isInactive) {
      store.delete(ip);
    }
  }
}, 5 * 60 * 1000);

/**
 * Obtiene la IP real del cliente considerando proxies.
 * @param {import('express').Request} req
 * @returns {string}
 */
function resolveClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    const first = forwarded.split(',')[0].trim();
    if (first) return first;
  }
  return req.socket?.remoteAddress || req.ip || 'unknown';
}

/**
 * Crea un middleware de rate limiting con ventana deslizante.
 *
 * @param {object} options
 * @param {number} options.windowMs       - Tamaño de la ventana en ms
 * @param {number} options.max            - Máximo de requests por ventana
 * @param {number} [options.blockMs]      - Tiempo de bloqueo al superar el límite (default: windowMs)
 * @param {string} [options.message]      - Mensaje de error para el cliente
 * @param {boolean} [options.skipWhenDebug] - Omitir el limitador cuando DEBUG_MODE=true
 * @returns {import('express').RequestHandler}
 */
export function createRateLimiter({ windowMs, max, blockMs, message, skipWhenDebug = false }) {
  const blockDuration = blockMs ?? windowMs;
  const defaultMessage = message ?? 'Demasiadas solicitudes. Por favor espera un momento antes de continuar.';

  return function rateLimiterMiddleware(req, res, next) {
    if (skipWhenDebug && process.env.DEBUG_MODE === 'true') {
      return next();
    }

    const ip = resolveClientIp(req);
    const now = Date.now();

    let record = store.get(ip);

    if (!record) {
      record = { timestamps: [], blocked: false, blockedUntil: 0 };
      store.set(ip, record);
    }

    // Si está bloqueado, comprobar si ya expiró
    if (record.blocked) {
      if (now < record.blockedUntil) {
        const retryAfterSecs = Math.ceil((record.blockedUntil - now) / 1000);
        res.set('Retry-After', String(retryAfterSecs));
        res.set('X-RateLimit-Limit', String(max));
        res.set('X-RateLimit-Remaining', '0');
        res.set('X-RateLimit-Reset', String(Math.ceil(record.blockedUntil / 1000)));
        return res.status(429).json({
          error: defaultMessage,
          retryAfterSeconds: retryAfterSecs,
          rateLimited: true,
        });
      }

      // Bloqueo expirado: limpiar estado
      record.blocked = false;
      record.blockedUntil = 0;
      record.timestamps = [];
    }

    // Descartar timestamps fuera de la ventana
    record.timestamps = record.timestamps.filter((ts) => now - ts < windowMs);

    if (record.timestamps.length >= max) {
      // Activar bloqueo
      record.blocked = true;
      record.blockedUntil = now + blockDuration;
      record.timestamps = [];

      const retryAfterSecs = Math.ceil(blockDuration / 1000);
      res.set('Retry-After', String(retryAfterSecs));
      res.set('X-RateLimit-Limit', String(max));
      res.set('X-RateLimit-Remaining', '0');
      res.set('X-RateLimit-Reset', String(Math.ceil(record.blockedUntil / 1000)));
      return res.status(429).json({
        error: defaultMessage,
        retryAfterSeconds: retryAfterSecs,
        rateLimited: true,
      });
    }

    // Registrar timestamp actual
    record.timestamps.push(now);

    const remaining = max - record.timestamps.length;
    res.set('X-RateLimit-Limit', String(max));
    res.set('X-RateLimit-Remaining', String(remaining));

    return next();
  };
}

/**
 * Límites predefinidos por tipo de endpoint.
 */
export const RATE_LIMITS = {
  /** Endpoints de IA: costosos en cómputo, más restrictivos */
  ai: createRateLimiter({
    windowMs: 60 * 1000,  // 1 minuto
    max: 15,               // 15 requests/min por IP
    blockMs: 2 * 60 * 1000, // bloqueo 2 min al superarlo
    message: 'Límite de consultas IA alcanzado. Espera un momento antes de continuar.',
  }),

  /** Endpoints de intención: más ligeros, algo más permisivos */
  intent: createRateLimiter({
    windowMs: 60 * 1000,  // 1 minuto
    max: 25,               // 25 requests/min por IP
    blockMs: 90 * 1000,    // bloqueo 90s
    message: 'Demasiadas consultas seguidas. Espera unos segundos.',
  }),

  /** Uso general: estático/API de datos */
  general: createRateLimiter({
    windowMs: 60 * 1000,  // 1 minuto
    max: 60,               // 60 requests/min por IP
    blockMs: 60 * 1000,    // bloqueo 1 min
    message: 'Demasiadas solicitudes. Por favor espera un momento.',
  }),

  /** Webhook de Discord: enviar reportes — muy restrictivo para evitar spam */
  webhook: createRateLimiter({
    windowMs: 5 * 60 * 1000, // ventana de 5 minutos
    max: 5,                   // máximo 5 reportes por ventana por IP
    blockMs: 15 * 60 * 1000, // bloqueo de 15 minutos al superarlo
    message: 'Has enviado demasiados reportes. Aguarda 15 minutos antes de continuar.',
    skipWhenDebug: true,
  }),
};
