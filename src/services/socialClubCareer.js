import { buildApiUrl } from './apiConfig.js';
import { readApiResponse } from './jsonResponse.js';

export const SOCIAL_CLUB_PLATFORMS = [
  { value: 'pc', label: 'PC' },
  { value: 'ps4', label: 'PlayStation 4' },
  { value: 'ps5', label: 'PlayStation 5' },
  { value: 'xboxone', label: 'Xbox One' },
];

export const DEFAULT_SOCIAL_CLUB_PLATFORM = 'pc';

const WIN_PAIRS = [
  ['Total Races Won', 'Total Races Lost', 'Carreras'],
  ['Total Deathmatches Won', 'Total Deathmatches Lost', 'Deathmatch'],
  ['Total Parachuting Wins', 'Total Parachuting Losses', 'Paracaídas'],
  ['Total Tennis Matches Won', 'Total Tennis Matches Lost', 'Tenis'],
  ['Total Golf Wins', 'Total Golf Losses', 'Golf'],
];

const NUMBER_SUFFIXES = { K: 1e3, M: 1e6, B: 1e9, T: 1e12 };
const CHART_CATEGORY_ORDER = ['Competitive', 'Criminal Record', 'Cash', 'Skills'];

export async function fetchSocialClubCareer({ rid, platform = DEFAULT_SOCIAL_CLUB_PLATFORM, signal }, buildUrl = buildApiUrl) {
  const params = new URLSearchParams({ rid, platform });
  const response = await fetch(buildUrl(`/external/socialclub/career?${params}`), { signal });
  const payload = await readApiResponse(response, 'No se pudo cargar la carrera del jugador.');
  if (!Array.isArray(payload.rows)) throw new Error('La carrera del jugador tiene un formato inválido.');
  return payload;
}

/**
 * Convierte los textos de Social Club ("$288.8M", "24d 20h 31m", "4,258.49 miles")
 * en números para graficar. Devuelve null si el valor no es numérico (p. ej. "Yes").
 */
export function parseStatValue(value) {
  const text = String(value ?? '').trim();
  const money = text.match(/^\$([\d,]+(?:\.\d+)?)([KMBT])?$/);
  if (money) return { kind: 'money', amount: scaled(money[1], money[2]) };

  const count = text.match(/^([\d,]+(?:\.\d+)?)([KMBT])?$/);
  if (count) return { kind: 'count', amount: scaled(count[1], count[2]) };

  const distance = text.match(/^([\d,]+(?:\.\d+)?)\s*miles$/);
  if (distance) return { kind: 'distance', amount: Number(distance[1].replace(/,/g, '')) };

  const clock = text.match(/^(\d+):(\d{2}):(\d{2})$/);
  if (clock) return { kind: 'duration', amount: Number(clock[1]) * 3600 + Number(clock[2]) * 60 + Number(clock[3]) };

  const span = text.match(/^((?:\d+\s*[dhm]\s*)+)$/);
  if (span) {
    const units = { d: 86400, h: 3600, m: 60 };
    const seconds = [...span[1].matchAll(/(\d+)\s*([dhm])/g)].reduce((total, [, amount, unit]) => total + Number(amount) * units[unit], 0);
    return { kind: 'duration', amount: seconds };
  }
  return null;
}

function scaled(number, suffix) {
  return Number(number.replace(/,/g, '')) * (NUMBER_SUFFIXES[suffix] || 1);
}

function byLabel(rows) {
  return new Map(rows.map(row => [row.label, row]));
}

/**
 * Prepara el modelo visual: indicadores de victoria/derrota, barras por categoría y datos de texto.
 */
export function buildCareerModel(rows) {
  const labels = byLabel(rows);
  const overview = rows.filter(row => row.category === 'Overview');
  const duels = WIN_PAIRS.flatMap(([wonLabel, lostLabel, name]) => {
    const won = labels.get(wonLabel);
    const lost = labels.get(lostLabel);
    const wonValue = won && parseStatValue(won.value)?.amount;
    const lostValue = lost && parseStatValue(lost.value)?.amount;
    if (!Number.isFinite(wonValue) || !Number.isFinite(lostValue) || wonValue + lostValue === 0) return [];
    return [{ name, won: wonValue, lost: lostValue, rate: wonValue / (wonValue + lostValue) }];
  });

  const categories = CHART_CATEGORY_ORDER
    .map(name => {
      const categoryRows = rows.filter(row => row.category === name);
      const bars = categoryRows
        .map(row => ({ ...row, parsed: parseStatValue(row.value) }))
        .filter(row => row.parsed && ['count', 'money'].includes(row.parsed.kind));
      const maxByKind = new Map();
      bars.forEach(({ parsed }) => maxByKind.set(parsed.kind, Math.max(maxByKind.get(parsed.kind) || 0, parsed.amount)));
      const items = bars.map(row => {
        const max = name === 'Skills' ? 100 : maxByKind.get(row.parsed.kind);
        return { key: row.key, label: row.label, value: row.value, kind: row.parsed.kind, ratio: max ? Math.min(1, row.parsed.amount / max) : 0 };
      });
      const barKeys = new Set(items.map(item => item.key));
      const texts = categoryRows.filter(row => !barKeys.has(row.key));
      return { name, items, texts };
    })
    .filter(category => category.items.length || category.texts.length);

  return { overview, duels, categories };
}
