import assert from 'node:assert/strict';
import test from 'node:test';
import { mapCategoriaLegacy, mapWordpressReportToReporte, normalizeComentariosFromCommunityVerification, normalizeReporte, normalizeReportLabels } from './reportViewModel.js';
import { publicReport } from '../../server/modules/expedientes/services/caseReports.service.js';

test('WordPress adapter preserves report presentation, evidence and player identity without author attribution', () => {
  const report = {
    id: '42', nickname: ' Player ', rid: '000123', content: '**Motivo**',
    createdAt: '2026-10-01T12:00:00Z', categories: ['MODDER', 'ACOSO-RAID'],
    severity: 'alta', validation: 'verified', aliases: ['OldName'], crews: [{ name: 'Crew' }],
    avatar1: 'https://example.com/avatar.png',
    labels: ['Aimbot', { id: 7, label: 'Crash', detail: 'Cierre de la sesion' }],
    time: 1760000000, investigation_status: 'resolved',
    evidence: [{ url: 'https://example.com/proof.png', name: 'Prueba', contentType: 'image/webp' }, { url: '' }],
    reporter: { id: 'PRIVATE_ID', name: 'PRIVATE_NAME' }, ownerDiscordId: 'PRIVATE_OWNER', ip: 'PRIVATE_IP',
    communityVerification: { up: '7', down: 2, confirmations: [{ reason: '  Revisar prueba  ' }, { reason: '' }] },
  };
  const before = structuredClone(report);
  const view = mapWordpressReportToReporte(report);
  assert.equal(view.id, 42);
  assert.equal(view.usuario, 'Player');
  assert.equal(view.wpRid, '123');
  assert.equal(view.categoria, 'modder');
  assert.deepEqual(view.categories, ['MODDER', 'ACOSO-RAID']);
  assert.equal(view.motivo, '**Motivo**');
  assert.equal(view.fecha, report.createdAt);
  assert.equal(view.severidad, 'alta');
  assert.equal(view.validacion, 'verificado');
  assert.equal(view.reportadoPor, 'ANONIMO');
  assert.equal(view.evidencia, report.evidence[0].url);
  assert.deepEqual(view.evidencias, [{ id: '42-evidence-0', preview: report.evidence[0].url, nombre: 'Prueba', tipo: 'image/webp' }]);
  assert.equal(view.votos.up, 7);
  assert.equal(view.votos.down, 2);
  assert.equal(view.votos.comentarios[0].comentario, 'Revisar prueba');
  assert.equal(view.votos.comentarios[0].autor, 'Comunidad');
  assert.deepEqual(view.aliases, ['OldName']);
  assert.deepEqual(view.crews, [{ name: 'Crew' }]);
  assert.equal(view.avatar1, report.avatar1);
  assert.deepEqual(view.labels, [{ label: 'Aimbot', detail: '' }, { label: 'Crash', detail: 'Cierre de la sesion' }]);
  assert.equal(view.time, report.time);
  assert.equal(view.investigation_status, 'resolved');
  assert.equal(JSON.stringify(view).includes('PRIVATE'), false);
  assert.deepEqual(report, before);
});

test('missing and legacy values retain their established defaults', () => {
  assert.equal(mapCategoriaLegacy(['GRIFFER']), 'griffer');
  assert.equal(mapCategoriaLegacy(['GLITCHER']), 'ardido');
  assert.equal(mapCategoriaLegacy(['ACOSO-RAID']), 'ardido');
  assert.equal(mapCategoriaLegacy([], 'custom'), 'custom');
  const view = mapWordpressReportToReporte({ id: 7, title: 'Title', categories: ['griffer'] });
  assert.equal(view.usuario, 'Title');
  assert.equal(view.categoria, 'griffer');
  assert.equal(view.severidad, '');
  assert.equal(view.validacion, '');
  assert.equal(view.avatar2, '');
  assert.deepEqual(view.evidencias, []);
  assert.deepEqual(view.labels, []);
  assert.deepEqual(view.votos, { up: 0, down: 0, comentarios: [] });
  const legacy = normalizeReporte({ id: 1, categorias: ['MODDER'], severidad: 'invalid', reportadoPor: 'PRIVATE' });
  assert.equal(legacy.categoria, 'modder');
  assert.equal(legacy.validacion, 'pendiente');
  assert.equal(legacy.severidad, '');
  assert.equal(legacy.reportadoPor, 'ANONIMO');
  assert.deepEqual(normalizeComentariosFromCommunityVerification({ confirmations: 'invalid' }), []);
});

test('labels retain names and details across WordPress, case reports and cached legacy reports', () => {
  const raw = {
    id: 7, nickname: 'Player', rid: '123', typesOfInfraction: ['MODDER', 'GLITCHER'],
    labels: [' Aimbot ', { id: 9, name: 'Crash', detail: ' Detalle ' }, null, { id: 10 }],
    reason: 'Motivo del reporte', time: '1760000000', investigation_status: 'resolved',
    analysis: { severity: 'alta' }, reporter: { id: 'PRIVATE' }, ip: 'PRIVATE',
  };
  const expectedLabels = [{ label: 'Aimbot', detail: '' }, { label: 'Crash', detail: 'Detalle' }];
  for (const source of [raw, publicReport(raw)]) {
    const view = normalizeReporte(mapWordpressReportToReporte(source));
    assert.deepEqual(view.labels, expectedLabels);
    assert.deepEqual(view.categories, ['MODDER', 'GLITCHER']);
    assert.equal(view.wpRid, '123');
    assert.equal(view.motivo, raw.reason);
    assert.equal(view.time, raw.time);
    assert.equal(view.investigation_status, 'resolved');
    assert.equal(view.severidad, 'alta');
    assert.equal(JSON.stringify(view).includes('PRIVATE'), false);
  }
  assert.deepEqual(normalizeReporte({ etiquetas: raw.labels }).labels, expectedLabels);
  for (const labels of [null, undefined, {}, '', [null, {}, 9]]) {
    assert.deepEqual(normalizeReportLabels(labels), []);
  }
});
