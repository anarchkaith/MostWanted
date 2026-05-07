import { toSafeText } from './utils.js';

export function hasAiCredentials(config) {
  return Boolean(config?.user && config?.password);
}

export function hasAiProvider(config) {
  const hasProd = Boolean(config?.endpoint && hasAiCredentials(config));
  const hasLocal = Boolean(config?.useLocalOllama && config?.localEndpoint);
  return hasProd || hasLocal;
}

function buildProviders(config) {
  const providers = [];

  if (config?.useLocalOllama && config?.localEndpoint) {
    providers.push({
      id: 'ollama-local',
      endpoint: config.localEndpoint,
      model: config.localModel || config.model,
      requiresAuth: false,
    });
    return providers;
  }

  if (config?.endpoint && hasAiCredentials(config)) {
    providers.push({
      id: 'production-api',
      endpoint: config.endpoint,
      model: config.model,
      requiresAuth: true,
    });
  }

  return providers;
}

export function getAssistantReply(payload = {}) {
  if (typeof payload.response === 'string' && payload.response.trim()) {
    return payload.response.trim();
  }

  if (typeof payload.text === 'string' && payload.text.trim()) {
    return payload.text.trim();
  }

  if (typeof payload.output === 'string' && payload.output.trim()) {
    return payload.output.trim();
  }

  if (payload.message && typeof payload.message.content === 'string' && payload.message.content.trim()) {
    return payload.message.content.trim();
  }

  if (typeof payload.raw === 'string' && payload.raw.trim()) {
    return payload.raw.trim();
  }

  return 'No pude generar una respuesta en este momento.';
}

export async function requestAiGenerate({ config, payload, timeoutMs = 120000 }) {
  const providers = buildProviders(config);
  if (providers.length === 0) {
    return {
      ok: false,
      status: 500,
      error: 'No hay proveedores IA configurados (Ollama local o API de produccion).',
      details: 'Configura KAITH_AI_USE_LOCAL_OLLAMA y/o KAITH_AI_USER + KAITH_AI_PASSWORD.',
    };
  }

  const attempts = [];

  for (const provider of providers) {
    try {
      const headers = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      };

      if (provider.requiresAuth) {
        headers.Authorization = `Basic ${Buffer.from(`${config.user}:${config.password}`).toString('base64')}`;
      }

      const providerPayload = {
        ...payload,
        model: payload?.model || provider.model,
      };

      const upstreamResponse = await fetch(provider.endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(providerPayload),
        signal: AbortSignal.timeout(timeoutMs),
      });

      const contentType = upstreamResponse.headers.get('content-type') || 'application/json; charset=utf-8';
      const rawText = await upstreamResponse.text();
      const looksLikeHtml = contentType.includes('text/html') || /^\s*<(?:!doctype|html|head|body)\b/i.test(rawText);

      if (looksLikeHtml) {
        attempts.push({ provider: provider.id, status: upstreamResponse.status, reason: 'html_response' });
        continue;
      }

      let parsedPayload;
      try {
        parsedPayload = rawText ? JSON.parse(rawText) : {};
      } catch {
        parsedPayload = { raw: rawText };
      }

      if (!upstreamResponse.ok) {
        attempts.push({
          provider: provider.id,
          status: upstreamResponse.status,
          reason: toSafeText(parsedPayload?.error, 'upstream_error'),
        });
        continue;
      }

      return {
        ok: true,
        status: upstreamResponse.status,
        payload: parsedPayload,
        provider: provider.id,
        attempts,
      };
    } catch (error) {
      attempts.push({
        provider: provider.id,
        status: 0,
        reason: error instanceof Error ? error.message : 'network_error',
      });
    }
  }

  const lastAttempt = attempts[attempts.length - 1] || {};
  return {
    ok: false,
    status: lastAttempt.status && lastAttempt.status > 0 ? lastAttempt.status : 502,
    error: 'No se pudo conectar con proveedores IA disponibles.',
    details: attempts.map((item) => `${item.provider}: ${item.reason}`).join(' | ').slice(0, 240),
    attempts,
  };
}
