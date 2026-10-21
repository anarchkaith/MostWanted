import { getWordpressOwnedReports } from '../../../reports/wordpressClient.js';
import { hasWordpressReportsConfig } from '../../../reports/wordpressConfig.js';
import { publicReport } from '../../expedientes/services/caseReports.service.js';

export async function getOwnedReports({ config, userId, page = 1, logger = console }) {
  if (!/^\d+$/.test(String(userId || ''))) {
    return { status: 401, payload: { ok: false, error: 'Debes iniciar sesión con Discord.' } };
  }
  const pageNumber = Number(page);
  if (!Number.isSafeInteger(pageNumber) || pageNumber < 1) {
    return { status: 400, payload: { ok: false, error: 'La página debe ser un entero positivo.' } };
  }
  if (!hasWordpressReportsConfig(config)) {
    return { status: 503, payload: { ok: false, error: 'La consulta de mis reportes requiere configurar WordPress.' } };
  }
  const perPage = 20;
  try {
    const result = await getWordpressOwnedReports({
      config, ownerDiscordId: String(userId), page: pageNumber, perPage, logger,
    });
    const data = result.payload;
    if (data.ok !== true || !Array.isArray(data.items) || typeof data.hasMore !== 'boolean') {
      throw new Error('invalid_owned_reports_response');
    }
    return { status: 200, payload: {
      ok: true, items: data.items.map(publicReport), page: pageNumber, perPage, hasMore: data.hasMore,
    } };
  } catch (error) {
    logger.error('[reports] No se pudieron consultar los reportes propios.', { status: error.status || 0, message: error.message });
    return { status: 502, payload: { ok: false, error: 'No se pudieron consultar tus reportes. Comprueba la conexión y que el plugin WordPress esté actualizado.' } };
  }
}
