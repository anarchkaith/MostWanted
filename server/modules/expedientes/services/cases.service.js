import crypto from 'node:crypto';
import { readExpedientes, updateExpedientes } from './expedientesStore.service.js';
import { calculatePriority, matchReports, normalizeName, normalizeRid, publicReport } from './caseReports.service.js';
import { publicClassification, refreshCaseSummary } from './caseSummary.service.js';

function findCase(items, { id, nickname, rid }) {
  if (id) return items.find((item) => item.expedienteId === id);
  return items.find((item) => rid
    ? normalizeRid(item.player?.rid) === rid
    : !normalizeRid(item.player?.rid) && normalizeName(item.player?.nickname) === normalizeName(nickname));
}

export function publicCase(item, reports = item.caseSnapshot?.reports || []) {
  return {
    id: item.expedienteId,
    player: { nickname: item.player.nickname, rid: item.player.rid || null },
    status: ['open', 'investigating', 'closed'].includes(item.status) ? item.status : 'open',
    createdAt: item.createdAt, updatedAt: item.updatedAt,
    priority: calculatePriority(reports), reportIds: reports.map((report) => report.id),
    classification: publicClassification(item, reports),
  };
}

export async function readCase({ rootDir, source, generateCaseSummary, id, nickname = '', rid = '' }) {
  rid = normalizeRid(rid);
  let item = findCase(readExpedientes(rootDir), { id, nickname, rid });
  if (id && !item) return { status: 404, payload: { ok: false, error: 'case_not_found' } };
  const identity = item?.player || { nickname, rid };
  let reports;
  let sourceInfo;
  try {
    const available = await source(identity);
    if (!item && !rid) {
      const matching = available.filter((report) => normalizeName(report.nickname) === normalizeName(nickname));
      const rids = [...new Set(matching.map((report) => normalizeRid(report.rid)).filter(Boolean))];
      if (rids.length > 1) return { status: 409, payload: { ok: false, error: 'ambiguous_player',
        candidates: rids.map((value) => ({ nickname, rid: value })) } };
      if (rids.length === 1) {
        rid = rids[0];
        identity.rid = rid;
        item = findCase(readExpedientes(rootDir), { nickname, rid });
      }
    }
    reports = matchReports(available.map(publicReport), identity);
    sourceInfo = { name: 'wordpress-snapshot', stale: false, fetchedAt: new Date().toISOString(), error: null };
  } catch {
    if (!item?.caseSnapshot) return { status: 502, payload: { ok: false, error: 'reports_source_unavailable', case: item ? publicCase(item, []) : null, reports: null,
      source: { name: 'wordpress-snapshot', stale: true, fetchedAt: null, error: 'reports_source_unavailable' } } };
    reports = item.caseSnapshot.reports.map(publicReport);
    sourceInfo = { name: 'wordpress-snapshot', stale: true, fetchedAt: item.caseSnapshot.fetchedAt, error: 'reports_source_unavailable' };
  }
  if (!sourceInfo.stale && (item || reports.length)) {
    item = updateExpedientes(rootDir, (items) => {
      let current = findCase(items, { id, nickname, rid });
      const now = new Date().toISOString();
      if (!current) {
        current = { expedienteId: `case-${crypto.randomUUID()}`,
          playerKey: rid ? `rid:${rid}` : `name:${normalizeName(nickname)}`,
          player: { nickname: nickname || reports.find((report) => report.nickname)?.nickname || '', rid: rid || null },
          status: 'open', notes: [], staffNotes: [], history: [], reports: [],
          votes: { legit: 0, not_legit: 0, entries: [] }, createdAt: now, updatedAt: now };
        items.push(current);
      }
      const changed = JSON.stringify(current.caseSnapshot?.reports) !== JSON.stringify(reports);
      if (changed) {
        if (current.status === 'closed') {
          const oldIds = new Set((current.caseSnapshot?.reports || []).map((report) => String(report.id)));
          const newIds = reports.filter((report) => !oldIds.has(String(report.id))).map((report) => report.id);
          if (newIds.length) {
            current.history = [...(current.history || []), { id: crypto.randomUUID(), type: 'new_reports_on_closed_case',
              reportIds: newIds, createdAt: now }];
          }
        }
        current.updatedAt = now;
      }
      current.caseSnapshot = { reports, fetchedAt: sourceInfo.fetchedAt };
      return current;
    });
    if (generateCaseSummary) {
      item = await refreshCaseSummary({ rootDir, id: item.expedienteId, generate: generateCaseSummary });
    }
  }
  return { status: 200, payload: { ok: true, case: item ? publicCase(item, reports) : null, reports, source: sourceInfo,
    association: identity.rid ? 'rid' : 'name',
    nameOnlyReportIds: reports.filter((report) => !report.rid).map((report) => report.id) } };
}

export function staffCase({ rootDir, id }) {
  const item = findCase(readExpedientes(rootDir), { id });
  if (!item) return null;
  return staffCaseFromItem(item);
}

export function manageCase({ rootDir, id, user, text, status, reason }) {
  return updateExpedientes(rootDir, (items) => {
    const item = findCase(items, { id });
    if (!item) return null;
    const createdAt = new Date().toISOString();
    const author = { id: String(user.id), name: String(user.globalName || user.username || user.id) };
    if (text !== undefined) {
      const note = { id: crypto.randomUUID(), text, author, createdAt };
      item.staffNotes = [...(item.staffNotes || []), note];
      item.history = [...(item.history || []), { id: crypto.randomUUID(), type: 'note_added', noteId: note.id, author, createdAt }];
    } else {
      item.history = [...(item.history || []), { id: crypto.randomUUID(), type: 'status_changed',
        from: item.status || 'open', to: status, reason, author, createdAt }];
      item.status = status;
    }
    item.updatedAt = createdAt;
    return { case: publicCase(item), ...staffCaseFromItem(item) };
  });
}

function staffCaseFromItem(item) {
  const closure = item.status === 'closed'
    ? [...(item.history || [])].reverse().find((event) => event.type === 'status_changed' && event.to === 'closed')
    : null;
  const closedTime = Date.parse(closure?.createdAt);
  const reportIds = Number.isFinite(closedTime)
    ? (item.caseSnapshot?.reports || [])
      .filter((report) => Date.parse(report.createdAt) > closedTime)
      .map((report) => report.id)
    : [];
  return {
    notes: item.staffNotes || [], history: item.history || [], legacyNotes: item.notes || [],
    capabilities: { manageCases: true },
    closedCaseNewReports: {
      count: reportIds.length, reportIds, closedAt: closure?.createdAt || null,
    },
  };
}
