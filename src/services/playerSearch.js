import { resolvePlayerRid } from '../../shared/playerIdentity.js';
import { buildApiUrl } from './apiConfig.js';
import { readApiResponse } from './jsonResponse.js';

export async function fetchArchiveSearch({ query, page = 1, signal }, buildUrl = buildApiUrl) {
  const params = new URLSearchParams({ q: query, page: String(page) });
  const response = await fetch(buildUrl(`/reports/search?${params}`), { signal, credentials: 'include' });
  const payload = await readApiResponse(response, 'No se pudo buscar en el archivo.');
  if (payload.ok !== true || !Array.isArray(payload.items) || typeof payload.hasMore !== 'boolean' || !Number.isSafeInteger(payload.total)) {
    throw new Error('La búsqueda del archivo devolvió un formato inválido.');
  }
  return { ...payload, items: payload.items.map(item => ({ ...item, matchedQuery: normalizeSearchText(query) })) };
}

export function normalizeSearchText(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().trim();
}

function texts(value) {
  if (Array.isArray(value)) return value.flatMap(texts);
  if (typeof value === 'string') return [value];
  if (!value || typeof value !== 'object') return [];
  return ['name', 'label', 'detail', 'text'].flatMap(key => typeof value[key] === 'string' ? [value[key]] : []);
}

export function publicSearchFields(item) {
  return [
    ['Nombre', [item.nickname, item.usuario, item.username]],
    ['Alias', [item.names, item.aliases]],
    ['RID', resolvePlayerRid(item)],
    ['Motivo', [item.motivo, item.reason, item.content]],
    ['Infracción', [item.categories, item.categoria, item.typesOfInfraction]],
    ['Etiqueta', [item.labels, item.etiquetas]],
    ['Crew', item.crews],
    ['Resumen', [item.resumen, item.summary, item.aiSummary?.text, item.analysis?.summary, item.analysis?.recommendation]],
  ].flatMap(([field, values]) => texts(values).filter(text => text.trim()).map(text => ({ field, text })));
}

export function searchFieldMatches(fields, query) {
  const terms = normalizeSearchText(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  if (!terms.every(term => fields.some(item => normalizeSearchText(item.text).includes(term)))) return [];
  return fields.filter(item => terms.some(term => normalizeSearchText(item.text).includes(term)));
}

export function mergePlayerMatches(reported, known, query) {
  const text = normalizeSearchText(query);
  if (!text) return [];
  const matches = new Map();
  for (const player of [...reported, ...known]) {
    const nickname = String(player.nickname || '').trim();
    const rid = resolvePlayerRid(player);
    const fields = [...publicSearchFields(player), ...(player.searchMatches || [])];
    const serverMatch = player.matchedQuery === text;
    const searchMatches = serverMatch ? player.searchMatches || [] : searchFieldMatches(fields, query);
    if (!serverMatch && !searchMatches.length) continue;
    const key = rid ? `rid:${rid}` : `name:${nickname.toLocaleLowerCase()}`;
    const previous = matches.get(key);
    matches.set(key, {
      ...player, nickname, rid, key,
      count: Math.max(Number(player.count) || 0, previous?.count || 0),
      names: [...(previous?.names || []), previous?.nickname, ...texts(player.names), ...texts(player.aliases)]
        .map(name => String(name || '').trim())
        .filter((name, index, names) => name && normalizeSearchText(name) !== normalizeSearchText(nickname)
          && names.findIndex(other => normalizeSearchText(other) === normalizeSearchText(name)) === index),
      searchMatches: [...(previous?.searchMatches || []), ...searchMatches]
        .filter((item, index, items) => items.findIndex(other => other.field === item.field && other.text === item.text && other.reportId === item.reportId) === index),
      sources: [...new Set([...(previous?.sources || []), player.source || 'Reportes'])],
    });
  }
  return [...matches.values()].sort((a, b) => {
    const exact = item => normalizeSearchText(item.nickname) === text || item.rid === text;
    return Number(exact(b)) - Number(exact(a)) || b.count - a.count || a.nickname.localeCompare(b.nickname);
  });
}
