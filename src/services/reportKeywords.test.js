import test from 'node:test';
import assert from 'node:assert/strict';
import { TIPOS_ETIQUETAS } from '../../components/tiposEtiquetas.js';
import { KEYWORD_RULES, suggestInfractionsFromText } from './reportKeywords.js';

const catalogLabels = new Set(TIPOS_ETIQUETAS.flatMap(type => type.etiquetas.map(item => item.nombre)));

test('every keyword rule points to a label that exists in the catalog', () => {
  for (const rule of KEYWORD_RULES) {
    assert.ok(catalogLabels.has(rule.label), `Etiqueta inexistente: ${rule.label}`);
  }
});

test('returns the matching labels and their categories without AI', () => {
  const result = suggestInfractionsFromText('Usó aimbot y me mató con wallhack desde el otro lado del mapa', TIPOS_ETIQUETAS);
  assert.ok(result.labels.includes('Aimbot'));
  assert.ok(result.labels.includes('Wallhack / ESP'));
  assert.ok(result.categories.includes('MODDER'));
  assert.equal(result.categories.includes('GLITCHER'), false);
});

test('keeps mod menu suspicious unless there is evidence, then confirmed', () => {
  const suspicious = suggestInfractionsFromText('Creo que tenía un mod menu, no sé', TIPOS_ETIQUETAS).labels;
  assert.ok(suspicious.includes('Mod menu sospechoso (sin confirmar)'));
  assert.equal(suspicious.includes('Mod menu detectado (evidencia confirmada)'), false);

  const confirmed = suggestInfractionsFromText('Tengo video del mod menu funcionando', TIPOS_ETIQUETAS).labels;
  assert.ok(confirmed.includes('Mod menu detectado (evidencia confirmada)'));
  assert.equal(confirmed.includes('Mod menu sospechoso (sin confirmar)'), false);
});

test('ignores very short or unrelated text', () => {
  assert.deepEqual(suggestInfractionsFromText('hola', TIPOS_ETIQUETAS), { categories: [], labels: [] });
  assert.deepEqual(suggestInfractionsFromText('Jugamos una partida tranquila de carreras', TIPOS_ETIQUETAS), { categories: [], labels: [] });
});

test('matches across accents and case', () => {
  const result = suggestInfractionsFromText('Me DUPLICACIÓN de objetos y me sabotearon la partida', TIPOS_ETIQUETAS);
  assert.ok(result.labels.includes('Duplicación de objetos'));
  assert.ok(result.labels.includes('Sabotaje de partidas'));
  assert.ok(result.categories.includes('GLITCHER'));
  assert.ok(result.categories.includes('GRIFFER'));
});
