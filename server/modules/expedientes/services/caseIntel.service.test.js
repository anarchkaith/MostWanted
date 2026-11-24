import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { readCase, readCaseClassification } from './cases.service.js';
import { refreshCaseIntel } from './caseIntel.service.js';
import { readExpedientes, updateExpedientes } from './expedientesStore.service.js';

const HOUR = 60 * 60 * 1000;
const intelFor = signature => ({
  status: 200,
  payload: {
    ok: true, found: true, complete: true, signature,
    identity: { rid: '123', nickname: 'Player', names: [], socialClub: null },
    platforms: [], limitations: [],
    signals: [{ id: 'rank_over_cap', severity: signature === 'b' ? 'alta' : 'media', platform: 'pc', title: 'Rango por encima del máximo', detail: 'd', value: 'v', threshold: 't' }],
  },
});

test('depura una instantánea antigua aunque las fuentes fallen y no muestra su resumen hasta regenerarlo', async t => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mostwanted-intel-policy-'));
  t.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));
  const reports = [{ id: 1, nickname: 'Player', rid: '123', reason: 'Reporte' }];
  const query = {
    rootDir, source: async () => reports, nickname: 'Player', rid: '123', awaitSummary: true,
    getPlayerIntel: async () => intelFor('a'), generateCaseSummary: async () => 'Resumen anterior',
  };
  const first = await readCase(query);
  const id = first.payload.case.id;
  updateExpedientes(rootDir, items => {
    const item = items[0];
    delete item.intelSnapshot.policyVersion;
    delete item.aiSummary.policyVersion;
    item.intelSnapshot.digest.carreras = [{ plataforma: 'PC', saldo: '$288.8M', dineroSinOrigen: '$260.5M', ingresosPorHora: '$1.4M' }];
    item.intelSnapshot.digest.señales = [{ titulo: 'Dinero sin origen registrado', severidad: 'alta' }];
  });
  const old = readCaseClassification({ rootDir, id });
  assert.equal(old.classification.text, null);
  assert.match(old.classification.error, /criterios anteriores/);
  let calls = 0;
  await refreshCaseIntel({
    rootDir, id, logger: { error() {} },
    getPlayerIntel: async () => { calls++; throw new Error('Fuente caída'); },
  });
  assert.equal(calls, 1, 'La política nueva invalida la caché de seis horas');
  const stored = readExpedientes(rootDir)[0];
  assert.deepEqual(stored.intelSnapshot.digest.señales, []);
  assert.equal(stored.intelSnapshot.digest.carreras[0].saldo, '$288.8M');
  assert.equal(Object.hasOwn(stored.intelSnapshot.digest.carreras[0], 'dineroSinOrigen'), false);
  assert.equal(stored.aiSummary.text, 'Resumen anterior', 'El texto histórico no se destruye');
  let prompt;
  const updated = await readCase({
    ...query,
    generateCaseSummary: async ({ intel }) => { prompt = intel; return 'Resumen con criterios actuales'; },
  });
  assert.deepEqual(prompt.señales, []);
  assert.equal(updated.payload.case.classification.text, 'Resumen con criterios actuales');
});

test('el resumen HEX incorpora la inteligencia y se regenera solo cuando cambian sus conclusiones', async () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mostwanted-intel-'));
  const reports = [{ id: 1, nickname: 'Player', rid: '123', categories: ['MODDER'], reason: 'Dinero infinito', createdAt: '2026-10-01' }];
  const prompts = [];
  let intel = intelFor('a');
  let intelCalls = 0;
  const getPlayerIntel = async (target) => {
    intelCalls++;
    assert.deepEqual(target, { nickname: 'Player', rid: '123' });
    if (intel instanceof Error) throw intel;
    return intel;
  };
  const query = {
    rootDir, source: async () => reports, nickname: 'Player', rid: '123', awaitSummary: true, getPlayerIntel,
    generateCaseSummary: async ({ intel: digest }) => { prompts.push(digest); return 'Resumen'; },
  };
  const logger = { error() {} };

  const first = await readCase(query);
  assert.equal(prompts.length, 1);
  assert.equal(prompts[0].señales[0].severidad, 'media');
  assert.equal(first.payload.case.classification.stale, false);

  await readCase(query);
  assert.equal(intelCalls, 1, 'La inteligencia se reutiliza durante 6 horas');
  assert.equal(prompts.length, 1);

  const id = first.payload.case.id;
  intel = intelFor('a');
  await refreshCaseIntel({ rootDir, id, getPlayerIntel, logger, now: () => Date.now() + 7 * HOUR });
  assert.equal((await readCase(query)).payload.case.classification.stale, false, 'Misma firma, mismo resumen');
  assert.equal(prompts.length, 1);

  intel = intelFor('b');
  await refreshCaseIntel({ rootDir, id, getPlayerIntel, logger, now: () => Date.now() + 14 * HOUR });
  await readCase(query);
  assert.equal(prompts.length, 2);
  assert.equal(prompts[1].señales[0].severidad, 'alta');

  intel = new Error('caído');
  await refreshCaseIntel({ rootDir, id, getPlayerIntel, logger, now: () => Date.now() + 21 * HOUR });
  const snapshot = readExpedientes(rootDir)[0].intelSnapshot;
  assert.equal(snapshot.signature, 'b', 'Un fallo conserva la instantánea anterior');
  assert.notEqual(snapshot.attemptedAt, snapshot.fetchedAt);
  fs.rmSync(rootDir, { recursive: true, force: true });
});

test('usa la inteligencia parcial inicial, explica sus límites y se actualiza al recuperarse las fuentes', async (t) => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mostwanted-intel-partial-'));
  t.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));
  const reports = [{ id: 1, nickname: 'Player', rid: '123', reason: 'Reporte de prueba' }];
  const prompts = [];
  let intel = intelFor('partial');
  intel.payload.complete = false;
  intel.payload.limitations = ['No se pudo consultar la carrera en PlayStation 4.'];
  intel.payload.platforms = [{ platform: 'pc', label: 'PC', metrics: { rank: 936 } }];
  let intelCalls = 0;
  const getPlayerIntel = async () => { intelCalls++; return intel; };
  const query = {
    rootDir, source: async () => reports, nickname: 'Player', rid: '123', awaitSummary: true, getPlayerIntel,
    generateCaseSummary: async ({ intel: digest }) => { prompts.push(digest); return 'Resumen'; },
  };
  const first = await readCase(query);
  const id = first.payload.case.id;
  assert.equal(first.payload.case.classification.intelStatus, 'partial');
  assert.equal(prompts[0].carreras[0].rango, 936);
  assert.deepEqual(prompts[0].limitaciones, ['No se pudo consultar la carrera en PlayStation 4.']);
  assert.equal(readExpedientes(rootDir)[0].intelSnapshot.complete, false);

  await refreshCaseIntel({ rootDir, id, getPlayerIntel, now: () => Date.now() + 14 * 60 * 1000 });
  assert.equal(intelCalls, 1, 'No reintenta antes del intervalo para fuentes parciales');
  intel = intelFor('richer');
  intel.payload.complete = false;
  intel.payload.limitations = ['No se pudo consultar la carrera en PlayStation 4.'];
  intel.payload.platforms = [{ platform: 'pc', label: 'PC', metrics: { rank: 936, kdRatio: 12 } }];
  await refreshCaseIntel({ rootDir, id, getPlayerIntel, now: () => Date.now() + 16 * 60 * 1000 });
  const moreData = await readCase(query);
  assert.equal(prompts[1].carreras[0].kdJugadores, 12, 'La nueva información parcial llega a HEX');
  assert.equal(moreData.payload.case.classification.intelStatus, 'partial');

  intel = intelFor('poorer');
  intel.payload.complete = false;
  intel.payload.limitations = ['No se pudo consultar la carrera en PC.'];
  await refreshCaseIntel({ rootDir, id, getPlayerIntel, now: () => Date.now() + 32 * 60 * 1000 });
  assert.equal(readExpedientes(rootDir)[0].intelSnapshot.signature, 'richer', 'Una respuesta parcial no descarta datos ya disponibles');
  intel = intelFor('recovered');
  await refreshCaseIntel({ rootDir, id, getPlayerIntel, now: () => Date.now() + 48 * 60 * 1000 });
  assert.equal(readCaseClassification({ rootDir, id }).classification.intelStatus, 'partial', 'El estado corresponde al texto anterior mientras se actualiza');
  const recovered = await readCase(query);
  assert.equal(prompts.length, 3, 'Una recuperación invalida el resumen anterior');
  assert.deepEqual(prompts[2].limitaciones, []);
  assert.equal(recovered.payload.case.classification.intelStatus, 'complete');

  const completeSnapshot = readExpedientes(rootDir)[0].intelSnapshot;
  intel = intelFor('degraded');
  intel.payload.complete = false;
  intel.payload.limitations = ['No se pudo consultar la carrera en PlayStation 4.'];
  await refreshCaseIntel({ rootDir, id, getPlayerIntel, now: () => Date.now() + 7 * HOUR });
  const preserved = readExpedientes(rootDir)[0].intelSnapshot;
  assert.equal(preserved.signature, completeSnapshot.signature);
  assert.deepEqual(preserved.digest, completeSnapshot.digest, 'Una respuesta parcial no reemplaza datos completos anteriores');
  assert.equal(preserved.fetchedAt, completeSnapshot.fetchedAt);
});

test('la inteligencia pendiente se comparte y no inicia el resumen antes de terminar', async (t) => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mostwanted-intel-pending-'));
  t.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));
  let release;
  let notifyStarted;
  const started = new Promise(resolve => { notifyStarted = resolve; });
  let intelCalls = 0;
  let summaryCalls = 0;
  const query = {
    rootDir, source: async () => [{ id: 1, nickname: 'Player', rid: '123', reason: 'Reporte' }],
    nickname: 'Player', rid: '123',
    getPlayerIntel: async () => {
      intelCalls++;
      notifyStarted();
      return new Promise(resolve => { release = resolve; });
    },
    generateCaseSummary: async () => { summaryCalls++; return 'Resumen completo'; },
  };
  const first = readCase({ ...query, awaitSummary: true });
  await started;
  const second = await readCase(query);
  const id = second.payload.case.id;
  assert.equal(second.payload.case.classification.pending, true);
  assert.equal(second.payload.case.classification.text, null);
  assert.equal(readCaseClassification({ rootDir, id }).classification.pending, true);
  assert.equal(intelCalls, 1);
  assert.equal(summaryCalls, 0, 'No genera un informe sin esperar la inteligencia pendiente');

  release(intelFor('complete'));
  const completed = await first;
  assert.equal(summaryCalls, 1);
  assert.equal(completed.payload.case.classification.text, 'Resumen completo');
  assert.equal(readCaseClassification({ rootDir, id }).classification.pending, false);
});

test('una consulta vencida no reemplaza los datos de una reserva más reciente', async (t) => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mostwanted-intel-lease-'));
  t.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));
  const first = await readCase({
    rootDir, source: async () => [{ id: 1, nickname: 'Player', rid: '123', reason: 'Reporte' }],
    nickname: 'Player', rid: '123',
  });
  const id = first.payload.case.id;
  const started = Date.now();
  const releases = [];
  const getPlayerIntel = () => new Promise(resolve => releases.push(resolve));
  const oldRequest = refreshCaseIntel({ rootDir, id, getPlayerIntel, now: () => started });
  const newRequest = refreshCaseIntel({ rootDir, id, getPlayerIntel, now: () => started + 16 * 60 * 1000 });
  assert.equal(releases.length, 2);
  releases[0](intelFor('obsolete'));
  assert.equal((await oldRequest).pending, true);
  assert.notEqual(readExpedientes(rootDir)[0].intelSnapshot.signature, 'obsolete');
  releases[1](intelFor('current'));
  await newRequest;
  assert.equal(readExpedientes(rootDir)[0].intelSnapshot.signature, 'current');
});
