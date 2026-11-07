import assert from 'node:assert/strict';
import test from 'node:test';
import { createPlayerAvatarSlots, playerAvatarReducer, visiblePlayerAvatarSlots } from './playerAvatarState.js';

const avatars = [
  { index: 1, avatarUrl: 'https://example.com/1.png' },
  { index: 0, avatarUrl: 'https://example.com/0.png', avatarDataUrl: 'data:image/png;base64,AA==' },
];

test('avatar slots preserve original metadata, prefer inline data and sort without mutating input', () => {
  const input = structuredClone(avatars);
  const slots = createPlayerAvatarSlots(input);
  assert.deepEqual(input, avatars);
  assert.deepEqual(slots.map(slot => slot.index), [0, 1]);
  assert.equal(slots[0].src, avatars[1].avatarDataUrl);
  assert.equal(slots[0].originalUrl, avatars[1].avatarUrl);
  assert.equal(slots[0].loaded, false);
  assert.deepEqual(createPlayerAvatarSlots(), []);
  assert.deepEqual(visiblePlayerAvatarSlots([]), []);
});

test('avatar slots display a refreshed URL while retaining the canonical URL for profile data', () => {
  const slots = createPlayerAvatarSlots([{
    index: 0,
    avatarUrl: 'https://example.com/avatar.png',
    displayUrl: 'https://example.com/avatar.png?v=123',
  }]);
  assert.equal(slots[0].src, 'https://example.com/avatar.png?v=123');
  assert.equal(slots[0].originalUrl, 'https://example.com/avatar.png');
});

test('loading completes only the matching current source and never alters other slots', () => {
  const initial = createPlayerAvatarSlots(avatars);
  const loaded = playerAvatarReducer(initial, { type: 'loaded', index: 0, src: initial[0].src });
  assert.equal(loaded[0].loaded, true);
  assert.equal(initial[0].loaded, false);
  assert.equal(loaded[1], initial[1]);
});

test('a failed avatar is marked failed and the other portrait stays visible', () => {
  const initial = createPlayerAvatarSlots(avatars);
  const failed = playerAvatarReducer(initial, { type: 'error', index: 0, src: initial[0].src });
  assert.equal(failed[0].failed, true);
  assert.equal(failed[0].loaded, false);
  assert.deepEqual(visiblePlayerAvatarSlots(failed).map(slot => slot.index), [1]);
});

test('late events for a replaced source cannot change the current slot', () => {
  const initial = createPlayerAvatarSlots(avatars);
  for (const type of ['error', 'loaded']) {
    const updated = playerAvatarReducer(initial, { type, index: 0, src: 'https://example.com/stale.png' });
    assert.equal(updated[0], initial[0]);
  }
});

test('unavailable and missing images show an empty slot', () => {
  for (const avatar of [
    { index: 0, avatarUrl: 'https://example.com/unavailable.png', available: false },
    { index: 0 },
  ]) {
    const initial = createPlayerAvatarSlots([avatar]);
    const failed = playerAvatarReducer(initial, { type: 'error', index: 0, src: initial[0].src });
    assert.equal(failed[0].failed, true);
    assert.equal(visiblePlayerAvatarSlots(failed).length, 1);
  }
});

test('rebuilding a different identity clears previous failures and restarts image loading', () => {
  let first = createPlayerAvatarSlots(avatars);
  first = playerAvatarReducer(first, { type: 'error', index: 0, src: first[0].src });
  const next = createPlayerAvatarSlots([{ index: 0, avatarUrl: 'https://example.com/new-player.png' }]);
  assert.equal(next[0].failed, false);
  assert.equal(next[0].loaded, false);
  assert.equal(next[0].src, 'https://example.com/new-player.png');
});

test('rebuilding a different identity clears previous failures and restarts image loading', () => {
  let first = createPlayerAvatarSlots(avatars);
  first = playerAvatarReducer(first, { type: 'error', index: 0, src: first[0].src });
  const next = createPlayerAvatarSlots([{ index: 0, avatarUrl: 'https://example.com/new-player.png' }]);
  assert.equal(next[0].failed, false);
  assert.equal(next[0].loaded, false);
  assert.equal(next[0].src, 'https://example.com/new-player.png');
});
