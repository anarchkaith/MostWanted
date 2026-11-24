import crypto from 'node:crypto';
import { fetchScCacheAliases, fetchScCacheRidByName } from '../../../reportes/store.js';
import { buildCareerMetrics, detectCareerSignals, formatMoney, sortSignals } from './careerSignals.js';

export const INTEL_POLICY_VERSION = 2;

const INTEL_TTL_MS = 10 * 60 * 1000;
const MAX_CACHE_ENTRIES = 300;
const MAX_NAMES = 30;
const RID_PATTERN = /^\d{1,30}$/;
const SOCIAL_CLUB_NAME = /^[A-Za-z0-9_-]{1,32}$/;
const PLATFORM_LABELS = {
  pc: 'PC Legacy', pcalt: 'PC Enhanced', ps4: 'PlayStation 4', ps5: 'PlayStation 5',
  xboxone: 'Xbox One', xboxsx: 'Xbox Series X/S',
};

const round = (value, digits = 0) => (value === null || value === undefined ? null : Number(value.toFixed(digits)));

function sameName(left, right) {
  return String(left || '').trim().toLowerCase() === String(right || '').trim().toLowerCase();
}

function publicMetrics(metrics) {
  return {
    rank: metrics.rank,
    rp: metrics.rp,
    cashBalance: metrics.cashBalance,
    totalEarned: metrics.totalEarned,
    totalSpent: metrics.totalSpent,
    hoursOnline: round(metrics.hoursOnline, 1),
    kdRatio: metrics.kdRatio,
    playerKills: metrics.playerKills,
    playerDeaths: metrics.playerDeaths,
    accuracy: round(metrics.accuracy, 3),
    headshotRate: round(metrics.headshotRate, 3),
    rpPerHour: round(metrics.rpPerHour),
    pickedUpMoney: metrics.pickedUpMoney,
    receivedMoney: metrics.receivedMoney,
  };
}

function buildSignature(intel) {
  return crypto.createHash('sha256').update(JSON.stringify(toIntelDigest(intel))).digest('hex').slice(0, 16);
}

/**
 * Inteligencia unificada de un jugador: identidad Rockstar, historial de nombres,
 * cuenta y crew de Social Club, carrera por plataforma y señales de incongruencia.
 */
export function createPlayerIntel({
  socialClub,
  fetchAliases = fetchScCacheAliases,
  resolveRidByName = fetchScCacheRidByName,
  now = () => Date.now(),
  logger = console,
}) {
  const cache = new Map();

  async function findAccount(name, rid) {
    if (!SOCIAL_CLUB_NAME.test(name || '')) return { account: null, ok: true };
    const result = await socialClub.searchPlayers({ name });
    if (result.status !== 200) return { account: null, ok: false };
    const accounts = result.payload.accounts || [];
    const account = rid ? accounts.find(entry => entry.rid === rid) : accounts.find(entry => sameName(entry.name, name));
    return { account: account || null, ok: true };
  }

  async function loadPlatform(rid, platform) {
    const overview = await socialClub.getCareer({ rid, platform });
    if (overview.status !== 200) return { platform, ok: false };
    if (!overview.payload.hasCareer) return { platform, ok: true, hasCareer: false };
    const stats = await socialClub.getCareer({ rid, platform, section: 'stats' });
    const statsRows = stats.status === 200 && stats.payload.hasCareer ? stats.payload.rows : [];
    const metrics = buildCareerMetrics({ overviewRows: overview.payload.rows, statsRows });
    return {
      platform, ok: true, hasCareer: true, statsAvailable: statsRows.length > 0,
      metrics, signals: detectCareerSignals(metrics, platform),
    };
  }

  async function build({ nickname, rid }) {
    const limitations = [];
    let { account, ok: accountOk } = await findAccount(nickname, rid);
    let resolvedRid = rid || account?.rid || '';
    if (!resolvedRid && nickname) resolvedRid = await resolveRidByName({ username: nickname });
    if (!RID_PATTERN.test(resolvedRid)) {
      return { ok: true, found: false, generatedAt: new Date(now()).toISOString(), query: { nickname, rid } };
    }

    const aliases = await fetchAliases({ rid: resolvedRid });
    const names = (aliases.names || [])
      .filter(entry => entry?.name)
      .sort((a, b) => (Number(b.time) || 0) - (Number(a.time) || 0))
      .slice(0, MAX_NAMES)
      .map(entry => ({ name: String(entry.name), time: Number(entry.time) || 0 }));
    if (!aliases.fetched) limitations.push('No se pudo consultar el historial de nombres.');

    const currentName = names[0]?.name || account?.name || nickname;
    if (!account || account.rid !== resolvedRid) {
      ({ account, ok: accountOk } = await findAccount(currentName, resolvedRid));
    }
    if (!accountOk) limitations.push('No se pudo consultar la cuenta de Social Club.');

    const careers = await Promise.all(socialClub.platforms.map(platform => loadPlatform(resolvedRid, platform)));
    const failed = careers.filter(entry => !entry.ok).map(entry => PLATFORM_LABELS[entry.platform]);
    if (failed.length) limitations.push(`No se pudo consultar la carrera en: ${failed.join(', ')}.`);
    const platforms = careers.filter(entry => entry.hasCareer);
    platforms.filter(entry => !entry.statsAvailable)
      .forEach(entry => limitations.push(`Sin estadísticas detalladas en ${PLATFORM_LABELS[entry.platform]}.`));

    const signals = sortSignals(platforms.flatMap(entry => entry.signals));
    const crew = account?.crew || null;
    const intel = {
      ok: true,
      found: true,
      generatedAt: new Date(now()).toISOString(),
      identity: {
        rid: resolvedRid,
        nickname: currentName,
        names,
        socialClub: account ? { name: account.name, avatarUrl: account.avatarUrl, crew } : null,
      },
      platforms: platforms.map(entry => ({
        platform: entry.platform, label: PLATFORM_LABELS[entry.platform], metrics: publicMetrics(entry.metrics),
      })),
      signals,
      summary: {
        alta: signals.filter(entry => entry.severity === 'alta').length,
        media: signals.filter(entry => entry.severity === 'media').length,
        baja: signals.filter(entry => entry.severity === 'baja').length,
      },
      limitations,
      complete: failed.length === 0 && platforms.every(entry => entry.statsAvailable) && aliases.fetched && accountOk,
    };
    return { ...intel, signature: buildSignature(intel) };
  }

  async function getPlayerIntel({ nickname = '', rid = '' } = {}) {
    const cleanName = typeof nickname === 'string' ? nickname.trim() : '';
    const cleanRid = typeof rid === 'string' ? rid.trim() : '';
    if ((!cleanName && !cleanRid) || cleanName.length > 64 || (cleanRid && !RID_PATTERN.test(cleanRid))) {
      return { status: 400, payload: { ok: false, error: 'Indica un nombre o RID válido.' } };
    }
    const key = cleanRid ? `rid:${cleanRid}` : `name:${cleanName.toLowerCase()}`;
    const hit = cache.get(key);
    if (hit && hit.expiresAt > now()) return { status: 200, payload: hit.payload };
    try {
      const payload = await build({ nickname: cleanName, rid: cleanRid });
      if (payload.found === false || payload.complete) {
        cache.set(key, { payload, expiresAt: now() + INTEL_TTL_MS });
        if (cache.size > MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value);
      }
      return { status: 200, payload };
    } catch (error) {
      logger.error('[intel] No se pudo construir la inteligencia del jugador.', { message: error.message });
      return { status: 502, payload: { ok: false, error: 'No se pudo analizar al jugador. Intentá de nuevo en unos minutos.' } };
    }
  }

  return { getPlayerIntel };
}

function isoDate(seconds) {
  return seconds ? new Date(seconds * 1000).toISOString().slice(0, 10) : null;
}

/**
 * Versión compacta en español para los prompts de HEX.
 */
export function toIntelDigest(intel) {
  if (!intel?.found) return null;
  const percent = value => (value === null || value === undefined ? null : `${Math.round(value * 100)}%`);
  const money = value => (value === null || value === undefined ? null : formatMoney(value));
  return {
    rid: intel.identity.rid,
    nombreActual: intel.identity.nickname,
    historialNombres: intel.identity.names.slice(0, 12).map(entry => ({ nombre: entry.name, desde: isoDate(entry.time) })),
    crewSocialClub: intel.identity.socialClub?.crew
      ? { nombre: intel.identity.socialClub.crew.name, tag: intel.identity.socialClub.crew.tag }
      : null,
    carreras: intel.platforms.map(({ label, metrics }) => ({
      plataforma: label,
      rango: metrics.rank,
      horasOnline: metrics.hoursOnline,
      rpPorHora: metrics.rpPerHour,
      saldo: money(metrics.cashBalance),
      ingresosTotales: money(metrics.totalEarned),
      gastosTotales: money(metrics.totalSpent),
      dineroRecogido: money(metrics.pickedUpMoney),
      dineroRecibido: money(metrics.receivedMoney),
      kdJugadores: metrics.kdRatio,
      jugadoresEliminados: metrics.playerKills,
      muertesPorJugadores: metrics.playerDeaths,
      precision: percent(metrics.accuracy),
      tirosALaCabeza: percent(metrics.headshotRate),
    })),
    señales: intel.signals.filter(entry => entry.id === 'rank_over_cap').map(entry => ({
      id: entry.id,
      severidad: entry.severity,
      plataforma: entry.platform ? PLATFORM_LABELS[entry.platform] : 'cuenta',
      titulo: entry.title,
      detalle: entry.detail,
      umbral: entry.threshold,
    })),
    limitaciones: intel.limitations,
  };
}

export function sanitizeIntelDigest(digest) {
  if (!digest) return null;
  return {
    ...digest,
    carreras: digest.carreras.map(career => {
      const clean = { ...career };
      delete clean.dineroSinOrigen;
      delete clean.ingresosPorHora;
      return clean;
    }),
    señales: digest.señales.filter(entry => entry.id === 'rank_over_cap'),
  };
}

export const INTEL_PROMPT_RULES = [
  'La INTELIGENCIA DEL JUGADOR proviene de Social Club y sc-cache (fuentes no oficiales).',
  'Solo se marcan límites verificables; una incongruencia también puede ser un error de la fuente y nunca demuestra uso de mods.',
  'No uses el dinero, su saldo, ingresos, gastos ni procedencia como señal de incongruencia o argumento de sospecha de mods: son datos informativos.',
  'K/D, precisión, tiros a la cabeza, RP por hora y cambios de nombre son información neutral: valores altos o cambios frecuentes no prueban trampas ni justifican nuevas señales.',
  'No inventes límites ni compares contadores de distinto alcance como si fueran equivalentes. La ausencia de señales tampoco demuestra que el jugador sea legítimo.',
  'Cruza únicamente las incongruencias verificables con las categorías y relatos de los reportes; distingue las denuncias de los hechos y destaca también contradicciones.',
  'Explica qué dato concreto sostiene cada observación y menciona las limitaciones si existen.',
].join(' ');
