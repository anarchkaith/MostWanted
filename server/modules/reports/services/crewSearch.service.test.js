import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchCrews } from './crewSearch.service.js';

const logger = { error() {} };
const rockstarBody = {
  status: true, total: 56236, crews: [
    { crewId: 68666905, crewName: ' GHOSTS GHOST ', crewTag: 'Ghst', crewMotto: 'Motto', memberCount: 1, isPrivate: true, canRequestInvite: true, crewType: 'allStars', crewColour: '#2A0DA1', division: '1-5', createdAt: '0001-01-01T00:00:00.000Z', isMember: false },
    { crewName: 'missing id is dropped' },
    { crewId: 2, crewName: '   ' },
  ],
};

test('crew search forwards the term with the Rockstar headers and returns only public fields', async () => {
  let calledUrl;
  let calledHeaders;
  const result = await searchCrews({ query: ' Ghost ', logger, fetchImpl: async (url, options) => {
    calledUrl = new URL(url);
    calledHeaders = options.headers;
    return new Response(JSON.stringify(rockstarBody), { status: 200 });
  } });
  assert.equal(calledUrl.searchParams.get('searchTerm'), 'Ghost');
  assert.equal(calledUrl.searchParams.get('crewtype'), 'all');
  assert.equal(calledHeaders['X-Requested-With'], 'XMLHttpRequest');
  assert.equal(result.status, 200);
  assert.deepEqual(result.payload.crews, [{
    crewId: '68666905', crewName: 'GHOSTS GHOST', memberCount: 1, emblemUrl: 'https://prod.cloud.rockstargames.com/crews/sc/6266/68666905/publish/emblem/emblem_256.png',
    crewTag: 'Ghst', crewMotto: 'Motto',
    crewType: 'allStars', division: '1-5', crewColour: '#2A0DA1', createdAt: '0001-01-01T00:00:00.000Z',
    isPrivate: true, isOpen: false, canJoin: false, canRequestInvite: true, isMember: false,
    isPrimary: false, isFounderCrew: false, isSystem: false,
  }]);
});

test('crew search rejects empty or oversized terms without calling Rockstar', async () => {
  const fetchImpl = () => assert.fail('no debe llamar a Rockstar');
  assert.equal((await searchCrews({ query: '   ', fetchImpl, logger })).status, 400);
  assert.equal((await searchCrews({ query: 'a'.repeat(101), fetchImpl, logger })).status, 400);
});

test('crew search maps upstream failures and malformed bodies to 502', async () => {
  const failing = await searchCrews({ query: 'Ghost', logger, fetchImpl: async () => new Response('', { status: 503 }) });
  const malformed = await searchCrews({ query: 'Ghost', logger, fetchImpl: async () => new Response('{"status":false}', { status: 200 }) });
  assert.equal(failing.status, 502);
  assert.equal(malformed.status, 502);
  assert.equal(malformed.payload.ok, false);
});
