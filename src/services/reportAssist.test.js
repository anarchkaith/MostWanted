import test from 'node:test';
import assert from 'node:assert/strict';
import { canRequestReportAssist, requestReportAssist, resolveReportAssistSuggestion } from './reportAssist.js';

const catalog = [
  { key: 'MODDER', etiquetas: [{ nombre: 'Kickear de la sesión (modding)' }] },
  { key: 'GRIFFER', etiquetas: [{ nombre: 'Spawnkill' }] },
];

test('requires some user input before asking the AI', () => {
  assert.equal(canRequestReportAssist({ reason: 'corto', typesOfInfraction: [] }), false);
  assert.equal(canRequestReportAssist({ reason: 'me crasheó el juego', typesOfInfraction: [] }), true);
  assert.equal(canRequestReportAssist({ reason: '', typesOfInfraction: ['MODDER'] }), true);
});

test('maps unaccented server labels to form labels and drops duplicates', () => {
  const resolved = resolveReportAssistSuggestion(
    { reason: 'Texto nuevo', categories: ['MODDER', 'GRIFFER', 'X'], labels: ['Kickear de la sesion (modding)', 'Spawnkill', 'Otra'] },
    { reason: 'texto', typesOfInfraction: ['MODDER'], labels: [] },
    catalog,
  );
  assert.deepEqual(resolved.categories, ['GRIFFER']);
  assert.deepEqual(resolved.labels, ['Kickear de la sesión (modding)', 'Spawnkill']);
  assert.equal(resolved.reason, 'Texto nuevo');
});

test('explains login and quota errors in plain language', async () => {
  const fetch401 = async () => ({ ok: false, status: 401, json: async () => ({}) });
  await assert.rejects(requestReportAssist({}, { fetchImpl: fetch401, url: '/api/ia-report-assist' }), /Inicia sesión/);
  const fetch429 = async () => ({ ok: false, status: 429, json: async () => ({}) });
  await assert.rejects(requestReportAssist({}, { fetchImpl: fetch429, url: '/api/ia-report-assist' }), /límite diario/);
});
