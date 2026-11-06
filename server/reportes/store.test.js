import assert from 'node:assert/strict';
import test from 'node:test';
import { buildReportesStats, getRelatedReportes, buildPlayerInsights } from './store.js';

test('historical severity has no effect on report statistics, related ordering or public insights', () => {
  const reports = [
    { id: 1, usuario: 'Target', categoria: 'modder', motivo: 'Aimbot reportado', severidad: 'alta', fecha: '2026-10-01' },
    { id: 2, usuario: 'Different', categoria: 'spam', motivo: 'Otros hechos', severidad: 'alta', fecha: '2026-10-02' },
    { id: 3, usuario: 'Target', categoria: 'modder', motivo: 'Aimbot reportado', severidad: 'baja', fecha: '2026-10-03' },
  ];
  assert.deepEqual(buildReportesStats(reports), { total: 3, byCategory: { modder: 2, spam: 1 } });
  assert.deepEqual(getRelatedReportes(reports, reports[0]).map(report => report.id), [3]);
  const before = structuredClone(reports);
  const insights = buildPlayerInsights(reports, { username: 'Target' });
  assert.doesNotMatch(JSON.stringify(insights), /severidad|severity/i);
  assert.deepEqual(reports, before, 'Retiring severity must not mutate historical storage');
});
