export function toSafeText(value, fallback = '') {
  if (typeof value !== 'string') {
    return fallback;
  }

  const text = value.trim();
  return text || fallback;
}

export function parseIntegerOr(value, fallback) {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function normalizeRecommendation(value) {
  const raw = toSafeText(value, '').toLowerCase();
  if (!raw) return 'investigar';

  if (raw.includes('cazar')) return 'cazar';
  if (raw.includes('evitar')) return 'evitar';
  if (raw.includes('investigar')) return 'investigar';
  return 'investigar';
}

export function extractJsonObject(rawText) {
  const text = toSafeText(rawText, '');
  if (!text) {
    return null;
  }

  const fenced = text.match(/```json\s*([\s\S]*?)\s*```/i);
  const candidate = fenced?.[1] || text;

  try {
    return JSON.parse(candidate);
  } catch {
    const openIdx = text.indexOf('{');
    const closeIdx = text.lastIndexOf('}');
    if (openIdx >= 0 && closeIdx > openIdx) {
      try {
        return JSON.parse(text.slice(openIdx, closeIdx + 1));
      } catch {
        return null;
      }
    }
  }

  return null;
}
