import assert from 'node:assert/strict';
import { executeReportAssistUseCase, isFaithfulRewrite, sanitizeReportAssistSuggestion } from './reportAssist.js';

let prompt = '';
const result = await executeReportAssistUseCase({
  config: {},
  body: { nickname: 'Tester', categories: ['modder', 'FAKE'], labels: [], reason: 'me crasheo el juego y me saco de la sesion' },
  generate: async ({ payload }) => {
    prompt = payload.prompt;
    return {
      ok: true,
      status: 200,
      payload: { response: '```json\n{"reason":"Me crasheó el juego y me sacó de la sesión.","categories":["MODDER","GRIFFER","INVENTADA"],"labels":["Kickear de la sesión (modding)","Etiqueta inventada"],"note":"Adjunta una captura si la tienes."}\n```' },
    };
  },
});

assert.equal(result.ok, true);
assert.match(prompt, /No inventes hechos/);
assert.match(prompt, /"categorias":\["MODDER"\]/, 'unknown input categories are dropped');
assert.deepEqual(result.payload.suggestion.categories, ['GRIFFER'], 'already selected and invented categories are excluded');
assert.equal(result.payload.suggestion.labels.length, 1, 'only catalog labels survive');
assert.match(result.payload.suggestion.labels[0], /Kickear/);
assert.equal(result.payload.suggestion.reason, 'Me crasheó el juego y me sacó de la sesión.');

const addedIntent = sanitizeReportAssistSuggestion(
  { reason: 'He estado provocando crashes a los jugadores que me disgustan y activando godmode cada vez que me atacan.' },
  { reason: 'Estuvo crasheando a todos los que les cae mal y usando godmode cuando lo atacaban' },
);
assert.equal(addedIntent, null, 'rewrites that add intent or targets are discarded');
assert.equal(isFaithfulRewrite('me crasheo el juego', 'Me crasheó el juego.'), true);
assert.equal(isFaithfulRewrite('me crasheo el juego', 'El jugador crasheó el juego.'), false, 'speaker change is rejected');
assert.equal(isFaithfulRewrite('me saco de la sesion 3 veces', 'Me sacó de la sesión 5 veces.'), false, 'changed numbers are rejected');

const tooShort = await executeReportAssistUseCase({ config: {}, body: { reason: 'hola' }, generate: async () => assert.fail('must not call AI') });
assert.equal(tooShort.status, 400);

const garbage = await executeReportAssistUseCase({
  config: {},
  body: { reason: 'me mató muchas veces seguidas' },
  generate: async () => ({ ok: true, status: 200, payload: { response: 'no sé' } }),
});
assert.equal(garbage.status, 502);

assert.equal(sanitizeReportAssistSuggestion({ reason: 'x'.repeat(900) }, { reason: 'x'.repeat(900) }).reason.length, 500);
assert.equal(sanitizeReportAssistSuggestion({ categories: ['NOPE'] }), null);

console.log('OK report assist use case');
