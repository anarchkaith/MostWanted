import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCareerModel, parseStatValue } from './socialClubCareer.js';

test('parses Social Club display values into chartable numbers', () => {
  assert.deepEqual(parseStatValue('$288.8M'), { kind: 'money', amount: 288800000 });
  assert.deepEqual(parseStatValue('4,573'), { kind: 'count', amount: 4573 });
  assert.deepEqual(parseStatValue('24d 20h 31m'), { kind: 'duration', amount: 24 * 86400 + 20 * 3600 + 31 * 60 });
  assert.deepEqual(parseStatValue('75:08:53'), { kind: 'duration', amount: 75 * 3600 + 8 * 60 + 53 });
  assert.equal(parseStatValue('Yes'), null);
});

test('career model pairs wins with losses and scales bars per category', () => {
  const model = buildCareerModel([
    { category: 'Overview', key: 'Rank', label: 'Rank', value: '936' },
    { category: 'Competitive', key: 'W', label: 'Total Races Won', value: '500' },
    { category: 'Competitive', key: 'L', label: 'Total Races Lost', value: '250' },
    { category: 'Competitive', key: 'T', label: 'Total Time Racing', value: '24d 20h 31m' },
    { category: 'Skills', key: 'S', label: 'Stamina', value: '100' },
  ]);

  assert.deepEqual(model.overview.map(row => row.key), ['Rank']);
  assert.deepEqual(model.duels, [{ name: 'Carreras', won: 500, lost: 250, rate: 2 / 3 }]);
  const competitive = model.categories.find(category => category.name === 'Competitive');
  assert.deepEqual(competitive.items.map(item => [item.label, item.ratio]), [['Total Races Won', 1], ['Total Races Lost', 0.5]]);
  assert.deepEqual(competitive.texts.map(row => row.label), ['Total Time Racing']);
  assert.equal(model.categories.find(category => category.name === 'Skills').items[0].ratio, 1);
});
