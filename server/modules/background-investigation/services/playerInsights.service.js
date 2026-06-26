/**
 * Construye la respuesta de antecedentes de jugador combinando reportes locales
 * y datos enriquecidos desde sc-cache.
 */
export async function getPlayerInsights({
  rootDir,
  username,
  rid,
  getReportesSnapshot,
  buildPlayerInsightsWithScCache,
}) {
  const normalizedUsername = typeof username === 'string' ? username.trim() : '';
  const normalizedRid = typeof rid === 'string' ? rid.trim() : '';

  if (!normalizedUsername && !normalizedRid) {
    return {
      status: 400,
      payload: {
        ok: false,
        error: 'Debes enviar username o rid para consultar antecedentes del jugador.',
      },
    };
  }

  const reportes = getReportesSnapshot(rootDir);
  const playerInsights = await buildPlayerInsightsWithScCache(reportes, {
    username: normalizedUsername,
    rid: normalizedRid,
  });

  const {
    reportesEncontrados = [],
    scCache = null,
    ...player
  } = playerInsights || {};

  return {
    status: 200,
    payload: {
      ok: true,
      query: {
        username: normalizedUsername || null,
        rid: normalizedRid || null,
      },
      player,
      antecedentes: {
        total: reportesEncontrados.length,
        reportes: reportesEncontrados,
      },
      scCache: scCache || {
        fetched: false,
        names: [],
        error: 'not_requested',
      },
    },
  };
}
