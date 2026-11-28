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

test('crew details require exact player RID and crew ID and cache successful lookups', async () => {
  const urls = [];
  const fetchImpl = async url => {
    urls.push(url);
    if (url.startsWith('https://app.socialclubplus.com/')) return jsonResponse({ accounts: [
      { rockstarId: '123', name: 'Player', crew: { id: '68841088', name: 'Kaith Rebels', tag: 'HOPE', color: '#8470FF' } },
      { rockstarId: '456', name: 'Player', crew: { id: '999', name: 'Other' } },
    ] });
    return jsonResponse({ status: true, crews: [
      { crewId: 7, crewName: 'Kaith Rebels', crewMotto: 'Wrong', memberCount: 1 },
      { crewId: 68841088, crewName: 'Kaith Rebels', crewMotto: 'Correct', memberCount: 281, division: '101-1000', crewType: 'rebels', isPrivate: true },
    ] });
  };
  const proxy = createSocialClubProxy({ fetchImpl, logger: silentLogger });
  const result = await proxy.searchPlayers({ name: 'Player', crewForRid: '123' });
  assert.deepEqual(result.payload.crewDetails, { status: 'ready', data: {
    crewMotto: 'Correct', memberCount: 281, division: '101-1000', crewType: 'rebels',
    createdAt: '', isPrivate: true, isOpen: false,
  } });
  await proxy.searchPlayers({ name: 'Player', crewForRid: '123' });
  assert.equal(urls.length, 2);
  assert.equal((await proxy.searchPlayers({ name: 'Player', crewForRid: '999' })).payload.crewDetails.status, 'not_applicable');
  assert.equal(urls.length, 2, 'A nonmatching RID must not trigger a crew search');
  assert.equal((await proxy.searchPlayers({ name: 'Player', crewForRid: '456' })).payload.crewDetails.status, 'not_found');
});

test('failed crew details preserve player data and can be retried', async () => {
  let crewCalls = 0;
  const proxy = createSocialClubProxy({
    logger: silentLogger,
    fetchImpl: async url => {
      if (url.startsWith('https://app.socialclubplus.com/')) return jsonResponse({ accounts: [
        { rockstarId: '123', name: 'Player', crew: { id: '1', name: 'Crew', tag: 'TAG' } },
      ] });
      crewCalls++;
      return crewCalls === 1 ? jsonResponse({}, false) : jsonResponse({ status: true, crews: [{ crewId: 1, crewName: 'Crew' }] });
    },
  });
  const failed = await proxy.searchPlayers({ name: 'Player', crewForRid: '123' });
  assert.equal(failed.status, 200);
  assert.equal(failed.payload.accounts[0].crew.tag, 'TAG');
  assert.equal(failed.payload.crewDetails.status, 'unavailable');
  assert.equal((await proxy.searchPlayers({ name: 'Player', crewForRid: '123' })).payload.crewDetails.status, 'ready');
  assert.equal(crewCalls, 2);
  assert.equal((await proxy.searchPlayers({ name: 'Player', crewForRid: 'invalid' })).status, 400);
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

test('all career sections and platforms are whitelisted, cached apart and keep safe metadata', async () => {
  const calls = [];
  const fetchImpl = async url => {
    const params = new URL(url).searchParams;
    calls.push([params.get('section'), params.get('platform')]);
    return jsonResponse({
      hasCareer: true,
      categories: [{ name: 'Money', label: 'Money &amp; more', extra: 'discarded' }, { name: 7, label: 'Invalid' }],
      rows: [
        { category: 'Money', key: 'MONEY_SPENT_WEAPON_ARMOR', label: 'Spent on weapons &amp; armor', value: '$31.3M', level: 'GOLD' },
        { category: 'Money', key: 'unsafe', label: 'Unsafe', value: 'x', level: '<img>' },
      ],
    });
  };
  const proxy = createSocialClubProxy({ fetchImpl, logger: silentLogger });

  const sections = ['overview', 'stats', 'weapons', 'vehicles', 'awards'];
  for (const section of sections) {
    const result = await proxy.getCareer({ rid: '166688426', section, platform: section === 'awards' ? 'pcalt' : 'pc' });
    assert.equal(result.status, 200);
    assert.equal(result.payload.rows[0].label, 'Spent on weapons & armor');
    assert.equal(result.payload.rows[0].level, 'gold');
    assert.equal(Object.hasOwn(result.payload.rows[1], 'level'), false);
    assert.deepEqual(result.payload.categories, [{ name: 'Money', label: 'Money & more' }]);
  }
  assert.deepEqual(calls, sections.map(section => [section, section === 'awards' ? 'pcalt' : 'pc']));
  assert.equal((await proxy.getCareer({ rid: '166688426', section: 'unknown' })).status, 400);
  assert.equal((await proxy.getCareer({ rid: '166688426', platform: 'ps3' })).status, 400);
  assert.equal(calls.length, sections.length);
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

test('simultaneous career requests share one upstream request and failed requests can be retried', async () => {
  let calls = 0;
  let fail = false;
  const proxy = createSocialClubProxy({
    logger: silentLogger,
    fetchImpl: async () => {
      calls++;
      await new Promise(resolve => setImmediate(resolve));
      return jsonResponse({ hasCareer: false, rows: [] }, !fail);
    },
  });
  const [first, second] = await Promise.all([
    proxy.getCareer({ rid: '123' }), proxy.getCareer({ rid: '123' }),
  ]);
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(calls, 1);

  fail = true;
  const failures = await Promise.all([
    proxy.getCareer({ rid: '456' }), proxy.getCareer({ rid: '456' }),
  ]);
  assert.ok(failures.every(result => result.status === 502));
  assert.equal(calls, 2);
  await proxy.getCareer({ rid: '456' });
  assert.equal(calls, 3, 'Un fallo compartido no impide un intento posterior');
});
