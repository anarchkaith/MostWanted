function readString(env, key, fallback = '') {
  const value = env?.[key];
  return typeof value === 'string' ? value.trim() || fallback : fallback;
}

function readPositiveNumber(env, key, fallback) {
  const raw = Number(env?.[key]);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

export function createWordpressReportsConfig(env = process.env) {
  return {
    enabled: readString(env, 'WORDPRESS_REPORTS_ENABLED', 'false').toLowerCase() === 'true',
    baseUrl: readString(env, 'WORDPRESS_API_BASE_URL'),
    apiSecret: readString(env, 'WORDPRESS_API_SECRET'),
    timeoutMs: readPositiveNumber(env, 'WORDPRESS_API_TIMEOUT_MS', 9000),
  };
}

export function hasWordpressReportsConfig(config = {}) {
  return Boolean(config.enabled && config.baseUrl && config.apiSecret);
}
