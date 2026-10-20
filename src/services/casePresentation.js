import { resolvePlayerRid } from '../../shared/playerIdentity.js';

export const CASE_STATUSES = { open: 'Abierto', investigating: 'En investigación', closed: 'Cerrado' };
export const VALIDATION_LABELS = { pendiente: 'Pendiente', investigando: 'En investigación', verificado: 'Verificado', rechazado: 'Rechazado' };

export function normalizeReportValidation(value) {
  return ({ pending: 'pendiente', investigating: 'investigando', verified: 'verificado', rejected: 'rechazado' })[value] || value || '';
}

function reportDay(value) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return value;
  const date = new Date(value);
  if (!value || !Number.isFinite(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function reportCategories(report) {
  return report.categories?.length ? report.categories : [report.categoria].filter(Boolean);
}

export function playerCandidates(reports, query) {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return [];
  const players = new Map();
  for (const report of reports) {
    const nickname = String(report.usuario || '').trim();
    const rid = resolvePlayerRid(report);
    const names = [nickname, ...(Array.isArray(report.aliases) ? report.aliases : [])]
      .map(name => String(name || '').trim()).filter(Boolean);
    if (!names.some(name => name.toLocaleLowerCase().includes(normalized)) && !rid.includes(normalized)) continue;
    const key = rid ? `rid:${rid}` : `name:${nickname.toLocaleLowerCase()}`;
    if (!players.has(key)) players.set(key, { nickname, rid, key, names: [], count: 0 });
    players.get(key).names = [...new Set([...players.get(key).names, ...names])];
    players.get(key).count += 1;
  }
  return [...players.values()];
}

export function filterCaseReports(reports, { category = '', validation = '', from = '', to = '', query = '' } = {}) {
  const text = query.trim().toLocaleLowerCase();
  return reports.filter(report => {
    const date = reportDay(report.fecha);
    return (!category || reportCategories(report).includes(category))
      && (!validation || report.validacion === validation)
      && (!from || (date && date >= from))
      && (!to || (date && date <= to))
      && (!text || [report.usuario, report.motivo, report.id].join(' ').toLocaleLowerCase().includes(text));
  }).sort((a, b) => {
    const left = Date.parse(a.fecha);
    const right = Date.parse(b.fecha);
    const dateOrder = (Number.isFinite(right) ? right : -Infinity) - (Number.isFinite(left) ? left : -Infinity);
    return (Number.isNaN(dateOrder) ? 0 : dateOrder) || String(b.id).localeCompare(String(a.id), undefined, { numeric: true });
  });
}

export function summarizeVotes(reports) {
  const up = reports.reduce((sum, report) => sum + (Number(report.votos?.up) || 0), 0);
  const down = reports.reduce((sum, report) => sum + (Number(report.votos?.down) || 0), 0);
  return { up, down, total: up + down, percent: up + down ? Math.round(up / (up + down) * 100) : null };
}

export function formatCaseDate(value, includeTime = false) {
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value || '') ? `${value}T12:00:00` : value);
  if (!value || !Number.isFinite(date.getTime())) return 'Fecha desconocida';
  return includeTime ? date.toLocaleString('es-ES') : date.toLocaleDateString('es-ES');
}
