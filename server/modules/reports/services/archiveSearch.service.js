import { searchWordpressArchive } from '../../../reports/wordpressClient.js';
import { hasWordpressReportsConfig } from '../../../reports/wordpressConfig.js';

export async function searchArchive({ config, query, page = 1, logger = console, search = searchWordpressArchive }) {
  const pageNumber = Number(page);
  if (typeof query !== 'string' || !query.trim() || [...query.trim()].length > 100
    || !['string', 'number'].includes(typeof page) || !Number.isSafeInteger(pageNumber) || pageNumber < 1) {
    return { status: 400, payload: { ok: false, error: 'Escribe una búsqueda de hasta 100 caracteres y una página válida.' } };
  }
  if (!hasWordpressReportsConfig(config)) {
    return { status: 503, payload: { ok: false, error: 'La búsqueda completa del archivo requiere configurar WordPress.' } };
  }
  try {
    const { payload } = await search({ config, query: query.trim(), page: pageNumber, logger });
    if (payload.ok !== true || !Array.isArray(payload.items) || typeof payload.hasMore !== 'boolean'
      || !Number.isSafeInteger(payload.total) || payload.total < 0 || payload.page !== pageNumber) {
      throw new Error('invalid_archive_search_response');
    }
    const items = payload.items.map(item => {
      if (typeof item.nickname !== 'string' || typeof item.rid !== 'string'
        || !Array.isArray(item.names) || !item.names.every(name => typeof name === 'string')
        || !Number.isSafeInteger(item.count) || item.count < 0 || !Array.isArray(item.searchMatches)
        || !item.searchMatches.every(match => typeof match.field === 'string' && typeof match.text === 'string')) {
        throw new Error('invalid_archive_search_item');
      }
      return {
        nickname: item.nickname, rid: item.rid, names: item.names, count: item.count,
      };
    });
    return { status: 200, payload: {
      ok: true, items, page: pageNumber, total: payload.total, hasMore: payload.hasMore,
    } };
  } catch (error) {
    logger.error('[reports] No se pudo buscar en el archivo.', { status: error.status || 0, message: error.message });
    return { status: 502, payload: { ok: false, error: 'No se pudo buscar en todo el archivo. Comprueba la conexión y el plugin WordPress 0.6.16 o posterior.' } };
  }
}
