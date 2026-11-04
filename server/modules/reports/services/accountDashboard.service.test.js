import assert from 'node:assert/strict';
import test from 'node:test';
import session from 'express-session';
import { getAccountDashboard, parseDashboardQuery, readActiveSessions } from './accountDashboard.service.js';
import { validateAccountDashboard } from '../../../../src/services/accountDashboard.js';

const now = Date.parse('2026-11-03T20:00:00Z');
const iso = offset => new Date(now + offset).toISOString();
const account = (id, reportCount = 0) => ({
  identity: { id: String(id), username: `User${id}`, globalName: `Name${id}`, email: `${id}@example.test` },
  reportIds: reportCount ? [Number(id)] : [], reportCount, loginCount: 2,
  firstAccess: iso(-100000), lastAccess: iso(-Number(id) * 1000), lastLogin: iso(-10000), lastEvent: 'active',
});
const activeSession = (id, activity = 0, expires = 60000) => ({
  authUser: { id: String(id), loggedAt: iso(-10000) }, cookie: { expires: iso(expires) },
  lastActivityAt: now + activity, discordToken: { accessToken: 'NEVER_EXPOSE' },
});
const store = {
  all(callback) {
    callback(null, {
      recent: activeSession(1), otherDevice: activeSession(1, -300000),
      idle: activeSession(2, -300001), expired: activeSession(3, 0, 0),
      anonymous: { cookie: { expires: iso(1000) } }, unsynced: activeSession(99),
    });
  },
};
async function dashboard(query = {}, options = {}) {
  return getAccountDashboard({
    config: {}, sessionStore: store, now, filters: parseDashboardQuery(query),
    readAccounts: async ({ page }) => ({ payload: { ok: true, items: page === 1 ? [account(1, 72), account(2, 1)] : [account(3)], hasMore: page === 1 } }),
    ...options,
  });
}

test('aggregates all account pages, exact report counts and distinct live sessions without private session data', async () => {
  const result = await dashboard();
  assert.deepEqual(result.summary, { users: 3, reports: 73, usersWithSession: 3, sessions: 4, recentlyActive: 2, unsyncedUsers: 1 });
  assert.equal(result.items[0].sessionCount, 2);
  assert.equal(result.items[0].recentlyActive, true);
  assert.equal(result.items[1].recentlyActive, false);
  assert.equal(result.items[2].sessionCount, 0);
  assert.equal(JSON.stringify(result).includes('NEVER_EXPOSE'), false);
  assert.equal(JSON.stringify(result).includes('otherDevice'), false);
  assert.equal(validateAccountDashboard(result), result);
});

test('filters globally before pagination and keeps global statistics unfiltered', async () => {
  for (const [query, expected] of [
    [{ minReports: '51', maxReports: '80' }, ['1']],
    [{ status: 'recent' }, ['1']], [{ status: 'session' }, ['1', '2']],
    [{ status: 'offline' }, ['3']], [{ search: '3@EXAMPLE.TEST' }, ['3']],
    [{ search: 'nAmE2' }, ['2']], [{ maxReports: '0' }, ['3']],
  ]) {
    const result = await dashboard(query);
    assert.deepEqual(result.items.map(item => item.identity.id), expected);
    assert.equal(result.summary.users, 3);
    assert.equal(result.total, expected.length);
  }
  const items = Array.from({ length: 45 }, (_, index) => account(index + 1, index));
  const readAccounts = async ({ page }) => ({ payload: { ok: true, items: items.slice((page - 1) * 20, page * 20), hasMore: page < 3 } });
  const result = await dashboard({ page: '2', sort: 'reports' }, { readAccounts });
  assert.equal(result.total, 45);
  assert.equal(result.items.length, 20);
  assert.equal(result.items[0].reportCount, 24);
  assert.equal(result.hasMore, true);
  const filtered = await dashboard({ minReports: '40' }, { readAccounts });
  assert.equal(filtered.total, 5);
  assert.equal(filtered.hasMore, false);
  assert.equal((await dashboard({ page: '4' }, { readAccounts })).items.length, 0);
});

test('rejects invalid filters, old plugin responses and failed upstream/session stores', async () => {
  for (const query of [{ page: '0' }, { page: '2.5' }, { page: [] }, { minReports: '-1' },
    { minReports: '3', maxReports: '2' }, { status: 'fake' }, { search: ['a'] }, { sort: 'fake' }]) {
    assert.throws(() => parseDashboardQuery(query), /invalid_filters/);
  }
  for (const payload of [
    { ok: true, items: [{ identity: { id: '1' }, reportIds: [] }], hasMore: false },
    { ok: true, items: [], hasMore: true },
    { ok: true, items: [account(1), account(1)], hasMore: false },
  ]) {
    await assert.rejects(dashboard({}, { readAccounts: async () => ({ payload }) }), /invalid_private_accounts/);
  }
  await assert.rejects(dashboard({}, { readAccounts: async () => { throw new Error('wp_down'); } }), /wp_down/);
  await assert.rejects(readActiveSessions({ all(callback) { callback(new Error('store_down')); } }, now), /store_down/);
  await assert.rejects(readActiveSessions({ all(callback) { callback(null, null); } }, now), /invalid_session_store_response/);
  assert.throws(() => validateAccountDashboard({ ok: true, items: [], summary: {} }), /datos inválidos/);
});

test('uses actual session-store expiration and logout, independently of historical access timestamps', async () => {
  const memory = new session.MemoryStore();
  const set = (id, value) => new Promise((resolve, reject) => memory.set(id, value, error => error ? reject(error) : resolve()));
  const destroy = id => new Promise((resolve, reject) => memory.destroy(id, error => error ? reject(error) : resolve()));
  const realNow = Date.now();
  const value = activeSession(1);
  value.cookie.expires = new Date(realNow + 60000).toISOString();
  value.lastActivityAt = realNow;
  await set('private-session', value);
  assert.equal((await readActiveSessions(memory, realNow)).get('1').length, 1);
  await destroy('private-session');
  assert.equal((await readActiveSessions(memory, realNow)).size, 0);
  value.cookie.expires = new Date(realNow - 1).toISOString();
  await set('expired-session', value);
  assert.equal((await readActiveSessions(memory, realNow)).size, 0);
});
