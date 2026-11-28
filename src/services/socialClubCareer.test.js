import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCareerGroups, buildCareerModel, buildWeaponGroups, fetchSocialClubAccount, fetchSocialClubCareer, parseStatValue, searchCareerGroups,
  SOCIAL_CLUB_CAREER_SECTIONS, SOCIAL_CLUB_PLATFORMS,
} from './socialClubCareer.js';
import { careerAwardLevelLabel } from './socialClubCareerEs.js';

test('parses Social Club display values into chartable numbers', () => {
  assert.deepEqual(parseStatValue('$288.8M'), { kind: 'money', amount: 288800000 });
  assert.deepEqual(parseStatValue('4,573'), { kind: 'count', amount: 4573 });
  assert.deepEqual(parseStatValue('24d 20h 31m'), { kind: 'duration', amount: 24 * 86400 + 20 * 3600 + 31 * 60 });
  assert.deepEqual(parseStatValue('75:08:53'), { kind: 'duration', amount: 75 * 3600 + 8 * 60 + 53 });
  assert.equal(parseStatValue('Yes'), null);
});

const row = (category, key, value, label = key) => ({ category, key, label, value });

test('localizes upstream metric labels, units and award tiers without changing IDs or numeric skills', () => {
  const [skills, vehicles, weapons] = buildCareerGroups([
    row('Skills', 'SHOOTING', '98.5', 'Shooting'),
    row('Vehicles', 'SPEED', '271.68 mph', 'Highest speed in a road vehicle'),
    row('Vehicles', 'JUMP', '6,663.01 ft', 'Farthest vehicle jump'),
    row('Weapons', 'PISTOL_KILLS', '1,200', 'Pistol kills'),
  ]);
  assert.deepEqual(skills.rows[0], {
    category: 'Skills', key: 'SHOOTING', label: 'Puntería', value: '98,5', skillAmount: 98.5,
  });
  assert.deepEqual(vehicles.rows.map(({ label, value }) => [label, value]), [
    ['Velocidad máxima en un vehículo terrestre', '271,68 mi/h'], ['Salto más largo con un vehículo', '6.663,01 pies'],
  ]);
  assert.equal(weapons.rows[0].label, 'Bajas con Pistol');
  const [weapon] = buildWeaponGroups([row('Pistol', 'PISTOL_ACC', '50.00%', 'Accuracy')]);
  assert.deepEqual([weapon.rows[0].label, weapon.rows[0].value], ['Precisión', '50,00 %']);
  assert.equal(careerAwardLevelLabel('platinum'), 'Platino');
});

test('places every competitive result and detail in its activity, including detail-only activities', () => {
  const model = buildCareerModel([
    row('Overview', 'Rank', '936'),
    row('Competitive', 'MPPLY_TOTAL_RACES_WON', '500'),
    row('Competitive', 'MPPLY_TOTAL_RACES_LOST', '250'),
    row('Competitive', 'MPPLY_DARTS_TOTAL_WINS', '4'),
    row('Competitive', 'MPPLY_DARTS_TOTAL_MATCHES', '6'),
    row('Competitive', 'MPPLY_TOTAL_TIME_SPENT_RACES', '24d 20h 31m'),
    row('Competitive', 'AWD_FM_GOLF_HOLE_IN_1', 'Yes'),
    row('Competitive', 'AWD_FM6DARTCHKOUT', '2'),
  ]);

  assert.deepEqual(model.overview.map(row => row.key), ['Rank']);
  assert.deepEqual(model.competitive.map(({ name, primary, details, rate }) => [
    name, primary.map(({ label, value }) => [label, value]), details.map(({ label, value }) => [label, value]), rate,
  ]), [
    ['Carreras', [['Victorias', '500'], ['Derrotas', '250']], [['Tiempo en carreras', '24 d 20 h 31 m']], 2 / 3],
    ['Dardos', [['Victorias', '4'], ['Partidas', '6']], [['Cierres de 6 dardos', '2']], 2 / 3],
    ['Golf', [], [['Hoyo en uno', 'Sí']], null],
  ]);
});

test('preserves empty, incomplete and inconsistent results without inventing a rate', () => {
  const model = buildCareerModel([
    row('Competitive', 'MPPLY_TOTAL_RACES_WON', '0'),
    row('Competitive', 'MPPLY_TOTAL_RACES_LOST', '0'),
    row('Competitive', 'MPPLY_TOTAL_DEATHMATCH_WON', '12'),
    row('Competitive', 'MPPLY_DARTS_TOTAL_WINS', '9'),
    row('Competitive', 'MPPLY_DARTS_TOTAL_MATCHES', '5'),
    row('Competitive', 'MPPLY_GOLF_WINS', 'N/A'),
    row('Competitive', 'MPPLY_GOLF_LOSSES', '2'),
    row('Competitive', 'MPPLY_TENNIS_MATCHES_WON', '1.5'),
    row('Competitive', 'MPPLY_TENNIS_MATCHES_LOST', '1'),
    row('Competitive', 'FUTURE_STAT', '21'),
  ]);

  assert.ok(model.competitive.every(card => card.rate === null));
  assert.deepEqual(model.competitive.map(card => [card.name, card.primary.map(row => row.value)]), [
    ['Carreras', ['0', '0']], ['Partidas a muerte', ['12']], ['Dardos', ['9', '5']],
    ['Tenis', ['1,5', '1']], ['Golf', ['Sin datos', '2']], ['Sin actividad identificada', []],
  ]);
  assert.equal(model.competitive.at(-1).details[0].key, 'FUTURE_STAT');
});

test('retains the source precision and marks rates based on abbreviated counts', () => {
  const model = buildCareerModel([
    row('Overview', 'BANK_BALANCE', '$288.8M'),
    row('Competitive', 'MPPLY_TOTAL_RACES_WON', '1.2K'),
    row('Competitive', 'MPPLY_TOTAL_RACES_LOST', '800'),
    row('Cash', 'CHAR_DIST_TRAVELLED', '4,258.49 miles'),
    row('Criminal Record', 'KILLS_COP', '4,573'),
  ]);

  assert.equal(model.overview[0].value, '$288,8 M');
  assert.equal(model.competitive[0].primary[0].value, '1,2 K');
  assert.equal(model.competitive[0].rate, 0.6);
  assert.equal(model.competitive[0].approximate, true);
  assert.equal(model.cash.details[0].value, '4.258,49 millas');
  assert.equal(model.criminal[0].value, '4.573');
});

test('search finds matching rows across categories, ignoring accents and case', () => {
  const groups = buildCareerGroups([
    row('Skills', 'STAMINA', '98.5'),
    row('Skills', 'STRENGTH', '1,000'),
    row('Career', 'OTHER', '98.5', 'Registro de resistencia'),
  ]);
  assert.deepEqual(searchCareerGroups(groups, 'RESISTÉNCIA 98,5').map(group => group.name), ['Skills', 'Career']);
  assert.equal(searchCareerGroups(groups, 'habilidades resistencia')[0].rows[0].skillAmount, 98.5);
  assert.equal(groups[0].rows[1].skillAmount, undefined);
  assert.deepEqual(searchCareerGroups(groups, 'no coincide'), []);
});

test('compares financial totals separately from income sources', () => {
  const model = buildCareerModel([
    row('Cash', 'MPPLY_TOTAL_EVC', '$312.5M'),
    row('Cash', 'MPPLY_TOTAL_SVC', '$284.2M'),
    row('Cash', 'MONEY_EARN_JOBS', '$283.9M'),
    row('Cash', 'MONEY_EARN_PICKED_UP', '$36.3K'),
    row('Cash', 'MONEY_EARN_SHARED', '$0'),
    row('Cash', 'MONEY_EARN_BETTING', 'N/A'),
    row('Cash', 'CHAR_DIST_TRAVELLED', '4,258.49 miles'),
  ]);

  assert.deepEqual(model.cash.totals.map(({ key, ratio }) => [key, ratio]), [
    ['MPPLY_TOTAL_EVC', 1],
    ['MPPLY_TOTAL_SVC', 284200000 / 312500000],
  ]);
  assert.deepEqual(model.cash.sources.map(({ key, ratio }) => [key, ratio]), [
    ['MONEY_EARN_JOBS', 1],
    ['MONEY_EARN_PICKED_UP', 36300 / 283900000],
    ['MONEY_EARN_SHARED', 0],
  ]);
  assert.deepEqual(model.cash.details.map(row => row.key), ['MONEY_EARN_BETTING', 'CHAR_DIST_TRAVELLED']);

  const partial = buildCareerModel([row('Cash', 'MPPLY_TOTAL_EVC', '$100')]);
  assert.equal(partial.cash.totals[0].ratio, null, 'A single total is not presented as a comparison');
  const zeros = buildCareerModel([row('Cash', 'MPPLY_TOTAL_EVC', '$0'), row('Cash', 'MPPLY_TOTAL_SVC', '$0')]);
  assert.deepEqual(zeros.cash.totals.map(row => row.ratio), [0, 0]);
});

test('only charts skills on the known 0–100 scale and preserves other categories', () => {
  const model = buildCareerModel([
    row('Skills', 'STAMINA', '100'),
    row('Skills', 'STRENGTH', '0'),
    row('Skills', 'FLYING_ABILITY', '150'),
    row('Skills', 'SHOOTING_ABILITY', 'N/A'),
    row('New category', 'NEW_STAT', '42', 'New statistic'),
    row('New category', 'constructor', '7', 'Other statistic'),
  ]);

  assert.deepEqual(model.skills.map(({ label, amount }) => [label, amount]), [['Resistencia', 100], ['Fuerza', 0]]);
  assert.deepEqual(model.skillDetails.map(row => row.value), ['150', 'Sin datos']);
  assert.deepEqual(model.additional.map(({ name, rows }) => [name, rows[0].label, rows[0].value]), [
    ['New category', 'New statistic', '42'],
  ]);
  assert.equal(model.additional[0].rows[1].label, 'Other statistic');
});

test('exposes all career sections and current platform variants', () => {
  assert.deepEqual(SOCIAL_CLUB_CAREER_SECTIONS.map(({ value }) => value), [
    'overview', 'stats', 'weapons', 'vehicles', 'awards',
  ]);
  assert.deepEqual(SOCIAL_CLUB_PLATFORMS.map(({ value }) => value), [
    'pcalt', 'pc', 'ps4', 'ps5', 'xboxone', 'xboxsx',
  ]);
  assert.equal(SOCIAL_CLUB_PLATFORMS.find(({ value }) => value === 'pc').label, 'PC Legacy');
});

test('requests the selected career section through the internal API', async () => {
  const originalFetch = globalThis.fetch;
  let url;
  globalThis.fetch = async value => {
    url = value;
    return new Response(JSON.stringify({ rows: [], categories: [], hasCareer: true }));
  };
  try {
    await fetchSocialClubCareer({ rid: '123', platform: 'xboxsx', section: 'awards' }, path => path);
    assert.equal(url, '/external/socialclub/career?rid=123&platform=xboxsx&section=awards');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('selects Social Club accounts by exact RID, never by name alone', async () => {
  const originalFetch = globalThis.fetch;
  let url;
  globalThis.fetch = async value => {
    url = value;
    return new Response(JSON.stringify({ ok: true, accounts: [
      { rid: '456', name: 'Militan___', crew: { id: '2', name: 'Wrong' } },
      { rid: '123', name: 'Militan___', crew: { id: '1', name: 'Correct', tag: 'TAG' } },
    ] }));
  };
  try {
    const result = await fetchSocialClubAccount({ username: 'Militan___', rid: '123' }, path => path);
    assert.equal(url, '/external/socialclub/players?name=Militan___&crewForRid=123');
    assert.equal(result.account.crew.name, 'Correct');
    assert.equal((await fetchSocialClubAccount({ username: 'Militan___', rid: '999' }, path => path)).account, null);
    globalThis.fetch = async () => new Response(JSON.stringify({ ok: true, accounts: {} }));
    await assert.rejects(fetchSocialClubAccount({ username: 'Militan___', rid: '123' }, path => path), /formato inválido/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('groups full career sections, translates category names, and preserves award levels', () => {
  const groups = buildCareerGroups([
    { ...row('Skills', 'STAMINA', '100', 'Stamina'), level: '' },
    { ...row('Heists', 'AWD_HEIST', '4', 'The Closer'), level: 'platinum' },
  ], [{ name: 'Skills', label: 'Skills' }, { name: 'Heists', label: 'Heists' }]);
  assert.deepEqual(groups.map(group => [group.name, group.label, group.rows.length]), [
    ['Skills', 'Habilidades', 1], ['Heists', 'Golpes', 1],
  ]);
  assert.equal(groups[1].rows[0].level, 'platinum');
});

test('weapon groups keep unused rows available and rank populated weapons by recorded total kills', () => {
  const groups = buildWeaponGroups([
    row('Pistol', 'PISTOL_KILLS', '1,250', 'Total Kills'),
    row('Pistol', 'PISTOL_HITS', '30', 'Hits'),
    row('RPG', 'RPG_KILLS', '12', 'Total Kills'),
    row('Unused', 'UNUSED_KILLS', '0', 'Total Kills'),
  ], [
    { name: 'Pistol', label: 'Pistol' },
    { name: 'RPG', label: 'RPG' },
    { name: 'Unused', label: 'Unused' },
  ]);
  assert.deepEqual(groups.map(({ name }) => name), ['Pistol', 'RPG', 'Unused']);
  assert.equal(groups[0].kills, 1250, 'Sorting uses the original source precision, not localized display text');
  assert.equal(groups[2].hasRecords, false);
  assert.equal(groups[0].rows.length, 2, 'Every source stat remains available in the weapon card');
});
