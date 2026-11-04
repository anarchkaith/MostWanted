import assert from 'node:assert/strict';
import test from 'node:test';
import { searchArchive } from './archiveSearch.service.js';
import { registerReportsRoutes } from '../http/reports.routes.js';

const config = { enabled: true, baseUrl: 'https://wordpress.test', apiSecret: 'test-secret', timeoutMs: 1000 };
const logger = { error() {} };
const item = { nickname: 'Player', rid: '123', names: ['Alias'], count: 1,
  searchMatches: [{ field: 'Resumen', text: 'Carreras nocturnas', reportId: 9, reporter: 'private' }],
  privateIdentity: { email: 'private' } };

test('search forwards pagination and returns only the public search contract', async () => {
  const result = await searchArchive({ config, query: ' carreras ', page: '2', logger, search: async args => {
    assert.equal(args.query, 'carreras');
    assert.equal(args.page, 2);
    return { payload: { ok: true, items: [item], page: 2, total: 80, hasMore: false } };
  } });
  assert.equal(result.status, 200);
  assert.equal(result.payload.items[0].privateIdentity, undefined);
  assert.equal(result.payload.items[0].searchMatches[0].reporter, undefined);
});

test('invalid queries and pages never reach WordPress', async () => {
  for (const query of ['', ' ', [], {}, 'x'.repeat(101)]) {
    assert.equal((await searchArchive({ config, query, search: () => assert.fail() })).status, 400);
  }
  for (const page of [0, -1, 1.5, [], {}, 'bad']) {
    assert.equal((await searchArchive({ config, query: 'carreras', page, search: () => assert.fail() })).status, 400);
  }
});

test('configuration, missing plugin and malformed results are explicit failures', async () => {
  assert.equal((await searchArchive({ config: {}, query: 'carreras' })).status, 503);
  for (const search of [
    async () => { throw new Error('rest_no_route'); },
    async () => ({ payload: { ok: true, items: [], page: 1, total: 0 } }),
    async () => ({ payload: { ok: true, items: [{ ...item, names: null }], page: 1, total: 1, hasMore: false } }),
  ]) {
    const result = await searchArchive({ config, query: 'carreras', logger, search });
    assert.equal(result.status, 502);
    assert.match(result.payload.error, /0\.6\.16/);
  }
});

test('registered search endpoint proxies the query with backend-only authorization', async () => {
  const routes = new Map();
  registerReportsRoutes({ get(path, ...handlers) { routes.set(path, handlers); }, post() {} }, {
    wordpressReportsConfig: config, rateLimits: { general() {}, webhook() {} },
  });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    assert.equal(new URL(url).pathname, '/wp-json/mostwanted/v1/search');
    assert.equal(new URL(url).searchParams.get('q'), 'carreras');
    assert.equal(new URL(url).searchParams.get('page'), '2');
    assert.equal(options.headers.Authorization, 'Bearer test-secret');
    return Response.json({ ok: true, items: [item], page: 2, total: 80, hasMore: false });
  };
  try {
    let data;
    const response = {
      set(key, value) { assert.equal(key, 'Cache-Control'); assert.equal(value, 'no-store'); },
      status(value) { assert.equal(value, 200); return this; },
      json(value) { data = value; },
    };
    await routes.get('/api/reports/search').at(-1)({ query: { q: 'carreras', page: '2' } }, response);
    assert.equal(data.items[0].searchMatches[0].text, 'Carreras nocturnas');
    assert.equal(data.items[0].privateIdentity, undefined);
  } finally { globalThis.fetch = originalFetch; }
});
