const ROCKSTAR_CREW_SEARCH_URL = 'https://scapi.rockstargames.com/search/crew';
const ROCKSTAR_CREW_EMBLEM_URL = 'https://prod.cloud.rockstargames.com/crews/sc/6266';
// Rockstar devuelve 20 crews por búsqueda; la búsqueda no pagina.
const MAX_QUERY_LENGTH = 100;
const TIMEOUT_MS = 8000;

const flagKeys = ['isPrivate', 'isOpen', 'canJoin', 'canRequestInvite', 'isMember', 'isPrimary', 'isFounderCrew', 'isSystem'];
const textKeys = ['crewTag', 'crewMotto', 'crewType', 'division', 'crewColour', 'createdAt'];

function toPublicCrew(crew) {
  const text = Object.fromEntries(textKeys.map(key => [key, typeof crew[key] === 'string' ? crew[key] : '']));
  const flags = Object.fromEntries(flagKeys.map(key => [key, crew[key] === true]));
  const crewId = String(crew.crewId);
  return {
    crewId,
    crewName: crew.crewName.trim(),
    memberCount: Number.isSafeInteger(crew.memberCount) && crew.memberCount >= 0 ? crew.memberCount : null,
    emblemUrl: /^\d+$/.test(crewId) ? `${ROCKSTAR_CREW_EMBLEM_URL}/${crewId}/publish/emblem/emblem_256.png` : '',
    ...text,
    ...flags,
  };
}

function isCrew(crew) {
  return crew && typeof crew === 'object'
    && (typeof crew.crewId === 'number' || typeof crew.crewId === 'string')
    && typeof crew.crewName === 'string' && crew.crewName.trim() !== '';
}

export async function searchCrews({ query, fetchImpl = fetch, logger = console }) {
  if (typeof query !== 'string' || !query.trim() || [...query.trim()].length > MAX_QUERY_LENGTH) {
    return { status: 400, payload: { ok: false, error: 'Escribe un nombre de crew de hasta 100 caracteres.' } };
  }
  const params = new URLSearchParams({ searchTerm: query.trim(), crewtype: 'all' });
  try {
    const response = await fetchImpl(`${ROCKSTAR_CREW_SEARCH_URL}?${params}`, {
      headers: { 'X-Requested-With': 'XMLHttpRequest', Accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`crew_search_http_${response.status}`);
    const body = await response.json();
    if (!body || body.status !== true || !Array.isArray(body.crews)) throw new Error('invalid_crew_search_response');
    const crews = body.crews.filter(isCrew).map(toPublicCrew);
    return { status: 200, payload: { ok: true, crews } };
  } catch (error) {
    logger.error('[reports] No se pudo buscar crews.', { message: error.message });
    return { status: 502, payload: { ok: false, error: 'No se pudo buscar crews en Rockstar. Intentá de nuevo en unos minutos.' } };
  }
}
