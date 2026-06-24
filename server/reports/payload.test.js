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
    crewCurrent: '',
    crew1: '',
    crew2: '',
    crew3: '',
    crew4: '',
    crews: '',
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
      crewCurrent: 'Crew de Prueba [TAG]',
      crew1: 'Crew Secundaria #1 [C1]',
      crew2: 'https://socialclub.rockstargames.com/crew/test_c2',
      investigation_status: 'not_found',
    },
  });

  assert.equal(validation.ok, true);
  assert.deepEqual(validation.value.report.labelIds, [7, 12, aimbotId]);
  assert.deepEqual(validation.value.report.labels, ['Aimbot']);

  const payload = buildHexbotReportPayload(validation.value);
  assert.equal(payload.crewCurrent, 'Crew de Prueba [TAG]');
  assert.ok(payload.crewCurrentData);
  assert.equal(payload.crewCurrentData.name, 'Crew de Prueba');
  assert.equal(payload.crewCurrentData.tag, 'TAG');
  assert.equal(payload.crew1, 'Crew Secundaria #1 [C1]');
  assert.equal(payload.crew2, 'https://socialclub.rockstargames.com/crew/test_c2');
  assert.deepEqual(payload.crewsAssigned, [
    'Crew Secundaria #1 [C1]',
    'https://socialclub.rockstargames.com/crew/test_c2',
  ]);
  assert.ok(Array.isArray(payload.crewsAssignedData));
  assert.equal(payload.crewsAssignedData.length, 2);
  assert.equal(payload.crewsAssignedData[0].tag, 'C1');
  assert.equal(payload.crewsAssignedData[1].url, 'https://socialclub.rockstargames.com/crew/test_c2');
  assert.ok(Array.isArray(payload.crewsData));
  assert.equal(payload.crewsData.length, 3);
  assert.deepEqual(payload.labelIds, [7, 12, aimbotId]);
  assert.deepEqual(payload.labels, ['Aimbot']);
  assert.deepEqual(payload.report.tagIds, [7, 12, aimbotId]);
});

console.log('OK payload/validation checks completed');
