import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCareerMetrics, detectCareerSignals } from './careerSignals.js';

const rows = values => Object.entries(values).map(([key, value]) => ({ category: 'Test', key, label: key, value }));
const signalsOf = ({ overview, stats }) => detectCareerSignals(buildCareerMetrics({ overviewRows: rows(overview), statsRows: rows(stats) }), 'pc')
  .map(entry => `${entry.id}:${entry.severity}`).sort();

test('perfil legítimo de larga duración no genera señales', () => {
  assert.deepEqual(signalsOf({
    overview: { Rank: '320', RP: '14.2M', WALLET_BALANCE: '$120,000', BANK_BALANCE: '$9.4M', TOTAL_PLAYING_TIME: '25:31:34' },
    stats: {
      MPPLY_TOTAL_TIME_SPENT_FREEMODE: '65d 12h 21m 56s', MPPLY_TOTAL_EVC: '$1.2B', MPPLY_TOTAL_SVC: '$1.19B',
      MPPLY_KILL_DEATH_RATIO: '0.8', MPPLY_KILLS_PLAYERS: '3,200', MPPLY_DEATHS_PLAYER: '4,000',
      SHOTS: '400,000', HITS_PEDS_VEHICLES: '120,000', KILLS: '60,000', HEADSHOTS: '9,000',
    },
  }), []);
});

test('dinero y estadísticas altas se conservan como información sin generar señales', () => {
  assert.deepEqual(signalsOf({
    overview: { Rank: '8000', RP: '43M', WALLET_BALANCE: '$0', BANK_BALANCE: '$9B' },
    stats: {
      MPPLY_TOTAL_TIME_SPENT_FREEMODE: '9d 5h', MPPLY_TOTAL_EVC: '$312.5M', MPPLY_TOTAL_SVC: '$284.2M',
      MPPLY_KILL_DEATH_RATIO: '99', MPPLY_KILLS_PLAYERS: '90,000', MONEY_EARN_PICKED_UP: '$9B', MONEY_EARN_SHARED: '$9B',
      SHOTS: '10,000', HITS_PEDS_VEHICLES: '20,000', KILLS: '3,000', HEADSHOTS: '3,000',
    },
  }), []);
  const metrics = buildCareerMetrics({ overviewRows: rows({ BANK_BALANCE: '$9B' }), statsRows: rows({ MPPLY_TOTAL_EVC: '$312.5M' }) });
  assert.equal(metrics.cashBalance, 9e9);
  assert.equal(metrics.totalEarned, 312.5e6);
  assert.equal(Object.hasOwn(metrics, 'unexplainedMoney'), false);
});

test('solo se marca un rango finito por encima del máximo, no un rango meramente alto', () => {
  assert.deepEqual(signalsOf({
    overview: { Rank: '8001', WALLET_BALANCE: '$2.2B', BANK_BALANCE: '$0' },
    stats: {
      MPPLY_KILL_DEATH_RATIO: '9.5', MPPLY_KILLS_PLAYERS: '950', MONEY_EARN_PICKED_UP: '$40M',
      SHOTS: '10,000', HITS_PEDS_VEHICLES: '8,500', KILLS: '3,000', HEADSHOTS: '1,900',
    },
  }), ['rank_over_cap:alta']);
  assert.deepEqual(signalsOf({ overview: {}, stats: { MPPLY_KILL_DEATH_RATIO: '20', MPPLY_KILLS_PLAYERS: '40', SHOTS: '100', HITS_PEDS_VEHICLES: '99' } }), []);
  for (const rank of [8000, null, undefined, NaN, Infinity]) {
    assert.deepEqual(detectCareerSignals({ rank }, 'pc'), []);
  }
  assert.match(detectCareerSignals({ rank: 8001 }, 'pc')[0].detail, /no demuestra uso de mods/);
});
