import { buildApiUrl } from './apiConfig.js';
import { readApiResponse } from './jsonResponse.js';
import { normalizeSearchText } from './playerSearch.js';

export async function fetchCrewSearch({ query, signal }, buildUrl = buildApiUrl) {
  const params = new URLSearchParams({ q: query });
  const response = await fetch(buildUrl(`/reports/crews/search?${params}`), { signal, credentials: 'include' });
  const payload = await readApiResponse(response, 'No se pudo buscar crews.');
  if (payload.ok !== true || !Array.isArray(payload.crews)) {
    throw new Error('La búsqueda de crews devolvió un formato inválido.');
  }
  return payload;
}

export function parseCrewList(value) {
  return String(value || '').split(',').map(name => name.trim()).filter(Boolean);
}

export function addCrewToList(value, crewName) {
  const name = String(crewName || '').trim();
  const current = parseCrewList(value);
  if (!name || current.some(item => normalizeSearchText(item) === normalizeSearchText(name))) return current.join(', ');
  return [...current, name].join(', ');
}

export function removeCrewFromList(value, crewName) {
  const target = normalizeSearchText(crewName);
  return parseCrewList(value).filter(item => normalizeSearchText(item) !== target).join(', ');
}

export function getCrewPrivacyLabel(crew) {
  if (crew.isOpen) return 'Pública';
  if (crew.isPrivate) return 'Privada';
  return '';
}
