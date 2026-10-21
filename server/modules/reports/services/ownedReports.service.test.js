import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import { getOwnedReports } from './ownedReports.service.js';
import { submitWordpressReport } from './submitReport.service.js';
import { registerReportsRoutes } from '../http/reports.routes.js';

const config = { enabled: true, baseUrl: 'https://wordpress.test', apiSecret: 'test-secret', timeoutMs: 1000 };
const logger = { info() {}, warn() {}, error() {} };
const report = { id: 7, nickname: 'Player', rid: '123', reason: 'Motivo documentado', investigation_status: 'resolved' };

test('ownership is taken only from the authenticated session, never from the submitted body', async t => {
  const sent = [];
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    sent.push(JSON.parse(options.body));
    return new Response(JSON.stringify({ ok: true, reportId: 7, player: null }), { status: 201 });
  });
  const body = { report, reporter: { id: '999', name: 'Claimed user' }, ownerDiscordId: '999' };
  const result = await submitWordpressReport({ body, sessionUser: { id: '123456789' }, wordpressReportsConfig: config, logger });
  assert.equal(result.status, 201);
  assert.equal(sent[0].ownerDiscordId, '123456789');
  await submitWordpressReport({ body, wordpressReportsConfig: config, logger });
  assert.equal(Object.hasOwn(sent[1], 'ownerDiscordId'), false);
});

test('owned reports require identity, valid pagination and configured WordPress', async () => {
  assert.equal((await getOwnedReports({ config, userId: '' })).status, 401);
  for (const page of ['x', 0, -1, 1.5]) {
    assert.equal((await getOwnedReports({ config, userId: '123', page })).status, 400);
  }
  assert.equal((await getOwnedReports({ config: { ...config, enabled: false }, userId: '123' })).status, 503);
});

test('owned reports use a secret-protected lookup and strip all author data', async t => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    const parsed = new URL(url);
    assert.equal(parsed.pathname, '/wp-json/mostwanted/v1/reports/owned');
    assert.equal(parsed.searchParams.get('ownerDiscordId'), '123');
    assert.equal(parsed.searchParams.get('page'), '2');
    assert.equal(parsed.searchParams.get('per_page'), '20');
    assert.equal(options.headers.Authorization, 'Bearer test-secret');
    return new Response(JSON.stringify({ ok: true, items: [{ ...report, ownerDiscordId: 'PRIVATE', reporter: { id: 'PRIVATE' }, ip: 'PRIVATE' }], hasMore: true }));
  });
  const result = await getOwnedReports({ config, userId: '123', page: 2, logger });
  assert.equal(result.status, 200);
  assert.equal(result.payload.hasMore, true);
  assert.equal(result.payload.items[0].id, 7);
  assert.equal(JSON.stringify(result.payload).includes('PRIVATE'), false);
});

test('upstream errors and invalid payloads are explicit, not an empty success', async t => {
  for (const response of [
    () => new Response('{}', { status: 404 }),
    () => new Response('not-json'),
    () => new Response(JSON.stringify({ ok: true, items: [], hasMore: 'false' })),
  ]) {
    t.mock.method(globalThis, 'fetch', async () => response());
    assert.equal((await getOwnedReports({ config, userId: '123', logger })).status, 502);
    t.mock.restoreAll();
  }
});

test('HTTP endpoint cannot select another owner, always requires session and is never cacheable', async t => {
  const nativeFetch = globalThis.fetch;
  const seen = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (String(url).startsWith(config.baseUrl)) {
      seen.push(new URL(url).searchParams.get('ownerDiscordId'));
      return new Response(JSON.stringify({ ok: true, items: [], hasMore: false }));
    }
    return nativeFetch(url, options);
  });
  const app = express();
  app.use((req, _res, next) => {
    if (req.headers['x-test-session']) req.session = { authUser: { id: req.headers['x-test-session'] } };
    next();
  });
  const next = (_req, _res, done) => done();
  registerReportsRoutes(app, { wordpressReportsConfig: config, rateLimits: { general: next, webhook: next }, maybeRequireSessionAuth: next, requireNonEmptyBody: next });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try {
    const url = `http://127.0.0.1:${server.address().port}/api/reports/mine?ownerDiscordId=999&userId=999`;
    const denied = await fetch(url);
    assert.equal(denied.status, 401);
    assert.equal(denied.headers.get('cache-control'), 'private, no-store');
    assert.deepEqual(seen, []);
    for (const id of ['123', '456']) {
      const response = await fetch(url, { headers: { 'x-test-session': id } });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('cache-control'), 'private, no-store');
    }
    assert.deepEqual(seen, ['123', '456']);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
