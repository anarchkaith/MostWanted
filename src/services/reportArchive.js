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

export function clearLegacyReportArchive(storage, logger = console) {
  try {
    storage.removeItem(REPORTS_KEY);
    return '';
  } catch (error) {
    logger.error('[reports] No se pudo retirar la copia antigua del archivo.', error);
    return 'No se pudo eliminar la copia antigua de reportes del navegador. Borra los datos locales de este sitio.';
  }
}
