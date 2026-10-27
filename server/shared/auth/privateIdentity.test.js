import assert from 'node:assert/strict';
import { privateIdentity, publishAccountActivity } from './privateIdentity.js';
import { buildWordpressReportPayload } from '../../reports/payload.js';

const user = { id: '123', username: 'name', globalName: 'Name', email: 'private@example.test',
  avatar: 'hash', accessToken: 'SECRET', extra: 'SECRET' };
const identity = privateIdentity(user);
assert.deepEqual(Object.keys(identity), ['id', 'username', 'globalName', 'avatar', 'email']);
assert.equal(JSON.stringify(identity).includes('SECRET'), false);
assert.equal(privateIdentity(null), null);
assert.equal(privateIdentity({ id: 'invalid' }), null);
assert.deepEqual(buildWordpressReportPayload({ privateIdentity: identity }).privateIdentity, identity);
const originalFetch = globalThis.fetch;
let errors = 0;
try {
  globalThis.fetch = async (url, options) => {
    assert.match(url, /accounts\/activity$/);
    assert.ok(options.headers.Authorization);
    assert.deepEqual(JSON.parse(options.body), { identity, event: 'login' });
    return new Response('{"ok":true}');
  };
  const config = { baseUrl: 'https://wordpress.test', apiSecret: 'secret', timeoutMs: 1000 };
  const logger = { info() {}, error() { errors++; } };
  assert.equal(await publishAccountActivity({ config, user, event: 'login', logger }), true);
  globalThis.fetch = async () => { throw new Error('unavailable'); };
  assert.equal(await publishAccountActivity({ config, user, event: 'login', logger }), false);
  assert.equal(errors, 1);
} finally {
  globalThis.fetch = originalFetch;
}
console.log('OK private verified identity allowlist, authenticated publication and explicit failure logging');
