import fs from 'node:fs';
import path from 'node:path';

function toTrimmedString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeText(value) {
  return toTrimmedString(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function parseDateLike(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const timestamp = value > 1e12 ? value : value * 1000;
    const date = new Date(timestamp);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

function extractNicknameCandidates(reporte = {}) {
  return [
    reporte?.usuario,
    reporte?.nickname,
    reporte?.username,
    reporte?.player_name,
    reporte?.playerName,
    reporte?.report?.nickname,
  ]
    .map((value) => toTrimmedString(value))
    .filter(Boolean);
}

function extractRidValue(reporte = {}) {
  const rawRid = reporte?.rid
    ?? reporte?.player_rid
    ?? reporte?.playerRid
    ?? reporte?.report?.rid
    ?? null;

  const parsed = Number(rawRid);
  if (Number.isFinite(parsed) && parsed > 0) {
    return String(Math.trunc(parsed));
  }

  const text = toTrimmedString(rawRid);
  return /^\d+$/.test(text) ? text : '';
}

function splitStringList(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => toTrimmedString(typeof item === 'string' ? item : item?.name || item?.tag || ''))
      .filter(Boolean);
  }

  const text = toTrimmedString(value);
  if (!text) return [];

  return text
    .split(/[;,|]/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function mergeUniqueStrings(...lists) {
  const result = [];
  const seen = new Set();

  for (const list of lists) {
    const source = Array.isArray(list) ? list : [];
    for (const rawValue of source) {
      const value = toTrimmedString(rawValue);
      if (!value) continue;
      const key = normalizeText(value);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      result.push(value);
    }
  }

  return result;
}

function extractCrews(reporte = {}) {
  return splitStringList(reporte?.crews ?? reporte?.crew ?? reporte?.report?.crews);
}

function extractAliases(reporte = {}) {
  return splitStringList(reporte?.aliases ?? reporte?.aka ?? reporte?.report?.aliases);
}

function extractAvatarCandidates(reporte = {}) {
  return [
    reporte?.avatar1,
    reporte?.avatar2,
    reporte?.report?.avatar1,
    reporte?.report?.avatar2,
  ]
    .map((value) => toTrimmedString(value))
    .filter((value) => /^https?:\/\//i.test(value));
}

function toUnixTimeFromDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  return Math.floor(date.getTime() / 1000);
}

function upsertNameEntry(map, name, time = null, source = 'local') {
  const normalizedName = normalizeText(name);
  const safeName = toTrimmedString(name);
  if (!normalizedName || !safeName) return;

  const current = map.get(normalizedName);
  const safeTime = Number.isFinite(time) && time > 0 ? Math.floor(time) : null;

  if (!current) {
    map.set(normalizedName, {
      name: safeName,
      time: safeTime,
      source,
    });
    return;
  }

  if ((safeTime || 0) > (current.time || 0)) {
    map.set(normalizedName, {
      name: safeName,
      time: safeTime,
      source,
    });
  }
}

function mapToSortedNameEntries(entriesMap, limit = 50) {
  return Array.from(entriesMap.values())
    .sort((a, b) => (b.time || 0) - (a.time || 0) || a.name.localeCompare(b.name))
    .slice(0, limit);
}

function buildScAvatarCandidates(rid = '') {
  const normalizedRid = toTrimmedString(rid);
  if (!/^\d+$/.test(normalizedRid)) return [];

  return [0, 1].map((slot) => `https://prod.cloud.rockstargames.com/members/sc/6266/${encodeURIComponent(normalizedRid)}/publish/gta5/mpchars/${slot}.png`);
}

export function readReportes(rootDir) {
  const filePath = path.join(rootDir, 'data', 'reportes.json');
  if (!fs.existsSync(filePath)) {
    return [];
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function findReporteByUsuario(reportes, usuario) {
  const target = String(usuario || '').trim().toLowerCase();
  if (!target) return null;

  return reportes.find((reporte) => String(reporte?.usuario || '').trim().toLowerCase() === target) || null;
}

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2);
}

export function getRelatedReportes(reportes, targetReport, limit = 5) {
  const baseTokens = new Set([
    ...tokenize(targetReport?.motivo),
    ...tokenize(targetReport?.usuario),
    ...tokenize(targetReport?.categoria),
  ]);

  const scored = reportes
    .filter((item) => item && item.id !== targetReport?.id)
    .map((item) => {
      const itemTokens = new Set([
        ...tokenize(item?.motivo),
        ...tokenize(item?.usuario),
        ...tokenize(item?.categoria),
      ]);

      let overlap = 0;
      for (const token of baseTokens) {
        if (itemTokens.has(token)) {
          overlap += 1;
        }
      }

      if (item?.categoria && item.categoria === targetReport?.categoria) {
        overlap += 2;
      }

      if (item?.severidad && item.severidad === targetReport?.severidad) {
        overlap += 1;
      }

      return { item, overlap };
    })
    .filter((entry) => entry.overlap > 0)
    .sort((a, b) => b.overlap - a.overlap)
    .slice(0, limit)
    .map((entry) => entry.item);

  return scored;
}

export function buildReportesStats(reportes) {
  const byCategory = {};
  const bySeverity = {};

  for (const reporte of reportes) {
    const category = String(reporte?.categoria || 'sin_categoria');
    const severity = String(reporte?.severidad || 'sin_severidad');
    byCategory[category] = (byCategory[category] || 0) + 1;
    bySeverity[severity] = (bySeverity[severity] || 0) + 1;
  }

  return {
    total: reportes.length,
    byCategory,
    bySeverity,
  };
}

export function buildPlayerInsights(reportes = [], { username = '', rid = '' } = {}) {
  const normalizedUsername = normalizeText(username);
  const normalizedRid = toTrimmedString(rid);

  const matches = reportes.filter((reporte) => {
    if (!reporte || typeof reporte !== 'object') return false;

    const reportRid = extractRidValue(reporte);
    if (normalizedRid && reportRid && reportRid === normalizedRid) {
      return true;
    }

    if (!normalizedUsername) return false;

    const nicknames = extractNicknameCandidates(reporte);
    return nicknames.some((name) => normalizeText(name) === normalizedUsername);
  });

  const crewsSet = new Set();
  const nameEntriesMap = new Map();
  const ridSet = new Set();
  const avatarSet = new Set();

  let latestReportDate = null;
  let activeCrew = '';

  for (const reporte of matches) {
    const reportDate = parseDateLike(
      reporte?.created_at
      ?? reporte?.updated_at
      ?? reporte?.fecha
      ?? reporte?.time
      ?? reporte?.report?.time
      ?? null
    );

    if (reportDate && (!latestReportDate || reportDate > latestReportDate)) {
      latestReportDate = reportDate;
      const recentCrews = extractCrews(reporte);
      activeCrew = recentCrews[0] || activeCrew;
    }

    const reportUnixTime = toUnixTimeFromDate(reportDate);

    for (const name of extractNicknameCandidates(reporte)) {
      upsertNameEntry(nameEntriesMap, name, reportUnixTime, 'local');
    }

    const reportRid = extractRidValue(reporte);
    if (reportRid) ridSet.add(reportRid);

    for (const crew of extractCrews(reporte)) {
      crewsSet.add(crew);
    }

    for (const alias of extractAliases(reporte)) {
      upsertNameEntry(nameEntriesMap, alias, reportUnixTime, 'local');
    }

    for (const avatarUrl of extractAvatarCandidates(reporte)) {
      avatarSet.add(avatarUrl);
    }
  }

  const resolvedRid = normalizedRid || (ridSet.size > 0 ? Array.from(ridSet)[0] : '');
  const avatars = [
    ...Array.from(avatarSet),
    ...buildScAvatarCandidates(resolvedRid),
  ].slice(0, 8);

  return {
    username: toTrimmedString(username),
    rid: resolvedRid,
    reportCount: matches.length,
    activeCrew,
    crews: Array.from(crewsSet).slice(0, 25),
    names: mapToSortedNameEntries(nameEntriesMap, 60),
    avatars,
    lastReportAt: latestReportDate ? latestReportDate.toISOString() : null,
  };
}

function parseScCacheNamesPayload(payload) {
  const source = Array.isArray(payload)
    ? payload
    : (payload && typeof payload === 'object' && Array.isArray(payload.value) ? payload.value : []);

  const names = source
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const name = toTrimmedString(entry.name);
      if (!name) return null;
      const time = Number(entry.time);
      return {
        name,
        time: Number.isFinite(time) && time > 0 ? Math.floor(time) : 0,
      };
    })
    .filter(Boolean);

  return { names };
}

async function fetchScCacheAliases({ rid = '', timeoutMs = 6000 } = {}) {
  const normalizedRid = toTrimmedString(rid);
  if (!/^\d+$/.test(normalizedRid)) {
    return {
      rid: normalizedRid,
      names: [],
      source: 'sc-cache',
      fetched: false,
      error: 'invalid_rid',
    };
  }

  const endpoint = `https://sc-cache.com/r/${encodeURIComponent(normalizedRid)}`;

  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      return {
        rid: normalizedRid,
        names: [],
        source: 'sc-cache',
        fetched: false,
        error: `http_${response.status}`,
      };
    }

    const payload = await response.json().catch(() => null);
    const parsed = parseScCacheNamesPayload(payload);

    return {
      rid: normalizedRid,
      ...parsed,
      source: 'sc-cache',
      fetched: true,
      error: '',
    };
  } catch (error) {
    return {
      rid: normalizedRid,
      names: [],
      source: 'sc-cache',
      fetched: false,
      error: error instanceof Error ? error.message : 'unknown_error',
    };
  }
}

export async function buildPlayerInsightsWithScCache(reportes = [], { username = '', rid = '' } = {}) {
  const base = buildPlayerInsights(reportes, { username, rid });
  const normalizedRid = toTrimmedString(rid) || toTrimmedString(base?.rid);

  const scCache = await fetchScCacheAliases({ rid: normalizedRid });

  const avatars = [
    ...(Array.isArray(base?.avatars) ? base.avatars : []),
    ...buildScAvatarCandidates(normalizedRid),
  ];

  const avatarSeen = new Set();
  const mergedAvatars = avatars.filter((avatar) => {
    const url = toTrimmedString(typeof avatar === 'string' ? avatar : avatar?.url);
    if (!url) return false;
    if (avatarSeen.has(url)) return false;
    avatarSeen.add(url);
    return true;
  }).slice(0, 8);

  return {
    ...base,
    names: Array.isArray(scCache?.names) ? scCache.names : [],
    avatars: mergedAvatars,
  };
}

// Caché simple con TTL para evitar lecturas repetidas en cada request.
const _cache = { data: null, expiresAt: 0 };
const CACHE_TTL_MS = 30_000;

export function getReportesSnapshot(rootDir) {
  if (_cache.data && Date.now() < _cache.expiresAt) {
    return _cache.data;
  }
  _cache.data = readReportes(rootDir);
  _cache.expiresAt = Date.now() + CACHE_TTL_MS;
  return _cache.data;
}
