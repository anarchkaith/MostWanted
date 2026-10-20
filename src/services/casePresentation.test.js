import assert from 'node:assert/strict';
import { playerCandidates, filterCaseReports, summarizeVotes, formatCaseDate, normalizeReportValidation } from './casePresentation.js';
import { mergePlayerMatches } from './playerSearch.js';
import { resolvePlayerRid } from '../../shared/playerIdentity.js';

assert.equal(resolvePlayerRid({ rid: '', playerId: 'RID-298932732' }), '298932732');
assert.equal(resolvePlayerRid({ rid: '200', playerId: 'RID-100' }), '200');
assert.equal(resolvePlayerRid({ rid: '00100' }), '100');
for (const playerId of ['TMP-298932732', 'RID-0', 'RID-123-extra', '123', 'RID-1.5', 'RID--123']) {
  assert.equal(resolvePlayerRid({ playerId }), '', `Do not infer identity from ${playerId}`);
}
const historical = playerCandidates([{ usuario: 'Sazxxin', wpRid: '', playerId: 'RID-298932732' }], 'Saz');
const unified = mergePlayerMatches(historical, [
  { nickname: 'Sazxxin', rid: '298932732', source: 'Analizado en esta sesión' },
], 'Saz');
assert.equal(unified.length, 1);
assert.equal(unified[0].count, 1);
assert.equal(unified[0].rid, '298932732');
assert.deepEqual(unified[0].sources, ['Reportes', 'Analizado en esta sesión']);
assert.equal(mergePlayerMatches(historical, [{ nickname: 'Sazxxin', rid: '999' }], 'Saz').length, 2);
assert.equal(playerCandidates([{ usuario: 'Sazxxin', playerId: 'RID-298932732' }], '298932732').length, 1);
assert.equal(playerCandidates([{ usuario: 'NewName', wpRid: '123', aliases: ['OldName'] }], 'OldName')[0].rid, '123');

const reports = [
  { id: 1, usuario: 'Igual', wpRid: '100', fecha: '2026-01-01T12:00:00Z', categories: ['MODDER', 'GRIFFER'], validacion: 'pendiente', motivo: 'Texto', votos: { up: 3, down: 1 } },
  { id: 2, usuario: 'Igual', wpRid: '200', fecha: '2026-01-02T12:00:00Z', categories: ['MODDER'], validacion: 'rechazado', votos: { up: 1, down: 3 } },
  { id: 3, usuario: 'Igual', wpRid: '', fecha: '', categoria: 'modder' },
];
assert.equal(playerCandidates(reports, 'Igual').length, 3);
assert.equal(playerCandidates(reports, '100')[0].rid, '100');
assert.equal(playerCandidates(reports, '').length, 0);
assert.deepEqual(filterCaseReports(reports, { category: 'GRIFFER' }).map(r => r.id), [1]);
assert.deepEqual(filterCaseReports(reports, { from: '2026-01-02', to: '2026-01-02' }).map(r => r.id), [2]);
assert.deepEqual(filterCaseReports(reports, { validation: 'pendiente', query: 'texto' }).map(r => r.id), [1]);
assert.deepEqual(filterCaseReports(reports).map(r => r.id), [2, 1, 3]);
assert.deepEqual(filterCaseReports([{ ...reports[0], reportadoPor: 'PRIVATE_REPORTER' }], { query: 'PRIVATE_REPORTER' }), []);
assert.deepEqual(summarizeVotes(reports), { up: 4, down: 4, total: 8, percent: 50 });
assert.equal(summarizeVotes([]).percent, null);
assert.equal(formatCaseDate(null), 'Fecha desconocida');
assert.equal(normalizeReportValidation('rejected'), 'rechazado');
assert.equal(normalizeReportValidation(null), '');
const localBoundary = new Date(2026, 0, 2, 0, 15).toISOString();
assert.equal(filterCaseReports([{ id: 4, fecha: localBoundary }], { from: '2026-01-02', to: '2026-01-02' }).length, 1);
assert.equal(filterCaseReports([{ id: 5, fecha: '2026-01-02' }], { from: '2026-01-02', to: '2026-01-02' }).length, 1);
console.log('OK case presentation checks completed');
const matches = mergePlayerMatches(playerCandidates(reports, 'Igual'), [
  { nickname: 'Igual', rid: '100', source: 'Social Club / sc-cache' },
  { nickname: 'Nuevo', rid: '300', names: ['Igual'], source: 'Analizado en esta sesión' },
], 'Igual');
assert.equal(matches.length, 4);
assert.equal(matches.find(item => item.rid === '100').count, 1);
assert.deepEqual(matches.find(item => item.rid === '100').sources, ['Reportes', 'Social Club / sc-cache']);
assert.equal(matches.find(item => item.rid === '300').nickname, 'Nuevo');
assert.equal(mergePlayerMatches([], [{ nickname: 'SinReportes', rid: '123', source: 'Archivo WordPress', count: 0 }], 'SinReportes').length, 1);
assert.equal(mergePlayerMatches([], [{ nickname: 'Nombre', rid: '123' }], '123')[0].rid, '123');
assert.equal(mergePlayerMatches([], [], '').length, 0);
assert.equal(mergePlayerMatches([], [{ nickname: 'Nombre', names: [null, { name: 'Alias' }] }], 'alias').length, 1);
