import assert from 'node:assert/strict';
import test from 'node:test';
import { buildOnboardingSteps, buildSampleReport, SAMPLE_PLAYER_NAME } from './onboardingTour.js';

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
