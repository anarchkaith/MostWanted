import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addCrewToList, fetchCrewSearch, getCrewPrivacyLabel, parseCrewList, removeCrewFromList } from './crewSearch.js';

test('crew privacy label only uses the flags returned by the search', () => {
  assert.equal(getCrewPrivacyLabel({ isOpen: true }), 'Pública');
  assert.equal(getCrewPrivacyLabel({ isPrivate: true }), 'Privada');
  assert.equal(getCrewPrivacyLabel({}), '');
});

test('crew list helpers keep the comma-separated report format and ignore case-only duplicates', () => {
  assert.deepEqual(parseCrewList(' Rebels ,, Ghost '), ['Rebels', 'Ghost']);
  assert.equal(addCrewToList('Rebels', ' ghost '), 'Rebels, ghost');
  assert.equal(addCrewToList('Rebels, Ghost', 'REBELS'), 'Rebels, Ghost');
  assert.equal(addCrewToList('Rebels', '   '), 'Rebels');
  assert.equal(removeCrewFromList('Rebels, Ghost', 'rebels'), 'Ghost');
});

test('crew search calls the backend proxy with the query and rejects malformed payloads', async () => {
  const originalFetch = globalThis.fetch;
  let requested;
  try {
    globalThis.fetch = async url => {
      requested = url;
      return new Response(JSON.stringify({ ok: true, crews: [{ crewId: '1', crewName: 'Ghost' }], total: 1 }), { status: 200 });
    };
    const payload = await fetchCrewSearch({ query: 'Ghost' }, path => `https://api.test${path}`);
    assert.equal(new URL(requested).searchParams.get('q'), 'Ghost');
    assert.equal(payload.crews[0].crewName, 'Ghost');
    globalThis.fetch = async () => new Response(JSON.stringify({ ok: true }), { status: 200 });
    await assert.rejects(() => fetchCrewSearch({ query: 'Ghost' }, path => `https://api.test${path}`), /formato inválido/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
