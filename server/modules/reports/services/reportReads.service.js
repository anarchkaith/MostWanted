import { readWordpressReport, readWordpressPlayerInsights, postWordpressReportVote } from '../../../reports/wordpressClient.js';
import { hasWordpressReportsConfig } from '../../../reports/wordpressConfig.js';
import { publicReport } from '../../expedientes/services/caseReports.service.js';
import { buildScAvatarCandidates, fetchScCacheAliases } from '../../../reportes/store.js';

const MAX_PLAYER_NAMES = 60;
const MAX_PLAYER_AVATARS = 8;

function nameKey(value) {
  return String(value || '').trim().toLowerCase();
}

function mergeNameEntries(...lists) {
  const byName = new Map();
  for (const entry of lists.flat()) {
    const item = typeof entry === 'string' ? { name: entry, time: 0 } : entry;
    const name = String(item?.name || '').trim();
    if (!name) continue;
    const key = nameKey(name);
    const time = Number(item.time) || 0;
    const previous = byName.get(key);
    if (!previous || time > previous.time) byName.set(key, { name, time });
  }
  return [...byName.values()]
    .sort((a, b) => b.time - a.time || a.name.localeCompare(b.name))
    .slice(0, MAX_PLAYER_NAMES);
}

function mergeAvatarUrls(...lists) {
  const urls = new Set();
  for (const item of lists.flat()) {
    const url = String(typeof item === 'string' ? item : item?.url || item?.avatarUrl || '').trim();
    if (/^https?:\/\//i.test(url)) urls.add(url);
  }
  return [...urls].slice(0, MAX_PLAYER_AVATARS);
}

/**
 * Completa el perfil con nombres historicos y avatares a partir del RID (sc-cache y Rockstar).
 */
async function enrichPlayerWithRid(player, rid) {
  const normalizedRid = String(rid || player?.rid || '').trim();
  if (!/^\d+$/.test(normalizedRid)) return player;

  const scCache = await fetchScCacheAliases({ rid: normalizedRid });
  const names = mergeNameEntries(player?.names || [], scCache.names || []);
  const avatars = mergeAvatarUrls(player?.avatars || [], buildScAvatarCandidates(normalizedRid));
  if (!player && names.length === 0 && avatars.length === 0) return null;

  return {
    ...(player || {}),
    rid: normalizedRid,
    names,
    avatars,
  };
}

export async function accessReportData({ config, reportId, username = '', rid = '', vote, user, logger = console }) {
  if (!hasWordpressReportsConfig(config)) {
    return { status: 503, payload: { ok: false, error: 'La consulta requiere configurar la integracion con WordPress.' } };
  }
  const id = Number(reportId);
  if (reportId !== undefined && (!Number.isSafeInteger(id) || id <= 0)) {
    return { status: 400, payload: { ok: false, error: 'ID de reporte invalido.' } };
  }
  if (reportId === undefined && (typeof username !== 'string' || typeof rid !== 'string'
    || (!username.trim() && !rid) || username.length > 128 || (rid && !/^\d{1,30}$/.test(rid)))) {
    return { status: 400, payload: { ok: false, error: 'Indica un nombre o RID valido.' } };
  }
  if (vote && (!['up', 'down'].includes(vote.voteType) || typeof vote.reason !== 'string'
    || typeof vote.voterName !== 'string' || vote.reason.length > 10000 || vote.voterName.length > 128
    || (vote.voteType === 'down' && (vote.reason.trim().length < 8 || vote.voterName.trim().length < 2)))) {
    return { status: 400, payload: { ok: false, error: 'Voto o motivo invalido.' } };
  }
  try {
    const result = vote
      ? await postWordpressReportVote({ config, reportId: id, logger, vote: {
        voteType: vote.voteType, reason: vote.reason.trim(), voterName: vote.voterName.trim(),
        voterId: String(user.id),
      } })
      : reportId !== undefined
        ? await readWordpressReport({ config, reportId: id, logger })
        : await readWordpressPlayerInsights({ config, username: username.trim(), rid, logger });
    const data = result.payload;
    if (data?.ok !== true) throw new Error('invalid_wordpress_response');
    if (vote) {
      const verification = data.communityVerification;
      if (!Number.isSafeInteger(verification?.up) || !Number.isSafeInteger(verification?.down)) throw new Error('invalid_vote_response');
      return { status: 200, payload: { ok: true, communityVerification: {
        up: verification.up, down: verification.down,
        confirmations: (verification.confirmations || []).map(entry => ({ reason: String(entry.reason || '') })),
      } } };
    }
    if (reportId !== undefined) {
      if (!data.report || Number(data.report.id) !== id) throw new Error('invalid_report_response');
      return { status: 200, payload: { ok: true, report: publicReport(data.report) } };
    }
    if (data.player !== null && (!data.player || typeof data.player !== 'object' || Array.isArray(data.player))) throw new Error('invalid_player_response');
    const player = await enrichPlayerWithRid(data.player, rid);
    return { status: 200, payload: { ok: true, player } };
  } catch (error) {
    logger.error('[reports] No se pudo consultar o actualizar el reporte.', { status: error.status || 0, message: error.message });
    return { status: error.status === 404 && error.code !== 'rest_no_route' ? 404 : 502,
      payload: { ok: false, error: 'No se pudo consultar o actualizar el reporte. Comprueba la conexion y el plugin WordPress.' } };
  }
}
