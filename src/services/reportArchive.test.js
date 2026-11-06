import assert from 'node:assert/strict';
import test from 'node:test';
import { clearLegacyReportArchive, readUserVotes } from './reportArchive.js';
import { fetchReportById, fetchWordpressPlayerInsights, submitWordpressCommunityVerificationVote } from './reportSubmissionService.js';

test('legacy bulk cache is removed, never read or reused as fallback', () => {
  const removed = [];
  assert.equal(clearLegacyReportArchive({
    removeItem(key) { removed.push(key); },
    getItem() { assert.fail('Read old full archive'); },
  }), '');
  assert.deepEqual(removed, ['mostwanted_reportes']);
  let errors = 0;
  assert.match(clearLegacyReportArchive({ removeItem() { throw new Error('denied'); } },
    { error() { errors++; } }), /copia antigua/);
  assert.equal(errors, 1);
});

test('scoped report, insights and votes use backend session, never direct WordPress or a client key', async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  const signal = new AbortController().signal;
  const buildUrl = path => `https://api.test/api${path}`;
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options });
    assert.ok(String(url).includes('/api/reports/'));
    assert.ok(!String(url).includes('wp-json'));
    assert.equal(options.credentials, 'include');
    assert.equal(options.headers?.Authorization, undefined);
    return Response.json(String(url).includes('player-insights')
      ? { ok: true, player: { rid: '123' } }
      : String(url).includes('community-verification')
        ? { ok: true, communityVerification: { up: 1, down: 0 } }
        : { ok: true, report: { id: 42, nickname: 'Player' } });
  };
  try {
    assert.equal((await fetchReportById({ reportId: 42, signal }, buildUrl)).id, 42);
    assert.equal(requests[0].options.signal, signal);
    assert.equal((await fetchWordpressPlayerInsights({ username: 'Player', rid: '123', signal }, buildUrl)).rid, '123');
    await submitWordpressCommunityVerificationVote({ reportId: 42, voteType: 'up' }, buildUrl);
    assert.equal(requests.length, 3);
    globalThis.fetch = async () => Response.json({ ok: false, error: 'auth_required' }, { status: 401 });
    await assert.rejects(fetchReportById({ reportId: 42 }, buildUrl), /auth_required/);
    globalThis.fetch = async () => Response.json({ ok: true, report: { id: 99 } });
    await assert.rejects(fetchReportById({ reportId: 42 }, buildUrl), /invalido/);
  } finally { globalThis.fetch = originalFetch; }
});

test('vote preferences remain available without storing report content', () => {
  assert.deepEqual(readUserVotes({ getItem: () => '{"1":"up"}' }), { 1: 'up' });
  let errors = 0;
  assert.deepEqual(readUserVotes({ getItem: () => '[]' }, { error() { errors++; } }), {});
  assert.equal(errors, 1);
});
