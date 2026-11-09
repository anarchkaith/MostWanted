import { BLOCKED_REPORTED_USERNAME_MESSAGE, isBlockedReportedUsername } from './blockedUsernames';
import { fetchPublicPlayerLookup, fetchWordpressPlayerInsights } from '../src/services/reportSubmissionService';
import { mergePlayerProfile } from '../src/services/playerProfile';

const CORS_ANYWHERE_BASE_URL = 'https://cors-anywhere.herokuapp.com/';

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
    available: true,
  }));
}

async function getPlayerReportInsights({ username, rid = '' }) {
  try {
    return await fetchWordpressPlayerInsights({ username, rid, signal: AbortSignal.timeout(12000) });
  } catch {
    // Sin sesión o con WordPress caído, se usa el perfil público (nombres y avatares externos).
    return fetchPublicPlayerLookup({ username, rid, signal: AbortSignal.timeout(12000) });
  }
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
  options = { ...options, signal: options.signal || AbortSignal.timeout(12000) };
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
    if (options.signal?.aborted) throw directError;
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
      if (options.signal?.aborted) throw proxyError;
      const detail = proxyError instanceof Error ? proxyError.message : 'fallo desconocido';
      const root = directError instanceof Error ? directError.message : 'fallo desconocido';
      throw new Error(`${root}. Fallback CORS falló: ${detail}`);
    }
  }
}

async function getPlayerRid(username, signal) {
  if (!username || typeof username !== 'string') {
    throw new Error('Username invalido');
  }

  const { response, usedProxy } = await fetchWithCorsFallback(
    `https://sc-cache.com/n/${encodeURIComponent(username)}`, { signal },
  );
  const data = await response.json();

  if (!data?.id) {
    throw new Error('RID no encontrado en la respuesta');
  }

  return { rid: String(data.id), usedProxy };
}

async function getPlayerProfile(rid, signal) {
  if (!rid) {
    throw new Error('RID invalido');
  }

  const { response, usedProxy } = await fetchWithCorsFallback(
    `https://sc-cache.com/r/${encodeURIComponent(String(rid))}`, { signal },
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

// Los avatares llegan del reporte (ya descargados en el servidor); nunca se consultan las APIs de Social Club.
function resolvePanelAvatars(reportInsights) {
  return extractPanelAvatarsFromInsights(reportInsights);
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

export async function investigatePlayerBackground(username, knownRid = '') {
  if (knownRid && !/^\d+$/.test(String(knownRid))) throw new Error('RID inválido');
  if ((!username || typeof username !== 'string' || username.trim() === '') && !/^\d+$/.test(knownRid)) {
    throw new Error('Nombre o RID requerido');
  }

  const trimmedUsername = typeof username === 'string' ? username.trim() : '';

  if (isBlockedReportedUsername(trimmedUsername)) {
    throw new Error(BLOCKED_REPORTED_USERNAME_MESSAGE);
  }

  const warnings = [];
  let reportInsights = null;
  try {
    reportInsights = await getPlayerReportInsights({ username: trimmedUsername, rid: knownRid });
  } catch (error) {
    warnings.push(`Reportes no disponibles: ${error.message}`);
  }

  // El RID guardado en los reportes es estable: sc-cache solo se consulta si aún no se conoce.
  let rid = String(knownRid || reportInsights?.rid || '');
  let usedCorsProxy = false;
  if (!rid && trimmedUsername) {
    try {
      const resolved = await getPlayerRid(trimmedUsername);
      rid = resolved.rid;
      usedCorsProxy = resolved.usedProxy;
    } catch {
      // Sin RID resuelto, el aviso de "Sin antecedentes" de más abajo ya informa al usuario.
    }
  }
  const hasStoredRid = Boolean(knownRid || reportInsights?.rid);
  if (rid && String(reportInsights?.rid || '') !== rid) {
    // Consultar por el RID resuelto evita mezclar el archivo de un nombre reutilizado.
    try {
      reportInsights = await getPlayerReportInsights({ rid });
    } catch (error) {
      reportInsights = null;
      warnings.push(`Reportes por RID no disponibles: ${error.message}`);
    }
  }
  let currentProfile = null;
  if (rid && !hasStoredRid) {
    try {
      currentProfile = (await getPlayerProfile(rid)).profile;
    } catch (error) {
      warnings.push(`Perfil externo no disponible: ${error.message}`);
    }
  }
  const profile = mergePlayerProfile({ username: trimmedUsername, rid, profile: currentProfile, reportInsights });
  if (!rid && !reportInsights) warnings.push('Sin antecedentes disponibles. Puedes registrar el jugador y aportar los datos que conozcas.');
  return {
    username: trimmedUsername,
    rid,
    nombre: profile.name,
    avatares: resolvePanelAvatars(reportInsights).map(avatar => ({
      ...avatar, source: 'Datos reportados',
    })),
    currentProfile,
    profile,
    reportInsights,
    warnings,
    accountStatus: null,
    corsPermissionRequired: false,
    usedCorsProxy,
    timestamp: new Date().toISOString(),
  };
}
