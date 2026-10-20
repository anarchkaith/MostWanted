import { executeChatUseCase } from '../../../ai/usecases/chat.js';
import { executeIntentUseCase } from '../../../ai/usecases/intent.js';
import { executeReportCorrelationUseCase } from '../../../ai/usecases/reportCorrelation.js';
import { hasAiProvider } from '../../../ai/client.js';
import { AI_DAILY_QUOTA_PER_USER, consumeAiDailyQuota } from '../../../ai/dailyQuota.js';

/**
 * Exige sesión de Discord: la cuota diaria se lleva por usuario.
 */
function requireAiSession(req, res, next) {
  if (!req.session?.authUser?.id) {
    return res.status(401).json({
      error: 'Inicia sesión con Discord para usar el asistente IA.',
    });
  }
  return next();
}

/**
 * Descuenta una consulta de la cuota diaria del usuario autenticado.
 */
function enforceAiDailyQuota(req, res, next) {
  const quota = consumeAiDailyQuota(String(req.session.authUser.id));
  res.set('X-AI-Quota-Limit', String(quota.limit));
  res.set('X-AI-Quota-Remaining', String(quota.remaining));
  if (!quota.allowed) {
    return res.status(429).json({
      error: `Alcanzaste el límite de ${AI_DAILY_QUOTA_PER_USER} consultas HEX por día. Se reinicia a medianoche (hora de Buenos Aires).`,
      quota: { limit: quota.limit, used: quota.used, remaining: 0 },
    });
  }
  return next();
}

/**
 * Crea middleware que valida que exista al menos un proveedor IA disponible.
 */
function ensureAiProvider(config) {
  return function ensureAiProviderMiddleware(req, res, next) {
    if (!hasAiProvider(config)) {
      return res.status(500).json({
        error: 'No hay proveedores HEX configurados. Activa Ollama local o credenciales de produccion.',
      });
    }
    return next();
  };
}

/**
 * Envuelve handlers de IA para mapear errores de upstream en respuestas uniformes.
 */
function withAiErrorHandler(handler, timeoutMsg, fallbackMsg, mapUpstreamError) {
  return async function aiRouteHandler(req, res) {
    try {
      return await handler(req, res);
    } catch (error) {
      const mapped = mapUpstreamError(error, timeoutMsg, fallbackMsg);
      return res.status(mapped.status).json(mapped.payload);
    }
  };
}

/**
 * Registra endpoints de chat, intencion y correlacion IA.
 */
export function registerAiRoutes(app, deps) {
  const {
    aiConfig,
    rootDir,
    rateLimits,
    requireNonEmptyBody,
    requireBodyObject,
    mapUpstreamError,
    getReportesSnapshot,
  } = deps;

  const ensureAiProviderMiddleware = ensureAiProvider(aiConfig);

  app.post('/api/ia-chat', rateLimits.ai, requireAiSession, ensureAiProviderMiddleware, requireNonEmptyBody, enforceAiDailyQuota, withAiErrorHandler(async (req, res) => {
    const reportes = getReportesSnapshot(rootDir);
    const result = await executeChatUseCase({ config: aiConfig, body: req.body, reportes });
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error, details: result.details });
    }
    return res.status(result.status).json(result.payload);
  }, 'El chat HEX no respondio a tiempo.', 'No se pudo conectar con la API HEX.', mapUpstreamError));

  app.post('/api/ia-intent', rateLimits.intent, requireAiSession, requireBodyObject, withAiErrorHandler(async (req, res) => {
    const result = await executeIntentUseCase({ config: aiConfig, body: req.body });
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error, details: result.details });
    }
    return res.status(result.status).json(result.payload);
  }, 'El clasificador de intencion no respondio a tiempo.', 'No se pudo clasificar la consulta.', mapUpstreamError));

  app.post('/api/ia-report-correlation', rateLimits.ai, requireAiSession, ensureAiProviderMiddleware, requireNonEmptyBody, enforceAiDailyQuota, withAiErrorHandler(async (req, res) => {
    const reportes = getReportesSnapshot(rootDir);
    const result = await executeReportCorrelationUseCase({ config: aiConfig, body: req.body, reportes });
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error, details: result.details });
    }
    return res.status(result.status).json(result.payload);
  }, 'La correlacion HEX no respondio a tiempo.', 'No se pudo correlacionar el reporte.', mapUpstreamError));
}
