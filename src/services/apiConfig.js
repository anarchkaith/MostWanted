const DEFAULT_REMOTE_API_BASE_URL = 'https://api.kaithsrebels.com/api';
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);

function hasWindow() {
  return typeof window !== 'undefined' && typeof window.location?.hostname === 'string';
}

function isLocalRuntime() {
  return hasWindow() && LOCAL_HOSTS.has(window.location.hostname);
}

function normalizeBaseUrl(baseUrl) {
  return String(baseUrl || '').replace(/\/+$/, '');
}

function isRelativeApiBaseUrl(baseUrl) {
  return baseUrl.startsWith('/');
}

export function getApiBaseUrl() {
  const configuredBaseUrl = normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL);

  if (configuredBaseUrl) {
    // In production the frontend should talk to the dedicated API host.
    // If someone builds with the local `.env` (`/api`), avoid hitting the SPA host.
    if (!isLocalRuntime() && isRelativeApiBaseUrl(configuredBaseUrl)) {
      return DEFAULT_REMOTE_API_BASE_URL;
    }
    return configuredBaseUrl;
  }

  return isLocalRuntime() ? '/api' : DEFAULT_REMOTE_API_BASE_URL;
}

export function buildApiUrl(path = '') {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${getApiBaseUrl()}${normalizedPath}`;
}

export function getIaChatEndpoint() {
  return import.meta.env.VITE_IA_ENDPOINT || buildApiUrl('/ia-chat');
}

export function getIaIntentEndpoint() {
  return import.meta.env.VITE_IA_INTENT_ENDPOINT || buildApiUrl('/ia-intent');
}

export function getIaReportCorrelationEndpoint() {
  return import.meta.env.VITE_IA_REPORT_CORRELATION_ENDPOINT || buildApiUrl('/ia-report-correlation');
}
