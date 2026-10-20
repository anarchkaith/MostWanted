import assert from 'node:assert/strict';
import { createDiscordStaffVerifier } from './discordStaff.js';

const config = { discordAuth: { apiUrl: 'https://discord.test', clientId: 'app', clientSecret: 'secret' },
  guildId: 'guild', roleIds: new Set(['staff']) };
const makeReq = (overrides = {}) => ({ sessionID: 'test', session: {
  authUser: { id: 'user', username: 'Staff' },
  discordToken: { accessToken: 'access', refreshToken: 'refresh', scope: 'identify guilds.members.read', expiresAt: Date.now() + 600000, ...overrides },
  save(callback) { callback(); },
} });
const response = (status, payload) => ({ status, ok: status >= 200 && status < 300, json: async () => payload });
const fails = async (verify, req, status, code) => assert.rejects(() => verify(req), (error) => error.status === status && error.code === code);

await fails(createDiscordStaffVerifier(config), {}, 401, 'auth_required');
await fails(createDiscordStaffVerifier({ ...config, guildId: '' }), makeReq(), 503, 'staff_roles_not_configured');
await fails(createDiscordStaffVerifier(config), makeReq({ scope: 'identify' }), 401, 'discord_reauthorization_required');
await fails(createDiscordStaffVerifier(config), makeReq({ expiresAt: 0, refreshToken: '' }), 401, 'discord_session_expired');
for (const [status, payload, expected, code] of [
  [200, { roles: [] }, 403, 'staff_role_required'],
  [404, {}, 403, 'staff_role_required'],
  [403, {}, 403, 'staff_role_required'],
  [401, {}, 401, 'discord_reauthorization_required'],
  [502, {}, 503, 'discord_unavailable'],
  [200, {}, 503, 'discord_invalid_response'],
  [429, {}, 503, 'discord_rate_limited'],
]) {
  await fails(createDiscordStaffVerifier({ ...config, fetchImpl: async () => response(status, payload) }), makeReq(), expected, code);
}
await fails(createDiscordStaffVerifier({ ...config, fetchImpl: async () => { throw new Error('network'); } }), makeReq(), 503, 'discord_unavailable');

let roles = ['staff'];
const verifyRevoked = createDiscordStaffVerifier({ ...config, fetchImpl: async () => response(200, { roles }) });
assert.deepEqual(await verifyRevoked(makeReq()), { manageCases: true });
roles = [];
await fails(verifyRevoked, makeReq(), 403, 'staff_role_required');

let refreshCalls = 0;
let memberCalls = 0;
const refreshVerifier = createDiscordStaffVerifier({ ...config, fetchImpl: async (url, options) => {
  if (url.endsWith('/oauth2/token')) {
    refreshCalls++;
    assert.equal(options.body.get('grant_type'), 'refresh_token');
    return response(200, { access_token: 'renewed', refresh_token: 'rotated', expires_in: 300, scope: 'guilds.members.read' });
  }
  memberCalls++;
  assert.equal(options.headers.Authorization, 'Bearer renewed');
  return response(200, { roles: ['staff'] });
} });
const expired = makeReq({ expiresAt: 0 });
await Promise.all([refreshVerifier(expired), refreshVerifier(expired)]);
assert.equal(refreshCalls, 1, 'parallel permission checks share refresh');
assert.equal(memberCalls, 2, 'permissions revalidated for each request');
assert.equal(expired.session.discordToken.refreshToken, 'rotated');
await fails(createDiscordStaffVerifier({ ...config, fetchImpl: async () => response(400, {}) }), makeReq({ expiresAt: 0 }), 401, 'discord_session_expired');
console.log('OK Discord staff fail-closed / role revocation / token refresh checks');
