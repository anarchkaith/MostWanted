import assert from 'node:assert/strict';
import { buildReportesChatContext } from './reportesChatContext.js';
import { inferReportIntent } from '../shared/reportIntent.js';

const reportes = Array.from({ length: 140 }, (_, index) => ({
  id: index + 1,
  usuario: `Jugador${index + 1}`,
  categoria: 'modder',
  severidad: 'alta',
  motivo: `Reporte ${index + 1}`,
  fecha: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
}));

globalThis.localStorage = {
  getItem: () => JSON.stringify(reportes),
};

const query = 'Que encuentras en comun con todos los reportados?';
const context = buildReportesChatContext(query, inferReportIntent(query));

assert.equal(context.useReportesDb, true);
assert.equal(context.reportQuery.tool, 'analyze_recent_similarity');
assert.equal(context.reportesContext.reportes.length, reportes.length);
assert.equal(context.reportesContext.stats.total, reportes.length);

console.log('OK full report context checks completed');
