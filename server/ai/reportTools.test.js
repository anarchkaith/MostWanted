import assert from 'node:assert/strict';
import { executeReportTool } from './reportTools.js';

const reports = [
  {
    id: 12,
    usuario: 'JugadorUno',
    categoria: 'griefing',
    severidad: 'alta',
    motivo: 'destruye construcciones en la zona norte',
    fecha: '2026-04-02',
    etiquetas: ['construcciones'],
    reporterDiscordId: 'private-id',
  },
  {
    id: 13,
    usuario: 'JugadorUno',
    categoria: 'griefing',
    severidad: 'alta',
    motivo: 'destruye construcciones en la zona norte',
    fecha: '2026-04-03',
    etiquetas: ['construcciones'],
  },
  {
    id: 14,
    usuario: 'JugadorDos',
    categoria: 'spam',
    severidad: 'baja',
    motivo: 'publica enlaces repetidos',
    fecha: '2026-04-04',
  },
];

const summary = executeReportTool({ tool: 'read_all_reports', reportes: reports });
assert.equal(summary.totalReportes, 3);
assert.equal(summary.totalUsuariosUnicos, 2);
assert.equal(summary.rankingUsuarios[0].usuario, 'JugadorUno');
assert.equal(summary.rankingPorCategoria.griefing[0].usuario, 'JugadorUno');
assert.equal(summary.rankingPorCategoria.griefing[0].totalReportes, 2);
assert.equal(JSON.stringify(summary).includes('private-id'), false);

const categoryRanking = executeReportTool({
  tool: 'read_all_reports',
  params: { categoria: 'griefing' },
  reportes: reports,
});
assert.equal(categoryRanking.rankingCategoria[0].usuario, 'JugadorUno');
assert.equal(categoryRanking.categoriaConsultada, 'griefing');

const details = executeReportTool({
  tool: 'get_report_detail',
  params: { usuario: 'jugadoruno' },
  reportes: reports,
});
assert.equal(details.totalCoincidencias, 2);
assert.equal(details.reportes[0].usuario, 'JugadorUno');

const similarity = executeReportTool({
  tool: 'analyze_recent_similarity',
  reportes: reports,
});
assert.equal(similarity.totalReportesAnalizados, 3);
assert.equal(similarity.porCategoria.griefing, 2);
assert.equal(similarity.comparacionDePares.paresSimilares[0].similitud, 1);
assert.ok(similarity.terminosFrecuentes.some(({ term }) => term === 'construcciones'));
for (const result of [summary, details, similarity]) {
  assert.doesNotMatch(JSON.stringify(result), /severidad|severity|severidades|porSeveridad/i);
}
const withoutSeverity = reports.map(({ severidad, ...report }) => report);
for (const tool of ['read_all_reports', 'get_report_detail', 'analyze_recent_similarity']) {
  assert.deepEqual(executeReportTool({ tool, params: { usuario: 'JugadorUno' }, reportes: reports }),
    executeReportTool({ tool, params: { usuario: 'JugadorUno' }, reportes: withoutSeverity }), 'Severity cannot change rankings or correlations');
}

assert.equal(executeReportTool({ tool: 'unsafe_tool', reportes: reports }), null);

console.log('OK report analysis tools checks completed');
