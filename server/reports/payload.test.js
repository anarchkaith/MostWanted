import assert from 'node:assert/strict';
import { buildHexbotReportPayload } from './payload.js';
import { validateIncomingReportSubmission } from './validation.js';

function runTest(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

runTest('validateIncomingReportSubmission acepta un reporte valido y buildHexbotReportPayload respeta el contrato de HEXBOT', () => {
  const validation = validateIncomingReportSubmission({
    report: {
      usuario: 'Jugador123',
      motivo: 'Uso de exploit',
      categorias: ['Exploit', 'Vehiculos'],
      etiquetas: ['exploit', 'griefing'],
      contacto: 'MOSTWANTED',
      severidad: 'critica',
    },
    reporter: {
      id: 'user-42',
      name: 'Kaith',
      tag: 'Kaith',
    },
    evidence: [
      {
        url: 'https://tu-sitio.com/uploads/captura-1.png',
        name: 'captura-1.png',
        contentType: 'image/png',
      },
    ],
    source: 'mostwanted-web',
  });

  assert.equal(validation.ok, true);

  const payload = buildHexbotReportPayload(validation.value);

  assert.deepEqual(payload, {
    username: 'Jugador123',
    reason: 'Uso de exploit',
    anonymous: false,
    source: 'mostwanted-web',
    reporter: {
      id: 'user-42',
      name: 'Kaith',
      tag: 'Kaith',
    },
    evidence: [
      {
        url: 'https://tu-sitio.com/uploads/captura-1.png',
        name: 'captura-1.png',
        contentType: 'image/png',
      },
    ],
    report: {
      categories: ['Exploit', 'Vehiculos'],
      tags: ['exploit', 'griefing'],
      contacto: 'MOSTWANTED',
      severity: 'critica',
    },
  });
});

runTest('validateIncomingReportSubmission rechaza evidencias sin contentType soportado', () => {
  const validation = validateIncomingReportSubmission({
    report: {
      usuario: 'Jugador123',
      motivo: 'Uso de exploit',
    },
    evidence: [
      {
        url: 'https://tu-sitio.com/uploads/captura-1.bmp',
        name: 'captura-1.bmp',
        contentType: 'image/bmp',
      },
    ],
  });

  assert.equal(validation.ok, false);
  assert.equal(validation.status, 400);
  assert.match(validation.error, /contentType/i);
});

console.log('OK payload/validation checks completed');
