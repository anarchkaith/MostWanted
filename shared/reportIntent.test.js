import assert from 'node:assert/strict';
import { inferReportIntent } from './reportIntent.js';

for (const query of [
  'Que encuentras en comun con todos los reportados?',
  'Determina un patrón de comportamiento',
]) {
  const intent = inferReportIntent(query);
  assert.equal(intent?.needsReportContext, true, query);
  assert.equal(intent?.tool, 'analyze_recent_similarity', query);
  assert.equal(intent?.params?.usuario, null, query);
}

assert.equal(
  inferReportIntent('Qué hizo KaithRider?', ['KaithRider'])?.tool,
  'get_report_detail',
);
const categoryRanking = inferReportIntent(
  'Can you showme the most modder in the database?',
  [],
  ['modder', 'spam'],
);
assert.equal(categoryRanking?.tool, 'read_all_reports');
assert.equal(categoryRanking?.params?.categoria, 'modder');
assert.equal(inferReportIntent('Cuéntame un chiste'), null);

console.log('OK report intent checks completed');
