import assert from 'node:assert/strict';
import test from 'node:test';
import { runReportSubmission } from './reportSubmissionWorkflow.js';

const values = { nickname: '  Player  ', reason: 'Motivo', evidence: ['FORM_ONLY'], rid: '123' };
const images = [{ name: 'Captura' }];
const evidence = [{ url: 'https://example.test/image.png' }];

test('submission uploads before saving and refreshing, trims identity and never submits form evidence', async () => {
  const order = [];
  const saved = { ok: true, player: { nickname: 'Player' }, discordDelivery: { ok: true } };
  const result = await runReportSubmission({
    values, images, apiKey: 'fixture-key', user: { id: '123', username: 'User' },
    upload: async (files, key) => { order.push('upload'); assert.equal(files, images); assert.equal(key, 'fixture-key'); return evidence; },
    save: async input => {
      order.push('save');
      assert.deepEqual(input, { report: { nickname: 'Player', reason: 'Motivo', rid: '123' }, reporter: { id: '123', name: 'User', email: '' }, evidence });
      return saved;
    },
    onSaved: async (report, response) => { order.push('refresh'); assert.equal(report.nickname, 'Player'); assert.equal(response, saved); },
  });
  assert.deepEqual(order, ['upload', 'save', 'refresh']);
  assert.deepEqual(result, { nickname: 'Player', discordDelivery: { ok: true }, warning: '' });
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
