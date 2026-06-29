import assert from 'node:assert/strict';
import { buildHexbotReportPayload } from './payload.js';
import { validateIncomingReportSubmission } from './validation.js';
import { TIPOS_ETIQUETAS } from '../../components/tiposEtiquetas.js';

function findLabelIdByName(name = '') {
  const target = String(name || '').trim().toLowerCase();
  if (!target) return null;

  let id = 1;
  for (const tipo of TIPOS_ETIQUETAS) {
    for (const etiqueta of tipo?.etiquetas || []) {
      if (String(etiqueta?.nombre || '').trim().toLowerCase() === target) {
        return id;
      }
      id += 1;
    }
  }

  return null;
}

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
      investigation_status: 'not_found',
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
    nickname: 'Jugador123',
    playerId: 'TMP-jugador123',
    avatar1: '',
    avatar2: '',
    rid: null,
    ip: '',
    aliases: [],
    time: null,
    reason: 'Uso de exploit',
    typesOfInfraction: ['Exploit', 'Vehiculos'],
    labels: ['exploit', 'griefing'],
    reportedby: 'MOSTWANTED',
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
      reportedby: 'MOSTWANTED',
      investigation_status: 'not_found',
    },
  });
});

runTest('validateIncomingReportSubmission rechaza evidencias sin contentType soportado', () => {
  const validation = validateIncomingReportSubmission({
    report: {
      usuario: 'Jugador123',
      motivo: 'Uso de exploit',
      investigation_status: 'not_found',
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

runTest('validateIncomingReportSubmission acepta labels por IDs y los expone como labelIds', () => {
  const aimbotId = findLabelIdByName('Aimbot');
  assert.ok(Number.isInteger(aimbotId) && aimbotId > 0, 'Aimbot debe existir en el catalogo');

  const validation = validateIncomingReportSubmission({
    report: {
      nickname: 'JugadorConIds',
      reason: 'Comportamiento sospechoso reiterado',
      labels: [7, '12', 'Aimbot'],
      crews: 'Crew de Prueba, Crew Secundaria #1, Kaiths Rebels',
      investigation_status: 'not_found',
    },
  });

  assert.equal(validation.ok, true);
  assert.deepEqual(validation.value.report.labelIds, [7, 12, aimbotId]);
  assert.deepEqual(validation.value.report.labels, ['Aimbot']);

  const payload = buildHexbotReportPayload(validation.value);
  assert.equal(Object.prototype.hasOwnProperty.call(payload, 'crewCurrent'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(payload, 'crew1'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(payload, 'crewsAssigned'), false);
  assert.ok(Array.isArray(payload.crews));
  assert.equal(payload.crews.length, 3);
  assert.equal(payload.crews[0].name, 'Crew de Prueba');
  assert.equal(payload.crews[1].name, 'Crew Secundaria #1');
  assert.deepEqual(payload.crews[2], {
    name: 'Kaiths Rebels',
    url: 'https://socialclub.rockstargames.com/crew/kaiths_rebels/hierarchy',
  });
  assert.deepEqual(payload.labelIds, [7, 12, aimbotId]);
  assert.deepEqual(payload.labels, ['Aimbot']);
  assert.deepEqual(payload.report.tagIds, [7, 12, aimbotId]);
});

console.log('OK payload/validation checks completed');
