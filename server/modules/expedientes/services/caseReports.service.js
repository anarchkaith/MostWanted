import { resolvePlayerRid } from '../../../../shared/playerIdentity.js';

const text = (value) => value == null ? '' : String(value).trim();
export const normalizeName = (value) => text(value).toLowerCase().normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ');
export const normalizeRid = (value) => /^\d+$/.test(text(value)) ? text(value) : '';
const list = (value) => Array.isArray(value) ? value : text(value) ? text(value).split(/[,;|]/).map(text).filter(Boolean) : [];
const strings = (value) => list(value).map((item) => text(typeof item === 'object' ? item?.name || item?.label : item)).filter(Boolean);
const count = (value) => Number.isFinite(Number(value)) ? Math.max(0, Math.trunc(Number(value))) : 0;

// An allowlist is deliberate: WP may return ingestion payloads, IPs and Discord IDs.
export function publicReport(raw) {
  const votes = raw.communityVerification || raw.votes || {};
  const validation = raw.rejectedByStaff === true ? 'rejected'
    : text(raw.staffValidation?.status || raw.staffValidation || raw.validation?.status || raw.validation
      || raw.validacion?.status || raw.validacion
      || (['rejected', 'rechazado', 'rechazada'].includes(normalizeName(raw.estado)) ? raw.estado : '')) || null;
  let createdAt = text(raw.createdAt || raw.fechaReporte || raw.fecha || raw.created_at) || null;
  if (!createdAt && Number.isFinite(Number(raw.time)) && Number(raw.time) > 0) {
    const date = new Date(Number(raw.time) * (Number(raw.time) < 1e12 ? 1000 : 1));
    createdAt = Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  
  // Fallback: parse nickname and rid from title if not provided
  let nickname = text(raw.nickname || raw.usuario || raw.username);
  let rid = resolvePlayerRid(raw);
  
  if (!nickname || !rid) {
    const title = text(raw.title);
    if (title) {
      const ridMatch = title.match(/\[RID\s+(\d+)\]/i);
      if (ridMatch && !rid) {
        rid = ridMatch[1];
      }
      if (!nickname) {
        nickname = title.replace(/\s*\[RID\s+\d+\]\s*$/i, '');
      }
    }
  }
  
  return {
    id: raw.id,
    title: text(raw.title),
    nickname,
    rid: rid || null,
    categories: strings(raw.categories || raw.typesOfInfraction || raw.categoria),
    typesOfInfraction: strings(raw.typesOfInfraction || raw.categories || raw.categoria),
    labels: list(raw.labels || raw.etiquetas).map((item) => typeof item === 'object'
      ? { id: item?.id ?? null, name: text(item?.name || item?.label),
        label: text(item?.label || item?.name), detail: text(item?.detail) } : text(item)),
    validation,
    content: text(raw.content || raw.reason || raw.motivo),
    reason: text(raw.reason || raw.content || raw.motivo),
    createdAt,
    time: typeof raw.time === 'number' || typeof raw.time === 'string' ? raw.time : null,
    investigation_status: text(raw.investigation_status),
    anonymous: Boolean(raw.anonymous),
    aliases: strings(raw.aliases),
    crews: list(raw.crews).map((item) => typeof item === 'object'
      ? { name: text(item?.name), url: text(item?.url) } : { name: text(item), url: '' }),
    avatar1: text(raw.avatar1), avatar2: text(raw.avatar2),
    evidence: list(raw.evidence || raw.evidencia).map((item) => typeof item === 'object'
      ? { url: text(item?.url), name: text(item?.name), contentType: text(item?.contentType) }
      : { url: text(item), name: '', contentType: '' }),
    communityVerification: {
      up: count(votes.up), down: count(votes.down), score: count(votes.up) - count(votes.down),
      confirmations: list(votes.confirmations).map((entry) => ({
        reason: text(entry?.reason),
      })),
    },
    source: 'wordpress',
    origin: text(raw.origin || (raw.source !== 'wordpress' ? raw.source : '')) || null,
  };
}

export function matchReports(reports, { nickname = '', rid = '' }) {
  const targetRid = normalizeRid(rid);
  const targetName = normalizeName(nickname);
  const seen = new Set();
  return reports.filter((report) => {
    if (!report || report.id == null || seen.has(String(report.id))) return false;
    const reportRid = normalizeRid(report.rid);
    const reportName = normalizeName(report.nickname);
    // If we have a RID, match by RID (with name as fallback for name-only reports)
    // If we only have a name, match by name (regardless of whether report has RID)
    const matches = targetRid
      ? (reportRid === targetRid || (reportRid === '' && targetName && reportName === targetName))
      : (targetName && reportName === targetName);
    if (matches) seen.add(String(report.id));
    return matches;
  }).sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0)
    || String(a.id).localeCompare(String(b.id), undefined, { numeric: true }));
}

export function createCaseReportsSource({ config, fetchImpl = fetch }) {
  return async ({ nickname = '', rid = '' }) => {
    if (!config?.enabled || !config?.baseUrl || !config?.apiSecret) throw new Error('wordpress_source_not_configured');
    if (!nickname && !rid) throw new Error('player_identity_required');
    const reports = [];
    for (let page = 1; page <= 1000; page++) {
      const url = new URL(`${String(config.baseUrl).replace(/\/+$/, '')}/wp-json/mostwanted/v1/reports`);
      url.searchParams.set('page', String(page));
      url.searchParams.set('per_page', '100');
      // Fetch by name as well for RID-less historical reports; matching below never joins conflicting RIDs.
      if (nickname) url.searchParams.set('nickname', nickname);
      else if (rid) url.searchParams.set('rid', rid);
      const response = await fetchImpl(url, { headers: {
        Accept: 'application/json', Authorization: `Bearer ${config.apiSecret}`,
      }, signal: AbortSignal.timeout(config.timeoutMs || 9000) });
      if (!response.ok) throw new Error(`wordpress_source_${response.status}`);
      const payload = await response.json();
      if (payload.ok === false || !Array.isArray(payload.items)) throw new Error('wordpress_source_invalid_payload');
      reports.push(...payload.items.map(publicReport));
      if (payload.items.length < 100) {
        // A renamed player can have additional RID-linked reports under historical names.
        if (rid && nickname) {
          const byRid = await createCaseReportsSource({ config, fetchImpl })({ rid });
          reports.push(...byRid);
        }
        return reports;
      }
    }
    throw new Error('wordpress_source_pagination_limit');
  };
}
