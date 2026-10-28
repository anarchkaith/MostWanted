import assert from 'node:assert/strict';
import test from 'node:test';
import { createPlayerAvatarSlots, needsAvatarProxyPermission, playerAvatarReducer, visiblePlayerAvatarSlots } from './playerAvatarState.js';

const avatars = [
  { index: 1, avatarUrl: 'https://example.com/1.png', proxiedAvatarUrl: 'https://proxy.example.com/1.png' },
  { index: 0, avatarUrl: 'https://example.com/0.png', avatarDataUrl: 'data:image/png;base64,AA==', proxiedAvatarUrl: 'https://proxy.example.com/0.png' },
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
  assert.equal(needsAvatarProxyPermission([]), false);
});

test('avatar slots display a refreshed URL while retaining the canonical URL for profile data', () => {
  const slots = createPlayerAvatarSlots([{
    index: 0,
    avatarUrl: 'https://example.com/avatar.png',
    displayUrl: 'https://example.com/avatar.png?v=123',
    proxiedAvatarUrl: 'https://proxy.example.com/avatar.png?v=123',
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
  assert.equal(needsAvatarProxyPermission(loaded), false);
});

test('a failed original tries the proxy once with its own loading state', () => {
  const initial = createPlayerAvatarSlots(avatars);
  const failed = playerAvatarReducer(initial, { type: 'error', index: 0, src: initial[0].src });
  assert.equal(failed[0].src, initial[0].proxyUrl);
  assert.equal(failed[0].triedProxy, true);
  assert.equal(failed[0].loaded, false);
  assert.equal(failed[0].failed, false);
  assert.equal(needsAvatarProxyPermission(failed), false);
  const loaded = playerAvatarReducer(failed, { type: 'loaded', index: 0, src: failed[0].src });
  assert.equal(loaded[0].loaded, true);
  assert.equal(needsAvatarProxyPermission(loaded), false);
});

test('late original events cannot overwrite the active proxy or complete its skeleton', () => {
  const initial = createPlayerAvatarSlots(avatars);
  const pending = playerAvatarReducer(initial, { type: 'error', index: 0, src: initial[0].src });
  for (const type of ['error', 'loaded']) {
    const updated = playerAvatarReducer(pending, { type, index: 0, src: initial[0].src });
    assert.equal(updated[0], pending[0]);
  }
});

test('proxy permission stays hidden while any other portrait can load', () => {
  let slots = createPlayerAvatarSlots(avatars);
  for (const index of [0, 1]) {
    slots = playerAvatarReducer(slots, { type: 'error', index, src: slots[index].src });
    slots = playerAvatarReducer(slots, { type: 'error', index, src: slots[index].src });
    assert.equal(needsAvatarProxyPermission(slots), index === 1);
    assert.deepEqual(visiblePlayerAvatarSlots(slots).map(slot => slot.index), [index === 0 ? 1 : 0]);
  }
  const exhausted = playerAvatarReducer(slots, { type: 'loaded', index: 0, src: slots[0].src });
  assert.equal(exhausted[0], slots[0]);
});

test('unavailable, missing and direct-only images show an empty slot without asking for proxy access', () => {
  for (const avatar of [
    { index: 0, avatarUrl: 'https://example.com/unavailable.png', available: false },
    { index: 0 },
    { index: 0, avatarUrl: 'https://example.com/direct.png' },
    { index: 0, avatarUrl: 'https://example.com/same.png', proxiedAvatarUrl: 'https://example.com/same.png' },
  ]) {
    const initial = createPlayerAvatarSlots([avatar]);
    const failed = playerAvatarReducer(initial, { type: 'error', index: 0, src: initial[0].src });
    assert.equal(failed[0].failed, true);
    assert.equal(needsAvatarProxyPermission(failed), false);
    assert.equal(visiblePlayerAvatarSlots(failed).length, 1);
  }
});

test('rebuilding a different identity clears previous failures and restarts image loading', () => {
  let first = createPlayerAvatarSlots(avatars);
  first = playerAvatarReducer(first, { type: 'error', index: 0, src: first[0].src });
  const next = createPlayerAvatarSlots([{ index: 0, avatarUrl: 'https://example.com/new-player.png' }]);
  assert.equal(next[0].failed, false);
  assert.equal(next[0].triedProxy, false);
  assert.equal(next[0].loaded, false);
  assert.equal(next[0].src, 'https://example.com/new-player.png');
});
