import assert from 'node:assert/strict';
import test from 'node:test';
import { createInterfaceAudio, INTERFACE_AUDIO_SOURCES } from './interfaceAudio.js';
import { getInterfaceHover } from './interfaceHover.js';

function fixture(play = () => Promise.resolve()) {
  const tracks = [];
  const errors = [];
  let ready = 0;
  const audio = createInterfaceAudio({
    createAudio: source => {
      const track = {
        source, currentTime: 9, pauses: 0, plays: 0, removed: '', loads: 0,
        play() { this.plays += 1; return play(); },
        pause() { this.pauses += 1; },
        removeAttribute(name) { this.removed = name; },
        load() { this.loads += 1; },
      };
      tracks.push(track);
      return track;
    },
    onError: error => errors.push(error),
    onReady: () => { ready += 1; },
  });
  return { audio, tracks, errors, get ready() { return ready; } };
}

test('loads all five interface sounds lazily, at low volume, and reuses tracks', async () => {
  const f = fixture();
  assert.equal(f.tracks.length, 0);
  for (const kind of ['slide', 'accept', 'reject', 'hoverOption', 'hoverButton']) {
    await f.audio.play(kind);
    const track = f.tracks.at(-1);
    assert.equal(track.source, INTERFACE_AUDIO_SOURCES[kind]);
    assert.equal(track.volume, 0.25);
    assert.equal(track.preload, 'none');
    assert.equal(track.currentTime, 0);
  }
  await f.audio.play('slide');
  assert.equal(f.tracks.length, 5);
  assert.equal(f.tracks[0].plays, 2);
  assert.equal(f.tracks[0].pauses, 1);
  assert.equal(f.tracks[1].pauses, 1);
  assert.equal(f.tracks[2].pauses, 1);
  assert.equal(f.ready, 6);
  assert.equal(INTERFACE_AUDIO_SOURCES.hoverOption, 'https://cdn.freesound.org/previews/370/370962_5450487-lq.mp3');
  assert.equal(INTERFACE_AUDIO_SOURCES.hoverButton, 'https://cdn.freesound.org/previews/703/703884_6142149-lq.mp3');
});

test('delegates hover once per control, prioritizes selector items, and respects disabled and opt-out controls', () => {
  const child = {};
  const previousSibling = {};
  let item = false;
  let disabled = false;
  let off = false;
  const control = {
    closest: selector => selector === '[data-ui-sound="off"]' ? (off ? control : null) : control,
    matches: selector => selector.includes(':disabled') ? disabled : item,
    contains: node => node === child,
  };
  const target = { closest: () => control };
  assert.equal(getInterfaceHover(null, null), null);
  assert.equal(getInterfaceHover(target, previousSibling), 'hoverButton');
  assert.equal(getInterfaceHover(target, child), null);
  item = true;
  assert.equal(getInterfaceHover(target, previousSibling), 'hoverOption');
  disabled = true;
  assert.equal(getInterfaceHover(target, null), null);
  disabled = false;
  off = true;
  assert.equal(getInterfaceHover(target, null), null);
});

test('muting prevents requests, stops playback, and can be reversed', async () => {
  const f = fixture();
  f.audio.setEnabled(false);
  await f.audio.play('accept');
  assert.equal(f.tracks.length, 0);
  f.audio.setEnabled(true);
  await f.audio.play('accept');
  f.audio.setEnabled(false);
  assert.equal(f.tracks[0].pauses, 1);
  await f.audio.play('reject');
  assert.equal(f.tracks.length, 1);
});

test('reports network and browser playback errors explicitly and retries', async () => {
  const failure = new Error('Network unavailable');
  let failing = true;
  const f = fixture(() => failing ? Promise.reject(failure) : Promise.resolve());
  await f.audio.play('slide');
  assert.deepEqual(f.errors, [failure]);
  assert.equal(f.ready, 0);
  assert.equal(f.tracks[0].removed, 'src');
  assert.equal(f.tracks[0].loads, 1);
  failing = false;
  await f.audio.play('slide');
  assert.equal(f.ready, 1);
  assert.equal(f.tracks.length, 2);
});

test('superseded playback cannot clear or raise an obsolete error', async () => {
  let rejectPending;
  const f = fixture(() => new Promise((resolve, reject) => { rejectPending = reject; }));
  const pending = f.audio.play('slide');
  f.audio.setEnabled(false);
  rejectPending(new Error('Interrupted by pause'));
  await pending;
  assert.equal(f.errors.length, 0);
  assert.equal(f.ready, 0);
});

test('disposal releases media and prevents later playback or callbacks', async () => {
  let resolvePending;
  const f = fixture(() => new Promise(resolve => { resolvePending = resolve; }));
  const pending = f.audio.play('accept');
  f.audio.dispose();
  resolvePending();
  await pending;
  assert.equal(f.ready, 0);
  assert.equal(f.tracks[0].pauses, 1);
  assert.equal(f.tracks[0].removed, 'src');
  assert.equal(f.tracks[0].loads, 1);
  await f.audio.play('reject');
  assert.equal(f.tracks.length, 1);
  await assert.rejects(f.audio.play('unknown'), /Unknown interface sound/);
});
