import assert from 'node:assert/strict';
import { registerReportsRoutes } from './reports.routes.js';

const routes = new Map();
registerReportsRoutes({ get(path, ...handlers) { routes.set(path, handlers.at(-1)); }, post() {} }, {
  rateLimits: { general() {}, webhook() {} },
  wordpressReportsConfig: { baseUrl: 'https://wordpress.test', apiSecret: 'secret', timeoutMs: 1000 },
  sessionStore: { all(callback) { callback(null, {}); } },
});
const originalFetch = globalThis.fetch;
let calls = 0;
globalThis.fetch = async (url, options) => {
  calls++;
  assert.match(url, /accounts\/private\?page=1$/);
  assert.ok(options.headers.Authorization);
  return new Response(JSON.stringify({ ok: true, items: [{ identity: { id: '123', email: 'private@test' }, reportIds: [7], reportCount: 70, loginCount: 1 }], hasMore: false }));
};
async function request(user, query = {}) {
  const res = { code: 200, headers: {}, set(k, v) { this.headers[k] = v; return this; },
    status(code) { this.code = code; return this; }, json(value) { this.payload = value; return this; } };
  await routes.get('/api/admin/accounts')({ session: user ? { authUser: user } : {}, query }, res);
  assert.equal(res.headers['Cache-Control'], 'private, no-store');
  return res;
}
try {
  assert.equal((await request(null)).code, 401);
  assert.equal((await request({ id: '123', username: 'camiikilljoy' }, { id: '343976455400718339' })).code, 403);
  assert.equal(calls, 0);
  assert.equal((await request({ id: '343976455400718339' }, { page: '-1' })).code, 400);
  const res = await request({ id: '343976455400718339' }, { minReports: '60' });
  assert.equal(res.code, 200);
  assert.equal(res.payload.items[0].identity.email, 'private@test');
  assert.equal(res.payload.summary.reports, 70);
  assert.equal(calls, 1);
  globalThis.fetch = async () => new Response(JSON.stringify({ ok: true, items: [{ identity: { id: '123' }, reportIds: [7] }], hasMore: false }));
  assert.equal((await request({ id: '343976455400718339' })).code, 502, 'Old plugins must not return success-shaped counts');
} finally {
  globalThis.fetch = originalFetch;
}
console.log('OK private accounts exact-session authorization, pagination and cache protection');
