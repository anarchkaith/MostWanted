import { indexCareerRows } from '../../../../shared/careerStats.js';

const HOUR = 3600;
const GTA_MAX_RANK = 8000;

const SEVERITY_ORDER = { alta: 0, media: 1, baja: 2 };

export function formatMoney(amount) {
  const sign = amount < 0 ? '-' : '';
  const value = Math.abs(amount);
  if (value >= 1e9) return `${sign}$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `${sign}$${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `${sign}$${(value / 1e3).toFixed(1)}K`;
  return `${sign}$${Math.round(value)}`;
}

const formatCount = value => Math.round(value).toLocaleString('es-AR');

function amountOf(index, key) {
  const amount = index.get(key)?.parsed?.amount;
  return Number.isFinite(amount) ? amount : null;
}

const ratio = (numerator, denominator) => (
  numerator !== null && denominator !== null && denominator > 0 ? numerator / denominator : null
);

/**
 * Métricas derivadas de una carrera. `statsRows` va primero porque su tiempo de juego
 * ("65d 1h") es más fiable que el de la sección overview.
 */
export function buildCareerMetrics({ overviewRows = [], statsRows = [] }) {
  const index = indexCareerRows(statsRows, overviewRows);
  const wallet = amountOf(index, 'WALLET_BALANCE');
  const bank = amountOf(index, 'BANK_BALANCE');
  const onlineSeconds = amountOf(index, 'MPPLY_TOTAL_TIME_SPENT_FREEMODE') ?? amountOf(index, 'TOTAL_PLAYING_TIME');
  const metrics = {
    rank: amountOf(index, 'Rank'),
    rp: amountOf(index, 'RP'),
    cashBalance: wallet === null && bank === null ? null : (wallet || 0) + (bank || 0),
    totalEarned: amountOf(index, 'MPPLY_TOTAL_EVC'),
    totalSpent: amountOf(index, 'MPPLY_TOTAL_SVC'),
    hoursOnline: onlineSeconds === null ? null : onlineSeconds / HOUR,
    kdRatio: amountOf(index, 'MPPLY_KILL_DEATH_RATIO'),
    playerKills: amountOf(index, 'MPPLY_KILLS_PLAYERS'),
    playerDeaths: amountOf(index, 'MPPLY_DEATHS_PLAYER'),
    shots: amountOf(index, 'SHOTS'),
    hits: amountOf(index, 'HITS_PEDS_VEHICLES'),
    kills: amountOf(index, 'KILLS'),
    headshots: amountOf(index, 'HEADSHOTS'),
    pickedUpMoney: amountOf(index, 'MONEY_EARN_PICKED_UP'),
    receivedMoney: amountOf(index, 'MONEY_EARN_SHARED'),
    jobsMoney: amountOf(index, 'MONEY_EARN_JOBS'),
  };
  metrics.accuracy = ratio(metrics.hits, metrics.shots);
  metrics.headshotRate = ratio(metrics.headshots, metrics.kills);
  metrics.rpPerHour = ratio(metrics.rp, metrics.hoursOnline);
  return metrics;
}

function signal(id, severity, platform, title, detail, value, threshold) {
  return { id, severity, platform, title, detail, value, threshold };
}

/**
 * Señales de incongruencia de una carrera en una plataforma.
 */
export function detectCareerSignals(metrics, platform) {
  const signals = [];
  const add = (...args) => signals.push(signal(...args));

  if (Number.isFinite(metrics.rank) && metrics.rank > GTA_MAX_RANK) {
    add('rank_over_cap', 'alta', platform, 'Rango por encima del máximo del juego',
      `Rango ${formatCount(metrics.rank)}; supera el máximo de ${GTA_MAX_RANK}. Revisá el dato de la fuente: esta incongruencia no demuestra uso de mods.`,
      formatCount(metrics.rank), `> ${GTA_MAX_RANK}`);
  }
  return signals;
}

export function sortSignals(signals) {
  return [...signals].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || a.id.localeCompare(b.id));
}
