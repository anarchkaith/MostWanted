import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyInfractionSuggestion, removeInfractionSuggestion } from './reportKeywords.js';

const catalog = [
  { key: 'glitcher', etiquetas: [{ nombre: 'Abuso de bugs' }, { nombre: 'Aimbot' }] },
  { key: 'modder', etiquetas: [{ nombre: 'Aimbot' }] },
];
const reason = 'Usaba un aimbot y abusaba de bugs para matarme';

test('applies matching labels and categories while keeping manual choices', () => {
  const next = applyInfractionSuggestion({ text: reason, catalog, typesOfInfraction: ['modder'], labels: ['Crash'] });
  assert.deepEqual(next.labels, ['Crash', 'Abuso de bugs', 'Aimbot']);
  assert.deepEqual(next.typesOfInfraction, ['modder', 'glitcher']);
  assert.deepEqual(next.applied, { categories: ['glitcher'], labels: ['Abuso de bugs', 'Aimbot'] });
});

test('does not duplicate or claim ownership of labels already chosen by the user', () => {
  const next = applyInfractionSuggestion({ text: reason, catalog, labels: ['Aimbot'] });
  assert.deepEqual(next.labels, ['Aimbot', 'Abuso de bugs']);
  assert.deepEqual(next.applied.labels, ['Abuso de bugs']);
});

test('re-applying replaces the previous suggestion instead of stacking it', () => {
  const first = applyInfractionSuggestion({ text: reason, catalog });
  const second = applyInfractionSuggestion({
    text: 'Solo un aimbot', catalog,
    typesOfInfraction: first.typesOfInfraction, labels: first.labels, previous: first.applied,
  });
  assert.deepEqual(second.labels, ['Aimbot']);
  assert.deepEqual(second.typesOfInfraction, ['modder']);
});

test('undo removes only the labels that were applied', () => {
  const next = applyInfractionSuggestion({ text: reason, catalog, labels: ['Crash'] });
  const undone = removeInfractionSuggestion({ typesOfInfraction: next.typesOfInfraction, labels: next.labels, applied: next.applied });
  assert.deepEqual(undone, { typesOfInfraction: [], labels: ['Crash'] });
});

test('short or unrelated text applies nothing', () => {
  const next = applyInfractionSuggestion({ text: 'hola', catalog, labels: ['Crash'] });
  assert.deepEqual(next, { typesOfInfraction: [], labels: ['Crash'], applied: { categories: [], labels: [] } });
});
