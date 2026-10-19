import { toSafeText } from './utils.js';

export function hasAiCredentials(config) {
  return Boolean(config?.user && config?.password);
}

export function hasAiProvider(config) {
  const hasGateway = Boolean(config?.gatewayToken && config?.gatewayEndpoint);
  const hasProd = Boolean(config?.endpoint && hasAiCredentials(config));
  const hasLocal = Boolean(config?.useLocalOllama && config?.localEndpoint);
  return hasGateway || hasProd || hasLocal;
}

function normalizeAssistantText(value) {
  return typeof value === 'string'
    ? value.trim().replace(/^(?:>>chat(?:\s+|$)\s*)+/i, '').trim()
    : '';
}

function buildProviders(config) {
  const providers = [];

  if (config?.gatewayToken && config?.gatewayEndpoint) {
    providers.push({
      id: 'hex-gateway',
      endpoint: config.gatewayEndpoint,
      provider: config.gatewayProvider,
      kind: 'gateway',
      requiresAuth: false,
    });
  }

  if (config?.useLocalOllama && config?.localEndpoint) {
    providers.push({
      id: 'ollama-local',
      endpoint: config.localEndpoint,
      model: config.localModel || config.model,
      requiresAuth: false,
    });
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
  const candidates = [
    payload.response,
    payload.text,
    payload.output,
    payload.message?.content,
    payload.raw,
  ];

  for (const candidate of candidates) {
    const text = normalizeAssistantText(candidate);
    if (text) {
      return text;
    }
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

      let requestBody;
      if (provider.kind === 'gateway') {
        headers['X-API-Token'] = config.gatewayToken;
        requestBody = {
          provider: provider.provider,
          prompt: payload?.prompt,
        };
      } else {
        if (provider.requiresAuth) {
          headers.Authorization = `Basic ${Buffer.from(`${config.user}:${config.password}`).toString('base64')}`;
        }

        requestBody = {
          ...payload,
          model: payload?.model || provider.model,
        };
      }

      const upstreamResponse = await fetch(provider.endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
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

      if (provider.kind === 'gateway') {
        const text = parsedPayload?.ok === true && typeof parsedPayload?.data?.text === 'string'
          ? parsedPayload.data.text
          : null;

        if (!upstreamResponse.ok || text === null) {
          attempts.push({
            provider: provider.id,
            status: upstreamResponse.status,
            reason: toSafeText(parsedPayload?.error?.message, 'upstream_error'),
          });
          continue;
        }

        return {
          ok: true,
          status: upstreamResponse.status,
          payload: { response: text },
          provider: provider.id,
          attempts,
        };
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
