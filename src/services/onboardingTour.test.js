import assert from 'node:assert/strict';
import test from 'node:test';
import { buildOnboardingSteps, buildPlayerTourSteps, buildSampleReport, SAMPLE_PLAYER_NAME } from './onboardingTour.js';

test('sample report is fictitious and never reuses a real player', () => {
  const sample = buildSampleReport();
  assert.equal(sample.fictitious, true);
  assert.equal(sample.nickname, SAMPLE_PLAYER_NAME);
  assert.equal(sample.rid, '000000000');
});

test('tour ends with the fictitious sample report step without a target element', () => {
  const steps = buildOnboardingSteps();
  const last = steps.at(-1);
  assert.equal(last.element, undefined);
  assert.match(last.popover.description, /Ejemplo ficticio/);
  assert.ok(steps.slice(0, -1).every(step => typeof step.element === 'string'));
});

test('player tour uses the searched player name in the sample report', () => {
  const steps = buildPlayerTourSteps('MiJugador');
  assert.equal(steps[0].element, '#report-player-title');
  assert.match(steps[1].popover.description, /<strong>Jugador:<\/strong> MiJugador/);
});

test('searched player name is escaped before it reaches the popover HTML', () => {
  const steps = buildPlayerTourSteps('<img src=x onerror=alert(1)>');
  assert.equal(steps[1].popover.description.includes('<img'), false);
  assert.match(steps[1].popover.description, /&lt;img src=x onerror=alert\(1\)&gt;/);
});
