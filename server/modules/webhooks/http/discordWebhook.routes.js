import { sanitizeDiscordWebhookPayload, sendDiscordWebhook } from '../services/discordWebhook.service.js';

/**
 * Resuelve IP cliente considerando cabeceras de proxy reverso.
 */
function resolveClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return req.socket?.remoteAddress || req.ip || 'unknown';
}

/**
 * Valida que el origen HTTP este permitido para el endpoint de webhook.
 */
function isAllowedWebhookOrigin(req, allowedOrigins) {
  if (!(allowedOrigins instanceof Set) || allowedOrigins.size === 0) {
    return true;
  }
  const origin = typeof req.headers.origin === 'string' ? req.headers.origin.trim() : '';
  return Boolean(origin && allowedOrigins.has(origin));
}

/**
 * Registra endpoint generico de Discord webhook para enviar embeds/contenido.
 */
function registerGenericDiscordWebhookPostRoute(routePath, app, deps) {
  const {
    debugMode,
    discordWebhookUrl,
    webhookAllowedOrigins,
    webhookMinIntervalMs,
    webhookLastSubmissionByIp,
    rateLimits,
    maybeRequireSessionAuth,
  } = deps;

  app.post(routePath, rateLimits.webhook, maybeRequireSessionAuth, async (req, res) => {
    const clientIp = resolveClientIp(req);
    const now = Date.now();

    if (!discordWebhookUrl) {
      return res.status(503).json({ error: 'Webhook de Discord no configurado en el servidor.' });
    }

    if (!isAllowedWebhookOrigin(req, webhookAllowedOrigins)) {
      return res.status(403).json({ error: 'Origen no autorizado para este endpoint.' });
    }

    const contentType = req.headers['content-type'] || '';
    if (!contentType.toLowerCase().includes('application/json')) {
      return res.status(415).json({ error: 'Tipo de contenido no soportado. Usa application/json.' });
    }

    if (!debugMode) {
      const elapsed = now - (webhookLastSubmissionByIp.get(clientIp) || 0);
      if (elapsed < webhookMinIntervalMs) {
        const retryAfterSeconds = Math.ceil((webhookMinIntervalMs - elapsed) / 1000);
        res.set('Retry-After', String(retryAfterSeconds));
        return res.status(429).json({
          error: `Debes esperar ${retryAfterSeconds}s antes de enviar otro mensaje por webhook.`,
          retryAfterSeconds,
        });
      }
    }

    if (!req.body || typeof req.body !== 'object' || Object.keys(req.body).length === 0) {
      return res.status(400).json({ error: 'El cuerpo de la peticion esta vacio.' });
    }

    try {
      const safePayload = sanitizeDiscordWebhookPayload(req.body);

      if (!safePayload.content && (!Array.isArray(safePayload.embeds) || safePayload.embeds.length === 0)) {
        return res.status(400).json({ error: 'El payload no contiene contenido ni embeds validos.' });
      }

      const delivery = await sendDiscordWebhook({
        webhookUrl: discordWebhookUrl,
        payload: safePayload,
      });

      if (!delivery.ok) {
        return res.status(delivery.status || 502).json({
          error: delivery.error,
          details: delivery.details,
        });
      }

      if (!debugMode) {
        webhookLastSubmissionByIp.set(clientIp, now);
      }

      return res.status(200).json({
        ok: true,
        provider: 'discord-webhook',
        status: delivery.status,
      });
    } catch (error) {
      return res.status(502).json({
        error: 'No se pudo contactar con Discord.',
        details: error instanceof Error ? error.message : 'fallo desconocido',
      });
    }
  });
}

/**
 * Registra endpoint de reenvio seguro a webhook de Discord.
 */
export function registerDiscordWebhookRoutes(app, deps) {
  registerGenericDiscordWebhookPostRoute('/api/webhooks/discord', app, deps);
  // Compatibilidad temporal con endpoint legado.
  registerGenericDiscordWebhookPostRoute('/api/discord-webhook', app, deps);
}
