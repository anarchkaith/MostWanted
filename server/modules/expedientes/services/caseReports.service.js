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
  const severity = text(raw.severity || raw.severidad || raw.analysis?.severity || raw.analysis?.severidad) || null;
  const validation = raw.rejectedByStaff === true ? 'rejected'
    : text(raw.staffValidation?.status || raw.staffValidation || raw.validation?.status || raw.validation
      || raw.validacion?.status || raw.validacion
      || (['rejected', 'rechazado', 'rechazada'].includes(normalizeName(raw.estado)) ? raw.estado : '')) || null;
  let createdAt = text(raw.createdAt || raw.fechaReporte || raw.fecha || raw.created_at) || null;
  if (!createdAt && Number.isFinite(Number(raw.time)) && Number(raw.time) > 0) {
    const date = new Date(Number(raw.time) * (Number(raw.time) < 1e12 ? 1000 : 1));
    createdAt = Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  return {
    id: raw.id,
    title: text(raw.title),
    nickname: text(raw.nickname || raw.usuario || raw.username),
    rid: resolvePlayerRid(raw) || null,
    categories: strings(raw.categories || raw.typesOfInfraction || raw.categoria),
    typesOfInfraction: strings(raw.typesOfInfraction || raw.categories || raw.categoria),
    labels: list(raw.labels || raw.etiquetas).map((item) => typeof item === 'object'
      ? { id: item?.id ?? null, name: text(item?.name || item?.label),
        label: text(item?.label || item?.name), detail: text(item?.detail) } : text(item)),
    severity,
    severidad: severity,
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
    const matches = targetRid
      ? (reportRid ? reportRid === targetRid : Boolean(targetName && normalizeName(report.nickname) === targetName))
      : Boolean(targetName && normalizeName(report.nickname) === targetName && !reportRid);
    if (matches) seen.add(String(report.id));
    return matches;
  }).sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0)
    || String(a.id).localeCompare(String(b.id), undefined, { numeric: true }));
}

export function calculatePriority(reports) {
  const levels = ['low', 'normal', 'high', 'critical'];
  const severities = { baja: 0, low: 0, media: 1, medium: 1, normal: 1, alta: 2, high: 2, critica: 3, critical: 3 };
  let result = { level: 'undetermined', reason: 'Sin reportes elegibles con severidad conocida.', reportId: null, severity: null, balance: null };
  let max = -1;
  for (const report of reports) {
    if (['rejected', 'rechazado', 'rechazada'].includes(normalizeName(report.validation))) continue;
    const severity = normalizeName(report.severity || report.severidad);
    const base = severities[severity];
    if (base === undefined) continue;
    const balance = count(report.communityVerification?.up) - count(report.communityVerification?.down);
    const rank = Math.min(3, base + (balance >= 5 ? 1 : 0));
    if (rank <= max) continue;
    max = rank;
    result = { level: levels[rank], reportId: report.id, severity: report.severity || report.severidad, balance,
      reason: `Reporte ${report.id}: severidad ${report.severity || report.severidad}, saldo ${balance}${balance >= 5 ? '; incremento de un nivel (tope crítica)' : ''}.` };
  }
  return result;
}

export function createCaseReportsSource({ config, fetchImpl = fetch }) {
  return async ({ nickname = '', rid = '' }) => {
    if (!config?.enabled || !config?.baseUrl) throw new Error('wordpress_source_not_configured');
    const reports = [];
    for (let page = 1; page <= 1000; page++) {
      const url = new URL(`${String(config.baseUrl).replace(/\/+$/, '')}/wp-json/mostwanted/v1/reports`);
      url.searchParams.set('page', String(page));
      url.searchParams.set('per_page', '100');
      // Fetch by name as well for RID-less historical reports; matching below never joins conflicting RIDs.
      if (nickname) url.searchParams.set('nickname', nickname);
      else if (rid) url.searchParams.set('rid', rid);
      const response = await fetchImpl(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(config.timeoutMs || 9000) });
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
