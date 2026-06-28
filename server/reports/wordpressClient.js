function buildApiUrl(baseUrl, path) {
  return `${String(baseUrl || '').replace(/\/+$/, '')}${path}`;
}

async function parseWordpressResponse(response) {
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

function buildPostTypePath({ postType, postId = null, query = null }) {
  const safePostType = String(postType || 'mw_report').trim();
  const basePath = `/wp-json/wp/v2/${encodeURIComponent(safePostType)}`;

  const pathWithId = postId ? `${basePath}/${encodeURIComponent(String(postId).trim())}` : basePath;
  if (!query || typeof query !== 'object') {
    return pathWithId;
  }

  const searchParams = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }
    searchParams.set(key, String(value));
  });

  const serialized = searchParams.toString();
  return serialized ? `${pathWithId}?${serialized}` : pathWithId;
}

async function requestWordpressApi({
  config,
  logger,
  method,
  path,
  operation,
  body,
  useAuth = true,
  onLog,
}) {
  const endpoint = buildApiUrl(config.baseUrl, path);
  if (typeof onLog === 'function') {
    onLog(endpoint);
  } else {
    logger.info(`[wordpress] ${operation}`, { endpoint });
  }

  const headers = {
    Accept: 'application/json, text/plain;q=0.9, */*;q=0.8',
    ...(useAuth ? { Authorization: `Bearer ${config.apiSecret}` } : {}),
    ...(body ? { 'Content-Type': 'application/json' } : {}),
  };

  const response = await fetch(endpoint, {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(config.timeoutMs),
  });

  const { rawText, parsed } = await parseWordpressResponse(response);
  if (!response.ok) {
    const error = new Error(`WordPress ${operation.toLowerCase()} failed.`);
    error.name = 'WordpressApiError';
    error.status = response.status;
    error.details = parsed?.error || rawText.slice(0, 240) || 'empty_response';
    throw error;
  }

  return {
    ok: true,
    status: response.status,
    payload: parsed ?? { raw: rawText || 'ok' },
  };
}

export async function postWordpressReport({ config, payload, logger = console }) {
  return requestWordpressApi({
    config,
    logger,
    method: 'POST',
    path: '/wp-json/mostwanted/v1/reports',
    operation: 'Report submission',
    body: payload,
    useAuth: true,
    onLog: (endpoint) => {
      logger.info('[wordpress] Sending report to WordPress API', {
        endpoint,
        nickname: payload?.nickname,
        playerId: payload?.playerId,
        rid: payload?.rid || null,
      });
    },
  });
}

export async function getWordpressHealth({ config, logger = console }) {
  return requestWordpressApi({
    config,
    logger,
    method: 'GET',
    path: '/wp-json/mostwanted/v1/health',
    operation: 'Healthcheck',
    useAuth: false,
    onLog: (endpoint) => {
      logger.info('[wordpress] Checking WordPress MostWanted health', { endpoint });
    },
  });
}

/**
 * Crea una entrada en cualquier Custom Post Type usando WP REST v2.
 */
export async function createWordpressCustomPost({
  config,
  postType,
  title,
  content,
  status = 'publish',
  excerpt = '',
  meta = {},
  logger = console,
}) {
  const body = {
    title: String(title || '').trim() || 'MostWanted Report',
    content: String(content || '').trim(),
    status: String(status || 'publish').trim() || 'publish',
    ...(String(excerpt || '').trim() ? { excerpt: String(excerpt).trim() } : {}),
    ...(meta && typeof meta === 'object' && Object.keys(meta).length > 0 ? { meta } : {}),
  };

  return requestWordpressApi({
    config,
    logger,
    method: 'POST',
    path: buildPostTypePath({ postType }),
    operation: `Create ${postType || 'custom-post'}`,
    body,
    useAuth: true,
  });
}

/**
 * Lee una entrada puntual de un Custom Post Type por ID.
 */
export async function getWordpressCustomPost({ config, postType, postId, logger = console }) {
  return requestWordpressApi({
    config,
    logger,
    method: 'GET',
    path: buildPostTypePath({ postType, postId }),
    operation: `Read ${postType || 'custom-post'} by id`,
    useAuth: false,
  });
}

/**
 * Lista entradas de un Custom Post Type con filtros basicos.
 */
export async function listWordpressCustomPosts({
  config,
  postType,
  page = 1,
  perPage = 20,
  search = '',
  status = 'publish',
  logger = console,
}) {
  return requestWordpressApi({
    config,
    logger,
    method: 'GET',
    path: buildPostTypePath({
      postType,
      query: {
        page,
        per_page: perPage,
        search,
        status,
      },
    }),
    operation: `List ${postType || 'custom-post'}`,
    useAuth: false,
  });
}
