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

function createWordpressError(message, response, details) {
  const error = new Error(message);
  error.name = 'WordpressApiError';
  error.status = response.status;
  error.details = details;
  return error;
}

export async function postWordpressReport({ config, payload, logger = console }) {
  const endpoint = buildApiUrl(config.baseUrl, '/wp-json/mostwanted/v1/reports');

  logger.info('[wordpress] Sending report to WordPress API', {
    endpoint,
    nickname: payload?.nickname,
    playerId: payload?.playerId,
    rid: payload?.rid || null,
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
    throw createWordpressError(
      'WordPress report submission failed.',
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

export async function getWordpressHealth({ config, logger = console }) {
  const endpoint = buildApiUrl(config.baseUrl, '/wp-json/mostwanted/v1/health');

  logger.info('[wordpress] Checking WordPress MostWanted health', { endpoint });

  const response = await fetch(endpoint, {
    method: 'GET',
    headers: {
      Accept: 'application/json, text/plain;q=0.9, */*;q=0.8',
    },
    signal: AbortSignal.timeout(config.timeoutMs),
  });

  const { rawText, parsed } = await readResponseBody(response);

  if (!response.ok) {
    throw createWordpressError(
      'WordPress healthcheck failed.',
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
