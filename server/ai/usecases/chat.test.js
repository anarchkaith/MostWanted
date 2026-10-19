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
    messages: [{ role: 'user', content: 'Que encuentras en comun con todos los reportados?' }],
    reportesContext: {
      reportes: [
        {
          id: 1,
          usuario: 'JugadorUno',
          categoria: 'griefing',
          severidad: 'alta',
          motivo: 'destruye construcciones en la zona norte',
          fecha: '2026-04-02',
        },
        {
          id: 2,
          usuario: 'JugadorDos',
          categoria: 'griefing',
          severidad: 'alta',
          motivo: 'destruye construcciones en la zona norte',
          fecha: '2026-04-03',
        },
      ],
    },
  },
  generate: async ({ payload }) => {
    generatedPrompt = payload.prompt;
    return { ok: true, status: 200, payload: { response: 'Hay dos reportes con coincidencias.' } };
  },
});

assert.match(generatedPrompt, /RESULTADO DE HERRAMIENTA EJECUTADA EN EL SERVIDOR/);
assert.match(generatedPrompt, /"totalReportesAnalizados":2/);
assert.match(generatedPrompt, /"herramienta":"analyze_recent_similarity"/);
assert.equal(result.payload.agent.tool, 'analyze_recent_similarity');
assert.equal(result.payload.agent.reportCount, 2);

console.log('OK AI agent tool execution checks completed');
