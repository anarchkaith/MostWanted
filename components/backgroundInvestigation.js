import { BLOCKED_REPORTED_USERNAME_MESSAGE, isBlockedReportedUsername } from './blockedUsernames';
import { buildApiUrl } from '../src/services/apiConfig';

const CORS_ANYWHERE_BASE_URL = 'https://cors-anywhere.herokuapp.com/';
const CORS_PERMISSION_URL = `${CORS_ANYWHERE_BASE_URL}https://mostwanted.kaithsrebels.com/`;

function getCorsProxyUrl(url) {
  return `${CORS_ANYWHERE_BASE_URL}${url}`;
}

function mergeUniqueStrings(...lists) {
  const seen = new Set();
  const result = [];

  for (const list of lists) {
    const source = Array.isArray(list) ? list : [];
    for (const rawValue of source) {
      const value = String(rawValue || '').trim();
      if (!value) continue;
      const normalized = value.toLowerCase();
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      result.push(value);
    }
  }

  return result;
}

function extractNamesFromInsights(reportInsights = null) {
  if (!reportInsights || typeof reportInsights !== 'object') return [];

  const unifiedNames = Array.isArray(reportInsights.names)
    ? reportInsights.names
      .map((entry) => {
        if (typeof entry === 'string') return entry;
        if (entry && typeof entry === 'object') return entry.name;
        return '';
      })
      .filter(Boolean)
    : [];

  const legacyAliases = Array.isArray(reportInsights.aliases) ? reportInsights.aliases : [];
  const legacyNicknames = Array.isArray(reportInsights.nicknames) ? reportInsights.nicknames : [];

  return mergeUniqueStrings(unifiedNames, legacyAliases, legacyNicknames);
}

function extractNameHistoryFromInsights(reportInsights = null) {
  if (!reportInsights || typeof reportInsights !== 'object') return [];

  if (!Array.isArray(reportInsights.names)) return [];

  return reportInsights.names
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const name = String(entry.name || '').trim();
      if (!name) return null;

      const unix = Number(entry.time);
      const safeTime = Number.isFinite(unix) && unix > 0 ? Math.floor(unix) : 0;

      return {
        name,
        time: safeTime,
        timeReadable: safeTime > 0 ? formatUnixTimeReadable(safeTime) : 'Fecha desconocida',
      };
    })
    .filter(Boolean)
    .sort((a, b) => (Number(b.time) || 0) - (Number(a.time) || 0));
}

function extractPanelAvatarsFromInsights(reportInsights = null) {
  if (!reportInsights || typeof reportInsights !== 'object') return [];

  const urls = Array.isArray(reportInsights.avatars)
    ? reportInsights.avatars
      .map((item) => (typeof item === 'string' ? item : item?.url || item?.avatarUrl || ''))
      .map((item) => String(item || '').trim())
      .filter(Boolean)
    : [];

  return urls.slice(0, 2).map((avatarUrl, index) => ({
    index,
    avatarUrl,
    proxiedAvatarUrl: getCorsProxyUrl(avatarUrl),
    available: true,
  }));
}

async function getPlayerReportInsights({ username, rid = '' }) {
  const params = new URLSearchParams();
  if (username) params.set('username', username);
  if (rid) params.set('rid', String(rid));

  const response = await fetch(buildApiUrl(`/reports/player-insights?${params.toString()}`));
  if (!response.ok) {
    return null;
  }

  const payload = await response.json().catch(() => ({}));
  return payload?.ok ? payload.player : null;
}

function createHttpStatusError(status) {
  const error = new Error(`HTTP ${status}`);
  error.name = 'HttpStatusError';
  error.status = status;
  return error;
}

function isNetworkOrCorsFailure(error) {
  if (!error || error.name === 'HttpStatusError') return false;

  const message = String(error.message || '').toLowerCase();
  return message.includes('failed to fetch')
    || message.includes('networkerror')
    || message.includes('load failed')
    || message.includes('cors');
}

function formatUnixTimeReadable(unixSeconds) {
  if (!Number.isFinite(unixSeconds) || unixSeconds <= 0) return 'Fecha desconocida';
  const date = new Date(unixSeconds * 1000);
  return date.toLocaleString('es-ES', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function normalizeBattleyeStatus(payload) {
  const text = typeof payload === 'string' ? payload.trim() : '';

  if (text.startsWith('<script') || text.includes('window.ACCESS_TKN')) {
    return {
      key: 'challenge',
      label: 'Verificacion bloqueada',
      detail: 'Battleye exige challenge anti-bot antes de responder.',
      tone: 'warning',
      isActive: null,
    };
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {
      key: 'unknown',
      label: 'Sin verificar',
      detail: 'No se pudo interpretar la respuesta de Battleye.',
      tone: 'neutral',
      isActive: null,
    };
  }

  const active = payload.active ?? payload.isActive ?? payload.valid ?? payload.success;
  const banned = payload.banned ?? payload.isBanned ?? false;
  const statusText = String(payload.status || payload.result || payload.message || '').toLowerCase();

  if (typeof active === 'boolean') {
    return {
      key: active ? 'active' : 'inactive',
      label: active ? 'Cuenta activa' : 'Cuenta inactiva',
      detail: payload.message || payload.status || 'Estado informado por Battleye.',
      tone: active ? 'success' : 'danger',
      isActive: active,
    };
  }

  if (typeof banned === 'boolean' && banned) {
    return {
      key: 'banned',
      label: 'Cuenta restringida',
      detail: payload.message || 'Battleye reporta estado restringido.',
      tone: 'danger',
      isActive: false,
    };
  }

  if (statusText.includes('active') || statusText.includes('valid')) {
    return {
      key: 'active',
      label: 'Cuenta activa',
      detail: payload.message || payload.status || 'Estado informado por Battleye.',
      tone: 'success',
      isActive: true,
    };
  }

  if (statusText.includes('inactive') || statusText.includes('invalid') || statusText.includes('ban')) {
    return {
      key: 'inactive',
      label: 'Cuenta inactiva',
      detail: payload.message || payload.status || 'Estado informado por Battleye.',
      tone: 'danger',
      isActive: false,
    };
  }

  return {
    key: 'unknown',
    label: 'Sin verificar',
    detail: payload.message || payload.status || 'Respuesta no concluyente de Battleye.',
    tone: 'neutral',
    isActive: null,
  };
}

async function fetchWithCorsFallback(url, options = {}) {
  const directRequest = async () => {
    const response = await fetch(url, options);
    if (!response.ok) {
      throw createHttpStatusError(response.status);
    }
    return { response, usedProxy: false };
  };

  try {
    return await directRequest();
  } catch (directError) {
    // Evita doble request innecesario para errores HTTP de la API (404/400/etc).
    if (!isNetworkOrCorsFailure(directError)) {
      throw directError;
    }

    try {
      const proxiedResponse = await fetch(`${CORS_ANYWHERE_BASE_URL}${url}`, options);
      if (!proxiedResponse.ok) {
        const proxyMessage = proxiedResponse.status === 403
          ? 'CORS Anywhere requiere activacion previa.'
          : createHttpStatusError(proxiedResponse.status).message;
        throw new Error(proxyMessage);
      }
      return { response: proxiedResponse, usedProxy: true };
    } catch (proxyError) {
      const detail = proxyError instanceof Error ? proxyError.message : 'fallo desconocido';
      const root = directError instanceof Error ? directError.message : 'fallo desconocido';
      throw new Error(`${root}. Fallback CORS falló: ${detail}`);
    }
  }
}

async function getPlayerRid(username) {
  if (!username || typeof username !== 'string') {
    throw new Error('Username invalido');
  }

  const { response, usedProxy } = await fetchWithCorsFallback(
    `https://sc-cache.com/n/${encodeURIComponent(username)}`,
  );
  const data = await response.json();

  if (!data?.id) {
    throw new Error('RID no encontrado en la respuesta');
  }

  return { rid: String(data.id), usedProxy };
}

async function getPlayerProfile(rid) {
  if (!rid) {
    throw new Error('RID invalido');
  }

  const { response, usedProxy } = await fetchWithCorsFallback(
    `https://sc-cache.com/r/${encodeURIComponent(String(rid))}`,
  );
  const data = await response.json();

  if (Array.isArray(data)) {
    const validEntries = data
      .filter((entry) => entry && typeof entry === 'object' && entry.name)
      .map((entry) => ({
        name: String(entry.name),
        time: Number.isFinite(entry.time) ? entry.time : 0,
      }))
      .sort((a, b) => b.time - a.time)
      .map((entry) => ({
        ...entry,
        timeReadable: formatUnixTimeReadable(entry.time),
        timeIso: Number.isFinite(entry.time) && entry.time > 0
          ? new Date(entry.time * 1000).toISOString()
          : null,
      }));

    if (validEntries.length === 0) {
      throw new Error('El historial de nombres esta vacio o es invalido');
    }

    return {
      usedProxy,
      profile: {
        name: validEntries[0].name,
        aliases: validEntries.slice(1).map((entry) => entry.name),
        names: validEntries.map((entry) => entry.name),
        nameHistory: validEntries,
        lastSeenUnix: validEntries[0].time,
        lastSeenReadable: validEntries[0].timeReadable,
      },
    };
  }

  if (!data || typeof data !== 'object') {
    throw new Error('Formato de perfil no soportado');
  }

  const fallbackName = data.name || data.nickname || data.username || data.player_name;
  if (!fallbackName) {
    throw new Error('No se encontro el nombre del jugador');
  }

  return {
    usedProxy,
    profile: {
      ...data,
      name: String(fallbackName),
      aliases: Array.isArray(data.aliases) ? data.aliases : [],
    },
  };
}

function getPlayerAvatarUrl(rid, index = 0) {
  if (!rid) {
    throw new Error('RID invalido para obtener avatar');
  }

  return `https://prod.cloud.rockstargames.com/members/sc/6266/${encodeURIComponent(String(rid))}/publish/gta5/mpchars/${index}.png`;
}

async function downloadPlayerAvatar(rid, index) {
  const avatarUrl = getPlayerAvatarUrl(rid, index);

  return {
    avatar: {
      index,
      avatarUrl,
      proxiedAvatarUrl: getCorsProxyUrl(avatarUrl),
      available: true,
    },
    usedProxy: false,
  };
}

async function fetchBattleyeAccountStatus() {
  try {
    const response = await fetch('/api/battleye-status');

    if (!response.ok) {
      throw createHttpStatusError(response.status);
    }

    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json')
      ? await response.json()
      : await response.text();

    return {
      status: normalizeBattleyeStatus(payload),
      usedProxy: false,
    };
  } catch (error) {
    return {
      status: {
        key: 'unavailable',
        label: 'Sin verificar',
        detail: `No se pudo consultar Battleye: ${error instanceof Error ? error.message : 'fallo desconocido'}`,
        tone: 'neutral',
        isActive: null,
      },
      usedProxy: false,
    };
  }
}

export async function investigatePlayerBackground(username) {
  if (!username || typeof username !== 'string' || username.trim() === '') {
    throw new Error('Username requerido');
  }

  const trimmedUsername = username.trim();

  if (isBlockedReportedUsername(trimmedUsername)) {
    throw new Error(BLOCKED_REPORTED_USERNAME_MESSAGE);
  }

  try {
    const { rid, usedProxy: ridProxy } = await getPlayerRid(trimmedUsername);
    const reportInsights = await getPlayerReportInsights({ username: trimmedUsername, rid });
    const nameHistory = extractNameHistoryFromInsights(reportInsights);
    const aliases = extractNamesFromInsights(reportInsights);
    const crews = mergeUniqueStrings(reportInsights?.crews);
    const avatars = extractPanelAvatarsFromInsights(reportInsights);
    const displayName = nameHistory[0]?.name || aliases[0] || trimmedUsername;
    const lastSeenReadable = reportInsights?.lastReportAt
      ? new Date(reportInsights.lastReportAt).toLocaleString('es-ES')
      : 'Sin datos de API local';

    return {
      username: trimmedUsername,
      rid,
      nombre: displayName,
      avatares: avatars,
      profile: {
        name: displayName,
        aliases,
        crews,
        nameHistory,
        lastSeenReadable,
      },
      reportInsights,
      accountStatus: null,
      corsPermissionRequired: false,
      corsPermissionUrl: CORS_PERMISSION_URL,
      usedCorsProxy: ridProxy,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    const reportInsights = await getPlayerReportInsights({ username: trimmedUsername }).catch(() => null);

    if (reportInsights?.reportCount > 0) {
      const aliases = extractNamesFromInsights(reportInsights);
      const nameHistory = extractNameHistoryFromInsights(reportInsights);
      const avatars = extractPanelAvatarsFromInsights(reportInsights);

      return {
        username: trimmedUsername,
        rid: reportInsights.rid || '',
        nombre: nameHistory[0]?.name || aliases[0] || trimmedUsername,
        avatares: avatars,
        profile: {
          name: nameHistory[0]?.name || aliases[0] || trimmedUsername,
          aliases: mergeUniqueStrings(aliases),
          crews: mergeUniqueStrings(reportInsights.crews),
          nameHistory,
          lastSeenReadable: reportInsights.lastReportAt
            ? new Date(reportInsights.lastReportAt).toLocaleString('es-ES')
            : 'Sin datos de API local',
        },
        reportInsights,
        accountStatus: null,
        corsPermissionRequired: false,
        corsPermissionUrl: CORS_PERMISSION_URL,
        usedCorsProxy: false,
        timestamp: new Date().toISOString(),
      };
    }

    console.error('[Investigation] ERROR durante investigacion:', error);
    throw new Error(`No se pudo investigar al jugador "${trimmedUsername}": ${error instanceof Error ? error.message : 'fallo desconocido'}`);
  }
}
