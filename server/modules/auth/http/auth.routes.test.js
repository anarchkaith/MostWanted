import assert from 'node:assert/strict';
import { registerAuthRoutes } from './auth.routes.js';
import { StaffAuthError } from '../../../shared/auth/discordStaff.js';

const handlers = new Map();
let roleError = null;
registerAuthRoutes({
  get(path, handler) { handlers.set(path, handler); },
  post(path, handler) { handlers.set(path, handler); },
}, {
  discordAuth: { clientId: 'client', clientSecret: 'secret', callbackUrl: 'http://localhost/callback',
    apiUrl: 'https://discord.test', oauthScopes: 'identify email guilds.members.read' },
  authFrontendSuccessUrl: 'http://localhost/success',
  authFrontendFailureUrl: 'http://localhost/failure',
  authAllowedDiscordUserIds: new Set(),
  verifyCaseStaff: async () => { if (roleError) throw roleError; return { manageCases: true }; },
});
function response() {
  return {
    statusCode: 200, headers: {}, payload: null, redirectUrl: '',
    set(name, value) { this.headers[name] = value; return this; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; },
    redirect(url) { this.redirectUrl = url; return this; },
  };
}
const req = { session: { authUser: { id: 'user', username: 'User' }, discordToken: { accessToken: 'PRIVATE_TOKEN' } } };
let res = response();
await handlers.get('/api/auth/me')(req, res);
assert.deepEqual(res.payload.capabilities, { manageCases: true });
assert.equal(JSON.stringify(res.payload).includes('PRIVATE_TOKEN'), false);
assert.equal(res.headers['Cache-Control'], 'private, no-store');
for (const [status, code] of [[403, 'staff_role_required'], [503, 'discord_unavailable'], [401, 'discord_session_expired']]) {
  roleError = new StaffAuthError(status, code);
  res = response();
  await handlers.get('/api/auth/me')(req, res);
  assert.equal(res.statusCode, 200, 'staff failure must not silently log out a regular application user');
  assert.deepEqual(res.payload.capabilities, { manageCases: false });
  assert.deepEqual(res.payload.capabilityError, { status, code });
}
res = response();
await handlers.get('/api/auth/me')({}, res);
assert.equal(res.statusCode, 401);
assert.equal(res.payload.capabilities.manageCases, false);

const oauthReq = { session: {} };
res = response();
handlers.get('/auth/discord')(oauthReq, res);
assert.match(new URL(res.redirectUrl).searchParams.get('scope'), /guilds.members.read/);
const state = oauthReq.session.discordOauthState;
oauthReq.query = { state, code: 'code' };
oauthReq.session.regenerate = (callback) => {
  oauthReq.session = { save(next) { next(); } };
  callback();
};
const originalFetch = globalThis.fetch;
try {
  globalThis.fetch = async (url) => ({
    ok: true, json: async () => url.endsWith('/oauth2/token')
      ? { access_token: 'PRIVATE_ACCESS', refresh_token: 'PRIVATE_REFRESH', expires_in: 600, scope: 'identify guilds.members.read' }
      : { id: 'user', username: 'User' },
  });
  res = response();
  await handlers.get('/auth/discord/callback')(oauthReq, res);
  assert.equal(oauthReq.session.discordToken.refreshToken, 'PRIVATE_REFRESH');
  assert.ok(oauthReq.session.discordToken.expiresAt > Date.now());
  assert.equal(oauthReq.session.authUser.id, 'user');
  assert.match(res.redirectUrl, /auth=ok/);
  assert.equal(res.redirectUrl.includes('PRIVATE'), false);
} finally {
  globalThis.fetch = originalFetch;
}
console.log('OK auth capabilities / OAuth scope / server-only token storage');
