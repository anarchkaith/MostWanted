import assert from 'node:assert/strict';
import { executeChatUseCase } from './chat.js';

let generatedPrompt = '';
const result = await executeChatUseCase({
  config: {
    assistantName: 'H.E.X.',
    creator: 'Most Wanted',
    appContext: 'asistente de reportes',
    tone: 'claro',
    extraInstructions: '',
  },
  body: {
    messages: [{ role: 'user', content: 'Can you showme the most modder in the database?' }],
    reportesContext: { reportes: [] },
  },
  reportes: [
    { id: 1, usuario: 'JugadorUno', categoria: 'modder', severidad: 'alta', motivo: 'uso de mods', fecha: '2026-04-02' },
    { id: 2, usuario: 'JugadorDos', categoria: 'modder', severidad: 'alta', motivo: 'uso de mods', fecha: '2026-04-03' },
    { id: 3, usuario: 'JugadorUno', categoria: 'modder', severidad: 'alta', motivo: 'uso de mods', fecha: '2026-04-04' },
  ],
  generate: async ({ payload }) => {
    generatedPrompt = payload.prompt;
    return { ok: true, status: 200, payload: { response: 'Hay dos reportes con coincidencias.' } };
  },
});

assert.match(generatedPrompt, /RESULTADO DE HERRAMIENTA EJECUTADA EN EL SERVIDOR/);
assert.match(generatedPrompt, /"herramienta":"read_all_reports"/);
assert.match(generatedPrompt, /"categoriaConsultada":"modder"/);
assert.match(generatedPrompt, /"rankingCategoria":\[\{"usuario":"JugadorUno","totalReportes":2\}/);
assert.doesNotMatch(generatedPrompt, /"severidad"|"severity"|"porSeveridad"|"severidades"/);
assert.equal(result.payload.agent.tool, 'read_all_reports');
assert.equal(result.payload.agent.reportCount, 3);

const config = { assistantName: 'H.E.X.', creator: 'Most Wanted', appContext: 'reportes', tone: 'claro', extraInstructions: '' };
const intelReports = [
  { id: 7, usuario: 'Sazxinxxx', rid: 166688426, categoria: 'dinero', motivo: 'lluvia de dinero', fecha: '2026-04-02', crews: ['Crew Norte'] },
  { id: 8, usuario: 'OtroJugador', rid: '45869978', categoria: 'modder', motivo: 'godmode', fecha: '2026-04-03', crews: ['crew norte'] },
];
const intelPayload = (nickname, rid) => ({
  ok: true, found: true, identity: { rid, nickname, names: [], socialClub: null },
  platforms: [], signals: [{ id: 'unexplained_money', severity: 'alta', platform: 'pc', title: 'Dinero sin origen registrado', detail: 'detalle', value: '$260.5M', threshold: '≥ $250.0M' }],
  limitations: [],
});
const intelCalls = [];
const getPlayerIntel = async (target) => {
  intelCalls.push(target);
  return { status: 200, payload: intelPayload(target.nickname, target.rid || '1') };
};
const run = async (body) => {
  let prompt = '';
  const response = await executeChatUseCase({
    config, body, reportes: intelReports, getPlayerIntel,
    generate: async ({ payload }) => { prompt = payload.prompt; return { ok: true, status: 200, payload: { response: 'ok' } }; },
  });
  return { prompt, response };
};

const focused = await run({ messages: [{ role: 'user', content: '¿Qué opinás de este jugador?' }], playerContext: { nickname: 'Sazxinxxx', rid: '166688426' } });
assert.deepEqual(intelCalls.at(-1), { nickname: 'Sazxinxxx', rid: '166688426' });
assert.match(focused.prompt, /"herramienta":"get_report_detail"/);
assert.match(focused.prompt, /"rid":"166688426"/);
assert.match(focused.prompt, /INTELIGENCIA DEL JUGADOR/);
assert.doesNotMatch(focused.prompt, /Dinero sin origen registrado/);
assert.match(focused.prompt, /No uses el dinero/);
assert.match(focused.prompt, /información neutral/);
assert.equal(focused.response.payload.agent.reportCount, 1);

const other = await run({ messages: [{ role: 'user', content: 'Mostrame los reportes de OtroJugador' }], playerContext: { nickname: 'Sazxinxxx', rid: '' } });
assert.deepEqual(intelCalls.at(-1), { nickname: 'OtroJugador', rid: '45869978' });
assert.match(other.prompt, /"crews":\["crew norte"\]/);

const callsBefore = intelCalls.length;
const ranking = await run({ messages: [{ role: 'user', content: 'Quién tiene más reportes de la categoría modder?' }] });
assert.equal(intelCalls.length, callsBefore, 'Sin jugador enfocado ni detalle, no consulta inteligencia');
assert.match(ranking.prompt, /"crewsCompartidas":\[\{"crew":"Crew Norte","totalUsuarios":2/);

const failing = await executeChatUseCase({
  config, reportes: intelReports, body: { messages: [{ role: 'user', content: 'hola' }], playerContext: { nickname: 'Sazxinxxx', rid: 'no-rid' } },
  getPlayerIntel: async () => { throw new Error('upstream'); },
  generate: async () => ({ ok: true, status: 200, payload: { response: 'ok' } }),
});
assert.equal(failing.ok, true, 'Un fallo de inteligencia no rompe el chat');

console.log('OK AI agent tool execution checks completed');
