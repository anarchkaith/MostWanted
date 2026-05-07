function buildApiUrl(baseUrl, path) {
  return `${String(baseUrl || '').replace(/\/+$/, '')}${path}`;
}

async function readResponseBody(response) {
  const rawText = await response.text().catch(() => '');

  if (!rawText) {
    return { rawText: '', parsed: {} };
  }

  try {
    return { rawText, parsed: JSON.parse(rawText) };
  } catch {
    return { rawText, parsed: null };
  }
}

function createUpstreamError(message, response, details) {
  const error = new Error(message);
  error.name = 'HexbotApiError';
  error.status = response.status;
  error.details = details;
  return error;
}

export async function postHexbotReport({ config, payload, logger = console }) {
  const endpoint = buildApiUrl(config.baseUrl, '/api/reports');

  logger.info('[hexbot] Sending report to HEXBOT API', {
    endpoint,
    username: payload?.username,
    evidenceCount: Array.isArray(payload?.evidence) ? payload.evidence.length : 0,
    source: payload?.source,
  });

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiSecret}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(config.timeoutMs),
  });

  const { rawText, parsed } = await readResponseBody(response);

  if (!response.ok) {
    throw createUpstreamError(
      'HEXBOT report submission failed.',
      response,
      parsed?.error || rawText.slice(0, 240) || 'empty_response',
    );
  }

  return {
    ok: true,
    status: response.status,
    payload: parsed || {},
  };
}

export async function getHexbotHealth({ config, logger = console }) {
  const endpoint = buildApiUrl(config.baseUrl, '/health');

  logger.info('[hexbot] Checking HEXBOT health', { endpoint });

  const response = await fetch(endpoint, {
    method: 'GET',
    headers: {
      Accept: 'application/json, text/plain;q=0.9, */*;q=0.8',
    },
    signal: AbortSignal.timeout(config.timeoutMs),
  });

  const { rawText, parsed } = await readResponseBody(response);

  if (!response.ok) {
    throw createUpstreamError(
      'HEXBOT healthcheck failed.',
      response,
      parsed?.error || rawText.slice(0, 240) || 'empty_response',
    );
  }

  return {
    ok: true,
    status: response.status,
    payload: parsed ?? { raw: rawText || 'ok' },
  };
}
