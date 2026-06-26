import { executeChatUseCase } from '../../../ai/usecases/chat.js';
import { executeIntentUseCase } from '../../../ai/usecases/intent.js';
import { executeReportCorrelationUseCase } from '../../../ai/usecases/reportCorrelation.js';
import { hasAiProvider } from '../../../ai/client.js';

/**
 * Crea middleware que valida que exista al menos un proveedor IA disponible.
 */
function ensureAiProvider(config) {
  return function ensureAiProviderMiddleware(req, res, next) {
    if (!hasAiProvider(config)) {
      return res.status(500).json({
        error: 'No hay proveedores IA configurados. Activa Ollama local o credenciales de produccion.',
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

  app.post('/api/ia-chat', rateLimits.ai, ensureAiProviderMiddleware, requireNonEmptyBody, withAiErrorHandler(async (req, res) => {
    const reportes = getReportesSnapshot(rootDir);
    const result = await executeChatUseCase({ config: aiConfig, body: req.body, reportes });
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error, details: result.details });
    }
    return res.status(result.status).json(result.payload);
  }, 'El chat IA no respondio a tiempo.', 'No se pudo conectar con la API IA.', mapUpstreamError));

  app.post('/api/ia-intent', rateLimits.intent, requireBodyObject, withAiErrorHandler(async (req, res) => {
    const result = await executeIntentUseCase({ config: aiConfig, body: req.body });
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error, details: result.details });
    }
    return res.status(result.status).json(result.payload);
  }, 'El clasificador de intencion no respondio a tiempo.', 'No se pudo clasificar la consulta.', mapUpstreamError));

  app.post('/api/ia-report-correlation', rateLimits.ai, ensureAiProviderMiddleware, requireNonEmptyBody, withAiErrorHandler(async (req, res) => {
    const reportes = getReportesSnapshot(rootDir);
    const result = await executeReportCorrelationUseCase({ config: aiConfig, body: req.body, reportes });
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error, details: result.details });
    }
    return res.status(result.status).json(result.payload);
  }, 'La correlacion IA no respondio a tiempo.', 'No se pudo correlacionar el reporte.', mapUpstreamError));
}
