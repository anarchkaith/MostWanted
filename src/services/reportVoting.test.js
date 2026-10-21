import assert from 'node:assert/strict';
import test from 'node:test';
import { prepareReportVote, registerReportVote } from './reportVoting.js';

function storage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}
const verification = { ok: true, communityVerification: { up: 4, down: 2, confirmations: [{ reason: 'Revisar evidencia.' }] } };

test('vote validation rejects invalid IDs, vote types and incomplete false-report feedback before writing', async () => {
  for (const input of [
    { reportId: 0, voteType: 'up' }, { reportId: 'abc', voteType: 'up' },
    { reportId: 1, voteType: 'invalid' }, { reportId: 1, voteType: 'down', reason: 'short', voterName: 'Name' },
    { reportId: 1, voteType: 'down', reason: 'Reason long enough', voterName: 'x' },
  ]) {
    await assert.rejects(registerReportVote({ input, storage: {}, request: () => assert.fail('Invalid vote reached WordPress') }));
  }
});

test('vote names and feedback preserve the established contract', () => {
  assert.deepEqual(prepareReportVote({ reportId: '42', voteType: 'up' }, { username: 'Player', discriminator: '1234' }),
    { reportId: 42, voteType: 'up', reason: '', voterName: 'Player#1234' });
  assert.equal(prepareReportVote({ reportId: 42, voteType: 'up' }, { username: 'Player', discriminator: '0' }).voterName, 'Player');
  assert.equal(prepareReportVote({ reportId: 42, voteType: 'up' }).voterName, 'Comunidad');
  assert.deepEqual(prepareReportVote({ reportId: 42, voteType: 'down', reason: '  Motivo suficiente  ', voterName: '  Comunidad  ' }),
    { reportId: 42, voteType: 'down', reason: 'Motivo suficiente', voterName: 'Comunidad' });
});

test('only a confirmed remote vote updates local preferences and cached counters', async () => {
  const cache = storage({
    mostwanted_user_votes: '{"1":"down"}',
    mostwanted_reportes: JSON.stringify([{ id: 42, usuario: 'Player' }, { id: 43, usuario: 'Other' }]),
  });
  const result = await registerReportVote({
    input: { reportId: 42, voteType: 'up' }, storage: cache,
    request: async vote => { assert.equal(vote.reportId, 42); return verification; },
  });
  assert.equal(result.userVote, 'up');
  assert.equal(result.votos.up, 4);
  assert.equal(result.votos.down, 2);
  assert.equal(result.votos.comentarios[0].comentario, 'Revisar evidencia.');
  assert.equal(result.warning, '');
  assert.deepEqual(JSON.parse(cache.getItem('mostwanted_user_votes')), { 1: 'down', 42: 'up' });
  const cachedReports = JSON.parse(cache.getItem('mostwanted_reportes'));
  assert.deepEqual(cachedReports[0].votos, result.votos);
  assert.deepEqual(cachedReports[1], { id: 43, usuario: 'Other' });
});

test('network and malformed responses never create a success-shaped local vote', async () => {
  const cache = { getItem() { assert.fail('Failure reached storage'); }, setItem() { assert.fail('Failure wrote storage'); } };
  for (const request of [
    async () => { throw new Error('offline'); }, async () => ({}),
    async () => ({ ok: false, communityVerification: verification.communityVerification }),
    async () => ({ ok: true, communityVerification: { up: '4', down: 0 } }),
    async () => ({ ok: true, communityVerification: { up: 4, down: -1 } }),
  ]) {
    await assert.rejects(registerReportVote({ input: { reportId: 42, voteType: 'up' }, request, storage: cache }));
  }
});

test('storage failure after remote success returns the real counters with an explicit warning, not a failed-vote retry', async () => {
  let errors = 0;
  const result = await registerReportVote({
    input: { reportId: 42, voteType: 'up' }, request: async () => verification,
    storage: { getItem() { return null; }, setItem() { throw new Error('quota'); } },
    logger: { error() { errors += 1; } },
  });
  assert.equal(result.votos.up, 4);
  assert.match(result.warning, /El voto se guardó en WordPress/);
  assert.equal(errors, 1);
});
