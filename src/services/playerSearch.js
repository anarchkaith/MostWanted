import { resolvePlayerRid } from '../../shared/playerIdentity.js';

export function mergePlayerMatches(reported, known, query) {
  const text = query.trim().toLocaleLowerCase();
  if (!text) return [];
  const matches = new Map();
  for (const player of [...reported, ...known]) {
    const nickname = String(player.nickname || '').trim();
    const rid = resolvePlayerRid(player);
    const names = [nickname, ...(player.names || []).map(item => typeof item === 'string' ? item : item?.name)];
    if (!names.some(name => String(name || '').toLocaleLowerCase().includes(text)) && !rid.includes(text)) continue;
    const key = rid ? `rid:${rid}` : `name:${nickname.toLocaleLowerCase()}`;
    const previous = matches.get(key);
    matches.set(key, {
      ...player, nickname, rid, key,
      count: Math.max(Number(player.count) || 0, previous?.count || 0),
      sources: [...new Set([...(previous?.sources || []), player.source || 'Reportes'])],
    });
  }
  return [...matches.values()].sort((a, b) => {
    const exact = item => item.nickname.toLocaleLowerCase() === text || item.rid === text;
    return Number(exact(b)) - Number(exact(a)) || b.count - a.count || a.nickname.localeCompare(b.nickname);
  });
}
