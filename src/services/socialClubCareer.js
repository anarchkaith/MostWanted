import { buildApiUrl } from './apiConfig.js';
import { readApiResponse } from './jsonResponse.js';
import { parseStatValue } from '../../shared/careerStats.js';
import { normalizeSearchText } from './playerSearch.js';
import { CAREER_LABELS_ES } from './socialClubCareerEs.js';

export const SOCIAL_CLUB_PLATFORMS = [
  { value: 'pcalt', label: 'PC Enhanced' },
  { value: 'pc', label: 'PC Legacy' },
  { value: 'ps4', label: 'PlayStation 4' },
  { value: 'ps5', label: 'PlayStation 5' },
  { value: 'xboxone', label: 'Xbox One' },
  { value: 'xboxsx', label: 'Xbox Series X/S' },
];

export const DEFAULT_SOCIAL_CLUB_PLATFORM = 'pc';

export const SOCIAL_CLUB_CAREER_SECTIONS = [
  { value: 'overview', label: 'Resumen' },
  { value: 'stats', label: 'Estadísticas' },
  { value: 'weapons', label: 'Armas' },
  { value: 'vehicles', label: 'Vehículos' },
  { value: 'awards', label: 'Premios' },
];

const CATEGORY_LABELS = {
  Career: 'Carrera',
  Skills: 'Habilidades',
  Crime: 'Crimen',
  Crimes: 'Delitos',
  Money: 'Dinero',
  Combat: 'Combate',
  Weapons: 'Armas',
  Vehicles: 'Vehículos',
  Victory: 'Victoria',
  Heists: 'Golpes',
  Rewards: 'Recompensas',
  General: 'General',
  Doomsday: 'Golpe del Juicio Final',
  'After Hours': 'Noctámbulos',
  'Arena War': 'Arena de guerra',
  'Diamond Casino Heist': 'Golpe al Diamond Casino',
  'Los Santos Summer Special': 'Especial de verano de Los Santos',
  'Cayo Perico Heist': 'Golpe a Cayo Perico',
  'The Contract': 'El contrato',
  'Los Santos Drug Wars': 'Guerra de drogas en Los Santos',
  'The Chop Shop': 'El desguace',
  'Cluckin’ Bell Farm Raid': 'Asalto a la granja de Cluckin’ Bell',
  'Bottom Dollar Bounties': 'Cazarrecompensas de Bottom Dollar',
  'Agents of Sabotage': 'Agentes de sabotaje',
  'Oscar Guzman Flies Again': 'Oscar Guzman vuelve a volar',
  'Money Fronts': 'Negocios de fachada',
  'A Safehouse in the Hills': 'Un refugio en las colinas',
  'The Kortz Center Heist': 'Golpe al Centro Kortz',
};

const COMPETITIVE_RESULTS = [
  { name: 'Carreras', wins: 'MPPLY_TOTAL_RACES_WON', other: 'MPPLY_TOTAL_RACES_LOST', detail: 'MPPLY_TOTAL_TIME_SPENT_RACES' },
  { name: 'Partidas a muerte', wins: 'MPPLY_TOTAL_DEATHMATCH_WON', other: 'MPPLY_TOTAL_DEATHMATCH_LOST', detail: 'MPPLY_TOTAL_TIME_SPENT_DEATHMAT' },
  { name: 'Paracaídas', wins: 'MPPLY_BJ_WINS', other: 'MPPLY_BJ_LOST', detail: 'AWD_FMBASEJMP' },
  { name: 'Dardos', wins: 'MPPLY_DARTS_TOTAL_WINS', other: 'MPPLY_DARTS_TOTAL_MATCHES', detail: 'AWD_FM6DARTCHKOUT', total: true },
  { name: 'Tenis', wins: 'MPPLY_TENNIS_MATCHES_WON', other: 'MPPLY_TENNIS_MATCHES_LOST', detail: 'AWD_FM_TENNIS_ACE' },
  { name: 'Golf', wins: 'MPPLY_GOLF_WINS', other: 'MPPLY_GOLF_LOSSES', detail: 'AWD_FM_GOLF_HOLE_IN_1' },
];

const MONEY_TOTALS = new Set(['MPPLY_TOTAL_EVC', 'MPPLY_TOTAL_SVC']);
const MONEY_SOURCES = new Set([
  'MONEY_EARN_JOBS', 'MONEY_EARN_SELLING_VEH', 'MONEY_EARN_BETTING',
  'MONEY_EARN_GOOD_SPORT', 'MONEY_EARN_PICKED_UP', 'MONEY_EARN_SHARED', 'MONEY_EARN_JOBSHARED',
]);
const KNOWN_CATEGORIES = new Set(['Overview', 'Competitive', 'Criminal Record', 'Cash', 'Skills']);

const STAT_LABELS = {
  Rank: 'Rango',
  RP: 'RP',
  WALLET_BALANCE: 'Efectivo',
  BANK_BALANCE: 'Banco',
  TOTAL_PLAYING_TIME: 'Tiempo de juego',
  MPPLY_TOTAL_RACES_WON: 'Carreras ganadas',
  MPPLY_TOTAL_RACES_LOST: 'Carreras perdidas',
  MPPLY_TOTAL_TIME_SPENT_RACES: 'Tiempo en carreras',
  MPPLY_TOTAL_DEATHMATCH_WON: 'Partidas a muerte ganadas',
  MPPLY_TOTAL_DEATHMATCH_LOST: 'Partidas a muerte perdidas',
  MPPLY_TOTAL_TIME_SPENT_DEATHMAT: 'Tiempo en partidas a muerte',
  MPPLY_BJ_WINS: 'Paracaidismos ganados',
  MPPLY_BJ_LOST: 'Paracaidismos perdidos',
  AWD_FMBASEJMP: 'Objetivos de paracaídas',
  MPPLY_DARTS_TOTAL_WINS: 'Victorias en dardos',
  MPPLY_DARTS_TOTAL_MATCHES: 'Partidas de dardos',
  AWD_FM6DARTCHKOUT: 'Cierres de 6 dardos',
  MPPLY_TENNIS_MATCHES_WON: 'Partidos de tenis ganados',
  MPPLY_TENNIS_MATCHES_LOST: 'Partidos de tenis perdidos',
  AWD_FM_TENNIS_ACE: 'Saques directos en tenis',
  MPPLY_GOLF_WINS: 'Partidas de golf ganadas',
  MPPLY_GOLF_LOSSES: 'Partidas de golf perdidas',
  AWD_FM_GOLF_HOLE_IN_1: 'Hoyo en uno',
  KILLS_COP: 'Policías eliminados',
  KILLS_SWAT: 'Miembros de NOOSE eliminados',
  NO_TIMES_WANTED_LEVEL: 'Veces buscado',
  STARS_ATTAINED: 'Estrellas obtenidas',
  STARS_EVADED: 'Estrellas evadidas',
  TOTAL_CHASE_TIME: 'Tiempo con búsqueda',
  VEHEXPORTED: 'Vehículos exportados',
  AWD_VEHICLES_JACKEDR: 'Vehículos robados',
  TOTAL_NO_SHOPS_HELD_UP: 'Tiendas atracadas',
  MONEY_EARN_JOBS: 'Trabajos',
  MONEY_EARN_SELLING_VEH: 'Venta de vehículos',
  MONEY_EARN_BETTING: 'Apuestas',
  MONEY_EARN_GOOD_SPORT: 'Buen comportamiento',
  MONEY_EARN_PICKED_UP: 'Dinero recogido',
  MONEY_EARN_SHARED: 'Dinero compartido',
  MONEY_EARN_JOBSHARED: 'Compartido en trabajos',
  MPPLY_TOTAL_EVC: 'Ingresos registrados',
  MPPLY_TOTAL_SVC: 'Gastos registrados',
  CHAR_DIST_TRAVELLED: 'Distancia recorrida',
  STAMINA: 'Resistencia',
  STEALTH_ABILITY: 'Sigilo',
  LUNG_CAPACITY: 'Capacidad pulmonar',
  FLYING_ABILITY: 'Vuelo',
  SHOOTING_ABILITY: 'Puntería',
  STRENGTH: 'Fuerza',
  WHEELIE_ABILITY: 'Conducción',
  PLAYER_MENTAL_STATE: 'Estado mental',
};

export async function fetchSocialClubCareer({
  rid, platform = DEFAULT_SOCIAL_CLUB_PLATFORM, section = 'overview', signal,
}, buildUrl = buildApiUrl) {
  const params = new URLSearchParams({ rid, platform, section });
  const response = await fetch(buildUrl(`/external/socialclub/career?${params}`), { signal });
  const payload = await readApiResponse(response, 'No se pudo cargar la carrera del jugador.');
  if (!Array.isArray(payload.rows)) throw new Error('La carrera del jugador tiene un formato inválido.');
  return payload;
}

export { parseStatValue };

export async function fetchSocialClubAccount({ username, rid, signal }, buildUrl = buildApiUrl) {
  const params = new URLSearchParams({ name: username, crewForRid: rid });
  const response = await fetch(buildUrl(`/external/socialclub/players?${params}`), { signal });
  const payload = await readApiResponse(response, 'No se pudo consultar la crew de Social Club.');
  if (!Array.isArray(payload.accounts)) throw new Error('La búsqueda de Social Club tiene un formato inválido.');
  const account = payload.accounts.find(entry => String(entry.rid) === String(rid)) || null;
  return { account, crewDetails: payload.crewDetails };
}

export function careerCategoryLabel(category) {
  return Object.hasOwn(CATEGORY_LABELS, category) ? CATEGORY_LABELS[category] : category;
}

export function buildCareerGroups(rows, categories = []) {
  const ordered = categories.length
    ? categories
    : [...new Set(rows.map(row => row.category).filter(Boolean))].map(name => ({ name, label: name }));
  return ordered.map(category => ({
    ...category,
    label: careerCategoryLabel(category.label || category.name),
    rows: rows.filter(row => row.category === category.name).map(row => {
      const displayed = displayRow(row);
      if (category.name !== 'Skills') return displayed;
      const amount = amountOf(row, 'count');
      return amount !== null && amount <= 100 ? { ...displayed, skillAmount: amount } : displayed;
    }),
  }));
}

export function searchCareerGroups(groups, query) {
  const terms = normalizeSearchText(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return groups;
  return groups.map(group => ({
    ...group,
    rows: group.rows.filter(row => {
      const text = normalizeSearchText(`${group.label} ${row.label} ${row.value}`);
      return terms.every(term => text.includes(term));
    }),
  })).filter(group => group.rows.length);
}

export function buildWeaponGroups(rows, categories = []) {
  const ordered = categories.length
    ? categories
    : [...new Set(rows.map(row => row.category).filter(Boolean))].map(name => ({ name, label: name }));
  const groups = ordered.map((category, index) => {
    const sourceRows = rows.filter(row => row.category === category.name);
    const displayedRows = sourceRows.map(displayRow);
    const totalKills = sourceRows.find(row => row.label === 'Total Kills');
    const parsedKills = parseStatValue(totalKills?.value);
    return {
      ...category,
      label: careerCategoryLabel(category.label || category.name),
      rows: displayedRows,
      index,
      kills: parsedKills?.kind === 'count' ? parsedKills.amount : -1,
      hasRecords: sourceRows.some(row => !/^[0\s:.,%$-]*$/.test(row.value)),
      searchable: `${category.label} ${displayedRows.map(row => row.label).join(' ')}`.toLocaleLowerCase(),
    };
  });
  return groups.sort((left, right) => Number(right.hasRecords) - Number(left.hasRecords)
    || right.kills - left.kills || left.index - right.index);
}

export async function fetchPlayerIntel({ username = '', rid = '', signal }, buildUrl = buildApiUrl) {
  const params = new URLSearchParams();
  if (username) params.set('username', username);
  if (rid) params.set('rid', rid);
  const response = await fetch(buildUrl(`/players/intel?${params}`), { signal, credentials: 'include' });
  const payload = await readApiResponse(response, 'No se pudo cargar el análisis de incongruencias.');
  if (!Array.isArray(payload.signals) || !Array.isArray(payload.platforms)) throw new Error('El análisis de incongruencias tiene un formato inválido.');
  return payload;
}

function displayValue(value) {
  const text = String(value ?? '').trim();
  if (/^yes$/i.test(text)) return 'Sí';
  if (/^no$/i.test(text)) return 'No';
  if (/^(?:n\/a|not available)$/i.test(text)) return 'Sin datos';
  if (/^(?:\d+\s*[dhms]\s*)+$/i.test(text)) {
    return [...text.matchAll(/(\d+)\s*([dhms])/gi)].map(([, amount, unit]) => `${amount} ${unit.toLowerCase()}`).join(' ');
  }
  if (/^[\d,.]+\s*\/\s*[\d,.]+$/.test(text)) return text.split('/').map(displayValue).join(' / ');
  const number = text.match(/^(\$?)([\d,]+(?:\.\d+)?)([KMBT])?(?:\s*(miles|ft|mph|%))?$/i);
  if (!number) return text;
  const [whole, fraction] = number[2].split('.');
  const localized = `${whole.replace(/,/g, '.')}${fraction ? `,${fraction}` : ''}`;
  const unit = { miles: ' millas', ft: ' pies', mph: ' mi/h', '%': ' %' }[number[4]?.toLowerCase()] ?? '';
  return `${number[1]}${localized}${number[3] ? ` ${number[3].toUpperCase()}` : ''}${unit}`;
}

function displayRow(row) {
  const sourceLabel = (row.label || row.key).replace(/&amp;/g, '&');
  const weapon = row.category === 'Weapons' ? sourceLabel.match(/^(.+) kills$/i) : null;
  const label = Object.hasOwn(STAT_LABELS, row.key) ? STAT_LABELS[row.key]
    : Object.hasOwn(CAREER_LABELS_ES, sourceLabel) ? CAREER_LABELS_ES[sourceLabel]
      : weapon ? `Bajas con ${weapon[1]}` : sourceLabel;
  return { ...row, label, value: displayValue(row.value) };
}

function amountOf(row, kind) {
  const parsed = row && parseStatValue(row.value);
  return parsed?.kind === kind && Number.isFinite(parsed.amount) && parsed.amount >= 0 ? parsed.amount : null;
}

export function buildCareerModel(rows) {
  const overview = rows.filter(row => row.category === 'Overview').map(displayRow);
  const competitiveRows = rows.filter(row => row.category === 'Competitive');
  const assigned = new Set();
  const competitive = COMPETITIVE_RESULTS.flatMap(result => {
    const records = competitiveRows.filter(row => [result.wins, result.other, result.detail].includes(row.key));
    if (!records.length) return [];
    records.forEach(row => assigned.add(row));
    const winsRow = records.find(row => row.key === result.wins);
    const otherRow = records.find(row => row.key === result.other);
    const wins = amountOf(winsRow, 'count');
    const other = amountOf(otherRow, 'count');
    const total = result.total ? other : wins + other;
    const comparable = Number.isSafeInteger(wins) && Number.isSafeInteger(other)
      && Number.isSafeInteger(total) && (!result.total || wins <= other);
    const primary = [winsRow, otherRow].filter(Boolean).map(displayRow);
    if (winsRow) primary[0].label = 'Victorias';
    if (otherRow) primary[primary.length - 1].label = result.total ? 'Partidas' : 'Derrotas';
    return [{
      name: result.name,
      primary,
      details: records.filter(row => row !== winsRow && row !== otherRow).map(displayRow),
      rate: comparable && total > 0 ? wins / total : null,
      approximate: comparable && total > 0 && [winsRow, otherRow].some(row => /[KMBT]$/i.test(row.value.trim())),
    }];
  });
  const unassigned = competitiveRows.filter(row => !assigned.has(row)).map(displayRow);
  if (unassigned.length) competitive.push({ name: 'Sin actividad identificada', primary: [], details: unassigned, rate: null, approximate: false });
  const criminal = rows.filter(row => row.category === 'Criminal Record').map(displayRow);

  const cashRows = rows.filter(row => row.category === 'Cash');
  const totalRows = cashRows.filter(row => MONEY_TOTALS.has(row.key));
  const totalAmounts = totalRows.map(row => amountOf(row, 'money'));
  const comparable = totalRows.length === 2 && new Set(totalRows.map(row => row.key)).size === 2
    && totalAmounts.every(amount => amount !== null);
  const totalMax = comparable ? Math.max(...totalAmounts) : 0;
  const totals = totalRows.map((row, index) => ({
    ...displayRow(row),
    ratio: comparable ? (totalMax > 0 ? totalAmounts[index] / totalMax : 0) : null,
  }));
  const sourceRows = cashRows.filter(row => MONEY_SOURCES.has(row.key) && amountOf(row, 'money') !== null);
  const sourceMax = Math.max(0, ...sourceRows.map(row => amountOf(row, 'money')));
  const sources = sourceRows.map(row => ({
    ...displayRow(row),
    amount: amountOf(row, 'money'),
    ratio: sourceMax > 0 ? amountOf(row, 'money') / sourceMax : 0,
  })).sort((a, b) => b.amount - a.amount);
  const cashDetails = cashRows.filter(row => !totalRows.includes(row) && !sourceRows.includes(row)).map(displayRow);

  const skillRows = rows.filter(row => row.category === 'Skills');
  const skills = skillRows.flatMap(row => {
    const amount = amountOf(row, 'count');
    return amount !== null && amount <= 100 ? [{ ...displayRow(row), amount }] : [];
  });
  const skillDetails = skillRows.filter(row => {
    const amount = amountOf(row, 'count');
    return amount === null || amount > 100;
  }).map(displayRow);
  const additional = [...new Set(rows.map(row => row.category).filter(category => !KNOWN_CATEGORIES.has(category)))]
    .map(category => ({
      name: category || 'Otros',
      rows: rows.filter(row => row.category === category).map(displayRow),
    }));

  return { overview, competitive, criminal, cash: { totals, sources, details: cashDetails }, skills, skillDetails, additional };
}
