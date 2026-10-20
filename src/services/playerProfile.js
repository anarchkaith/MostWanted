import { getPlayerAvatarUrl } from './playerAvatars.js';

const text = value => String(value ?? '').trim();
const list = value => Array.isArray(value) ? value : [];
const unix = value => {
  if (!value) return 0;
  if (Number.isFinite(Number(value))) return Number(value) > 1e12 ? Math.floor(Number(value) / 1000) : Number(value);
  const parsed = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value);
  return Number.isFinite(parsed) ? Math.floor(parsed / 1000) : 0;
};

export function mergePlayerProfile({ username = '', rid = '', profile = null, reportInsights = null, reports = [], currentAvatars = [] }) {
  const names = new Map();
  const crews = new Map();
  const avatars = new Map();
  const currentUrls = new Set([
    ...(rid ? [0, 1].map(index => getPlayerAvatarUrl(rid, index)) : []),
    ...currentAvatars.flatMap(avatar => typeof avatar === 'string' ? [avatar] : [avatar?.avatarUrl, avatar?.avatarDataUrl]),
  ].filter(Boolean));
  const addObservation = (collection, value, time, source, reportId = null) => {
    const name = text(typeof value === 'string' ? value : value?.name || value?.raw);
    if (!name) return;
    const key = name.toLowerCase();
    const entry = collection.get(key) || { name, time: 0, source: '', url: '', observations: [] };
    entry.time = Math.max(entry.time, unix(time));
    entry.url ||= text(value?.url);
    if (source) {
      const previous = entry.observations.find(item => item.source === source);
      if (previous) previous.time = Math.max(previous.time, unix(time));
      else entry.observations.push({ source, time: unix(time), reportId });
    }
    entry.source = entry.observations.map(item => item.source).join(' · ');
    collection.set(key, entry);
  };
  const addName = (value, time, source, reportId) => addObservation(names, value, time, source, reportId);
  const addCrew = (value, time, source, reportId) => addObservation(crews, value, time, source, reportId);
  const addAvatar = (value, time, source) => {
    const url = text(typeof value === 'string' ? value : value?.url || value?.avatarUrl);
    if (!/^https?:\/\//i.test(url) || currentUrls.has(url)) return;
    const key = url;
    const entry = { avatarUrl: url, time: unix(time), source, available: true };
    const previous = avatars.get(key);
    const sources = [...new Set([...(previous?.sources || []), source].filter(Boolean))];
    avatars.set(key, { ...entry, sources, source: sources.join(' / '), time: Math.max(previous?.time || 0, entry.time) });
  };
  // Insights aggregate reports; they must not create another source.
  const archive = '';
  for (const entry of list(reportInsights?.names)) addName(typeof entry === 'string' ? entry : entry?.name, entry?.time, archive);
  for (const entry of list(reportInsights?.aliases)) addName(typeof entry === 'string' ? entry : entry?.alias || entry?.name, entry?.time, archive);
  addName(reportInsights?.username, reportInsights?.lastReportAt, archive);
  for (const crew of list(reportInsights?.crews)) addCrew(crew, 0, archive);
  for (const crew of list(reportInsights?.crewHistory)) addCrew(crew, crew?.lastSeen || crew?.time, archive);
  for (const avatar of list(reportInsights?.avatars)) addAvatar(avatar, 0, archive);
  for (const avatar of list(reportInsights?.avatarHistory)) addAvatar(avatar, avatar?.lastSeen || avatar?.time, archive);
  for (const report of reports) {
    const source = `Reporte #${report.id}`;
    const time = report.fecha || report.createdAt;
    addName(report.usuario || report.nickname, time, source, report.id);
    for (const alias of list(report.aliases)) addName(alias, time, source, report.id);
    for (const crew of list(report.crews)) addCrew(crew, time, source, report.id);
    addAvatar(report.avatar1, time, source);
    addAvatar(report.avatar2, time, source);
  }
  const current = 'Social Club';
  addName(profile?.name, profile?.lastSeenUnix, current);
  for (const entry of list(profile?.nameHistory)) addName(entry?.name, entry?.time, current);
  for (const alias of list(profile?.aliases)) addName(alias, 0, current);
  for (const crew of list(profile?.crews)) addCrew(crew, 0, current);
  if (profile?.activeCrew) addCrew(profile.activeCrew, 0, current);
  const nameHistory = [...names.values()].sort((a, b) => b.time - a.time);
  return {
    name: profile?.name || reportInsights?.username || username || `RID ${rid}`,
    aliases: [...new Set(nameHistory.map(entry => entry.name))],
    nameHistory,
    crews: [...new Set([...crews.values()].map(entry => entry.name))],
    crewHistory: [...crews.values()].sort((a, b) => b.time - a.time),
    historicalAvatars: [...avatars.values()].sort((a, b) => b.time - a.time),
  };
}
