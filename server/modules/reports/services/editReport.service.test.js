import assert from 'node:assert/strict';
import test from 'node:test';
import { editReport } from './editReport.service.js';
import { registerReportsRoutes } from '../http/reports.routes.js';

const config = { enabled: true, baseUrl: 'https://wordpress.test', apiSecret: 'fixture-secret', timeoutMs: 1000 };
const user = { id: '123' };
const changes = { nickname: 'Player', reason: 'Corrected reason', crews: '', typesOfInfraction: ['MODDER'], labels: [], evidence: [] };
const logger = { info() {}, error() {} };
const request = options => editReport({ config, user, reportId: '7', logger, ...options });
const success = { ok: true, canEdit: true, report: { id: 7, nickname: 'Player', rid: '456' }, revision: 'new-revision' };

test('inspection uses verified session identity, never client claims; only the existing administrator is elevated', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options, body: JSON.parse(options.body) });
    return Response.json(success);
  };
  try {
    const result = await request({ inspect: true, body: { actor: { id: 'victim', isAdmin: true } } });
    assert.equal(result.status, 200);
    assert.equal(calls[0].url, 'https://wordpress.test/wp-json/mostwanted/v1/reports/7/edit');
    assert.deepEqual(calls[0].body, { actor: { id: '123', isAdmin: false }, inspect: true });
    assert.equal(calls[0].options.headers.Authorization, 'Bearer fixture-secret');
    await request({ inspect: true, user: { id: '343976455400718339' } });
    assert.deepEqual(calls[1].body.actor, { id: '343976455400718339', isAdmin: true });
    globalThis.fetch = async () => Response.json({ ok: true, canEdit: false });
    assert.deepEqual((await request({ inspect: true })).payload, { ok: true, canEdit: false });
  } finally { globalThis.fetch = originalFetch; }
});

test('editing sends only changes, revision and server authority, then refreshes the same report without another submission', async () => {
  const originalFetch = globalThis.fetch;
  let refreshed;
  globalThis.fetch = async (_url, options) => {
    assert.deepEqual(JSON.parse(options.body), { actor: { id: '123', isAdmin: false }, changes, revision: 'old-revision' });
    return Response.json(success);
  };
  try {
    const result = await request({ body: { changes, revision: 'old-revision', actor: { isAdmin: true }, ownerDiscordId: 'victim' },
      refreshPlayerCase: async value => { refreshed = value; } });
    assert.equal(result.status, 200);
    assert.deepEqual(refreshed, { nickname: 'Player', rid: '456', reportId: 7 });
    const warned = await request({ body: { changes, revision: 'old-revision' }, refreshPlayerCase: async () => { throw new Error('offline'); } });
    assert.equal(warned.status, 200);
    assert.match(warned.payload.warning, /guardaron/);
  } finally { globalThis.fetch = originalFetch; }
});

test('auth, ids, configuration, denied writes, conflicts and incomplete deployments fail explicitly', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => assert.fail('Invalid local requests must not reach WordPress');
  try {
    assert.equal((await request({ user: null, inspect: true })).status, 401);
    for (const reportId of ['0', '1.2', '../7', '99999999999999999999']) {
      assert.equal((await request({ reportId, inspect: true })).status, 400);
    }
    assert.equal((await request({ body: {} })).status, 400);
    assert.equal((await request({ inspect: true, config: {} })).status, 503);
    for (const status of [400, 403, 409]) {
      globalThis.fetch = async () => Response.json({ error: `failure-${status}` }, { status });
      const result = await request({ body: { changes, revision: 'old-revision' } });
      assert.equal(result.status, status);
      assert.equal(result.payload.error, `failure-${status}`);
    }
    for (const data of [{}, { ...success, report: { id: 8 } }, { ...success, revision: null }]) {
      globalThis.fetch = async () => Response.json(data);
      assert.equal((await request({ inspect: true })).status, 502);
    }
    globalThis.fetch = async () => new Response('Cannot GET /edit', { status: 404 });
    assert.equal((await request({ inspect: true })).status, 502);
    globalThis.fetch = async () => Response.json({ code: 'report_not_found', error: 'Reporte no disponible.' }, { status: 404 });
    assert.equal((await request({ inspect: true })).status, 404);
    globalThis.fetch = async () => { throw new Error('offline'); };
    assert.equal((await request({ inspect: true })).status, 502);
  } finally { globalThis.fetch = originalFetch; }
});

test('both web routes enforce a session and private no-store headers even when anonymous reading is enabled', async () => {
  const routes = new Map();
  registerReportsRoutes({
    get(path, ...handlers) { routes.set(`GET ${path}`, handlers); },
    post(path, ...handlers) { routes.set(`POST ${path}`, handlers); },
  }, { rateLimits: { general() {}, webhook() {} } });
  for (const method of ['GET', 'POST']) {
    const handlers = routes.get(`${method} /api/reports/:id/edit`);
    const res = { set(key, value) { assert.equal(key, 'Cache-Control'); assert.equal(value, 'private, no-store'); },
      status(value) { this.code = value; return this; }, json(value) { this.payload = value; return this; } };
    handlers[1]({ session: {} }, res, () => assert.fail('Anonymous editing allowed'));
    assert.equal(res.code, 401);
    assert.equal(res.payload.ok, false);
  }
});
