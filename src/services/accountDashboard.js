export function validateAccountDashboard(payload) {
  const count = value => Number.isSafeInteger(value) && value >= 0;
  const date = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
  if (payload?.ok !== true || !Array.isArray(payload.items) || !count(payload.total)
      || typeof payload.hasMore !== 'boolean' || !date(payload.generatedAt) || payload.recentWindowMinutes !== 5
      || !['users', 'reports', 'usersWithSession', 'sessions', 'recentlyActive', 'unsyncedUsers'].every(key => count(payload.summary?.[key]))
      || payload.items.some(item => !item?.identity?.id || !count(item.reportCount) || !count(item.loginCount)
        || !count(item.sessionCount) || typeof item.recentlyActive !== 'boolean'
        || !Array.isArray(item.reportIds) || item.reportIds.some(id => !Number.isSafeInteger(id) || id < 1)
        || !Array.isArray(item.sessions) || item.sessions.length !== item.sessionCount
        || item.sessions.some(session => !date(session.expiresAt)))) {
    throw new Error('El panel recibió datos inválidos. Actualiza el backend y el plugin WordPress.');
  }
  return payload;
}
