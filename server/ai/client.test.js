import assert from 'node:assert/strict';
import { getAssistantReply } from './client.js';

assert.equal(
  getAssistantReply({ response: '>>chat La respuesta comienza aquí.' }),
  'La respuesta comienza aquí.',
);
assert.equal(
  getAssistantReply({ text: '  >>chat\n>>chat Respuesta normalizada.  ' }),
  'Respuesta normalizada.',
);
assert.equal(
  getAssistantReply({ message: { content: 'Una respuesta sin prefijo.' } }),
  'Una respuesta sin prefijo.',
);
assert.equal(
  getAssistantReply({ response: '>>chat ', text: 'Respuesta alternativa.' }),
  'Respuesta alternativa.',
);

console.log('OK AI client checks completed');
