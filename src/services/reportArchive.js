import { assignExpedienteIds } from './expedienteIds.js';
import { mapWordpressReportToReporte, normalizeReporte } from './reportViewModel.js';

const REPORTS_KEY = 'mostwanted_reportes';
const VOTES_KEY = 'mostwanted_user_votes';

export function readUserVotes(storage, logger = console) {
  try {
    const votes = JSON.parse(storage.getItem(VOTES_KEY) || '{}');
    if (!votes || typeof votes !== 'object' || Array.isArray(votes)) throw new Error('invalid_stored_votes');
    return votes;
  } catch (error) {
    logger.error('[reports] No se pudieron leer los votos locales.', error);
    return {};
  }
}

export function prepareReportArchive(reports, votes) {
  return assignExpedienteIds(reports.map(report => ({
    ...normalizeReporte(report),
    userVote: votes[report.id] || report.userVote || null,
  })));
}

export async function loadReportArchive({ fetchPage, storage, signal, logger = console }) {
  let reports;
  try {
    const items = [];
    for (let page = 1; ; page += 1) {
      const snapshot = await fetchPage({ perPage: 100, page, signal });
      signal?.throwIfAborted();
      if (!Array.isArray(snapshot?.items)) throw new Error('invalid_reports_snapshot');
      items.push(...snapshot.items);
      if (snapshot.items.length < 100) break;
    }
    reports = items.map(mapWordpressReportToReporte);
  } catch (error) {
    if (signal?.aborted) throw error;
    logger.error('[reports] No se pudo actualizar el archivo de WordPress.', error);
    let cached;
    try {
      cached = JSON.parse(storage.getItem(REPORTS_KEY) || '[]');
      if (!Array.isArray(cached)) throw new Error('invalid_stored_reports');
    } catch (cacheError) {
      logger.error('[reports] No se pudo leer el archivo local.', cacheError);
      throw new Error('No se pudo actualizar el archivo ni leer su copia local. Comprueba la conexión e inténtalo de nuevo.');
    }
    return { reports: cached, warning: 'No se pudo actualizar el archivo. Las coincidencias locales pueden estar desactualizadas.' };
  }
  try {
    storage.setItem(REPORTS_KEY, JSON.stringify(reports));
  } catch (error) {
    logger.error('[reports] No se pudo guardar la copia local del archivo.', error);
    return { reports, warning: 'El archivo está actualizado, pero no se pudo guardar su copia local.' };
  }
  return { reports, warning: '' };
}
