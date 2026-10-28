import assert from 'node:assert/strict';
import test from 'node:test';
import { runReportSubmission } from './reportSubmissionWorkflow.js';

const values = {
  investigation_status: 'resolved',
  nickname: '  Player  ',
  crews: 'Crew One',
  avatar1: 'https://example.test/avatar.png',
  avatar2: '',
  rid: '123',
  ip: '192.0.2.1',
  aliases: 'OtherName',
  time: '1760000000',
  typesOfInfraction: ['MODDER'],
  reason: 'Motivo completo del reporte',
  evidence: ['FORM_ONLY'],
  labels: ['Aimbot'],
};
const images = [{ name: 'Captura' }];
const evidence = [{ url: 'https://example.test/image.png' }];
const expectedReport = { ...values, nickname: 'Player' };
delete expectedReport.evidence;

test('submission uploads before saving and refreshing, trims identity and never submits form evidence', async () => {
  const order = [];
  const saved = { ok: true, player: { nickname: 'Player' }, discordDelivery: { ok: true } };
  const result = await runReportSubmission({
    values, images, apiKey: 'fixture-key', user: { id: '123', username: 'User' },
    upload: async (files, key) => { order.push('upload'); assert.equal(files, images); assert.equal(key, 'fixture-key'); return evidence; },
    save: async input => {
      order.push('save');
      assert.deepEqual(input, {
        report: expectedReport,
        reporter: { id: '123', name: 'User', email: '' },
        evidence,
      });
      return saved;
    },
    onSaved: async (report, response) => { order.push('refresh'); assert.equal(report.nickname, 'Player'); assert.equal(response, saved); },
  });
  assert.deepEqual(order, ['upload', 'save', 'refresh']);
  assert.deepEqual(result, {
    nickname: 'Player',
    report: expectedReport,
    evidence,
    discordDelivery: { ok: true },
    warning: '',
  });
  assert.equal(values.nickname, '  Player  ');
});

test('upload or save failures stop the workflow without a success or refresh', async () => {
  for (const stage of ['upload', 'save']) {
    await assert.rejects(runReportSubmission({
      values, images,
      upload: async () => { if (stage === 'upload') throw new Error('upload failed'); return evidence; },
      save: async () => { throw new Error('save failed'); },
      onSaved: () => assert.fail('Failed submission refreshed'),
    }), new RegExp(`${stage} failed`));
  }
});

test('partial or invalid evidence uploads never save or refresh the report', async () => {
  for (const uploaded of [
    undefined, [], [null], [{}], [{ url: '' }], [{ url: 'not-a-url' }],
    [{ url: 'javascript:alert(1)' }], [...evidence, ...evidence],
  ]) {
    await assert.rejects(runReportSubmission({
      values, images,
      upload: async () => uploaded,
      save: () => assert.fail('Report saved with incomplete evidence'),
      onSaved: () => assert.fail('Report refreshed with incomplete evidence'),
    }), /evidencia/i);
  }
});

test('all selected evidence must upload successfully before saving, including after a retry', async () => {
  const selected = [{ name: 'Uno' }, { name: 'Dos' }];
  const uploaded = [{ url: 'https://example.test/one.png' }, { url: 'https://example.test/two.png' }];
  let saves = 0;
  for (const fails of [true, false]) {
    const operation = runReportSubmission({
      values, images: selected,
      upload: async () => { if (fails) throw new Error('Dos: upload failed'); return uploaded; },
      save: async ({ evidence: actual }) => {
        saves += 1;
        assert.deepEqual(actual, uploaded);
        return { ok: true };
      },
    });
    if (fails) await assert.rejects(operation, /Dos: upload failed/);
    else assert.deepEqual((await operation).evidence, uploaded);
  }
  assert.equal(saves, 1);
});

test('reports without selected evidence remain supported', async () => {
  const result = await runReportSubmission({
    values, images: [], upload: async () => [],
    save: async ({ evidence }) => { assert.deepEqual(evidence, []); return { ok: true }; },
  });
  assert.deepEqual(result.evidence, []);
});

test('Discord and refresh warnings retain confirmed save without repeating upload or save', async () => {
  for (const fails of [false, true]) {
    const warnings = [];
    let saves = 0;
    const result = await runReportSubmission({
      values, images, logger: { warn: (...args) => warnings.push(args) },
      upload: async () => evidence,
      save: async ({ reporter }) => {
        saves += 1;
        assert.deepEqual(reporter, { id: '', name: 'Anónimo', email: '' });
        return { ok: true, discordDelivery: { ok: false, message: 'Discord offline' }, warning: 'Aviso remoto.' };
      },
      onSaved: async () => { if (fails) throw new Error('refresh offline'); return { warning: 'Copia desactualizada.' }; },
    });
    assert.equal(saves, 1);
    assert.equal(result.discordDelivery.ok, false);
    assert.match(result.warning, /Aviso remoto/);
    assert.match(result.warning, fails ? /se guardó.*no se pudo refrescar/ : /Copia desactualizada/);
    assert.equal(warnings.length, fails ? 1 : 0);
  }
});
