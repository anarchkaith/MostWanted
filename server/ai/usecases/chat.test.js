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
assert.equal(result.payload.agent.tool, 'read_all_reports');
assert.equal(result.payload.agent.reportCount, 3);

console.log('OK AI agent tool execution checks completed');
