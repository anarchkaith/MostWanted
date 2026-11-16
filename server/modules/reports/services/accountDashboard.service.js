import { getWordpressAccounts } from '../../../reports/wordpressClient.js';

const RECENT_MS = 5 * 60 * 1000;
// Dirección por defecto de cada columna ordenable cuando el cliente no pide una explícita
// (clic en encabezado de tabla o selector "Ordenar"); conserva el orden histórico por columna.
export const SORT_DEFAULT_DIR = { lastAccess: 'desc', reports: 'desc', name: 'asc', firstAccess: 'desc', presence: 'desc' };

export function parseDashboardQuery(query) {
  const integer = (key, fallback) => {
    const raw = query[key] ?? fallback;
    if (!/^\d+$/.test(String(raw)) || !Number.isSafeInteger(Number(raw))) throw new Error('invalid_filters');
    return Number(raw);
  };
  const page = integer('page', 1);
  const minReports = integer('minReports', 0);
  const maxReports = integer('maxReports', Number.MAX_SAFE_INTEGER);
  const status = query.status ?? 'all';
  const sort = query.sort ?? 'lastAccess';
  const dir = query.dir ?? SORT_DEFAULT_DIR[sort];
  const search = query.search ?? '';
  if (page < 1 || minReports > maxReports || typeof search !== 'string' || search.length > 200
      || !['all', 'recent', 'session', 'offline'].includes(status)
      || !Object.keys(SORT_DEFAULT_DIR).includes(sort)
      || !['asc', 'desc'].includes(dir)) throw new Error('invalid_filters');
  return { page, minReports, maxReports, status, sort, dir, search: search.trim().toLocaleLowerCase('es') };
}

export async function readActiveSessions(store, now) {
  const sessions = await new Promise((resolve, reject) => store.all((error, result) => error ? reject(error) : resolve(result)));
  if (!sessions || typeof sessions !== 'object' || Array.isArray(sessions)) throw new Error('invalid_session_store_response');
  const byUser = new Map();
  for (const session of Object.values(sessions)) {
    const userId = session?.authUser?.id;
    const expires = Date.parse(session?.cookie?.expires);
    if (!userId || !Number.isFinite(expires) || expires <= now) continue;
    const list = byUser.get(userId) || [];
    list.push({
      loggedAt: session.authUser.loggedAt || null,
      lastActivity: Number.isFinite(session.lastActivityAt) ? new Date(session.lastActivityAt).toISOString() : null,
      expiresAt: new Date(expires).toISOString(),
    });
    byUser.set(userId, list);
  }
  return byUser;
}

export async function getAccountDashboard({ config, sessionStore, filters, now = Date.now(), readAccounts = getWordpressAccounts }) {
  const byUser = await readActiveSessions(sessionStore, now);
  const accounts = new Map();
  let page = 1;
  let hasMore;
  do {
    const { payload } = await readAccounts({ config, page });
    if (payload?.ok !== true || !Array.isArray(payload.items) || typeof payload.hasMore !== 'boolean'
        || (payload.hasMore && !payload.items.length)) throw new Error('invalid_private_accounts_response');
    for (const item of payload.items) {
      if (!/^\d+$/.test(item?.identity?.id) || !Array.isArray(item.reportIds)
          || item.reportIds.some(id => !Number.isSafeInteger(id) || id < 1)
          || !Number.isSafeInteger(item.reportCount) || item.reportCount < item.reportIds.length
          || !Array.isArray(item.loginHistory) || item.loginHistory.some(moment => typeof moment !== 'string' || !Number.isFinite(Date.parse(moment)))
          || accounts.has(item.identity.id)) throw new Error('invalid_private_accounts_response_update_plugin');
      const sessions = byUser.get(item.identity.id) || [];
      accounts.set(item.identity.id, {
        ...item,
        sessions,
        sessionCount: sessions.length,
        recentlyActive: sessions.some(session => {
          const at = Date.parse(session.lastActivity);
          return at <= now && now - at <= RECENT_MS;
        }),
      });
    }
    hasMore = payload.hasMore;
    page++;
  } while (hasMore);

  const all = [...accounts.values()];
  const summary = {
    users: all.length,
    reports: all.reduce((sum, item) => sum + item.reportCount, 0),
    usersWithSession: byUser.size,
    sessions: [...byUser.values()].reduce((sum, items) => sum + items.length, 0),
    recentlyActive: [...byUser.values()].filter(items => items.some(session => {
      const at = Date.parse(session.lastActivity);
      return at <= now && now - at <= RECENT_MS;
    })).length,
    unsyncedUsers: [...byUser.keys()].filter(id => !accounts.has(id)).length,
  };
  const items = all.filter(item => {
    const matchesText = ['id', 'username', 'globalName', 'email']
      .some(key => String(item.identity[key] || '').toLocaleLowerCase('es').includes(filters.search));
    const matchesStatus = filters.status === 'all' || (filters.status === 'recent' && item.recentlyActive)
      || (filters.status === 'session' && item.sessionCount > 0) || (filters.status === 'offline' && item.sessionCount === 0);
    return matchesText && matchesStatus && item.reportCount >= filters.minReports && item.reportCount <= filters.maxReports;
  });
  const date = value => Date.parse(value) || 0;
  const presenceScore = item => (item.recentlyActive ? 2 : item.sessionCount > 0 ? 1 : 0);
  const sortValue = item => {
    switch (filters.sort) {
      case 'reports': return item.reportCount;
      case 'name': return (item.identity.globalName || item.identity.username || '').toLocaleLowerCase('es');
      case 'firstAccess': return date(item.firstAccess);
      case 'presence': return presenceScore(item);
      default: return date(item.lastAccess);
    }
  };
  const dirSign = filters.dir === 'asc' ? 1 : -1;
  items.sort((a, b) => {
    const valueA = sortValue(a);
    const valueB = sortValue(b);
    const order = typeof valueA === 'string' ? dirSign * valueA.localeCompare(valueB, 'es') : dirSign * (valueA - valueB);
    return order || a.identity.id.localeCompare(b.identity.id);
  });
  const offset = (filters.page - 1) * 20;
  return {
    ok: true, items: items.slice(offset, offset + 20), total: items.length,
    hasMore: offset + 20 < items.length, summary,
    generatedAt: new Date(now).toISOString(), recentWindowMinutes: 5,
  };
}
