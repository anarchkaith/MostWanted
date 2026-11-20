import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSocialClubProxy } from './socialClubProxy.service.js';

const silentLogger = { error() {} };
const jsonResponse = (body, ok = true) => ({ ok, status: ok ? 200 : 503, json: async () => body });

test('player search keeps only public fields, safe avatars and valid RIDs', async () => {
  const calls = [];
  const fetchImpl = async url => {
    calls.push(url);
    return jsonResponse({ accounts: [
      { rockstarId: '166688426', name: 'Sazxinxxx', avatarUrl: 'https://prod-avatars.akamaized.net/a.png', crew: { id: '68841088', name: 'Kaith Rebels', tag: 'HOPE', color: '#37F3F5', extra: 'x' } },
      { rockstarId: '1', name: 'Tracker', avatarUrl: 'https://evil.example.com/pixel.png', crew: null },
      { rockstarId: 'abc', name: 'Invalid' },
    ] });
  };
  const proxy = createSocialClubProxy({ fetchImpl, logger: silentLogger });
  const result = await proxy.searchPlayers({ name: ' Sazxinxxx ' });

  assert.equal(result.status, 200);
  assert.deepEqual(result.payload.accounts, [
    { rid: '166688426', name: 'Sazxinxxx', avatarUrl: 'https://prod-avatars.akamaized.net/a.png', crew: { id: '68841088', name: 'Kaith Rebels', tag: 'HOPE', color: '#37F3F5' } },
    { rid: '1', name: 'Tracker', avatarUrl: '', crew: null },
  ]);
  assert.match(calls[0], /^https:\/\/app\.socialclubplus\.com\/api\/players\?name=Sazxinxxx$/);
});

test('invalid input is rejected before calling the upstream', async () => {
  let called = false;
  const proxy = createSocialClubProxy({ fetchImpl: async () => { called = true; return jsonResponse({}); }, logger: silentLogger });

  assert.equal((await proxy.searchPlayers({ name: 'bad name!' })).status, 400);
  assert.equal((await proxy.searchPlayers({ name: undefined })).status, 400);
  assert.equal((await proxy.getCareer({ rid: '12a' })).status, 400);
  assert.equal(called, false);
});

test('career responses are cached until the TTL expires', async () => {
  let calls = 0;
  let time = 0;
  const fetchImpl = async () => {
    calls += 1;
    return jsonResponse({ hasCareer: true, player: { nickname: 'Sazxinxxx' }, rows: [
      { category: 'Overview', key: 'Rank', label: 'Rank', value: '936', level: '' },
      { category: 'Overview', key: 'RP' },
    ] });
  };
  const proxy = createSocialClubProxy({ fetchImpl, logger: silentLogger, now: () => time });

  const first = await proxy.getCareer({ rid: '166688426' });
  assert.deepEqual(first.payload.rows, [{ category: 'Overview', key: 'Rank', label: 'Rank', value: '936' }]);
  assert.equal(first.payload.nickname, 'Sazxinxxx');
  await proxy.getCareer({ rid: '166688426' });
  assert.equal(calls, 1);

  time = 11 * 60 * 1000;
  await proxy.getCareer({ rid: '166688426' });
  assert.equal(calls, 2);
});

test('career requests use the selected platform and cache it separately', async () => {
  const calls = [];
  const fetchImpl = async url => {
    calls.push(new URL(url).searchParams.get('platform'));
    return jsonResponse({ hasCareer: false, player: null, rows: [] });
  };
  const proxy = createSocialClubProxy({ fetchImpl, logger: silentLogger });

  await proxy.getCareer({ rid: '166688426' });
  await proxy.getCareer({ rid: '166688426', platform: 'ps5' });
  await proxy.getCareer({ rid: '166688426', platform: 'ps5' });
  assert.deepEqual(calls, ['pc', 'ps5']);
  assert.equal((await proxy.getCareer({ rid: '166688426', platform: 'ps' })).status, 400);
  assert.equal(calls.length, 2);
});

test('upstream failures return 502 and are not cached', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return jsonResponse({}, false);
  };
  const proxy = createSocialClubProxy({ fetchImpl, logger: silentLogger });

  const first = await proxy.searchPlayers({ name: 'Sazxinxxx' });
  const second = await proxy.searchPlayers({ name: 'Sazxinxxx' });
  assert.equal(first.status, 502);
  assert.equal(second.status, 502);
  assert.equal(first.payload.ok, false);
  assert.equal(calls, 2);
});
