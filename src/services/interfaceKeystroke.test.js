import test from 'node:test';
import assert from 'node:assert/strict';
import { isKeystrokeTarget } from './interfaceKeystroke.js';
import { canAutoplayInterfaceSound } from './interfaceSoundBus.js';
import { shouldPlayTerminalSound, terminalTypingStep, TERMINAL_MAX_TICKS } from './terminalTyping.js';
import { INTERFACE_AUDIO_SOURCES } from './interfaceAudio.js';

const input = (type, extra = {}) => ({ tagName: 'INPUT', type, ...extra });
const key = (value, extra = {}) => ({ key: value, ...extra });

test('keystroke sound plays for printable keys in text inputs and textareas', () => {
  assert.equal(isKeystrokeTarget({ tagName: 'TEXTAREA' }, key('a')), true);
  assert.equal(isKeystrokeTarget(input('text'), key(' ')), true);
  assert.equal(isKeystrokeTarget(input('search'), key('ñ')), true);
  assert.equal(isKeystrokeTarget(input('password'), key('x')), true);
});

test('keystroke sound ignores controls, shortcuts, read-only fields and non-text inputs', () => {
  assert.equal(isKeystrokeTarget(input('text'), key('Backspace')), false);
  assert.equal(isKeystrokeTarget(input('text'), key('Enter')), false);
  assert.equal(isKeystrokeTarget(input('text'), key('c', { ctrlKey: true })), false);
  assert.equal(isKeystrokeTarget(input('text'), key('v', { metaKey: true })), false);
  assert.equal(isKeystrokeTarget(input('text'), key('x', { isComposing: true })), false);
  assert.equal(isKeystrokeTarget(input('text', { readOnly: true }), key('a')), false);
  assert.equal(isKeystrokeTarget(input('text', { disabled: true }), key('a')), false);
  assert.equal(isKeystrokeTarget(input('checkbox'), key('a')), false);
  assert.equal(isKeystrokeTarget({ tagName: 'BUTTON' }, key('a')), false);
  assert.equal(isKeystrokeTarget(null, key('a')), false);
});

test('autoplay is only allowed after the user has activated the page', () => {
  assert.equal(canAutoplayInterfaceSound({ userActivation: { hasBeenActive: true } }), true);
  assert.equal(canAutoplayInterfaceSound({ userActivation: { hasBeenActive: false } }), false);
  assert.equal(canAutoplayInterfaceSound({}), false);
  assert.equal(canAutoplayInterfaceSound(undefined), false);
});

test('terminal typing reveals long texts in at most TERMINAL_MAX_TICKS steps', () => {
  assert.equal(terminalTypingStep(1), 1);
  assert.equal(terminalTypingStep(TERMINAL_MAX_TICKS), 1);
  const step = terminalTypingStep(1200);
  assert.ok(Math.ceil(1200 / step) <= TERMINAL_MAX_TICKS);
});

test('terminal sound plays once at the start of a reveal and skips whitespace-only text', () => {
  assert.equal(shouldPlayTerminalSound({ text: 'Busca', revealed: 0 }), true);
  assert.equal(shouldPlayTerminalSound({ text: 'Busca', revealed: 2 }), false);
  assert.equal(shouldPlayTerminalSound({ text: '   ', revealed: 0 }), false);
});

test('keystroke and terminal sounds are registered as interface sources', () => {
  assert.match(INTERFACE_AUDIO_SOURCES.keystroke, /^https:\/\/cdn\.freesound\.org\//);
  assert.match(INTERFACE_AUDIO_SOURCES.terminal, /^https:\/\/cdn\.freesound\.org\//);
});
