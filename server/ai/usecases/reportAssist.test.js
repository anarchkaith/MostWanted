import assert from 'node:assert/strict';
import { executeReportAssistUseCase, sanitizeReportAssistSuggestion } from './reportAssist.js';

let prompt = '';
const result = await executeReportAssistUseCase({
  config: {},
  body: { nickname: 'Tester', categories: ['modder', 'FAKE'], labels: [], reason: 'me crasheo el juego y me saco de la sesion' },
  generate: async ({ payload }) => {
    prompt = payload.prompt;
    return {
      ok: true,
      status: 200,
      payload: { response: '```json\n{"reason":"El jugador me crasheó el juego y me expulsó de la sesión.","categories":["MODDER","GRIFFER","INVENTADA"],"labels":["Kickear de la sesión (modding)","Etiqueta inventada"],"note":"Adjunta una captura si la tienes."}\n```' },
    };
  },
});

assert.equal(result.ok, true);
assert.match(prompt, /No inventes hechos/);
assert.match(prompt, /"categorias":\["MODDER"\]/, 'unknown input categories are dropped');
assert.deepEqual(result.payload.suggestion.categories, ['GRIFFER'], 'already selected and invented categories are excluded');
assert.equal(result.payload.suggestion.labels.length, 1, 'only catalog labels survive');
assert.match(result.payload.suggestion.labels[0], /Kickear/);
assert.equal(result.payload.suggestion.reason, 'El jugador me crasheó el juego y me expulsó de la sesión.');

const tooShort = await executeReportAssistUseCase({ config: {}, body: { reason: 'hola' }, generate: async () => assert.fail('must not call AI') });
assert.equal(tooShort.status, 400);

const garbage = await executeReportAssistUseCase({
  config: {},
  body: { reason: 'me mató muchas veces seguidas' },
  generate: async () => ({ ok: true, status: 200, payload: { response: 'no sé' } }),
});
assert.equal(garbage.status, 502);

assert.equal(sanitizeReportAssistSuggestion({ reason: 'x'.repeat(900) }).reason.length, 500);
assert.equal(sanitizeReportAssistSuggestion({ categories: ['NOPE'] }), null);

console.log('OK report assist use case');
