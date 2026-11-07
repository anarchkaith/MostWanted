import { buildApiUrl } from './apiConfig.js';
import { ASSISTANT_NAME } from '../config/assistant.js';

export const REPORT_ASSIST_MIN_REASON = 10;

function labelKey(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

export function canRequestReportAssist(values = {}) {
  return String(values.reason || '').trim().length >= REPORT_ASSIST_MIN_REASON || (values.typesOfInfraction || []).length > 0;
}

export async function requestReportAssist(values, { fetchImpl = fetch, signal, url } = {}) {
  const response = await fetchImpl(url || buildApiUrl('/ia-report-assist'), {
    method: 'POST',
    credentials: 'include',
    cache: 'no-store',
    signal,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      nickname: values.nickname || '',
      categories: values.typesOfInfraction || [],
      labels: values.labels || [],
      reason: values.reason || '',
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = response.status === 401
      ? `Inicia sesión con Discord para usar ${ASSISTANT_NAME}.`
      : response.status === 429
        ? `Llegaste al límite diario de ${ASSISTANT_NAME}.`
        : response.status === 404
          ? `${ASSISTANT_NAME} estará disponible muy pronto.`
          : payload?.error || `${ASSISTANT_NAME} no está disponible ahora.`;
    throw Object.assign(new Error(message), { status: response.status });
  }
  return payload?.suggestion || null;
}

// Server catalog names lack accents; map them back to the names the form uses.
export function resolveReportAssistSuggestion(suggestion, values, catalog) {
  if (!suggestion) return null;
  const selected = new Set(values.typesOfInfraction || []);
  const categories = (suggestion.categories || []).filter(key => catalog.some(type => type.key === key) && !selected.has(key));
  const allowed = new Set([...selected, ...categories]);
  const byKey = new Map(catalog.filter(type => allowed.has(type.key))
    .flatMap(type => type.etiquetas.map(item => [labelKey(item.nombre), item.nombre])));
  const current = new Set((values.labels || []).map(labelKey));
  const labels = [...new Set((suggestion.labels || []).map(label => byKey.get(labelKey(label))).filter(label => label && !current.has(labelKey(label))))];
  const reason = String(suggestion.reason || '').trim();
  return {
    reason: reason && reason !== String(values.reason || '').trim() ? reason : '',
    categories,
    labels,
    note: String(suggestion.note || '').trim(),
  };
}
