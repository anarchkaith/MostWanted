const DEFAULT_HEXBOT_API_BASE_URL = 'https://hex-api.kaithsrebels.com';

function readString(env, key, fallback = '') {
  const value = env?.[key];
  return typeof value === 'string' ? value.trim() || fallback : fallback;
}

function readPositiveNumber(env, key, fallback) {
  const raw = Number(env?.[key]);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

export function createHexbotConfig(env = process.env) {
  return {
    baseUrl: readString(env, 'HEXBOT_API_BASE_URL', DEFAULT_HEXBOT_API_BASE_URL),
    apiSecret: readString(env, 'HEXBOT_API_SECRET'),
    timeoutMs: readPositiveNumber(env, 'HEXBOT_API_TIMEOUT_MS', 8000),
  };
}

export function hasHexbotConfig(config) {
  return Boolean(config?.baseUrl && config?.apiSecret);
}
