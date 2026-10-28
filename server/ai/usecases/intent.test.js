import assert from 'node:assert/strict';
import { executeIntentUseCase } from './intent.js';

for (const query of [
  'Que encuentras en comun con todos los reportados?',
  'Determina un patrón de comportamiento',
]) {
  const result = await executeIntentUseCase({
    config: {},
    body: { query },
  });

  assert.equal(result.ok, true, query);
  assert.equal(result.payload.needsReportContext, true, query);
  assert.equal(result.payload.tool, 'analyze_recent_similarity', query);
  assert.equal(result.payload.provider, 'deterministic-router', query);
}

const ranking = await executeIntentUseCase({
  config: {},
  body: {
    query: 'Can you showme the most modder in the database?',
    candidateCategories: ['modder', 'spam'],
  },
});
assert.equal(ranking.payload.tool, 'read_all_reports');
assert.equal(ranking.payload.params.categoria, 'modder');

const detail = await executeIntentUseCase({
  config: {},
  body: {
    query: 'Que reportes tiene jugador123?',
    candidateUsuarios: ['jugador123'],
  },
});
assert.equal(detail.payload.tool, 'get_report_detail');
assert.equal(detail.payload.params.usuario, 'jugador123');
assert.equal(detail.payload.params.recentDays, null);

console.log('OK AI intent routing checks completed');
