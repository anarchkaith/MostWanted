const SOCIAL_CLUB_API_URL = 'https://app.socialclubplus.com/api';
const TIMEOUT_MS = 8000;
const PLAYERS_TTL_MS = 5 * 60 * 1000;
const CAREER_TTL_MS = 10 * 60 * 1000;
const MAX_CACHE_ENTRIES = 500;
const NAME_PATTERN = /^[A-Za-z0-9_-]{1,32}$/;
const RID_PATTERN = /^\d{1,30}$/;
const AVATAR_HOSTS = new Set(['prod-avatars.akamaized.net', 'prod.cloud.rockstargames.com']);
const CAREER_PLATFORMS = new Set(['pc', 'pcalt', 'ps4', 'ps5', 'xboxone', 'xboxsx']);
const DEFAULT_CAREER_PLATFORM = 'pc';
const CAREER_SECTIONS = new Set(['overview', 'stats', 'weapons', 'vehicles', 'awards']);
const CAREER_LEVELS = new Set(['basic', 'bronze', 'silver', 'gold', 'platinum']);
const HTML_ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };

const UNAVAILABLE = { status: 502, error: 'No se pudo consultar Social Club. Intentá de nuevo en unos minutos.' };

function safeAvatarUrl(value) {
  try {
    const url = new URL(String(value));
    return url.protocol === 'https:' && AVATAR_HOSTS.has(url.hostname) ? url.href : '';
  } catch {
    return '';
  }
}

function toAccount(account) {
  const crew = account.crew && typeof account.crew === 'object' && account.crew.id
    ? { id: String(account.crew.id), name: String(account.crew.name ?? ''), tag: String(account.crew.tag ?? ''), color: String(account.crew.color ?? '') }
    : null;
  return { rid: String(account.rockstarId ?? ''), name: String(account.name ?? ''), avatarUrl: safeAvatarUrl(account.avatarUrl), crew };
}

function decodeEntities(value) {
  return String(value).replace(/&(?:amp|lt|gt|quot|#39);/g, entity => HTML_ENTITIES[entity]);
}

function toCareerRow(row) {
  const careerRow = {
    category: decodeEntities(row.category), key: String(row.key),
    label: decodeEntities(row.label), value: decodeEntities(row.value),
  };
  if (typeof row.level === 'string' && CAREER_LEVELS.has(row.level.toLowerCase())) {
    careerRow.level = row.level.toLowerCase();
  }
  return careerRow;
}

function toCareerCategory(category) {
  if (!category || typeof category.name !== 'string' || typeof category.label !== 'string') return null;
  return { name: decodeEntities(category.name), label: decodeEntities(category.label) };
}

function isCareerRow(row) {
  return row && typeof row === 'object' && ['category', 'key', 'label', 'value'].every(field => typeof row[field] === 'string');
}

/**
 * Proxy interno de Social Club: el navegador nunca llama a la API de terceros directamente.
 * Cachea respuestas exitosas en memoria por tiempo limitado.
 */
export function createSocialClubProxy({ fetchImpl = fetch, logger = console, now = () => Date.now() } = {}) {
  const cache = new Map();
  const pending = new Map();

  async function cached(key, ttlMs, load) {
    const hit = cache.get(key);
    if (hit && hit.expiresAt > now()) return hit.payload;
    if (pending.has(key)) return pending.get(key);
    const request = (async () => {
      const payload = await load();
      cache.set(key, { payload, expiresAt: now() + ttlMs });
      if (cache.size > MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value);
      return payload;
    })();
    pending.set(key, request);
    try {
      return await request;
    } finally {
      pending.delete(key);
    }
  }

  async function getJson(path, params) {
    const response = await fetchImpl(`${SOCIAL_CLUB_API_URL}/${path}?${new URLSearchParams(params)}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`socialclub_http_${response.status}`);
    return response.json();
  }

  function fail(error, message) {
    logger.error(message, { message: error.message });
    return { status: UNAVAILABLE.status, payload: { ok: false, error: UNAVAILABLE.error } };
  }

  async function searchPlayers({ name }) {
    const cleanName = typeof name === 'string' ? name.trim() : '';
    if (!NAME_PATTERN.test(cleanName)) {
      return { status: 400, payload: { ok: false, error: 'Escribe un nickname válido (letras, números, _ o -).' } };
    }
    try {
      const payload = await cached(`players:${cleanName.toLowerCase()}`, PLAYERS_TTL_MS, async () => {
        const body = await getJson('players', { name: cleanName });
        if (!body || !Array.isArray(body.accounts)) throw new Error('invalid_socialclub_players_response');
        const accounts = body.accounts.map(toAccount).filter(account => RID_PATTERN.test(account.rid));
        return { ok: true, accounts };
      });
      return { status: 200, payload };
    } catch (error) {
      return fail(error, '[reports] No se pudo buscar jugadores en Social Club.');
    }
  }

  async function getCareer({ rid, platform = DEFAULT_CAREER_PLATFORM, section = 'overview' }) {
    const cleanRid = typeof rid === 'string' ? rid.trim() : '';
    if (!RID_PATTERN.test(cleanRid)) {
      return { status: 400, payload: { ok: false, error: 'Indica un RID válido.' } };
    }
    const cleanPlatform = typeof platform === 'string' ? platform.trim() : '';
    if (!CAREER_PLATFORMS.has(cleanPlatform)) {
      return { status: 400, payload: { ok: false, error: 'Plataforma no soportada.' } };
    }
    if (!CAREER_SECTIONS.has(section)) {
      return { status: 400, payload: { ok: false, error: 'Sección no soportada.' } };
    }
    try {
      const payload = await cached(`career:${section}:${cleanPlatform}:${cleanRid}`, CAREER_TTL_MS, async () => {
        const body = await getJson('career', { platform: cleanPlatform, section, id: cleanRid });
        if (!body || !Array.isArray(body.rows)) throw new Error('invalid_socialclub_career_response');
        return {
          ok: true,
          hasCareer: body.hasCareer === true,
          nickname: String(body.player?.nickname ?? ''),
          categories: Array.isArray(body.categories)
            ? body.categories.map(toCareerCategory).filter(Boolean)
            : [],
          rows: body.rows.filter(isCareerRow).map(toCareerRow),
        };
      });
      return { status: 200, payload };
    } catch (error) {
      return fail(error, '[reports] No se pudo consultar la carrera en Social Club.');
    }
  }

  return { searchPlayers, getCareer, platforms: [...CAREER_PLATFORMS] };
}
